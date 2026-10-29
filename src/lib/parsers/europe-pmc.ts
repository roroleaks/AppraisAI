import { XMLParser } from 'fast-xml-parser';
import { IngestionSourceDepth } from '../schemas/ingestion.schema';
import { buildVancouverCitation } from './vancouver-formatter';
import { fetchCrossrefMetadata } from './crossref';

export interface EuropePmcResolvedArticle {
  title: string;
  authors: string[];
  journal: string;
  publicationYear: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  vancouverCitation: string;
  sourceDepth: IngestionSourceDepth;
  abstract: string;
  fullText: string;
  sections: Array<{ heading: string; content: string }>;
  tablesRaw: string[];
  openAccess: boolean;
  pdfUrl?: string;
}

/**
 * Strips XML/HTML tags and decodes entities to produce clean readable text.
 */
function cleanXmlText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recursively extracts clean text from a parsed XML node.
 * Gracefully handles nested formatted tags (bold, italic, xref, sup, sub)
 * while strictly ignoring non-prose metadata, attributes, and raw JSON representations.
 */
export function extractNodeText(node: any): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') {
    return cleanXmlText(String(node));
  }
  if (Array.isArray(node)) {
    return node
      .map(extractNodeText)
      .filter((s) => s.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (typeof node === 'object') {
    const parts: string[] = [];
    if (node['#text']) {
      parts.push(cleanXmlText(String(node['#text'])));
    }
    for (const key of Object.keys(node)) {
      // Discard attribute keys, metadata objects, and citation references
      if (
        !key.startsWith('@_') &&
        key !== '#text' &&
        key !== 'journal-id' &&
        key !== 'issn' &&
        key !== 'permissions' &&
        key !== 'kwd-group' &&
        key !== 'custom-meta-group' &&
        key !== 'ref-list'
      ) {
        const text = extractNodeText(node[key]);
        if (text) {
          parts.push(text);
        }
      }
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

/**
 * Parses JATS XML into clean clinical sections (Abstract, Methods, Results, Discussion)
 * strictly targeting article title, structured abstract, and body sections.
 * Completely discards <journal-id>, <issn>, <permissions>, <kwd-group>, and metadata noise.
 */
export function parseJatsXmlToSections(xmlString: string): {
  title?: string;
  abstract: string;
  fullText: string;
  sections: Array<{ heading: string; content: string }>;
  tablesRaw: string[];
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  const parsed = parser.parse(xmlString);
  const sections: Array<{ heading: string; content: string }> = [];
  const tablesRaw: string[] = [];

  const articleMeta = parsed?.article?.front?.['article-meta'] || parsed?.['article-meta'];

  // Extract Article Title from <title-group>/<article-title>
  let title = '';
  const titleNode = articleMeta?.['title-group']?.['article-title'];
  if (titleNode) {
    title = extractNodeText(titleNode);
  }

  // Extract Abstract targeting <abstract> with structured <sec> or <p>
  let abstract = '';
  const abstractNode = articleMeta?.abstract;
  if (abstractNode) {
    if (typeof abstractNode === 'string') {
      abstract = cleanXmlText(abstractNode);
    } else if (abstractNode.sec) {
      const secs = Array.isArray(abstractNode.sec) ? abstractNode.sec : [abstractNode.sec];
      abstract = secs
        .map((s: any) => {
          const secTitle = extractNodeText(s.title || '');
          const secText = s.p ? extractNodeText(s.p) : extractNodeText(s);
          return secTitle ? `**${secTitle}**: ${secText}` : secText;
        })
        .filter(Boolean)
        .join('\n\n');
    } else if (abstractNode.p) {
      const pNodes = Array.isArray(abstractNode.p) ? abstractNode.p : [abstractNode.p];
      abstract = pNodes
        .map(extractNodeText)
        .filter(Boolean)
        .join('\n\n');
    } else {
      abstract = extractNodeText(abstractNode);
    }
  }

  // Extract Body Sections & Table Wraps exclusively from <body>
  const body = parsed?.article?.body || parsed?.body;
  if (body) {
    // If body has direct paragraphs before or without sections
    if (body.p) {
      const directP = Array.isArray(body.p) ? body.p : [body.p];
      const pText = directP.map(extractNodeText).filter(Boolean).join('\n\n');
      if (pText) {
        sections.push({ heading: 'Introduction / Overview', content: pText });
      }
    }

    const rawSections = body.sec ? (Array.isArray(body.sec) ? body.sec : [body.sec]) : [];

    const processSec = (secObj: any) => {
      const heading = extractNodeText(secObj.title) || 'Section';
      let content = '';

      if (secObj.p) {
        const paragraphs = Array.isArray(secObj.p) ? secObj.p : [secObj.p];
        content = paragraphs.map(extractNodeText).filter(Boolean).join('\n\n');
      }

      // Check table-wrap inside section
      if (secObj['table-wrap']) {
        const tableWraps = Array.isArray(secObj['table-wrap'])
          ? secObj['table-wrap']
          : [secObj['table-wrap']];
        tableWraps.forEach((tw: any) => {
          const label = extractNodeText(tw.label || '');
          const caption = extractNodeText(tw.caption?.p || tw.caption?.title || '');
          if (label || caption) {
            tablesRaw.push(`${label} ${caption}`.trim());
          }
        });
      }

      if (content || (heading && heading !== 'Section')) {
        sections.push({ heading, content });
      }

      // Recursively handle nested sub-sections
      if (secObj.sec) {
        const nested = Array.isArray(secObj.sec) ? secObj.sec : [secObj.sec];
        nested.forEach(processSec);
      }
    };

    rawSections.forEach(processSec);
  }

  const fullText = sections
    .map((s) => `## ${s.heading}\n\n${s.content}`)
    .join('\n\n');

  return {
    title: title || undefined,
    abstract,
    fullText,
    sections,
    tablesRaw,
  };
}

/**
 * Helper to fetch with 429-aware exponential backoff retry.
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delayMs = 500): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 && i < retries) {
        const wait = delayMs * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (err) {
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
        continue;
      }
      throw err;
    }
  }
  return fetch(url, options);
}

/**
 * Searches Europe PMC by query (DOI, PMID, PMCID, or keyword).
 */
export async function queryEuropePmc(query: string): Promise<any | null> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodedQuery}&resultType=core&format=json&pageSize=1`;

  try {
    const res = await fetchWithRetry(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.resultList?.result?.[0] || null;
  } catch (err) {
    console.error('Europe PMC query failed:', err);
    return null;
  }
}

/**
 * Fetches Full Text JATS XML from Europe PMC if PMCID exists.
 */
export async function fetchEuropePmcFullTextXml(pmcid: string): Promise<string | null> {
  const cleanPmcId = pmcid.replace(/^PMC/i, '');
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC${cleanPmcId}/fullTextXML`;

  try {
    const res = await fetchWithRetry(url, {
      headers: { Accept: 'application/xml, text/xml' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error(`Failed to fetch full text XML for PMC${cleanPmcId}:`, err);
    return null;
  }
}

/**
 * Complete Europe PMC resolver with JATS XML extraction & Crossref fallback.
 */
export async function resolveEuropePmcArticle(query: string): Promise<EuropePmcResolvedArticle | null> {
  const pmcResult = await queryEuropePmc(query);

  if (!pmcResult) {
    // If Europe PMC did not find it, and query has a DOI, try Crossref
    if (query.includes('10.')) {
      const doi = query.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/)?.[1] || query;
      const crossrefMeta = await fetchCrossrefMetadata(doi);
      if (crossrefMeta) {
        return {
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
          abstract: 'Abstract unavailable via Crossref direct lookup. Please upload the PDF for complete critical appraisal.',
          fullText: '',
          sections: [],
          tablesRaw: [],
          openAccess: false,
        };
      }
    }
    return null;
  }

  const title = pmcResult.title || 'Untitled Article';
  const authorString: string = pmcResult.authorString || '';
  const authors: string[] = authorString ? authorString.split(',').map((a: string) => a.trim()) : [];
  const journal = pmcResult.journalInfo?.journal?.title || pmcResult.journalTitle || 'Unknown Journal';
  const publicationYear = Number(pmcResult.pubYear || new Date().getFullYear());
  const volume = pmcResult.journalInfo?.volume;
  const issue = pmcResult.journalInfo?.issue;
  const pages = pmcResult.pageInfo;
  const doi = pmcResult.doi;
  const pmid = pmcResult.pmid;
  const pmcid = pmcResult.pmcid;
  const isOpenAccess = pmcResult.isOpenAccess === 'Y';

  let vancouverCitation = '';
  // Try crossref for ultra-clean ICMJE volume/issue/page formatting if DOI exists
  if (doi) {
    const crossrefData = await fetchCrossrefMetadata(doi);
    if (crossrefData) {
      vancouverCitation = crossrefData.vancouverCitation;
    }
  }

  if (!vancouverCitation) {
    vancouverCitation = buildVancouverCitation({
      authors,
      title,
      journal,
      year: publicationYear,
      volume,
      issue,
      pages,
      doi,
    });
  }

  let sourceDepth: IngestionSourceDepth = 'ABSTRACT_ONLY_FALLBACK';
  let abstract = cleanXmlText(pmcResult.abstractText || '');
  let fullText = abstract;
  let sections: Array<{ heading: string; content: string }> = [
    { heading: 'Abstract', content: abstract }
  ];
  let tablesRaw: string[] = [];

  // Attempt full-text XML extraction if PMCID is available and Open Access
  if (pmcid) {
    const fullTextXml = await fetchEuropePmcFullTextXml(pmcid);
    if (fullTextXml && fullTextXml.length > 500) {
      const parsedXml = parseJatsXmlToSections(fullTextXml);
      if (parsedXml.fullText.length > 1000) {
        sourceDepth = 'FULL_TEXT_JATS_XML';
        abstract = parsedXml.abstract || abstract;
        fullText = parsedXml.fullText;
        sections = parsedXml.sections;
        tablesRaw = parsedXml.tablesRaw;
      }
    }
  }

  return {
    title,
    authors,
    journal,
    publicationYear,
    volume,
    issue,
    pages,
    doi,
    pmid,
    pmcid,
    vancouverCitation,
    sourceDepth,
    abstract,
    fullText,
    sections,
    tablesRaw,
    openAccess: isOpenAccess,
  };
}
