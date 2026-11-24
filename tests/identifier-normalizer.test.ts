import assert from 'assert';
import { normalizeIdentifier } from '../src/lib/parsers/identifier-normalizer';
const cases: [string, string, string][] = [
  ['  PMID: 27509101 ;  ', 'PMID', '27509101'],
  ['https://pubmed.ncbi.nlm.nih.gov/27509101/', 'PMID', '27509101'],
  ['10.1056/NEJMoa1513873.', 'DOI', '10.1056/NEJMoa1513873'],
  ['PMC10426717', 'PMCID', 'PMC10426717'],
];
for (const [inp, type, val] of cases) {
  const r = normalizeIdentifier(inp);
  assert.strictEqual(r.type, type, `${inp} → ${r.type}`);
  assert.strictEqual(r.normalizedValue, val, `${inp} → ${r.normalizedValue}`);
}
assert.strictEqual(normalizeIdentifier('Does AI improve embryo selection?').type, 'UNKNOWN');
console.log('✅ identifier normalizer tests passed');
