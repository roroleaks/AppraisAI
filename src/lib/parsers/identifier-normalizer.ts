export interface ParsedIdentifier {
  type: 'DOI' | 'PMID' | 'PMCID' | 'URL' | 'UNKNOWN';
  normalizedValue: string;
  originalInput: string;
}

/**
 * Normalizes user input string and extracts pure DOI, PMID, PMCID, or URL.
 */
export function normalizeIdentifier(input: string): ParsedIdentifier {
  const trimmed = input.trim();

  // 1. Check for PMCID (e.g., PMC1234567 or https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1234567/)
  const pmcidMatch = trimmed.match(/(PMC\d+)/i);
  if (pmcidMatch) {
    return {
      type: 'PMCID',
      normalizedValue: pmcidMatch[1].toUpperCase(),
      originalInput: trimmed,
    };
  }

  // 2. Check for DOI (e.g. 10.1056/NEJMoa2100000 or https://doi.org/10.1056/NEJMoa...)
  const doiMatch = trimmed.match(/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/);
  if (doiMatch) {
    // Strip trailing punctuation often copied accidentally from text
    const cleanDoi = doiMatch[1].replace(/[.,;)]+$/, '');
    return {
      type: 'DOI',
      normalizedValue: cleanDoi,
      originalInput: trimmed,
    };
  }

  // 3. Check for PMID (Pubmed URL or pure 7-9 digits)
  const pubmedUrlMatch = trimmed.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  if (pubmedUrlMatch) {
    return {
      type: 'PMID',
      normalizedValue: pubmedUrlMatch[1],
      originalInput: trimmed,
    };
  }

  if (/^\d{6,9}$/.test(trimmed)) {
    return {
      type: 'PMID',
      normalizedValue: trimmed,
      originalInput: trimmed,
    };
  }

  // 4. General HTTP/HTTPS URL
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      type: 'URL',
      normalizedValue: trimmed,
      originalInput: trimmed,
    };
  }

  return {
    type: 'UNKNOWN',
    normalizedValue: trimmed,
    originalInput: trimmed,
  };
}
