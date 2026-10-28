import { getDocumentProxy, extractText } from 'unpdf';
import { IngestionSourceDepth } from '../schemas/ingestion.schema';
import { buildVancouverCitation } from './vancouver-formatter';

export interface ExtractedPdfDocument {
  text: string;
  abstract: string;
  sections: Array<{ heading: string; content: string }>;
  pageCount: number;
  metadata: {
    title: string;
    authors: string[];
    journal?: string;
    year?: number;
    doi?: string;
    vancouverCitation: string;
    sourceDepth: IngestionSourceDepth;
  };
}

/**
 * Standard medical section headings recognized in multi-column medical journals.
 */
const KNOWN_HEADINGS = [
  'ABSTRACT',
  'INTRODUCTION',
  'BACKGROUND',
  'METHODS',
  'MATERIALS AND METHODS',
  'PATIENTS AND METHODS',
  'STUDY DESIGN',
  'RESULTS',
  'DISCUSSION',
  'CONCLUSIONS',
  'LIMITATIONS',
  'CONFLICT OF INTEREST',
  'ACKNOWLEDGEMENTS',
  'REFERENCES',
];

/**
 * Extracts clean, column-ordered text from biomedical PDF buffers using unpdf.
 * Handles server-side Node execution without canvas/worker runtime crashes.
 */
export async function extractBiomedicalPdf(pdfBuffer: Uint8Array): Promise<ExtractedPdfDocument> {
  const pdf = await getDocumentProxy(pdfBuffer);
  const pageCount = pdf.numPages;

  // Extract text across all pages
  const { text: rawExtractedText, totalPages } = await extractText(pdf, { mergePages: true });

  // Clean raw line breaks and weird whitespace typical of PDF extractions
  const cleanFullText = rawExtractedText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Extract potential title from the first 500 characters
  const lines = cleanFullText.split('\n').map((l) => l.trim()).filter((l) => l.length > 5);
  let guessedTitle = lines[0] || 'Extracted Medical Manuscript';
  if (guessedTitle.toLowerCase().includes('journal') || guessedTitle.toLowerCase().includes('volume') || guessedTitle.length < 15) {
    if (lines[1] && lines[1].length > 15) {
      guessedTitle = lines[1];
    }
  }

  // Detect DOI in the text
  const doiMatch = cleanFullText.match(/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/);
  const detectedDoi = doiMatch ? doiMatch[1].replace(/[.,;)]+$/, '') : undefined;

  // Section splitting heuristic for medical structures
  const sections: Array<{ heading: string; content: string }> = [];
  let abstract = '';

  // Attempt to parse out Abstract
  const abstractMatch = cleanFullText.match(/(?:ABSTRACT|SUMMARY)[\s\S]*?(?=(?:INTRODUCTION|BACKGROUND|METHODS|MATERIALS))/i);
  if (abstractMatch) {
    abstract = abstractMatch[0].replace(/^(?:ABSTRACT|SUMMARY)[:\s]*/i, '').trim();
    sections.push({ heading: 'Abstract', content: abstract });
  } else {
    // Fallback: take the first 1500 chars after title
    abstract = cleanFullText.slice(0, 1500);
    sections.push({ heading: 'Abstract / Opening', content: abstract });
  }

  // Parse major medical headings
  for (let i = 0; i < KNOWN_HEADINGS.length - 1; i++) {
    const currentHeading = KNOWN_HEADINGS[i];
    const nextHeadingRegex = KNOWN_HEADINGS.slice(i + 1).join('|');
    const regex = new RegExp(`(?:\\n|\\r)(${currentHeading})\\b[\\s\\S]*?(?=(?:\\n|\\r)(?:${nextHeadingRegex})\\b|$)`, 'i');
    const match = cleanFullText.match(regex);
    if (match && match[0].length > 50) {
      const headingTitle = match[1].toUpperCase();
      const content = match[0].replace(new RegExp(`^${headingTitle}[:\\s]*`, 'i'), '').trim();
      if (!sections.some((s) => s.heading.toUpperCase() === headingTitle)) {
        sections.push({ heading: headingTitle, content });
      }
    }
  }

  // If section splitter was too strict due to custom formatting, provide raw segmented body
  if (sections.length <= 1) {
    sections.push({ heading: 'Full Manuscript Body', content: cleanFullText });
  }

  const publicationYear = new Date().getFullYear();
  const vancouverCitation = buildVancouverCitation({
    authors: ['[Author(s) Extracted from PDF]'],
    title: guessedTitle,
    journal: 'Biomedical Journal Article',
    year: publicationYear,
    doi: detectedDoi,
  });

  return {
    text: cleanFullText,
    abstract,
    sections,
    pageCount: totalPages,
    metadata: {
      title: guessedTitle,
      authors: ['[Author(s) Extracted from PDF]'],
      journal: 'Biomedical Journal Article',
      year: publicationYear,
      doi: detectedDoi,
      vancouverCitation,
      sourceDepth: 'FULL_TEXT_PDF',
    },
  };
}
