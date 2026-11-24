export interface ParsedIdentifier {
  type: 'DOI' | 'PMID' | 'PMCID' | 'URL' | 'UNKNOWN';
  normalizedValue: string;
  originalInput: string;
  doi?: string;
}

/**
 * Normalizes user input string and extracts pure DOI, PMID, PMCID, or URL.
 */
export function normalizeIdentifier(input: string): ParsedIdentifier {
  const trimmed = input.trim().replace(/^[\s"'“”]+|[\s"'“”;,.]+$/g, '');

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
      doi: cleanDoi,
    };
  }

  // 2b. Check for Nature publisher URL with embedded article ID (DOI: 10.1038/<id>)
  const natureMatch = trimmed.match(/nature\.com\/articles\/(s\d{5}-\d{3}-\d{5}-\w|[a-zA-Z0-9_-]+)/i);
  if (natureMatch) {
    const cleanDoi = `10.1038/${natureMatch[1].replace(/[.,;)]+$/, '')}`;
    return {
      type: 'DOI',
      normalizedValue: cleanDoi,
      originalInput: trimmed,
      doi: cleanDoi,
    };
  }

  // 3. Check for PMID (Pubmed URL, PMID: 1234567, or pure 6-9 digits)
  const pmidPrefixedMatch = trimmed.match(/^PMID[:\s]*(\d{6,9})$/i);
  if (pmidPrefixedMatch) {
    return {
      type: 'PMID',
      normalizedValue: pmidPrefixedMatch[1],
      originalInput: trimmed,
    };
  }

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
