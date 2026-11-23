import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { generateDeterministicAppraisal } from '../../src/lib/evaluators/deterministic-appraisal';
import { ParsedManuscriptPayload } from '../../src/lib/schemas/ingestion.schema';

function cleanXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function mapEpmcToManuscript(raw: any, id: string): ParsedManuscriptPayload {
  const authorString = raw.authorString || '';
  const authors = authorString ? authorString.split(',').map((a: string) => a.trim()) : [];
  const journal = raw.journalInfo?.journal?.title || raw.journalTitle || 'Biomedical Journal';
  const pubYear = Number(raw.pubYear || 2024);
  const abstract = cleanXml(raw.abstractText || '');

  const pubTypes = raw.pubTypeList?.pubType || [];
  const corrections = raw.commentCorrectionList?.commentCorrection || [];
  const isRetracted =
    pubTypes.some((pt: string) => /retracted publication/i.test(pt)) ||
    corrections.some((c: any) => /retraction in/i.test(c.type || ''));
  const retractionCitation = corrections.find((c: any) => /retraction in/i.test(c.type || ''))?.reference;

  return {
    id,
    metadata: {
      title: raw.title || '',
      authors,
      journal,
      publicationYear: pubYear,
      volume: raw.journalInfo?.volume,
      issue: raw.journalInfo?.issue,
      pages: raw.pageInfo,
      doi: raw.doi,
      pmid: raw.pmid,
      pmcid: raw.pmcid,
      vancouverCitation: `${authors.slice(0, 6).join(', ')}. ${raw.title} ${journal}. ${pubYear}.`,
      sourceDepth: 'ABSTRACT_ONLY_FALLBACK',
      openAccess: raw.isOpenAccess === 'Y',
    },
    retraction: isRetracted
      ? {
          isRetracted: true,
          retractionCitation: retractionCitation || 'Retraction notice published',
          hasExpressionOfConcern: corrections.some((c: any) => /expression of concern/i.test(c.type || '')),
        }
      : undefined,
    abstract,
    fullText: abstract,
    sections: [],
    tablesRaw: [],
    pageCount: 1,
    contentAvailable: Boolean(abstract),
    extractedAt: new Date().toISOString(),
  };
}

function loadFixture(filename: string): any {
  const p = path.join(__dirname, 'fixtures', filename);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

interface FieldResult {
  field: string;
  expected: string;
  observed: string;
  passed: boolean;
}

interface PaperResult {
  id: string;
  name: string;
  fields: FieldResult[];
  overallPassed: boolean;
}

async function runHoldoutValidation() {
  console.log('========================================================');
  console.log('  AppraisAI Held-Out Anti-Overfitting Validation Suite  ');
  console.log('========================================================\n');

  const results: PaperResult[] = [];

  // -------------------------------------------------------------
  // H1: RCT with harm outcome: WHI Trial (PMID 12117397)
  // Expected:
  // - Design: RCT
  // - Primary outcome: Coronary heart disease / breast cancer
  // - Primary estimate + CI + P: HR 1.29 (1.02-1.63) or breast cancer HR 1.26 (1.00-1.59)
  // - Outcome type: harm
  // - Retraction flag: false
  // -------------------------------------------------------------
  {
    const raw = loadFixture('H1_12117397.json');
    const manuscript = mapEpmcToManuscript(raw, 'H1');
    const appraisal = generateDeterministicAppraisal(manuscript);
    const estimates = appraisal.statisticalAudit.effectEstimates;
    const harmOrChd = estimates.find((e) =>
      /coronary|chd|breast|stroke|pulmonary|embolism/i.test(e.outcome || e.outcomeLabel || '')
    ) || estimates[0];

    const fields: FieldResult[] = [
      {
        field: 'Study Design',
        expected: 'RCT',
        observed: appraisal.classification.studyDesign,
        passed: appraisal.classification.studyDesign === 'RCT',
      },
      {
        field: 'Primary Outcome',
        expected: 'Coronary heart disease / breast cancer / cardiovascular events',
        observed: harmOrChd?.outcome || appraisal.pico.primaryOutcomes.join('; '),
        passed: /coronary|chd|heart|breast|cardiovascular/i.test(
          (harmOrChd?.outcome || '') + ' ' + appraisal.pico.primaryOutcomes.join(' ')
        ),
      },
      {
        field: 'Primary Estimate + CI + P',
        expected: 'HR 1.29 (95% CI 1.02 to 1.63) or HR 1.26 (1.00 to 1.59)',
        observed: `${harmOrChd?.metric} ${harmOrChd?.pointEstimate} (${harmOrChd?.confidenceInterval}, ${harmOrChd?.pValue})`,
        passed:
          (harmOrChd?.pointEstimate === '1.29' || harmOrChd?.pointEstimate === '1.26' || harmOrChd?.pointEstimate === '1.41') &&
          harmOrChd?.confidenceInterval.length > 0,
      },
      {
        field: 'Outcome Type',
        expected: 'harm',
        observed: harmOrChd?.outcomeType || 'undefined',
        passed: harmOrChd?.outcomeType === 'harm',
      },
      {
        field: 'Retraction Flag',
        expected: 'false (active)',
        observed: String(Boolean(manuscript.retraction?.isRetracted)),
        passed: !manuscript.retraction?.isRetracted,
      },
    ];

    results.push({
      id: 'H1',
      name: "WHI Hormone Therapy Trial (PMID 12117397) - RCT with Harm Outcome",
      fields,
      overallPassed: fields.every((f) => f.passed),
    });
  }

  // -------------------------------------------------------------
  // H2: Non-inferiority RCT: Chinese Indomethacin Trial (PMID 42140208)
  // Expected:
  // - Design: RCT
  // - Primary outcome: Post-ERCP pancreatitis (PEP)
  // - Primary estimate + CI + P: Risk difference 0.38% (-1.71 to 2.47), P = 0.72
  // - Outcome type: non-inferiority demonstrated (or benefit/neutral)
  // - Retraction flag: false
  // -------------------------------------------------------------
  {
    const raw = loadFixture('H2_42140208.json');
    const manuscript = mapEpmcToManuscript(raw, 'H2');
    const appraisal = generateDeterministicAppraisal(manuscript);
    const estimates = appraisal.statisticalAudit.effectEstimates;
    const pepEst = estimates.find((e) => /pep|pancreatitis/i.test(e.outcome || e.outcomeLabel || '')) || estimates[0];

    const fields: FieldResult[] = [
      {
        field: 'Study Design',
        expected: 'RCT',
        observed: appraisal.classification.studyDesign,
        passed: appraisal.classification.studyDesign === 'RCT',
      },
      {
        field: 'Primary Outcome',
        expected: 'Post-ERCP pancreatitis (PEP) rate',
        observed: pepEst?.outcome || appraisal.pico.primaryOutcomes.join('; '),
        passed: /pep|pancreatitis/i.test(
          (pepEst?.outcome || '') + ' ' + appraisal.pico.primaryOutcomes.join(' ')
        ),
      },
      {
        field: 'Primary Estimate + CI + P',
        expected: 'Risk Difference 0.38% (95% CI -1.71 to 2.47), P = 0.72',
        observed: `${pepEst?.metric} ${pepEst?.pointEstimate} (${pepEst?.confidenceInterval}, ${pepEst?.pValue})`,
        passed:
          (pepEst?.pointEstimate === '0.38' || pepEst?.pointEstimate === '0.38%') &&
          pepEst?.confidenceInterval.includes('-1.71') &&
          pepEst?.confidenceInterval.includes('2.47'),
      },
      {
        field: 'Outcome Type',
        expected: 'non-inferiority demonstrated (or neutral/benefit)',
        observed: pepEst?.outcomeType || 'undefined',
        passed: pepEst?.outcomeType === 'benefit' || pepEst?.outcomeType === 'neutral',
      },
      {
        field: 'Retraction Flag',
        expected: 'false (active)',
        observed: String(Boolean(manuscript.retraction?.isRetracted)),
        passed: !manuscript.retraction?.isRetracted,
      },
    ];

    results.push({
      id: 'H2',
      name: "Chinese Indomethacin Trial (PMID 42140208) - Non-Inferiority RCT",
      fields,
      overallPassed: fields.every((f) => f.passed),
    });
  }

  // -------------------------------------------------------------
  // H3: Cochrane Review: Magnesium sulphate for preterm neuroprotection (PMID 42689525)
  // Expected:
  // - Design: SYSTEMATIC_REVIEW_META_ANALYSIS
  // - Primary outcome: Cerebral palsy / death or cerebral palsy
  // - Primary estimate + CI + P: RR 0.71 (0.57 to 0.89) or RR 0.87 (0.77 to 0.98)
  // - Outcome type: benefit
  // - Retraction flag: false
  // -------------------------------------------------------------
  {
    const raw = loadFixture('H3_42689525.json');
    const manuscript = mapEpmcToManuscript(raw, 'H3');
    const appraisal = generateDeterministicAppraisal(manuscript);
    const estimates = appraisal.statisticalAudit.effectEstimates;
    const cpEst = estimates.find((e) => /cerebral palsy|palsy|death/i.test(e.outcome || e.outcomeLabel || '')) || estimates[0];

    const fields: FieldResult[] = [
      {
        field: 'Study Design',
        expected: 'SYSTEMATIC_REVIEW_META_ANALYSIS',
        observed: appraisal.classification.studyDesign,
        passed: appraisal.classification.studyDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS',
      },
      {
        field: 'Primary Outcome',
        expected: 'Cerebral palsy / death or cerebral palsy',
        observed: cpEst?.outcome || appraisal.pico.primaryOutcomes.join('; '),
        passed: /cerebral palsy|palsy|neuroprotection|death/i.test(
          (cpEst?.outcome || '') + ' ' + appraisal.pico.primaryOutcomes.join(' ')
        ),
      },
      {
        field: 'Primary Estimate + CI + P',
        expected: 'Risk Ratio 0.71 (95% CI 0.57 to 0.89) or RR 0.87 (0.77 to 0.98)',
        observed: `${cpEst?.metric} ${cpEst?.pointEstimate} (${cpEst?.confidenceInterval}, ${cpEst?.pValue})`,
        passed:
          (cpEst?.pointEstimate === '0.71' || cpEst?.pointEstimate === '0.87') &&
          cpEst?.confidenceInterval.length > 0,
      },
      {
        field: 'Outcome Type',
        expected: 'benefit',
        observed: cpEst?.outcomeType || 'undefined',
        passed: cpEst?.outcomeType === 'benefit',
      },
      {
        field: 'Retraction Flag',
        expected: 'false (active)',
        observed: String(Boolean(manuscript.retraction?.isRetracted)),
        passed: !manuscript.retraction?.isRetracted,
      },
    ];

    results.push({
      id: 'H3',
      name: "Magnesium Sulphate Neuroprotection (PMID 42689525) - Cochrane Review",
      fields,
      overallPassed: fields.every((f) => f.passed),
    });
  }

  // -------------------------------------------------------------
  // H4: Observational Cohort: NHS II Depression & Colorectal Cancer (PMID 42132476)
  // Expected:
  // - Design: COHORT (or OBSERVATIONAL_COHORT)
  // - Primary outcome: Colorectal cancer
  // - Primary estimate + CI + P: HR 0.76 (95% CI 0.59 to 0.97)
  // - Outcome type: benefit / inverse association
  // - Retraction flag: false
  // -------------------------------------------------------------
  {
    const raw = loadFixture('H4_42132476.json');
    const manuscript = mapEpmcToManuscript(raw, 'H4');
    const appraisal = generateDeterministicAppraisal(manuscript);
    const estimates = appraisal.statisticalAudit.effectEstimates;
    const crcEst = estimates.find((e) => /colorectal|cancer/i.test(e.outcome || e.outcomeLabel || '')) || estimates[0];

    const fields: FieldResult[] = [
      {
        field: 'Study Design',
        expected: 'COHORT_STUDY',
        observed: appraisal.classification.studyDesign,
        passed: appraisal.classification.studyDesign === 'COHORT_STUDY',
      },
      {
        field: 'Primary Outcome',
        expected: 'Colorectal cancer / colon cancer',
        observed: crcEst?.outcome || appraisal.pico.primaryOutcomes.join('; '),
        passed: /colorectal|cancer/i.test(
          (crcEst?.outcome || '') + ' ' + appraisal.pico.primaryOutcomes.join(' ')
        ),
      },
      {
        field: 'Primary Estimate + CI + P',
        expected: 'HR 0.76 (95% CI 0.59 to 0.97)',
        observed: `${crcEst?.metric} ${crcEst?.pointEstimate} (${crcEst?.confidenceInterval}, ${crcEst?.pValue})`,
        passed: crcEst?.pointEstimate === '0.76' && crcEst?.confidenceInterval.includes('0.59') && crcEst?.confidenceInterval.includes('0.97'),
      },
      {
        field: 'Outcome Type',
        expected: 'benefit',
        observed: crcEst?.outcomeType || 'undefined',
        passed: crcEst?.outcomeType === 'benefit',
      },
      {
        field: 'Retraction Flag',
        expected: 'false (active)',
        observed: String(Boolean(manuscript.retraction?.isRetracted)),
        passed: !manuscript.retraction?.isRetracted,
      },
    ];

    results.push({
      id: 'H4',
      name: "Nurses' Health Study II Depression & Colorectal Cancer (PMID 42132476) - Cohort",
      fields,
      overallPassed: fields.every((f) => f.passed),
    });
  }

  // -------------------------------------------------------------
  // H5: Primary Non-Significant while Secondary Significant: PROactive (PMID 16214598)
  // Expected:
  // - Design: RCT
  // - Primary outcome: Primary composite macrovascular endpoint
  // - Primary estimate + CI + P: HR 0.90 (0.80 to 1.02), P = 0.095 [non-significant]
  // - Secondary estimate: HR 0.84 (0.72 to 0.98), P = 0.027 [significant]
  // - Outcome type: neutral (CI crosses 1.0, non-significant)
  // - Retraction flag: false
  // -------------------------------------------------------------
  {
    const raw = loadFixture('H5_16214598.json');
    const manuscript = mapEpmcToManuscript(raw, 'H5');
    const appraisal = generateDeterministicAppraisal(manuscript);
    const estimates = appraisal.statisticalAudit.effectEstimates;
    const primEst = estimates.find((e) => e.pointEstimate === '0.90' || /primary/i.test(e.outcome || e.outcomeLabel || '')) || estimates[0];
    const secEst = estimates.find((e) => e.pointEstimate === '0.84' || /secondary|mortality/i.test(e.outcome || e.outcomeLabel || ''));

    const fields: FieldResult[] = [
      {
        field: 'Study Design',
        expected: 'RCT',
        observed: appraisal.classification.studyDesign,
        passed: appraisal.classification.studyDesign === 'RCT',
      },
      {
        field: 'Primary Outcome',
        expected: 'Primary composite endpoint (macrovascular events / mortality / MI / stroke)',
        observed: primEst?.outcome || appraisal.pico.primaryOutcomes.join('; '),
        passed: /primary|endpoint|composite|macrovascular/i.test(
          (primEst?.outcome || '') + ' ' + appraisal.pico.primaryOutcomes.join(' ')
        ),
      },
      {
        field: 'Primary Estimate + CI + P',
        expected: 'HR 0.90 (95% CI 0.80 to 1.02), P = 0.095 [Non-significant]',
        observed: `${primEst?.metric} ${primEst?.pointEstimate} (${primEst?.confidenceInterval}, ${primEst?.pValue})`,
        passed:
          primEst?.pointEstimate === '0.90' &&
          primEst?.confidenceInterval.includes('0.80') &&
          primEst?.confidenceInterval.includes('1.02') &&
          (primEst?.pValue.includes('0.095') || primEst?.pValue.includes('0.09')),
      },
      {
        field: 'Secondary Estimate (Significant)',
        expected: 'HR 0.84 (95% CI 0.72 to 0.98), P = 0.027 [Statistically significant]',
        observed: secEst ? `${secEst?.metric} ${secEst?.pointEstimate} (${secEst?.confidenceInterval}, ${secEst?.pValue})` : 'Not found',
        passed: secEst?.pointEstimate === '0.84' && secEst?.confidenceInterval.includes('0.72') && secEst?.confidenceInterval.includes('0.98'),
      },
      {
        field: 'Primary Outcome Type',
        expected: 'neutral (statistically non-significant, 95% CI crosses 1.0)',
        observed: primEst?.outcomeType || 'undefined',
        passed: primEst?.outcomeType === 'neutral',
      },
      {
        field: 'Retraction Flag',
        expected: 'false (active)',
        observed: String(Boolean(manuscript.retraction?.isRetracted)),
        passed: !manuscript.retraction?.isRetracted,
      },
    ];

    results.push({
      id: 'H5',
      name: "PROactive Pioglitazone Trial (PMID 16214598) - Primary Non-Sig, Secondary Sig",
      fields,
      overallPassed: fields.every((f) => f.passed),
    });
  }

  // -------------------------------------------------------------
  // H6: Retracted Paper other than Mehra 2020: Pediatric Dapagliflozin (PMID 42560379)
  // Expected:
  // - Design: RCT
  // - Retraction flag: true
  // - Red alert / clinical suppression: active
  // -------------------------------------------------------------
  {
    const raw = loadFixture('H6_42560379.json');
    const manuscript = mapEpmcToManuscript(raw, 'H6');
    const appraisal = generateDeterministicAppraisal(manuscript);

    const fields: FieldResult[] = [
      {
        field: 'Study Design',
        expected: 'RCT',
        observed: appraisal.classification.studyDesign,
        passed: appraisal.classification.studyDesign === 'RCT',
      },
      {
        field: 'Retraction Flag',
        expected: 'true (retracted publication detected)',
        observed: String(Boolean(manuscript.retraction?.isRetracted)),
        passed: manuscript.retraction?.isRetracted === true,
      },
      {
        field: 'GRADE Suppression',
        expected: 'NOT_GRADED_HEURISTIC',
        observed: appraisal.validitySynthesis.gradeCertainty,
        passed: appraisal.validitySynthesis.gradeCertainty === 'NOT_GRADED_HEURISTIC',
      },
      {
        field: 'Clinical Bottom Line Suppression',
        expected: 'Suppressed due to retraction',
        observed: (appraisal.clinicalPracticeBottomLine as any).suppressedDueToRetraction ? 'Suppressed' : 'Active',
        passed: (appraisal.clinicalPracticeBottomLine as any).suppressedDueToRetraction === true,
      },
    ];

    results.push({
      id: 'H6',
      name: "Pediatric CKD Dapagliflozin Trial (PMID 42560379) - Retracted Paper",
      fields,
      overallPassed: fields.every((f) => f.passed),
    });
  }

  // -------------------------------------------------------------
  // PRINT SUMMARY
  // -------------------------------------------------------------
  let allPassed = true;
  for (const r of results) {
    console.log(`--- ${r.id}: ${r.name} ---`);
    for (const f of r.fields) {
      const statusIcon = f.passed ? '✅' : '❌';
      console.log(`  ${statusIcon} [${f.field}]`);
      console.log(`      Expected: ${f.expected}`);
      console.log(`      Observed: ${f.observed}`);
      if (!f.passed) allPassed = false;
    }
    console.log(`Overall: ${r.overallPassed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  console.log('========================================================');
  console.log(`Held-Out Validation Summary: ${results.filter((r) => r.overallPassed).length} / ${results.length} Papers Passed Cleanly`);
  console.log('========================================================\n');

  if (!allPassed) {
    process.exitCode = 1;
  }
}

runHoldoutValidation().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
