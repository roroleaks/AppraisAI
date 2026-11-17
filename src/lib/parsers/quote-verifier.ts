import { ParsedManuscriptPayload } from '../schemas/ingestion.schema';

/**
 * Normalizes text for verbatim matching:
 * - Normalizes Unicode dashes, en-dashes, em-dashes to standard hyphen
 * - Normalizes curly/smart quotation marks to standard quotes
 * - Collapses consecutive whitespace to a single space
 * - Converts to lower-case for robust matching
 */
export function normalizeForQuoteMatch(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Verifies whether candidate text is genuinely verbatim in the manuscript
 * (checking title, abstract, and fullText body).
 * Enforces quotation integrity (P0-5).
 */
export function isVerbatimInManuscript(
  quote: string | undefined | null,
  manuscript: ParsedManuscriptPayload | undefined | null
): boolean {
  if (!quote || !manuscript) return false;

  const cleanQuote = normalizeForQuoteMatch(quote);
  if (cleanQuote.length < 12) return false;
  if (
    cleanQuote === 'not reported' ||
    cleanQuote.includes('not assessable') ||
    cleanQuote.includes('not reported in available text')
  ) {
    return false;
  }

  const titleNorm = normalizeForQuoteMatch(manuscript.metadata?.title || '');
  const abstractNorm = normalizeForQuoteMatch(manuscript.abstract || '');
  const fullTextNorm = normalizeForQuoteMatch(manuscript.fullText || '');

  return (
    titleNorm.includes(cleanQuote) ||
    abstractNorm.includes(cleanQuote) ||
    fullTextNorm.includes(cleanQuote)
  );
}
