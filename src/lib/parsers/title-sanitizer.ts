/**
 * Bulletproof Title & Author Metadata Sanitizer for Biomedical Papers
 * Strips raw PDF headers, journal prefixes, volume/issue data, submission dates,
 * and author affiliations that can leak into title fields from multi-column PDFs.
 */

export function cleanBiomedicalTitle(rawTitle?: string): string {
  if (!rawTitle) {
    return '[Title could not be extracted — please verify]';
  }

  let t = rawTitle.replace(/\s+/g, ' ').trim();

  // If citation is embedded inside the title string, extract the true title
  const citeMatch = t.match(
    /Citation:\s*([\s\S]*?)\s*\((\d{4})\)\.\s*([\s\S]*?)\.\s*([^,;]+?)(?:,\s*(\d+)\s*\(([^)]+)\)\s*,\s*([\d-]+))?/i
  );
  if (citeMatch) {
    let title = citeMatch[3].trim();
    const journalCandidate = citeMatch[4].trim();
    if (journalCandidate.includes('.')) {
      const parts = journalCandidate.split('.');
      const subTitle = parts.slice(0, -1).join('.').trim();
      if (subTitle.length > 5 && !subTitle.toLowerCase().includes('biomed')) {
        title = `${title}: ${subTitle}`;
      }
    }
    t = title;
  }

  // Strip leading volume/issue noise and standard document stamps
  t = t
    .replace(/Volume\s*\d+\s*\|\s*Issue\s*\d+\s*(?:\|\s*\d+)?\s*/gi, '')
    .replace(/ISSN:\s*\d{4}-\d{4}\s*/gi, '')
    .replace(/^\[?PDF\]?\s*\[?EF\.?\s*/i, '')
    .replace(/^(?:Conceptual paper|Review Article|Research Article|Original Article|Case Report)\s*/gi, '')
    .trim();

  // Strip boundary markers where text leaks into abstract or dates
  t = t.split(/(?:Abstract|Background:|Submitted:|Citation:|Accepted:|\* Corresponding Author)/i)[0].trim();

  // Strip author bylines and institutional affiliations attached at the end
  t = t.replace(/(?:Dr\s+[A-Z][a-z]+|Author\(s\)|Affiliation|Department of|Faculty of|School of|University|Hospital|Institute)[\s\S]*$/i, '').trim();

  // Strip leading/trailing punctuation
  t = t.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9)]+$/g, '').trim();

  // If still suspiciously long (> 180 chars) and contains colon or period, take clean title + subtitle
  if (t.length > 180) {
    if (t.includes(':')) {
      const parts = t.split(':');
      t = `${parts[0].trim()}: ${parts[1].trim()}`;
      if (t.length > 180) {
        t = parts[0].trim();
      }
    } else if (t.includes('.')) {
      t = t.split('.')[0].trim();
    }
  }

  return t || '[Title could not be extracted — please verify]';
}

/**
 * Extracts clean, presentable author names from raw strings or arrays
 */
export function cleanBiomedicalAuthors(authors?: string[] | string): string[] {
  if (!authors) {
    return ['[Author not specified]'];
  }

  let list: string[] = [];
  if (Array.isArray(authors)) {
    list = authors;
  } else if (typeof authors === 'string') {
    // Check if it is a Vancouver citation pair string: e.g. 'Taha, I., Roshdy, R.' or 'Roshdy, R., Saleh, D.'
    const pairs = authors.match(/[A-Z][a-zA-Z-]+,\s*[A-Z]\.?(?:\s*[A-Z]\.?)?/g);
    if (pairs && pairs.length > 0) {
      list = pairs;
    } else {
      list = authors.split(/,\s*(?=[A-Z])|\band\b|&/).map((a) => a.trim());
    }
  }

  const cleaned = list
    .map((a) => a.replace(/[\d*]/g, '').trim())
    .filter((a) => {
      const lower = a.toLowerCase();
      return (
        a.length > 2 &&
        !lower.includes('extracted from pdf') &&
        !lower.includes('author(s)') &&
        !lower.includes('volume') &&
        !lower.includes('issue') &&
        !lower.includes('submitted') &&
        !lower.includes('accepted') &&
        !lower.includes('issn')
      );
    })
    .map((a) => {
      // Normalize 'LastName, I.' to 'LastName I'
      if (/^[A-Z][a-zA-Z-]+,\s*[A-Z]\.?(?:\s*[A-Z]\.?)?$/.test(a)) {
        const parts = a.split(',');
        const last = parts[0].trim();
        const init = (parts[1] || '').replace(/[\s.]/g, '').trim();
        return `${last} ${init}`;
      }
      return a;
    });

  if (cleaned.length === 0) {
    return ['[Author not specified]'];
  }

  return cleaned;
}

/**
 * Extracts a clean first author surname for file naming.
 * Correctly handles 'Surname AB' -> 'Surname',
 * 'Dr. First Last, MD' -> 'Last', 'van der Berg A' -> 'van der Berg'.
 */
export function extractFirstAuthorSurname(authorStr: string): string {
  if (!authorStr || authorStr.startsWith('[')) return 'Manuscript';

  // Strip titles & degrees
  let clean = authorStr
    .replace(/^(?:Dr\.?|Prof\.?|Assoc\.?\s*Prof\.?)\s+/i, '')
    .replace(/,\s*(?:MD|PhD|MBBS|FRCOG|FACOG|MS|MPH|FACS|FRCS).*$/i, '')
    .replace(/[*0-9]/g, '')
    .trim();

  // If "LastName, FirstName"
  if (clean.includes(',')) {
    return clean.split(',')[0].trim();
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];

  // If last part is initials (e.g. "Surname HK", "Author JJV")
  const lastPart = parts[parts.length - 1];
  if (/^[A-Z]{1,4}\.?$/.test(lastPart)) {
    return parts.slice(0, parts.length - 1).join(' ');
  }

  // If first part is name and last part is surname (e.g. "John McNeil")
  return lastPart;
}

/**
 * Derives a clean filename prefix for downloads: e.g. "Critical_Appraisal_Siddiqi_2020.docx"
 */
export function getCleanDownloadFilename(authors?: string[] | string, year?: number | string, isDraft?: boolean): string {
  const cleanAuthors = cleanBiomedicalAuthors(authors);
  const first = cleanAuthors[0] && !cleanAuthors[0].startsWith('[') ? cleanAuthors[0] : 'Manuscript';
  const lastName = extractFirstAuthorSurname(first);
  const pubYear = year || new Date().getFullYear();
  return `Critical_Appraisal_${lastName}_${pubYear}${isDraft ? '_DRAFT' : ''}.docx`;
}
