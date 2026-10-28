import { NextRequest, NextResponse } from 'next/server';
import { normalizeIdentifier } from '@/lib/parsers/identifier-normalizer';
import { resolveEuropePmcArticle } from '@/lib/parsers/europe-pmc';
import { fetchCrossrefMetadata } from '@/lib/parsers/crossref';
import { ParsedManuscriptPayload } from '@/lib/schemas/ingestion.schema';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawInput = body?.rawInput;

    if (!rawInput || typeof rawInput !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid identifier input' }, { status: 400 });
    }

    const normalized = normalizeIdentifier(rawInput);
    if (normalized.type === 'UNKNOWN') {
      return NextResponse.json(
        { error: 'Could not recognize input as a valid DOI, PMID, PMCID, or article URL.' },
        { status: 422 }
      );
    }

    // Attempt resolution via Europe PMC first (gives PMCID and potential Full JATS XML)
    let pmcResolved = await resolveEuropePmcArticle(normalized.normalizedValue);

    // If Europe PMC did not return, and we have a DOI, query Crossref directly
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
