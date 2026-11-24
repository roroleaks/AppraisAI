/**
 * evidence-cues.ts — item-specific evidence for checklists and review-quality domains.
 * Lookup is by item/domain NAME, never by array index. A sentence may support two items
 * only if it matches both items' own cues (e.g. "(Funded by …; ClinicalTrials.gov NCT…)").
 */

export const sentencesOf = (text: string): string[] =>
  text
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/\b(vs|et al|e\.g|i\.e|Fig|No)\./gi, '$1__DOT__')
    // abstract section headings act as sentence breaks ("… outcomes. Search methods We searched …")
    .replace(/\s(?=(?:Background|Objectives?|Methods?|Search methods|Selection criteria|Data collection and analysis|Main results|Results|Conclusions?|Authors' conclusions|Design|Setting|Participants|Interventions|Findings|Interpretation|Funding|BACKGROUND|OBJECTIVES?|METHODS?|SEARCH METHODS|SELECTION CRITERIA|DATA COLLECTION AND ANALYSIS|MAIN RESULTS|RESULTS|CONCLUSIONS?|AUTHORS' CONCLUSIONS):?\s+[A-Z])/g, '\n')
    .split(/(?<=[.?!])\s+(?=[A-Z(\[])|\n/)
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter((s) => s.length > 15 && s.length < 1200);

export function findCue(text: string, cue: RegExp, reject?: RegExp): string | null {
  for (const s of sentencesOf(text)) if (cue.test(s) && !(reject && reject.test(s))) return s;
  return null;
}

/** Reporting-checklist cues keyed by words in the item label (CONSORT 2025, PRISMA 2020, TRIPOD+AI, STROBE). */
export const CHECKLIST_CUES: Array<{ label: RegExp; cue: RegExp; reject?: RegExp; structural?: 'title-design' | 'structured-abstract' }> = [
  { label: /title/i, cue: /./, structural: 'title-design' },
  { label: /structured abstract|structured summary|abstract/i, cue: /./, structural: 'structured-abstract' },
  { label: /registration/i, cue: /\b(?:ClinicalTrials\.gov|NCT\d{8}|ISRCTN\d+|ANZCTR|ACTRN\d+|ChiCTR|EudraCT|DRKS\d+|CTRI\/|UMIN|PROSPERO|CRD\d{8,})\b|\bregistered\b/i },
  { label: /protocol|sap|analysis plan/i, cue: /\b(?:protocol|statistical analysis plan)\b[^.]{0,80}\b(?:available|published|accessible|online|supplementary|appendix)\b/i },
  { label: /funding|coi|competing/i, cue: /\b(?:funded|supported|sponsored)\s+by\b|\bgrant(?:s)?\s+from\b|\bcompeting interests?\b|\bconflicts? of interest\b|\bfunding\b/i },
  { label: /background|rationale/i, cue: /\b(?:is|are|remains?)\s+(?:uncertain|unclear|unknown|limited|controversial)\b|\blittle is known\b|\bevidence (?:is|was) (?:lacking|limited|conflicting)\b|\bpreferred\b|\bsome evidence suggests\b|\bhowever\b/i, reject: /\b(?:\d+(?:\.\d+)?%|95%\s*CI|hazard ratio|odds ratio|P\s*[<=])/i },
  { label: /objective|hypothes|aim/i, cue: /\b(?:we (?:aimed|sought|hypothesi[sz]ed|investigated|evaluated|assessed|compared)|to (?:determine|assess|evaluate|compare|investigate) whether|the (?:aim|objective)s? (?:of this|was|were))\b/i },
  { label: /eligibility|criteria/i, cue: /\b(?:inclusion|exclusion|eligibility) criteria\b|\beligible (?:women|patients|participants|studies)\b|\bwere eligible\b|\bselection criteria\b/i },
  { label: /sample size/i, cue: /\b(?:sample size|power calculation|powered to detect|(?:80|90)%\s*power|was calculated to provide)\b/i },
  { label: /sequence/i, cue: /\b(?:computer-generated|permuted[- ]block|random(?:i[sz]ation)? sequence|block randomi[sz]ation|stratified randomi[sz]ation|minimi[sz]ation)\b/i },
  { label: /concealment/i, cue: /\b(?:allocation concealment|central(?:ised|ized)? (?:randomi[sz]ation|allocation)|interactive (?:web|voice) response|sealed opaque envelopes?|sequentially numbered)\b/i },
  { label: /blind|mask/i, cue: /\b(?:double-blind|single-blind|triple-blind|open-label|masked|blinded|matching placebo|unblinded)\b/i },
  { label: /participant flow|flow/i, cue: /\b(?:withdrew|lost to follow-?up|discontinued|were excluded after|flow diagram|completed the (?:trial|study)|included in the (?:analysis|primary analysis)|underwent randomi[sz]ation)\b/i, reject: /^[^.]*\brandomly assigned\b[^.]*$/i },
  { label: /outcomes? & estimation|outcome estimates|results of syntheses|outcomes and estimation|estimation/i, cue: /\b95%\s*(?:CI|confidence interval)\b/i },
  { label: /limitation/i, cue: /\blimitations?\b|\bcaveat|\bweakness(?:es)?\b|\bshould be interpreted with caution\b|\bmay not be generali[sz]able\b/i },
  { label: /search strategy|information sources/i, cue: /\b(?:searched|search methods|search strategy)\b[^.]{0,200}\b(?:MEDLINE|PubMed|Embase|CENTRAL|Cochrane|Scopus|Web of Science|registr)/i },
  { label: /risk of bias assessment|study risk of bias/i, cue: /\b(?:risk of bias|RoB ?2|ROBINS|Newcastle[- ]Ottawa|QUADAS|PROBAST|Downs? and Black|quality assessment)\b/i },
  { label: /synthesis methods/i, cue: /\b(?:random-effects|fixed-effect|pooled|meta-analy[sz]ed|narrative synthesis|I\s*[²2]\b|heterogeneity was)\b/i, reject: /\bcertainty\b/i },
  { label: /discussion|certainty/i, cue: /\b(?:certainty of (?:the )?evidence|GRADE|low-certainty|very low-certainty|moderate-certainty|high-certainty)\b/i },
  { label: /data source/i, cue: /\b(?:retrospective(?:ly)?|prospective(?:ly)?|database|registry|images? (?:from|of)|videos? (?:from|of)|collected (?:from|at))\b/i },
  { label: /performance/i, cue: /\b(?:AUC|area under|c-statistic|calibration|sensitivity|specificity|accuracy)\b/i },
  { label: /validation/i, cue: /\b(?:external(?:ly)? validat|internal validat|cross-validation|bootstrap|independent (?:test|validation) set|temporal validat)/i },
  { label: /fairness|subgroup/i, cue: /\b(?:subgroups?|across (?:age|ethnic|clinics|centres|centers)|fairness|bias across)\b/i },
];

/** AMSTAR 2 critical domains keyed by NAME. */
export const AMSTAR_CUES: Array<{ domain: RegExp; cue: RegExp; note: string }> = [
  { domain: /protocol/i, cue: /\b(?:PROSPERO|CRD\d{8,}|protocol (?:was )?(?:registered|published)|a priori protocol|registration number)\b/i, note: 'A priori protocol / registration not found in available text.' },
  { domain: /search/i, cue: /\b(?:searched|search methods|search strategy)\b[^.]{0,250}\b(?:MEDLINE|PubMed|Embase|CENTRAL|Cochrane|Scopus|Web of Science)\b/i, note: 'Databases searched not found in available text.' },
  { domain: /excluded/i, cue: /\b(?:excluded studies|reasons for exclusion|list of excluded|were excluded because)\b/i, note: 'List or justification of excluded studies not found in available text.' },
  { domain: /risk of bias assessment/i, cue: /\b(?:risk of bias|RoB ?2|ROBINS|Newcastle[- ]Ottawa|QUADAS|PROBAST|Downs? and Black)\b[^.]{0,80}\b(?:assessed|evaluated|using|tool)\b|\b(?:assessed|assessment of)\s+(?:the\s+)?(?:trial\s+|study\s+)?risk of bias\b/i, note: 'Risk-of-bias tool for included studies not found in available text.' },
  { domain: /pooling|statistical/i, cue: /\b(?:random-effects|fixed-effect|Mantel-Haenszel|inverse variance|DerSimonian)\b/i, note: 'Pooling model not found in available text.' },
  { domain: /consideration|interpret/i, cue: /\b(?:certainty of (?:the )?evidence|GRADE|sensitivity analys[ie]s (?:excluding|restricted to)|low-certainty|very low-certainty)\b/i, note: 'Use of risk of bias when interpreting results not found in available text.' },
  { domain: /publication bias/i, cue: /\b(?:funnel plot|Egger|Begg|publication bias|small-study effects?)\b/i, note: 'Publication-bias assessment not found in available text.' },
];
