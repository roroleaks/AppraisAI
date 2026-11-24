import fs from 'fs';
import path from 'path';
import { generateDeterministicAppraisal } from '../src/lib/evaluators/deterministic-appraisal';

const cleanXml = (t: string) =>
  (t || '').replace(/<\/?[a-zA-Z][^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function toManuscript(id: string, r: any): any {
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

const dir = 'tests/generalisation/live';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();

console.log('| PMID | Study Design | Primary Estimate (Metric Point [95% CI] P) | Outcome Label | Arms (I vs C) | Oxford Level | Note / Critique |');
console.log('|---|---|---|---|---|---|---|');

for (const f of files) {
  const pmid = f.replace(/^L_|\.json$/g, '');
  const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
  const m = toManuscript(pmid, raw);
  const rep = generateDeterministicAppraisal(m);
  
  const design = rep.classification?.studyDesign || 'Unknown';
  const pe = rep.statisticalAudit?.primaryEstimate;
  const estStr = pe
    ? `${pe.metric} ${pe.pointEstimate} (${pe.confidenceInterval || 'no CI'}, ${pe.pValue || 'no P'})`
    : 'None extracted (abstract text lacked explicit effect size or primary outcome definition)';
  const outLab = pe?.outcomeLabel || rep.pico?.primaryOutcomes?.[0] || 'None';
  const armI = rep.pico?.interventionOrExposure || 'Not reported';
  const armC = rep.pico?.comparator || 'Not reported';
  const armsStr = `${armI} vs ${armC}`;
  const level = rep.classification?.oxfordEvidenceLevel || 'Unknown';
  
  let critique = 'Plausible';
  if (pe && !pe.confidenceInterval && !pe.pValue) critique = 'Point estimate only (CI/P not in text)';
  if (!pe && design === 'RCT') critique = 'No primary effect size in abstract';
  
  console.log(`| [${pmid}](https://pubmed.ncbi.nlm.nih.gov/${pmid}) | \`${design}\` | ${estStr} | ${outLab} | ${armsStr.slice(0, 70)} | \`${level}\` | ${critique} |`);
}
