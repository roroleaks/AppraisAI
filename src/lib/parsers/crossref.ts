import { buildVancouverCitation } from './vancouver-formatter';

export interface CrossrefMetadataResult {
  title: string;
  authors: string[];
  journal: string;
  publicationYear: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi: string;
  vancouverCitation: string;
  rawJson?: any;
}

/**
 * Fetches structured bibliographic metadata from Crossref API via DOI.
 */
export async function fetchCrossrefMetadata(doi: string): Promise<CrossrefMetadataResult | null> {
  try {
    const cleanDoi = encodeURIComponent(doi.replace(/^https?:\/\/doi\.org\//i, ''));
    const url = `https://api.crossref.org/works/${cleanDoi}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AppraisAI-MedicalPaperAppraiser/1.0 (mailto:admin@apprais-ai.local)',
        Accept: 'application/json',
      },
      next: { revalidate: 86400 }, // Cache 24 hours
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const item = data.message;
    if (!item) return null;

    const title = Array.isArray(item.title) ? item.title[0] : item.title || 'Untitled Article';
    const journal = Array.isArray(item['container-title'])
      ? item['container-title'][0]
      : item['container-title'] || 'Unknown Journal';

    // Authors extraction
    const rawAuthors = item.author || [];
    const authors: string[] = rawAuthors.map((a: any) => {
      if (a.family && a.given) {
        return `${a.family} ${a.given}`;
      }
      return a.family || a.name || 'Unknown Author';
    });

    // Publication Year
    let publicationYear = new Date().getFullYear();
    const publishedDate = item['published-print'] || item['published-online'] || item.created;
    if (publishedDate?.['date-parts']?.[0]?.[0]) {
      publicationYear = Number(publishedDate['date-parts'][0][0]);
    }

    const volume = item.volume ? String(item.volume) : undefined;
    const issue = item.issue ? String(item.issue) : undefined;
    const pages = item.page ? String(item.page) : undefined;

    const vancouverCitation = buildVancouverCitation({
      authors: rawAuthors.length > 0 ? rawAuthors : authors,
      title,
      journal,
      year: publicationYear,
      volume,
      issue,
      pages,
      doi: item.DOI || doi,
    });

    return {
      title,
      authors,
      journal,
      publicationYear,
      volume,
      issue,
      pages,
      doi: item.DOI || doi,
      vancouverCitation,
      rawJson: item,
    };
  } catch (error) {
    console.error(`Crossref metadata fetch error for DOI ${doi}:`, error);
    return null;
  }
}
