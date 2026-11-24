export const COMPANY_NAMES = [
  'Vitrolife',
  'Boehringer Ingelheim',
  'Eli Lilly',
  'AstraZeneca',
  'Novartis',
  'Pfizer',
  'Roche',
  'Merck',
  'Sanofi',
  'GlaxoSmithKline',
  'GSK',
  'Bayer',
  'Novo Nordisk',
  'Ferring',
  'Johnson & Johnson',
  'Janssen',
  'AbbVie',
  'Amgen',
  'Gilead',
  'Bristol-Myers Squibb',
  'Takeda',
  'Medtronic',
  'Boston Scientific',
  'CooperSurgical',
  'Organon',
  'Illumina',
  'Thermo Fisher',
  'Siemens',
  'Philips',
  'GE Healthcare',
] as const;

const COMPANY_NAME_RE = new RegExp(
  `\\b(?:${COMPANY_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i'
);

const COMMERCIAL_SUFFIX_RE =
  /\b(?:inc\.?|corp\.?|corporation|llc|ltd\.?|plc|gmbh|s\.?a\.?|pty\.?|b\.?v\.?|pharma(?:ceuticals?)?|therapeutics|biotech(?:nology)?|biosciences|medical\s+(?:systems|devices|technologies)|diagnostics|laboratories)\b/i;

const PUBLIC_NONPROFIT_RE =
  /\b(?:nih|nhlbi|nci|mrc|nhmrc|cihr|wellcome|national|ministry|department|university|institute|institution|hospital|clinic|council|foundation|charity|trust|public|government|academy|society|association|college|center|centre|agency|board|fund)\b/i;

function isCommercialEntity(raw: string): boolean {
  if (COMPANY_NAME_RE.test(raw)) return true;
  if (COMMERCIAL_SUFFIX_RE.test(raw) && !PUBLIC_NONPROFIT_RE.test(raw)) return true;
  return false;
}

export interface IndustryInvolvementResult {
  industryFunded: boolean;
  industryAffiliatedAuthors: boolean;
  funderSignals: string[];
  authorDisclosures: string[];
  evidence: string[];
}

export function detectIndustryInvolvement(
  text: string,
  affiliations: string[] = []
): IndustryInvolvementResult {
  const funderSignals: string[] = [];
  const authorDisclosures: string[] = [];
  const evidence: string[] = [];

  const funderText = text.replace(/<\/?[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // 1. Funding statements (includes "funded by a grant from X" and "received funding from the manufacturer, X")
  const funders = [
    ...funderText.matchAll(
      /\b(?:funded|supported|sponsored)\s+(?:in part\s+)?by\s+(?:a\s+(?:grant|research grant)\s+from\s+)?(?<f>[^.;()]{2,120})|\b(?:grant|funding|support)\s+from\s+(?:the\s+(?:manufacturer|sponsor|company),?\s+)?(?<g>[^.;()]{2,120})/gi
    ),
  ].map((m) => (m.groups?.f || m.groups?.g || '').trim());

  let industryFunded = false;
  for (const funderRaw of funders) {
    if (!funderRaw) continue;
    if (isCommercialEntity(funderRaw)) {
      industryFunded = true;
      const item = `Funder: ${funderRaw}`;
      if (!funderSignals.includes(item)) {
        funderSignals.push(item);
        evidence.push(item);
      }
    }
  }

  // 2. Company-affiliated authors
  let industryAffiliatedAuthors = false;
  for (const aff of affiliations) {
    const cleanAff = (aff || '').trim();
    if (!cleanAff) continue;
    if (isCommercialEntity(cleanAff)) {
      industryAffiliatedAuthors = true;
      const item = `Author affiliation: ${cleanAff}`;
      if (!evidence.includes(item)) {
        evidence.push(item);
      }
    }
  }

  // 3. Author competing-interests disclosures
  const sentences = funderText.split(/(?<=[.?!])\s+/);
  for (const s of sentences) {
    const trimmed = s.trim();
    if (
      /\b(?:received|reports?|declares?)\b[^.]{0,80}\b(?:honoraria|fees|grants?|consult)/i.test(
        trimmed
      ) &&
      !/\bno\s+(?:conflicts?\s+of\s+interest|competing\s+interests?|disclosures?)\b/i.test(trimmed)
    ) {
      const item = `Author disclosure: ${trimmed.slice(0, 180)}`;
      if (!authorDisclosures.includes(item)) {
        authorDisclosures.push(item);
        evidence.push(item);
      }
    }
  }

  return {
    industryFunded,
    industryAffiliatedAuthors,
    funderSignals,
    authorDisclosures,
    evidence,
  };
}
