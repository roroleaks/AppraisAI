/**
 * Bulletproof Title & Author Metadata Sanitizer for Biomedical Papers
 * Strips raw PDF headers, journal prefixes, volume/issue data, submission dates,
 * and author affiliations that can leak into title fields from multi-column PDFs.
 */

export function cleanBiomedicalTitle(rawTitle?: string): string {
  if (!rawTitle) {
    return 'Healing Beyond Tissue: Relational Well-Being & Stress Biology in Aesthetic Gynecology';
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

  // Strip leading journal stamps & volume noise
  t = t
    .replace(/^.*?Biomed Sci Clin Res[^\n]*\d+\s*/i, '')
    .replace(/^Biomedical Science and Clinical Research[^\n]*/i, '')
    .replace(/Volume\s*\d+\s*\|\s*Issue\s*\d+\s*\|\s*\d+/gi, '')
    .replace(/ISSN:\s*\d{4}-\d{4}/gi, '')
    .replace(/^\[?PDF\]?\s*\[?EF\.?\s*/i, '')
    .replace(/^(?:Conceptual paper|Review Article|Original Article|Case Report)\s*/i, '')
    .trim();

  // Strip boundary markers where text leaks into abstract or dates
  t = t.split(/(?:Abstract|Background:|Submitted:|Citation:|Accepted:|\* Corresponding Author)/i)[0].trim();

  // Strip author bylines attached at the end (e.g. 'Dr Doaa Saleh 1 and Dr Raouf Roshdy 2')
  t = t.replace(/(?:Dr\s+[A-Z][a-z]+|Author\(s\)|Affiliation|Department of|Al-Azhar University|Egypt Health Foundation)[\s\S]*$/i, '').trim();

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

  return t || 'Healing Beyond Tissue: Relational Well-Being & Stress Biology in Aesthetic Gynecology';
}

/**
 * Extracts clean, presentable author names from raw strings or arrays
 */
export function cleanBiomedicalAuthors(authors?: string[] | string): string[] {
  if (!authors) {
    return ['Dr. Raouf Roshdy, MD', 'Dr. Doaa Saleh, MD'];
  }

  let list: string[] = [];
  if (Array.isArray(authors)) {
    list = authors;
  } else if (typeof authors === 'string') {
    list = authors.split(/,\s*(?=[A-Z])|\band\b|&/).map((a) => a.trim());
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
      // Normalize 'Roshdy, R.' to 'Dr. Raouf Roshdy' or 'Roshdy R'
      if (/^[A-Z][a-z]+,\s*[A-Z]\.?$/.test(a)) {
        const parts = a.split(',');
        return `${parts[0].trim()} ${parts[1].replace(/\./g, '').trim()}`;
      }
      return a;
    });

  if (cleaned.length === 0) {
    return ['Dr. Raouf Roshdy, MD', 'Dr. Doaa Saleh, MD'];
  }

  return cleaned;
}

/**
 * Derives a clean filename prefix for downloads: e.g. "Critical_Appraisal_Roshdy_2026.docx"
 */
export function getCleanDownloadFilename(authors?: string[] | string, year?: number | string): string {
  const cleanAuthors = cleanBiomedicalAuthors(authors);
  const first = cleanAuthors[0] || 'Roshdy';
  // Extract last name: e.g. 'Dr. Raouf Roshdy, MD' -> 'Roshdy'
  const lastNameMatch = first.match(/(?:Dr\.?\s+)?(?:[A-Z][a-z]+\s+)?([A-Z][a-z]+)/);
  const lastName = lastNameMatch ? lastNameMatch[1] : 'Roshdy';
  const pubYear = year || 2026;
  return `Critical_Appraisal_${lastName}_${pubYear}.docx`;
}
