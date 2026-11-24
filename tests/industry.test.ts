import assert from 'assert';
import { detectIndustryInvolvement } from '../src/lib/evaluators/trial-integrity';

const t = (text: string, aff: string[] = []) => detectIndustryInvolvement(text, aff);

// must flag
assert.ok(
  t('Supplementary Appendix ## Role of the funding source The project was funded by a grant from Vitrolife.').industryFunded,
  'funded by a grant from <company>'
);
assert.ok(
  t('The trial was implemented using EmbryoScope incubators and received funding from the manufacturer, Vitrolife, Denmark.').industryFunded,
  'received funding from the manufacturer, <company>'
);
assert.ok(
  t('(Funded by Boehringer Ingelheim and Eli Lilly; EMPEROR-Reduced ClinicalTrials.gov number, NCT03057977.)').industryFunded,
  'Funded by <pharma>'
);
assert.ok(
  t('', ['Vitrolife, Viby J, Denmark.']).industryAffiliatedAuthors,
  'company-affiliated author'
);

// must NOT flag
assert.ok(
  !t('This study was funded by Monash Data Future Institute.', ['Monash IVF, Melbourne, Victoria, Australia.']).industryFunded,
  'academic funder'
);
assert.ok(
  !t('Funded by the National Heart, Lung, and Blood Institute.').industryFunded,
  'government funder'
);

// evidence string always present when flagged
const e = t('The project was funded by a grant from Vitrolife.');
assert.ok(e.evidence.some((x) => /Vitrolife/.test(x)), 'evidence names the company');
console.log('✅ industry detection tests passed');
