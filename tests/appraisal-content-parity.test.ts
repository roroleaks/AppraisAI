import { generateDeterministicAppraisal } from '../src/lib/evaluators/deterministic-appraisal';
import { ParsedManuscriptPayload } from '../src/lib/schemas/ingestion.schema';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

async function runParityTests() {
  console.log('--- Testing Appraisal Content Parity (Non-Hardcoded Dynamic Extraction) ---');

  // Paper A: DAPA-HF Trial (Heart Failure RCT)
  const dapaHfManuscript: ParsedManuscriptPayload = {
    id: 'mock-dapa-hf',
    metadata: {
      title: 'Dapagliflozin in Patients with Heart Failure and Reduced Ejection Fraction',
      authors: ['John J.V. McMurray', 'Scott D. Solomon', 'Silvio E. Inzucchi'],
      journal: 'New England Journal of Medicine',
      publicationYear: 2019,
      doi: '10.1056/NEJMoa1911303',
      pmid: '31535829',
      sourceDepth: 'ABSTRACT_ONLY_FALLBACK',
      openAccess: true,
      vancouverCitation:
        'McMurray JJV, Solomon SD, Inzucchi SE, et al. Dapagliflozin in Patients with Heart Failure and Reduced Ejection Fraction. N Engl J Med. 2019;381(21):1995-2008.',
    },
    abstract:
      'BACKGROUND: In patients with heart failure and reduced ejection fraction, the effects of dapagliflozin are not known. ' +
      'METHODS: In this phase 3 trial, we randomly assigned 4744 patients with New York Heart Association class II, III, or IV heart failure ' +
      'and an ejection fraction of 40% or less to receive either dapagliflozin (at a dose of 10 mg once daily) or matching placebo. ' +
      'The primary outcome was a composite of worsening heart failure or cardiovascular death. ' +
      'RESULTS: The primary outcome occurred in 386 of 2373 patients in the dapagliflozin group and in 502 of 2371 patients in the placebo group ' +
      '(hazard ratio, 0.74; 95% confidence interval [CI], 0.65 to 0.85; P<0.001). ' +
      'CONCLUSIONS: Among patients with heart failure and reduced ejection fraction, the risk of worsening heart failure or death from cardiovascular causes was lower with dapagliflozin.',
    fullText: '',
    sections: [],
    tablesRaw: [],
    pageCount: 1,
    extractedAt: new Date().toISOString(),
  };

  // Paper B: COVID-19 Clinical Management Observational / Review
  const covidManuscript: ParsedManuscriptPayload = {
    id: 'mock-covid-staging',
    metadata: {
      title: 'COVID-19 Illness in Native and Immunosuppressed States: A Clinical-Therapeutic Staging Proposal',
      authors: ['Hasan K. Siddiqi', 'Mandeep R. Mehra'],
      journal: 'The Journal of Heart and Lung Transplantation',
      publicationYear: 2020,
      doi: '10.1016/j.healun.2020.03.012',
      pmid: '32362331',
      pmcid: 'PMC7118652',
      sourceDepth: 'ABSTRACT_ONLY_FALLBACK',
      openAccess: true,
      vancouverCitation:
        'Siddiqi HK, Mehra MR. COVID-19 Illness in Native and Immunosuppressed States: A Clinical-Therapeutic Staging Proposal. J Heart Lung Transplant. 2020;39(5):405-407.',
    },
    abstract:
      'The pandemic of coronavirus disease 2019 (COVID-19) caused by SARS-CoV-2 presents severe clinical challenges across native and immunocompromised patients. ' +
      'We propose a three-stage clinical classification based on disease severity: Stage I (early infection), Stage II (pulmonary phase), and Stage III (systemic hyperinflammation). ' +
      'Targeted therapeutic interventions should be calibrated to the specific pathophysiological phase to prevent respiratory failure and multisystem organ decompensation.',
    fullText: '',
    sections: [],
    tablesRaw: [],
    pageCount: 1,
    extractedAt: new Date().toISOString(),
  };

  const reportA = generateDeterministicAppraisal(dapaHfManuscript);
  const reportB = generateDeterministicAppraisal(covidManuscript);

  // Assertion 1: Dynamic Population Differentiation
  assert(
    reportA.pico.population !== reportB.pico.population,
    'Paper A and Paper B produce distinct, non-identical population extractions'
  );

  // Assertion 2: Paper A PICO is specific to Heart Failure
  assert(
    reportA.pico.population.toLowerCase().includes('heart failure') ||
      reportA.pico.population.toLowerCase().includes('reduced ejection fraction') ||
      reportA.pico.population.toLowerCase().includes('4,744') ||
      reportA.pico.population.toLowerCase().includes('4744'),
    `Paper A population mentions Heart Failure or sample size: "${reportA.pico.population}"`
  );

  // Assertion 3: Paper B PICO is specific to COVID-19 / immunocompromised
  assert(
    reportB.pico.population.toLowerCase().includes('covid-19') ||
      reportB.pico.population.toLowerCase().includes('immunosuppressed') ||
      reportB.pico.population.toLowerCase().includes('sars-cov-2'),
    `Paper B population mentions COVID-19: "${reportB.pico.population}"`
  );

  // Assertion 4: NO template leakage (no vaginal restoration)
  assert(
    !reportA.pico.population.toLowerCase().includes('vaginal') &&
      !reportA.pico.interventionOrExposure.toLowerCase().includes('vaginal') &&
      !reportB.pico.population.toLowerCase().includes('vaginal') &&
      !reportB.pico.interventionOrExposure.toLowerCase().includes('vaginal'),
    'Zero template leakage: neither report mentions hardcoded vaginal restoration'
  );

  // Assertion 5: Dynamic Intervention Extraction
  assert(
    reportA.pico.interventionOrExposure.toLowerCase().includes('dapagliflozin'),
    `Paper A intervention correctly identifies Dapagliflozin: "${reportA.pico.interventionOrExposure}"`
  );

  // Assertion 6: Dynamic Effect Estimate regex extraction in Paper A
  const hrEstimate = reportA.statisticalAudit.effectEstimates.find(
    (e) => e.pointEstimate === '0.74' || e.confidenceInterval.includes('0.65 to 0.85')
  );
  assert(
    !!hrEstimate,
    `Paper A correctly parsed numerical Hazard Ratio (0.74 [95% CI, 0.65 to 0.85]): ${JSON.stringify(
      hrEstimate || reportA.statisticalAudit.effectEstimates
    )}`
  );

  // Assertion 7: Classification parity
  assert(
    reportA.classification.studyDesign === 'RCT' &&
      reportA.classification.equatorReportingGuideline === 'CONSORT 2010',
    `Paper A classified as RCT under CONSORT 2010`
  );

  // Assertion 8: Vancouver References dynamically cite the analyzed paper
  assert(
    reportA.references[0].vancouverCitation.includes('McMurray') ||
      reportA.references[0].vancouverCitation.includes('Dapagliflozin'),
    'Report A Reference #1 is the analyzed DAPA-HF paper'
  );
  assert(
    reportB.references[0].vancouverCitation.includes('Siddiqi') ||
      reportB.references[0].vancouverCitation.includes('COVID-19'),
    'Report B Reference #1 is the analyzed COVID-19 paper'
  );

  console.log('✅ All appraisal content parity tests PASSED without error!');
}

runParityTests().catch((err) => {
  console.error('Appraisal parity test failed:', err);
  process.exit(1);
});
