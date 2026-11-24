/**
 * outcome-logic.ts — primary-estimate selection and direction-aware labelling.
 * No paper-specific words. No title fallbacks.
 */
import { ParsedEffect, crossesNull } from './effect-parser';

export type OutcomeNature = 'adverse' | 'desirable' | 'process' | 'unknown';
export type EffectDirection =
  | 'favours intervention'
  | 'favours comparator'
  | 'no clear difference'
  | 'direction not interpretable';

// Events nobody wants (a ratio < 1 is GOOD for these)
const ADVERSE = /\b(chd|coronary|heart disease|cardiovascular event|myocardial|death|mortality|died|haemorrhage|hemorrhage|bleed|stroke|infarction|failure|hospitali[sz]ation|complication|adverse|toxicity|infection|miscarriage|pregnancy loss|loss|abortion|ohss|hyperstimulation|pre-?eclampsia|eclampsia|preterm|abruption|stillbirth|cancer|fracture|embolism|thrombo|dementia|disability|relapse|recurrence|progression|readmission|pain|palsy|injury|malformation|anomal|small[- ]for[- ]gestational|primary[- ]outcome event|composite of (?:death|cardiovascular death))/i;
// Outcomes everyone wants (a ratio > 1 is GOOD for these)
const DESIRABLE = /\b(live birth|clinical pregnancy|ongoing pregnancy|pregnancy rate|implantation|survival|remission|cure|recovery|response|healing|quality of life|success|resolution|abstinence)\b/i;
// Intermediate / process measures (never the clinical primary if a clinical one exists)
const PROCESS = /\b(oocytes? retrieved|oocyte retrieval|number of (?:oocytes|embryos)|embryo transfer achieved|gonadotropin|units? of|dose|duration of stimulation|adherence|blastocyst formation|fertili[sz]ation rate)\b/i;

export function outcomeNature(label: string | null, fallbackDefinition?: string | null): OutcomeNature {
  if (!label) return fallbackDefinition ? outcomeNature(fallbackDefinition) : 'unknown';
  if (/^primary[- ](?:composite\s+)?(?:outcome|end ?point)/i.test(label) && fallbackDefinition) return outcomeNature(fallbackDefinition);
  if (PROCESS.test(label)) return 'process';
  if (ADVERSE.test(label)) return 'adverse';
  if (DESIRABLE.test(label)) return 'desirable';
  return fallbackDefinition ? outcomeNature(fallbackDefinition) : 'unknown';
}

/** Direction from the estimate, not from the words. Differences assume intervention − comparator. */
export function effectDirection(e: ParsedEffect, nature: OutcomeNature): EffectDirection {
  if (crossesNull(e)) return 'no clear difference';
  if (nature === 'unknown' || nature === 'process') return 'direction not interpretable';
  const lower = e.isRatio ? e.point < 1 : e.point < 0;
  if (nature === 'adverse') return lower ? 'favours intervention' : 'favours comparator';
  return lower ? 'favours comparator' : 'favours intervention';
}

const STOP = new Set(['the', 'and', 'with', 'after', 'from', 'that', 'were', 'was', 'for', 'of', 'in', 'a', 'an', 'or', 'to', 'at', 'by', 'first', 'rate', 'rates', 'per', 'woman', 'women', 'patients', 'group']);
const tokens = (s: string) => [...new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];

/**
 * Picks the primary estimate. Returns null unless the evidence actually points to the primary outcome.
 * primaryDefinition comes ONLY from text such as "The primary outcome was …" — never from the title.
 */
export function selectPrimaryEstimate(estimates: ParsedEffect[], primaryDefinition: string | null): ParsedEffect | null {
  if (!estimates.length) return null;
  const target = primaryDefinition ? tokens(primaryDefinition) : [];
  let best: { e: ParsedEffect; score: number } | null = null;
  for (const e of estimates) {
    let score = 0;
    // only the clause leading up to this estimate — not the whole sentence (several estimates can share one)
    const local = e.sentence.slice(Math.max(0, e.index - 350), e.index + 30);
    const hay = `${e.outcomeHint ?? ''} ${local}`.toLowerCase();
    if (/\bprimary[- ](?:composite\s+)?(?:outcome|end ?point)/.test(hay)) score += 10;
    if (target.length) {
      const hint = tokens(e.outcomeHint ?? '');
      const overlap = target.filter((w) => hint.includes(w)).length;
      if (overlap === 0 && !/primary/.test(hay)) { score -= 2; }
      score += overlap * 3;
      if (hint.length && overlap / Math.max(target.length, 1) >= 0.5) score += 4;
    }
    if (/^primary\b/i.test(e.outcomeHint ?? '')) score += 4;
    if (e.isRatio) score += 1;                                  // prefer the relative measure when both are reported
    if (outcomeNature(e.outcomeHint) === 'process') score -= 8;
    if (/\bsecondary\b|\bsubgroup\b|\bsensitivity analysis\b/.test(hay)) score -= 4;
    if (!best || score > best.score) best = { e, score };
  }
  return best && best.score >= 4 ? best.e : null;
}

/** "The primary outcome/end point was …" — returns null if the paper does not say. */
export function primaryOutcomeDefinition(text: string): string | null {
  const m = text.match(/\bprimary\s+(?:review\s+|efficacy\s+)?(?:outcomes?|end\s*points?)\s+(?:was|were|is|are|included|consisted of|defined as)\s+(?:an?\s+|the\s+)?([^.;]{3,250})/i);
  return m ? m[1].trim().replace(/\s+with\s+a\s+non-?inferiority.*$/i, '') : null;
}

/** Non-inferiority verdict from the CI bound and the stated margin (difference scale, percentage points). */
export function nonInferiorityVerdict(e: ParsedEffect, marginAbs: number | null, higherIsBetter: boolean):
  'demonstrated' | 'not demonstrated' | 'not assessable' {
  if (marginAbs == null || e.isRatio) return 'not assessable';
  const bound = higherIsBetter ? e.ciLow : -e.ciHigh;
  return bound > -Math.abs(marginAbs) ? 'demonstrated' : 'not demonstrated';
}
