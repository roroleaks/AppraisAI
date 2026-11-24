/**
 * review-designs.ts — what a review INCLUDED decides its evidence level, not the word "review".
 * Also flags AI / prediction-model studies so they are not appraised with RCT tools.
 */
import type { OxfordEvidenceLevel } from '../schemas/appraisal.schema';

export type IncludedDesigns = 'RANDOMIZED' | 'OBSERVATIONAL' | 'MIXED' | 'MODEL_PERFORMANCE' | 'UNKNOWN';

export function includedDesigns(abstract: string): IncludedDesigns {
  const t = abstract.toLowerCase();
  const rct = /\brandomi[sz]ed (?:controlled )?trials?\b|\brcts?\b/.test(t);
  const obs = /\bobservational\b|\bcohort\b|\bcase[- ]control\b|\bretrospective\b|\bnon-?randomi[sz]ed\b|\bregistry\b/.test(t);
  const model = /\b(?:auc|area under (?:the )?(?:receiver|roc|curve)|sensitivity|specificity|accuracy|predictive performance|c-statistic)\b/.test(t)
    && /\b(?:artificial intelligence|machine learning|deep learning|neural network|algorithm|model)s?\b/.test(t);
  // Eligibility that explicitly mixes designs ("RCTs and observational cohort studies")
  const mixedEligibility = /\b(?:rcts?|randomi[sz]ed[^.]{0,30}?trials?)\s*(?:\([^)]*\)\s*)?(?:and|or|,)\s+(?:non-?randomi[sz]ed|observational|cohort|case[- ]control)/.test(t)
    || /\b\d+\s+(?:observational|cohort|non-?randomi[sz]ed|retrospective)\s+(?:studies|trials)\b/.test(t);
  // Counted RCTs ("5 RCTs, 6689 infants") with no counted non-randomised studies → review of RCTs
  if (/\b(?:\d+|[a-z]+)\s+(?:rcts|randomi[sz]ed (?:controlled )?trials)\b/.test(t) && !mixedEligibility) return 'RANDOMIZED';
  if (mixedEligibility) return 'MIXED';
  if (model && !rct) return 'MODEL_PERFORMANCE';
  if (rct && (obs || model)) return 'MIXED';
  if (rct) return 'RANDOMIZED';
  if (obs) return 'OBSERVATIONAL';
  if (model) return 'MODEL_PERFORMANCE';
  return 'UNKNOWN';
}

/** OCEBM-style label used by the app. Only a review of randomised trials is 1a. */
export function reviewOxfordLevel(d: IncludedDesigns): OxfordEvidenceLevel {
  switch (d) {
    case 'RANDOMIZED': return 'Level 1a';
    case 'MIXED':
    case 'OBSERVATIONAL': return 'Level 2a';
    case 'MODEL_PERFORMANCE': return 'Level 3a';
    default: return 'Level 2a'; // unknown composition: never claim 1a
  }
}

/** AI / prediction-model development or validation study (not a trial of AI-guided care). */
export function isPredictionModelStudy(title: string, abstract: string): boolean {
  const text = `${title} ${abstract}`.toLowerCase();
  const ai = /\b(?:artificial intelligence|machine learning|deep learning|neural network|convolutional|computer vision|algorithm)\b/.test(text);
  const perf = /\b(?:auc|area under|sensitivity|specificity|accuracy|c-statistic|calibration|predict(?:ion|ive|s|ed)?)\b/.test(text);
  const trial = /\brandomly (?:assigned|allocated)\b|\brandomi[sz]ed\b[^.]{0,40}\btrial\b/.test(text);
  return ai && perf && !trial;
}

/** Validation signals the brief asks about for AI studies. Each flag is "reported" or "not found in text" — never a verdict. */
export function aiValidationSignals(text: string): { item: string; found: boolean; quote: string | null }[] {
  const find = (re: RegExp) => {
    const s = text.split(/(?<=[.?!])\s+/).find((x) => re.test(x));
    // "Calibration was not assessed" is evidence of absence, not presence
    const negated = s ? /\b(?:not|never)\s+(?:been\s+)?(?:assessed|reported|evaluated|performed|validated|available)\b|\bno\s+(?:external|calibration|validation)\b|\black(?:ed|s)?\b|\bwithout\b/i.test(s) : false;
    return { found: Boolean(s) && !negated, quote: s ? s.trim().slice(0, 300) : null };
  };
  return [
    { item: 'External validation (independent dataset / other centres)', ...find(/\bexternal(?:ly)?\s+validat|\bindependent\s+(?:test|validation)\s+(?:set|cohort|dataset)|\bvalidated\s+(?:on|in)\s+(?:an?\s+)?(?:independent|external)/i) },
    { item: 'Temporal or geographic validation', ...find(/\btemporal(?:ly)?\s+validat|\bgeographic(?:al)?\s+validat|\bprospective(?:ly)?\s+validat/i) },
    { item: 'Calibration reported', ...find(/\bcalibration\b|\bbrier\b|\bcalibration\s+(?:slope|plot|curve)/i) },
    { item: 'Discrimination reported (AUC / c-statistic)', ...find(/\bAUC\b|\barea under\b|\bc-statistic\b|\bconcordance\b/i) },
    { item: 'Comparison with clinicians', ...find(/\bembryologists?\b|\bclinicians?\b|\bradiologists?\b|\bexperts?\b|\bmanual\b/i) },
    { item: 'Effect on patient outcomes (e.g. live birth) in a prospective/randomised design', ...find(/\brandomi[sz]ed\b|\bprospective\b[^.]*\b(?:live birth|pregnancy|outcome)/i) },
    { item: 'Developer / vendor involvement disclosed', ...find(/\bfunded by\b|\bcompeting interests?\b|\bemployee\b|\bshareholder\b|\bconsultant\b/i) },
  ];
}
