import { NextRequest, NextResponse } from 'next/server';
import { normalizeIdentifier } from '@/lib/parsers/identifier-normalizer';
import { resolveEuropePmcArticle } from '@/lib/parsers/europe-pmc';
import { fetchCrossrefMetadata } from '@/lib/parsers/crossref';
import { extractBiomedicalPdf } from '@/lib/parsers/pdf-extractor';
import { cleanBiomedicalTitle, cleanBiomedicalAuthors } from '@/lib/parsers/title-sanitizer';
import { buildVancouverCitation } from '@/lib/parsers/vancouver-formatter';
import { ParsedManuscriptPayload } from '@/lib/schemas/ingestion.schema';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept:
    'application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawInput = body?.rawInput;

    if (!rawInput || typeof rawInput !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid identifier input' }, { status: 400 });
    }

    const normalized = normalizeIdentifier(rawInput);
    const isDirectUrl =
      normalized.type === 'URL' || /^https?:\/\//i.test(normalized.normalizedValue);

    // -------------------------------------------------------------
    // 1. DIRECT URL INGESTION ENGINE (PDFs & OPEN-ACCESS WEBPAGES)
    // -------------------------------------------------------------
    if (isDirectUrl) {
      const targetUrl = normalized.normalizedValue;

      try {
        const fetchRes = await fetch(targetUrl, {
          method: 'GET',
          headers: BROWSER_HEADERS,
          redirect: 'follow',
        });

        if (fetchRes.ok) {
          const contentType = fetchRes.headers.get('content-type') || '';
          const isPdfUrl =
            targetUrl.toLowerCase().includes('.pdf') ||
            contentType.toLowerCase().includes('application/pdf') ||
            contentType.toLowerCase().includes('application/octet-stream');

          // 1A. Direct PDF Binary Ingestion
          if (isPdfUrl) {
            const arrayBuffer = await fetchRes.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const extracted = await extractBiomedicalPdf(uint8Array);

            const payload: ParsedManuscriptPayload = {
              id: crypto.randomUUID(),
              metadata: {
                title: extracted.metadata.title,
                authors: extracted.metadata.authors,
                journal: extracted.metadata.journal || 'Biomedical Science and Clinical Research',
                publicationYear: extracted.metadata.year || new Date().getFullYear(),
                doi: extracted.metadata.doi,
                vancouverCitation: extracted.metadata.vancouverCitation,
                sourceDepth: 'FULL_TEXT_PDF',
                openAccess: true,
                resolvedUrl: targetUrl,
              },
              abstract: extracted.abstract,
              fullText: extracted.text,
              sections: extracted.sections,
              tablesRaw: [],
              pageCount: extracted.pageCount,
              extractedAt: new Date().toISOString(),
            };

            return NextResponse.json(payload);
          }

          // 1B. HTML Open-Access Article Ingestion
          const html = await fetchRes.text();

          // Check if the HTML links to a full-text PDF via Highwire / Dublin Core meta tags
          const pdfMetaMatch = html.match(
            /<meta\s+name=["'](?:citation_pdf_url|dc\.relation\.isformatof)["']\s+content=["']([^"']+)["']/i
          );
          if (pdfMetaMatch && pdfMetaMatch[1]) {
            try {
              const fullPdfUrl = new URL(pdfMetaMatch[1], targetUrl).toString();
              const pdfRes = await fetch(fullPdfUrl, {
                headers: BROWSER_HEADERS,
                redirect: 'follow',
              });
              if (pdfRes.ok) {
                const pdfBuf = await pdfRes.arrayBuffer();
                const extracted = await extractBiomedicalPdf(new Uint8Array(pdfBuf));
                const payload: ParsedManuscriptPayload = {
                  id: crypto.randomUUID(),
                  metadata: {
                    title: extracted.metadata.title,
                    authors: extracted.metadata.authors,
                    journal: extracted.metadata.journal || 'Biomedical Journal',
                    publicationYear: extracted.metadata.year || new Date().getFullYear(),
                    doi: extracted.metadata.doi,
                    vancouverCitation: extracted.metadata.vancouverCitation,
                    sourceDepth: 'FULL_TEXT_PDF',
                    openAccess: true,
                    resolvedUrl: fullPdfUrl,
                  },
                  abstract: extracted.abstract,
                  fullText: extracted.text,
                  sections: extracted.sections,
                  tablesRaw: [],
                  pageCount: extracted.pageCount,
                  extractedAt: new Date().toISOString(),
                };
                return NextResponse.json(payload);
              }
            } catch (pdfFollowErr) {
              console.warn('Could not follow citation_pdf_url, falling back to HTML parsing:', pdfFollowErr);
            }
          }

          // Parse Article Metadata from HTML Meta Tags
          const titleMatch = html.match(/<meta\s+name=["'](?:citation_title|dc\.title|title)["']\s+content=["']([^"']+)["']/i);
          const rawTitle = titleMatch ? titleMatch[1] : (html.match(/<title>([^<]+)<\/title>/i)?.[1] || '');
          const cleanTitle = cleanBiomedicalTitle(rawTitle);

          const authorsMatches = [...html.matchAll(/<meta\s+name=["'](?:citation_author|dc\.creator)["']\s+content=["']([^"']+)["']/gi)];
          const rawAuthors = authorsMatches.map((m) => m[1]);
          const authors = cleanBiomedicalAuthors(rawAuthors);

          const journalMatch = html.match(/<meta\s+name=["'](?:citation_journal_title|dc\.source)["']\s+content=["']([^"']+)["']/i);
          const journal = journalMatch ? journalMatch[1].trim() : 'Biomedical Journal';

          const yearMatch = html.match(/<meta\s+name=["'](?:citation_publication_date|citation_date|dc\.date)["']\s+content=["'](\d{4})[^"']*["']/i);
          const publicationYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

          const doiMatch = html.match(/<meta\s+name=["'](?:citation_doi|dc\.identifier)["']\s+content=["']([^"']+)["']/i);
          const doi = doiMatch ? doiMatch[1].trim() : undefined;

          // Extract Abstract from meta or common DOM selectors
          const abstractMeta = html.match(/<meta\s+name=["'](?:citation_abstract|dc\.description|description)["']\s+content=["']([^"']+)["']/i);
          let abstractText = abstractMeta ? abstractMeta[1].replace(/<[^>]+>/g, '').trim() : '';

          if (!abstractText || abstractText.length < 50) {
            const bodyAbstractMatch = html.match(/(?:<section[^>]*class=["'][^"']*abstract[^"']*["'][^>]*>|<div[^>]*class=["'][^"']*abstract[^"']*["'][^>]*>)([\s\S]*?)<\/(?:section|div)>/i);
            if (bodyAbstractMatch) {
              abstractText = bodyAbstractMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            }
          }

          // Clean body text
          const bodyText = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          const vancouverCitation = buildVancouverCitation({
            authors,
            title: cleanTitle,
            journal,
            year: publicationYear,
            doi,
          });

          const payload: ParsedManuscriptPayload = {
            id: crypto.randomUUID(),
            metadata: {
              title: cleanTitle,
              authors,
              journal,
              publicationYear,
              doi,
              vancouverCitation,
              sourceDepth: 'FULL_TEXT_HTML',
              openAccess: true,
              resolvedUrl: targetUrl,
            },
            abstract: abstractText || cleanTitle,
            fullText: bodyText.slice(0, 40000),
            sections: [{ heading: 'Abstract', content: abstractText || cleanTitle }],
            tablesRaw: [],
            extractedAt: new Date().toISOString(),
          };

          return NextResponse.json(payload);
        }
      } catch (urlFetchError: any) {
        console.warn(`Direct URL fetch failed for ${targetUrl}:`, urlFetchError?.message);
        // Fall through to Europe PMC / Crossref lookup if applicable
      }
    }

    if (normalized.type === 'UNKNOWN') {
      return NextResponse.json(
        { error: 'Could not recognize input as a valid DOI, PMID, PMCID, or article URL.' },
        { status: 422 }
      );
    }

    // -------------------------------------------------------------
    // 2. EUROPE PMC RESOLUTION (PMID / PMCID / JATS XML)
    // -------------------------------------------------------------
    let pmcResolved = await resolveEuropePmcArticle(normalized.normalizedValue);

    // -------------------------------------------------------------
    // 3. CROSSREF RESOLUTION (FALLBACK FOR DOI)
    // -------------------------------------------------------------
    if (!pmcResolved && normalized.type === 'DOI') {
      const crossrefMeta = await fetchCrossrefMetadata(normalized.normalizedValue);
      if (crossrefMeta) {
        const payload: ParsedManuscriptPayload = {
          id: crypto.randomUUID(),
          metadata: {
            title: crossrefMeta.title,
            authors: crossrefMeta.authors,
            journal: crossrefMeta.journal,
            publicationYear: crossrefMeta.publicationYear,
            volume: crossrefMeta.volume,
            issue: crossrefMeta.issue,
            pages: crossrefMeta.pages,
            doi: crossrefMeta.doi,
            vancouverCitation: crossrefMeta.vancouverCitation,
            sourceDepth: 'ABSTRACT_ONLY_FALLBACK',
            openAccess: false,
          },
          abstract: 'Abstract unavailable via open registry. Please upload PDF directly for full-text critical appraisal.',
          fullText: '',
          sections: [],
          tablesRaw: [],
          extractedAt: new Date().toISOString(),
        };
        return NextResponse.json(payload);
      }
    }

    if (!pmcResolved) {
      return NextResponse.json(
        {
          error: `Unable to locate article with identifier "${normalized.normalizedValue}". Please verify the identifier or upload the PDF directly.`,
        },
        { status: 404 }
      );
    }

    const payload: ParsedManuscriptPayload = {
      id: crypto.randomUUID(),
      metadata: {
        title: pmcResolved.title,
        authors: pmcResolved.authors,
        journal: pmcResolved.journal,
        publicationYear: pmcResolved.publicationYear,
        volume: pmcResolved.volume,
        issue: pmcResolved.issue,
        pages: pmcResolved.pages,
        doi: pmcResolved.doi,
        pmid: pmcResolved.pmid,
        pmcid: pmcResolved.pmcid,
        vancouverCitation: pmcResolved.vancouverCitation,
        sourceDepth: pmcResolved.sourceDepth,
        openAccess: pmcResolved.openAccess,
      },
      abstract: pmcResolved.abstract,
      fullText: pmcResolved.fullText,
      sections: pmcResolved.sections,
      tablesRaw: pmcResolved.tablesRaw,
      extractedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('Error in identifier resolution route:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to resolve article identifier' },
      { status: 500 }
    );
  }
}
