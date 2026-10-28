export interface VancouverAuthorInput {
  family?: string;
  given?: string;
  name?: string;
}

/**
 * Deterministically formats an array of author names or author objects
 * according to ICMJE / Vancouver citation standards.
 * Rules:
 * - If 1 to 6 authors: list all, separated by commas (e.g. "Smith AB, Jones CD, Taylor EF.")
 * - If > 6 authors: list first 6, followed by ", et al."
 * - Initials: No periods or spaces between initials.
 */
export function formatVancouverAuthors(
  authors: (string | VancouverAuthorInput)[]
): string {
  if (!authors || authors.length === 0) {
    return 'Anonymous';
  }

  const formattedList = authors.map((auth) => {
    if (typeof auth === 'string') {
      const trimmed = auth.trim();
      
      // Strip honorific prefixes & degrees: "Dr.", "Prof.", ", MD", ", PhD"
      let cleanAuth = trimmed
        .replace(/^(?:Dr\.?|Prof\.?|Assoc\.?\s*Prof\.?)\s+/i, '')
        .replace(/,\s*(?:MD|PhD|MBBS|MS|FRCS|FRCOG|FACS|FACP)[^,]*$/i, '')
        .trim();

      // If already in standard Vancouver format: e.g. "Smith JA" or "Taha I"
      if (/^[A-Za-z'-]+\s+[A-Z]{1,3}$/.test(cleanAuth)) {
        return cleanAuth;
      }

      // If comma-separated: "Smith, John A." or "Roshdy, R."
      if (cleanAuth.includes(',')) {
        const parts = cleanAuth.split(',');
        const surname = parts[0].trim();
        const initials = parts.slice(1).join(' ').trim().replace(/[\.\s-]/g, '').toUpperCase();
        return `${surname} ${initials}`.trim();
      }

      const words = cleanAuth.split(/\s+/);
      if (words.length > 1) {
        // If last word is uppercase initials: "Taha I"
        if (/^[A-Z]{1,3}$/.test(words[words.length - 1])) {
          return `${words.slice(0, -1).join(' ')} ${words[words.length - 1]}`;
        }
        const surname = words[words.length - 1];
        const initials = words
          .slice(0, words.length - 1)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('');
        return `${surname} ${initials}`;
      }
      return cleanAuth;
    }

    // Object format (Crossref style: { family: "Smith", given: "John A." })
    const family = auth.family || auth.name || '';
    let initials = '';
    if (auth.given) {
      initials = auth.given
        .replace(/[\.\s-]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('');
    }
    return initials ? `${family} ${initials}` : family;
  });

  if (formattedList.length <= 6) {
    return formattedList.join(', ');
  }

  return `${formattedList.slice(0, 6).join(', ')}, et al.`;
}

/**
 * Builds standard NLM / Vancouver Journal Article citation:
 * Author(s). Article Title. Journal Title. Year;Volume(Issue):Pages. doi:xxx.
 */
export function buildVancouverCitation(params: {
  authors: (string | VancouverAuthorInput)[];
  title: string;
  journal: string;
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
}): string {
  const authorPart = formatVancouverAuthors(params.authors);
  const cleanTitle = params.title.replace(/\.*$/, '');
  const cleanJournal = params.journal.replace(/\.*$/, '');
  
  let citation = `${authorPart}. ${cleanTitle}. ${cleanJournal}. ${params.year}`;

  if (params.volume) {
    citation += `;${params.volume}`;
    if (params.issue) {
      citation += `(${params.issue})`;
    }
    if (params.pages) {
      citation += `:${params.pages}`;
    }
  } else if (params.pages) {
    citation += `:${params.pages}`;
  }

  citation += '.';

  if (params.doi) {
    const cleanDoi = params.doi.replace(/^https?:\/\/doi\.org\//i, '');
    citation += ` doi:${cleanDoi}`;
  }

  return citation;
}
