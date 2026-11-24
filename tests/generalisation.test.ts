/**
 * Generalisation gate — must pass before any deploy.
 * Part A: invariants on EVERY fixture (benchmark + holdout + generalisation). No paper-specific expectations.
 * Part B: verified expected values for papers the engine was NOT tuned on.
 * Run: npx tsx tests/generalisation.test.ts
 */
import fs from 'fs';
import path from 'path';
import { generateDeterministicAppraisal } from '../src/lib/evaluators/deterministic-appraisal';

type Raw = any;
const ROOTS = ['tests/benchmark', 'tests/holdout/fixtures', 'tests/generalisation/fixtures'];

const cleanXml = (t: string) =>
  (t || '').replace(/<\/?[a-zA-Z][^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function load(file: string): { id: string; raw: Raw } {
  let d = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (d.resultList) d = d.resultList.result[0];
  return { id: path.basename(file, '.json'), raw: d };
}

function toManuscript(id: string, r: Raw): any {
  const abstract = cleanXml(r.abstractText || r.abstract || '');
  const pubTypes = r.pubTypeList?.pubType || [];
  const corrections = r.commentCorrectionList?.commentCorrection || [];
  const retracted = pubTypes.some((p: string) => /retracted publication/i.test(p)) || corrections.some((c: any) => /retraction in/i.test(c.type || ''));
  return {
    id,
    metadata: {
      title: r.title || r.metadata?.title || '',
      authors: (r.authorString || '').split(',').map((a: string) => a.trim()).filter(Boolean),
      journal: r.journalInfo?.journal?.title || r.metadata?.journal || 'Unknown',
      publicationYear: Number(r.pubYear || r.metadata?.publicationYear || 2024),
      pmid: r.pmid, doi: r.doi, publicationTypes: pubTypes,
      vancouverCitation: '', sourceDepth: 'ABSTRACT_ONLY_FALLBACK', openAccess: false,
    },
    retraction: retracted ? { isRetracted: true, retractionCitation: 'Retraction notice', hasExpressionOfConcern: false } : undefined,
    abstract, fullText: abstract, sections: [], tablesRaw: [], pageCount: 1, contentAvailable: Boolean(abstract),
    extractedAt: new Date().toISOString(),
  };
}

const norm = (s: string) => s.replace(/[−–]/g, '-').replace(/·/g, '.');
// a hyphen directly after a digit is a range dash ("1.54-20.80"), not a minus sign
const numsIn = (s: string) => {
  const out = new Set<string>();
  for (const n of norm(s).match(/(?<![\d.])-?\d+(?:\.\d+)?/g) || []) { out.add(String(parseFloat(n))); out.add(String(Math.abs(parseFloat(n)))); }
  return out;
};

const TEMPLATE_STRINGS = [
  'administered in accordance with', 'Patients presenting with or evaluated for', 'alongside standard guideline therapy',
  'Clinical investigation centers', 'Multicenter medical centers and clinical research hospitals',
  'Follow-up duration prespecified in clinical trial protocol', 'Primary clinical endpoints defined in',
  'Primary therapeutic intervention described in',
];

let failures = 0;
const fail = (id: string, msg: string) => { failures++; console.log(`  ❌ ${id}: ${msg}`); };

// ---------------- Part A: invariants ----------------
console.log('\n=== Part A — invariants on all fixtures ===');
const files = ROOTS.filter((r) => fs.existsSync(r)).flatMap((r) => fs.readdirSync(r).filter((f) => f.endsWith('.json')).map((f) => path.join(r, f)));
const reports: Record<string, any> = {};
for (const f of files) {
  const { id, raw } = load(f);
  const m = toManuscript(id, raw);
  if (!m.abstract) continue;
  const rep: any = generateDeterministicAppraisal(m);
  reports[id] = rep;
  const absNums = numsIn(m.abstract);
  const title = (m.metadata.title || '').toLowerCase();
  const hasPrimaryDef = /\bprimary\s+(?:review\s+|efficacy\s+)?(?:outcomes?|end\s*points?)\b/i.test(m.abstract);

  // A1: every reported number must exist in the source text
  for (const e of rep.statisticalAudit?.effectEstimates || []) {
    const ci = (String(e.confidenceInterval || '').replace(/^95%\s*CI:?/i, '').match(/(?<![\d.])-?\d+(?:\.\d+)?/g) || []);
    for (const n of [e.pointEstimate, ...ci]) {
      if (n && !absNums.has(String(Math.abs(parseFloat(norm(String(n))))))) fail(id, `number ${n} not found in source`);
    }
    // A2: outcome label is never a title fragment or a sentence fragment
    const lab = String(e.outcomeLabel || e.outcome || '');
    if (lab.length > 30 && title.includes(lab.toLowerCase().slice(0, 30))) fail(id, `outcome label is a title fragment: "${lab}"`);
    if (/\($|^than\b|^in the\b|group \($/i.test(lab.trim())) fail(id, `outcome label is a sentence fragment: "${lab}"`);
  }
  // A3: no primary outcome unless the paper states one (no title fallbacks)
  const po = (rep.pico?.primaryOutcomes || []).filter((x: string) => x && !/not (?:identified|reported|extracted|explicitly defined)/i.test(x));
  if (!hasPrimaryDef && po.length) fail(id, `primary outcome invented without a definition in text: "${po[0]}"`);
  // A4: no template sentences anywhere in PICO
  const picoText = JSON.stringify(rep.pico || {});
  for (const t of TEMPLATE_STRINGS) if (picoText.includes(t)) fail(id, `template text in PICO: "${t}"`);
  // A5: deterministic engine never grades, never asserts "no spin"/"no fatal flaws"
  const g = rep.validitySynthesis?.gradeCertainty;
  if (g && g !== 'NOT_GRADED_HEURISTIC') fail(id, `deterministic GRADE emitted: ${g}`);
  if (rep.statisticalAudit?.spinAndDiscrepancyAudit?.spinStatus === 'assessed-negative') fail(id, 'spin asserted negative in heuristic mode');
}

// ---------------- Part B: verified expectations (sources: Europe PMC abstracts) ----------------
console.log('\n=== Part B — verified values on papers not used for tuning ===');
type Exp = { id: string; design?: string; primary?: { point: string; lo: string; hi: string } | null; mustContain?: string[]; mustNotPrimary?: string[] };
const EXPECT: Exp[] = [
  { id: 'U1_27509101', design: 'RCT', primary: { point: '1.17', lo: '1.05', hi: '1.31' }, mustContain: ['0.19', '0.67'] },          // Chen NEJM 2016
  { id: 'U2_32865377', design: 'RCT', primary: { point: '0.75', lo: '0.65', hi: '0.86' }, mustNotPrimary: ['0.70', '0.7'] },        // EMPEROR-Reduced
  { id: 'U3_35363951', design: 'RCT', primary: { point: '0.82', lo: '0.74', hi: '0.92' } },                                          // CHAP
  { id: 'H1_12117397', design: 'RCT', mustContain: ['1.29', '1.26'] },                                                               // WHI list form
  { id: 'H4_42132476', mustContain: ['0.76'] },                                                                                      // bracketed HR
  { id: 'H5_16214598', design: 'RCT', primary: { point: '0.9', lo: '0.8', hi: '1.02' } },                                            // PROactive (British "randomised")
  { id: 'S1_synthetic_hf', primary: null },
  { id: 'S2_synthetic_preeclampsia', primary: null },
];
const f2 = (s: any) => String(parseFloat(String(s)));
for (const e of EXPECT) {
  const r = reports[e.id];
  if (!r) { fail(e.id, 'fixture missing'); continue; }
  const ests = r.statisticalAudit?.effectEstimates || [];
  if (e.design && r.classification?.studyDesign !== e.design) fail(e.id, `design ${r.classification?.studyDesign} ≠ ${e.design}`);
  const prim = ests.find((x: any) => x.isPrimary);
  if (e.primary === null && prim) fail(e.id, `primary estimate should be null, got ${prim.pointEstimate}`);
  if (e.primary) {
    if (!prim) fail(e.id, `no primary estimate (expected ${e.primary.point})`);
    else {
      const ci = String(prim.confidenceInterval).replace(/^95%\s*CI:?/i, '').match(/(?<![\d.])-?\d+(?:\.\d+)?/g) || [];
      if (f2(prim.pointEstimate) !== f2(e.primary.point) || f2(ci[0]) !== f2(e.primary.lo) || f2(ci[1]) !== f2(e.primary.hi))
        fail(e.id, `primary ${prim.pointEstimate} ${prim.confidenceInterval} ≠ ${e.primary.point} (${e.primary.lo}–${e.primary.hi})`);
    }
  }
  for (const v of e.mustContain || []) if (!ests.some((x: any) => f2(x.pointEstimate) === f2(v))) fail(e.id, `estimate ${v} not extracted`);
  for (const v of e.mustNotPrimary || []) if (prim && f2(prim.pointEstimate) === f2(v)) fail(e.id, `wrong primary ${v}`);
  // A primary-outcome label must not be "Embryo transfer"/process when the defined primary is clinical
  if (prim && /embryo transfer|oocyte/i.test(prim.outcomeLabel || '') && !/embryo transfer|oocyte/i.test((r.pico?.primaryOutcomes || []).join(' ')))
    fail(e.id, `primary mislabelled as process outcome "${prim.outcomeLabel}"`);
}


console.log(`\n${failures === 0 ? '✅ GENERALISATION GATE PASSED' : `❌ ${failures} failure(s)`}`);
process.exit(failures === 0 ? 0 : 1);
