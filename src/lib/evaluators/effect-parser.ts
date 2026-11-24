/**
 * effect-parser.ts — general, paper-agnostic effect-estimate extraction.
 *
 * Handles, among others:
 *   "hazard ratio for cardiovascular death or hospitalization for heart failure, 0.75; 95% confidence interval [CI], 0.65 to 0.86; P<0.001"
 *   "for an adjusted risk ratio of 0.82 (95% confidence interval [CI], 0.74 to 0.92; P<0.001)"
 *   "for a rate ratio of 1.17 (95% confidence interval [CI], 1.05 to 1.31; P=0.004)"
 *   "(risk ratio, 0.75; 95% CI, 0.45 to 1.26)"
 *   "(odds ratio [OR] 1.07, 95% CI 0.37 to 3.10)"   "(OR 5.67, 95% CI ...)"   "[HR = 0.76; 95% CI, 0.59-0.97]"
 *   "(hazard ratio 1·335, 95% CI 1·223-1·457)"       (middle-dot decimals)
 *   "(risk difference -1.7%, 95% CI -7.7% to 4.3%)"
 *   "hazard ratios (HRs) (nominal 95% CIs) were as follows: CHD, 1.29 (1.02-1.63); breast cancer, 1.26 (1.00-1.59)"  (list form)
 * Never invents values: anything not matched is simply not returned.
 */

export type MetricCode =
  | 'HR' | 'OR' | 'RR' | 'RATE_RATIO' | 'IRR' | 'RD' | 'ARR' | 'MD' | 'SMD' | 'NNT';

export interface ParsedEffect {
  metric: string;            // display name, e.g. "Hazard Ratio (HR)"
  metricCode: MetricCode;
  isRatio: boolean;
  adjusted: boolean;
  point: number;
  ciLow: number;
  ciHigh: number;
  raw: { point: string; lo: string; hi: string }; // exactly as printed in the paper (keeps "3.10", "−7.7")
  pValue: string;            // "P < 0.001" | "P = 0.004" | "P not reported"
  outcomeHint: string | null;// outcome phrase found in the sentence, or null (never a title fragment)
  subgroupHint: string | null; // e.g. 'older adults' when the clause ends 'in older adults ('
  sentence: string;
  index: number;             // char offset of the match inside the sentence
}

const NUM = String.raw`[-−–]?\d+(?:[.·]\d+)?`;

const METRIC = String.raw`(?<adj>adjusted\s+|unadjusted\s+|pooled\s+|summary\s+)?(?<metric>hazard\s+ratio|odds\s+ratio|risk\s+ratio|relative\s+risk|incidence\s+rate\s+ratio|rate\s+ratio|standardi[sz]ed\s+mean\s+difference|mean\s+difference|risk\s+difference|absolute\s+risk\s+(?:reduction|difference)|number\s+needed\s+to\s+treat|a?HR|a?OR|a?RR|IRR|SMD|MD|RD|ARR|NNT)`;

// metric → [optional "(HR)"/"[OR]"] → [optional "for <outcome>" | "in the X group"] → connector → point → CI
const MAIN = new RegExp(
  String.raw`\b${METRIC}(?:\s*[\(\[]\s*[A-Za-z]{1,5}s?\s*[\)\]])?` +
    String.raw`(?:\s+(?:for|of)\s+(?<forOutcome>(?:(?!\d)[^;:()\[\]]){3,140}?)(?=\s*(?:,|:|=|\bwas\b|\bwere\b|\bof\b)\s*${NUM}))?` +
    String.raw`(?:\s+in\s+the\s+[a-z\- ]{1,40}?\s+(?:group|arm))?` +
    String.raw`\s*(?:,|:|=|\bwas\b|\bwere\b|\bof\b|\bis\b)?\s*(?<point>${NUM})\s*%?` +
    String.raw`\s*[,;]?\s*[\(\[]?\s*(?:(?:nominal\s+)?95\s*%\s*(?:confidence\s+intervals?|CIs?|credible\s+interval|CrI)?(?:\s*[\(\[]\s*CIs?\s*[\)\]])?)?\s*[,:;=]?\s*` +
    String.raw`(?<lo>${NUM})\s*%?\s*(?:to|-|–|—|−|,)\s*(?<hi>${NUM})\s*%?`,
  'gi'
);

// list form: "hazard ratios ... were as follows: CHD, 1.29 (1.02-1.63); breast cancer, 1.26 (1.00-1.59)"
const LIST_HEAD = /\b(hazard|odds|risk|rate)\s+ratios?\b[^.]{0,120}?(?:as follows|were)\s*:/i;
const LIST_ITEM = new RegExp(
  String.raw`(?<label>[A-Za-z][A-Za-z0-9 '\-/]{1,60}?),\s*(?<point>${NUM})\s*\(\s*(?<lo>${NUM})\s*(?:to|-|–|—|−)\s*(?<hi>${NUM})\s*\)`,
  'g'
);

const rawNum = (s: string) => s.replace(/[−–]/g, '-').replace('·', '.');
// Lancet style: "... reached this endpoint (0.84, 0.72-0.98, p=0.027)" — metric inherited from the last named metric
const BARE = new RegExp(
  String.raw`\(\s*(?<point>${NUM})\s*[,;]\s*(?:95\s*%\s*CI\s*)?(?<lo>${NUM})\s*(?:to|-|–|—)\s*(?<hi>${NUM})\s*[,;]\s*[Pp]\s*[=<>≤]`,
  'g'
);

const toNum = (s: string) => parseFloat(s.replace(/[−–]/g, '-').replace('·', '.'));

function metricInfo(raw: string): { code: MetricCode; name: string; isRatio: boolean } {
  const m = raw.toLowerCase().replace(/\s+/g, ' ');
  if (/hazard|^a?hr$/.test(m)) return { code: 'HR', name: 'Hazard Ratio (HR)', isRatio: true };
  if (/odds|^a?or$/.test(m)) return { code: 'OR', name: 'Odds Ratio (OR)', isRatio: true };
  if (/incidence rate|^irr$/.test(m)) return { code: 'IRR', name: 'Incidence Rate Ratio (IRR)', isRatio: true };
  if (/^rate ratio$/.test(m)) return { code: 'RATE_RATIO', name: 'Rate Ratio', isRatio: true };
  if (/risk ratio|relative risk|^a?rr$/.test(m)) return { code: 'RR', name: 'Risk Ratio (RR)', isRatio: true };
  if (/standardi[sz]ed|^smd$/.test(m)) return { code: 'SMD', name: 'Standardised Mean Difference (SMD)', isRatio: false };
  if (/mean difference|^md$/.test(m)) return { code: 'MD', name: 'Mean Difference (MD)', isRatio: false };
  if (/absolute risk|^arr$/.test(m)) return { code: 'ARR', name: 'Absolute Risk Reduction (ARR)', isRatio: false };
  if (/risk difference|^rd$/.test(m)) return { code: 'RD', name: 'Risk Difference (RD)', isRatio: false };
  return { code: 'NNT', name: 'Number Needed to Treat (NNT)', isRatio: false };
}

/** P-value nearest AFTER the CI, inside the same clause; never the first P of the sentence. */
export function pValueAfter(sentence: string, from: number): string {
  const tail = sentence.slice(from, from + 60).split(/\)\s*[,;.]|\]\s*[,;.]/)[0];
  const m = tail.match(/\b[Pp]\s*(?:-?\s*value)?\s*(?<op>[<>=≤≥]|&lt;|&gt;)\s*(?<num>0?\.\d+|\d(?:\.\d+)?(?:\s*[x×]\s*10\s*[-−]\s*\d+)?)/);
  if (!m?.groups) return 'P not reported';
  let op = m.groups.op.replace('&lt;', '<').replace('&gt;', '>');
  let num = m.groups.num.startsWith('.') ? `0${m.groups.num}` : m.groups.num;
  return `P ${op} ${num}`;
}

/** Outcome phrase in the clause before the metric, by pattern priority. Returns null when unsure (caller shows "Unlabelled outcome"). */
export function outcomeHintBefore(sentence: string, metricIndex: number): string | null {
  const before = sentence.slice(Math.max(0, metricIndex - 260), metricIndex);
  const O = String.raw`(?<o>[A-Za-z][A-Za-z0-9'\- ]{1,80}?)`;
  const near: RegExp[] = [
    new RegExp(String.raw`\bdifferences?\s+in\s+(?:the\s+)?${O}\s+(?:between|among|across|with|for|\()`, 'gi'),
    new RegExp(String.raw`(?:frequency|incidence|rate|risk|odds|likelihood|chance|occurrence)\s+of\s+(?:an?\s+|the\s+|any\s+)?${O}\s*(?:\(|\[|\bwas\b|\bwere\b|\bin\b|\bwith\b|,)`, 'gi'),
    new RegExp(String.raw`\band\s+of\s+(?:the\s+)?${O}\s*\(`, 'gi'),
    new RegExp(String.raw`\b(?:reduced|increased|lowered|raised|decreased|improved|prevented)\s+(?:the\s+)?(?:(?:risk|rate|incidence|odds)\s+of\s+)?${O}\s*[\(\[]`, 'gi'),
    new RegExp(String.raw`(?:^|[.;:]\s*|\)\s*)${O}\s+(?:occurred|developed|was observed|was diagnosed)\s+in\b`, 'gi'),
    new RegExp(String.raw`\b(?:the|a|an)\s+${O}\s+rates?\s+(?:of|following|after|were|was|in)\b`, 'gi'),
    new RegExp(String.raw`effect of [A-Za-z0-9\- ]{1,30}? on\s+${O}\s+(?:per\b|in\b|for\b|\()`, 'gi'),
    /(?:a|an|the)\s+(?<o>primary[- ](?:composite\s+)?(?:outcome|end[- ]?point))(?:\s+event)?/gi,
  ];
  const far: RegExp[] = [
    /(?<o>primary (?:composite )?(?:outcome|end ?point))/gi,
    /(?<!controlling\s|adjusting\s|adjusted\s|accounting\s)\b(?:on|for|of)\s+(?<o>[a-z][a-z'\- ]{2,60}?)\s+(?:per woman|per participant|in (?:normal|poor) responders|was|were|\()/gi,
  ];
  // the outcome closest to the estimate wins among explicit constructions; generic patterns only as fallback
  for (const group of [near, far]) {
    let best: { o: string; end: number } | null = null;
    for (const re of group) {
      for (const m of before.matchAll(re)) {
        const cleaned = cleanHint(m.groups?.o ?? '');
        const end = (m.index ?? 0) + m[0].length;
        if (cleaned && (!best || end > best.end)) best = { o: cleaned, end };
      }
    }
    if (best) return best.o;
  }
  return null;
}

/** Population/subgroup qualifier right before the estimate: "... in older adults (HR 0.80" -> "older adults". */
export function subgroupBefore(sentence: string, metricIndex: number): string | null {
  const before = sentence.slice(Math.max(0, metricIndex - 120), metricIndex);
  const m = before.match(/\b(?:in|for|among)\s+(?<s>(?:poor|normal|high|low|older|younger)\s+[a-z\-]+|[a-z\-]+\s+responders|routine use[a-z ]{0,20}?|women with [a-z\- ]{3,30}?|patients with [a-z\- ]{3,30}?)\s*[\(\[]\s*$/i);
  return m?.groups?.s?.trim() ?? null;
}

function cleanHint(raw: string): string | null {
  const o = raw
    .replace(/\s+/g, ' ')
    .replace(/^.*\b(?:exhibited|had|showed|reported|achieved)\s+(?:an?\s+|the\s+)?(?=[A-Za-z])/i, '')
    .replace(/^(?:the|a|an|of|any)\s+/i, '')
    .replace(/^.*?\beffect of [a-z0-9\- ]+? on\s+/i, '')
    .replace(/^[A-Za-z0-9\-]{1,12}\s+on\s+/, '')
    .split(/\s+(?:than|compared|versus|vs|with the|in the|among|following an?|after an?)\b/i)[0]
    .trim();
  if (o.length < 2) return null;
  if (/\d|\b(?:patients|participants|women|men|group|arm|confounding|factors|placebo|control|intervention)\b/i.test(o)) return null;
  if (/^(?:the|this|that|it|there|we|our)$/i.test(o)) return null;
  return o;
}

function protect(text: string): string {
  return text
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')          // real tags only; keeps "P<0.001"
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\b(vs|et al|e\.g|i\.e|Fig|No|approx|ca)\./gi, '$1')
    .replace(/(\d)\.\s+(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ');
}

export function splitSentences(text: string): string[] {
  // split on ". " followed by a capital letter or section word — not inside "(…)"
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    else if ((c === ')' || c === ']') && depth > 0) depth--;
    else if (c === '.' && depth === 0 && /\s/.test(text[i + 1] || '') && /[A-Z(\[]/.test(text[i + 2] || '')) {
      out.push(text.slice(start, i + 1).trim()); start = i + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last) out.push(last);
  return out;
}

export function extractEffectEstimates(rawText: string, max = 12): ParsedEffect[] {
  const results: ParsedEffect[] = [];
  const seen = new Set<string>();
  let lastMetric: ReturnType<typeof metricInfo> | null = null;
  for (const sentence of splitSentences(protect(rawText))) {
    // 1. main grammar
    for (const m of sentence.matchAll(MAIN)) {
      const g = m.groups!;
      const info = metricInfo(g.metric);
      lastMetric = info;
      const point = toNum(g.point), lo = toNum(g.lo), hi = toNum(g.hi);
      if ([point, lo, hi].some(Number.isNaN)) continue;
      if (!(lo <= point && point <= hi)) continue;                 // CI must bracket the estimate
      if (info.isRatio && (point <= 0 || lo <= 0)) continue;       // ratios are positive
      const key = `${info.code}|${point}|${lo}|${hi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const forOutcome = g.forOutcome?.trim().replace(/\s+/g, ' ');
      results.push({
        metric: info.name, metricCode: info.code, isRatio: info.isRatio,
        adjusted: /adjusted/i.test(g.adj || '') || /^a(?:HR|OR|RR)$/.test(g.metric),
        point, ciLow: lo, ciHigh: hi,
        raw: { point: rawNum(g.point), lo: rawNum(g.lo), hi: rawNum(g.hi) },
        pValue: pValueAfter(sentence, (m.index ?? 0) + m[0].length),
        outcomeHint: forOutcome && !/^(?:the|this|each)\b/i.test(forOutcome) ? forOutcome : outcomeHintBefore(sentence, m.index ?? 0),
        subgroupHint: subgroupBefore(sentence, m.index ?? 0),
        sentence, index: m.index ?? 0,
      });
      if (results.length >= max) return results;
    }
    // 1b. bare tuple, only when a metric was named earlier in the text
    if (lastMetric) {
      for (const m of sentence.matchAll(BARE)) {
        const g = m.groups!;
        const point = toNum(g.point), lo = toNum(g.lo), hi = toNum(g.hi);
        if (!(lo <= point && point <= hi) || (lastMetric.isRatio && lo <= 0)) continue;
        const key = `${lastMetric.code}|${point}|${lo}|${hi}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          metric: lastMetric.name, metricCode: lastMetric.code, isRatio: lastMetric.isRatio, adjusted: false,
          point, ciLow: lo, ciHigh: hi, raw: { point: rawNum(g.point), lo: rawNum(g.lo), hi: rawNum(g.hi) },
          pValue: pValueAfter(sentence, (m.index ?? 0) + m[0].length - 3),
          outcomeHint: outcomeHintBefore(sentence, m.index ?? 0) ?? (sentence.match(/\b(?<o>secondary endpoint|primary endpoint|primary outcome|secondary outcome)\b/i)?.groups?.o ?? null),
          subgroupHint: null, sentence, index: m.index ?? 0,
        });
        if (results.length >= max) return results;
      }
    }
    // 2. list form
    const head = sentence.match(LIST_HEAD);
    if (head) {
      const info = metricInfo(head[1] + ' ratio');
      const listText = sentence.slice((head.index ?? 0) + head[0].length);
      for (const m of listText.matchAll(LIST_ITEM)) {
        const g = m.groups!;
        const point = toNum(g.point), lo = toNum(g.lo), hi = toNum(g.hi);
        if (!(lo <= point && point <= hi)) continue;
        const key = `${info.code}|${point}|${lo}|${hi}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          metric: info.name, metricCode: info.code, isRatio: true, adjusted: false,
          point, ciLow: lo, ciHigh: hi, raw: { point: rawNum(g.point), lo: rawNum(g.lo), hi: rawNum(g.hi) }, pValue: 'P not reported',
          outcomeHint: g.label.trim().replace(/^(?:and|or)\s+/i, ''),
          subgroupHint: null,
          sentence, index: (head.index ?? 0) + head[0].length + (m.index ?? 0),
        });
        if (results.length >= max) return results;
      }
    }
  }
  return results;
}

/** Null-crossing test that never mixes ratio and difference scales. */
export function crossesNull(e: Pick<ParsedEffect, 'isRatio' | 'ciLow' | 'ciHigh'>): boolean {
  const nullValue = e.isRatio ? 1 : 0;
  return e.ciLow <= nullValue && e.ciHigh >= nullValue;
}
