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
 * Parses JATS XML into structured clinical sections (Abstract, Methods, Results, Discussion)
 * and extracts any embedded `<table-wrap>` structures.
 */
function parseJatsXmlToSections(xmlString: string): {
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

  // Extract Abstract
  let abstract = '';
  const abstractNode = parsed?.article?.front?.['article-meta']?.abstract;
  if (abstractNode) {
    if (typeof abstractNode === 'string') {
      abstract = cleanXmlText(abstractNode);
    } else if (abstractNode.p) {
      const pNodes = Array.isArray(abstractNode.p) ? abstractNode.p : [abstractNode.p];
      abstract = pNodes.map((p: any) => cleanXmlText(typeof p === 'string' ? p : JSON.stringify(p))).join('\n\n');
    } else if (abstractNode.sec) {
      const secs = Array.isArray(abstractNode.sec) ? abstractNode.sec : [abstractNode.sec];
      abstract = secs
        .map((s: any) => {
          const title = cleanXmlText(s.title || '');
          const p = s.p ? cleanXmlText(typeof s.p === 'string' ? s.p : JSON.stringify(s.p)) : '';
          return title ? `**${title}**: ${p}` : p;
        })
        .join('\n\n');
    }
  }

  // Extract Body Sections & Table Wraps
  const body = parsed?.article?.body;
  if (body) {
    const rawSections = body.sec ? (Array.isArray(body.sec) ? body.sec : [body.sec]) : [];

    const processSec = (secObj: any) => {
      const heading = cleanXmlText(secObj.title || 'Section');
      let content = '';

      if (secObj.p) {
        const paragraphs = Array.isArray(secObj.p) ? secObj.p : [secObj.p];
        content = paragraphs.map((p: any) => cleanXmlText(typeof p === 'string' ? p : JSON.stringify(p))).join('\n\n');
      }

      // Check table-wrap inside section
      if (secObj['table-wrap']) {
        const tableWraps = Array.isArray(secObj['table-wrap']) ? secObj['table-wrap'] : [secObj['table-wrap']];
        tableWraps.forEach((tw: any) => {
          const label = cleanXmlText(tw.label || '');
          const caption = cleanXmlText(tw.caption?.p || tw.caption?.title || '');
          tablesRaw.push(`${label} ${caption}`.trim());
        });
      }

      if (content || heading) {
        sections.push({ heading, content });
      }

      // Recursively handle nested sections
      if (secObj.sec) {
        const nested = Array.isArray(secObj.sec) ? secObj.sec : [secObj.sec];
        nested.forEach(processSec);
      }
    };

    rawSections.forEach(processSec);
  }

  // If XML didn't map cleanly into body.sec, extract fallback paragraphs
  if (sections.length === 0) {
    const fallbackText = cleanXmlText(xmlString);
    if (fallbackText) {
      sections.push({ heading: 'Main Text', content: fallbackText.slice(0, 50000) });
    }
  }

  const fullText = sections
    .map((s) => `## ${s.heading}\n\n${s.content}`)
    .join('\n\n');

  return {
    abstract: abstract || cleanXmlText(xmlString).slice(0, 2000),
    fullText,
    sections,
    tablesRaw,
  };
}

/**
 * Searches Europe PMC by query (DOI, PMID, PMCID, or keyword).
 */
export async function queryEuropePmc(query: string): Promise<any | null> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodedQuery}&resultType=core&format=json&pageSize=1`;

  try {
    const res = await fetch(url, {
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
    const res = await fetch(url, {
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
