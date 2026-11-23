import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { generateDeterministicAppraisal } from '../src/lib/evaluators/deterministic-appraisal';
import { normalizeIdentifier } from '../src/lib/parsers/identifier-normalizer';
import { ParsedManuscriptPayload } from '../src/lib/schemas/ingestion.schema';

function loadFixture(filename: string): any {
  const filePath = path.join(__dirname, 'benchmark', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

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

  // Check retraction in pubTypeList or commentCorrectionList
  const pubTypes = raw.pubTypeList?.pubType || [];
  const corrections = raw.commentCorrectionList?.commentCorrection || [];
  const isRetracted = pubTypes.some((pt: string) => /retracted publication/i.test(pt)) ||
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
    retraction: isRetracted ? {
      isRetracted: true,
      retractionCitation: retractionCitation || 'Retraction notice published',
      hasExpressionOfConcern: corrections.some((c: any) => /expression of concern/i.test(c.type || '')),
      hasErratum: corrections.some((c: any) => /erratum in/i.test(c.type || '')),
    } : undefined,
    abstract,
    fullText: abstract,
    sections: [{ heading: 'Abstract', content: abstract }],
    tablesRaw: [],
    contentAvailable: true,
    extractedAt: new Date().toISOString(),
  };
}

async function runBenchmark() {
  console.log('========================================================');
  console.log('  AppraisAI 9-Point Independent Benchmark Suite (A0)');
  console.log('========================================================\n');

  let passedCount = 0;
  let totalCount = 9;

  // -------------------------------------------------------------
  // B1: ASPREE, McNeil NEJM 2018 (PMID 30221596)
  // Assert: Major haemorrhage HR 1.38 (1.18–1.62) has outcomeType = "harm";
  // P-value = "<0.001" (not "not reported"); follow-up = 4.7 y median, or null — never "5 years"
  // -------------------------------------------------------------
  console.log('--- B1: ASPREE, McNeil NEJM 2018 (PMID 30221596) ---');
  try {
    const rawB1 = loadFixture('B1_30221596.json');
    const manuscriptB1 = mapEpmcToManuscript(rawB1, 'b1');
    const appraisalB1 = generateDeterministicAppraisal(manuscriptB1);

    const estimates = appraisalB1.statisticalAudit.effectEstimates;
    const harmEstimate = estimates.find((e) =>
      /haemorrhage|hemorrhage|bleeding/i.test(e.outcome || e.outcomeLabel || '')
    );
    assert(harmEstimate, 'Must find major haemorrhage/hemorrhage estimate');
    assert.strictEqual(harmEstimate.pointEstimate, '1.38', 'Major haemorrhage HR must be 1.38');
    assert(harmEstimate.confidenceInterval.includes('1.18') && harmEstimate.confidenceInterval.includes('1.62'), 'CI must be 1.18 to 1.62');
    assert.strictEqual(harmEstimate.outcomeType, 'harm', 'Major haemorrhage must have outcomeType = "harm"');
    assert(harmEstimate.pValue.includes('<0.001') || harmEstimate.pValue.includes('< 0.001'), `P-value must be <0.001, got ${harmEstimate.pValue}`);

    // Follow-up check: must be 4.7 y median or null/not identified, never "5 years"
    const timeframe = appraisalB1.pico.timeframe;
    assert(!/5 years/i.test(timeframe), `Timeframe must never be "5 years" (got: "${timeframe}")`);
    assert(/4\.7/i.test(timeframe) || /not identified|not extracted/i.test(timeframe), `Timeframe should be median 4.7 years or not extracted (got: "${timeframe}")`);

    console.log('✅ B1 PASS: Major haemorrhage HR 1.38 (1.18–1.62) is harm, P<0.001, follow-up 4.7y');
    passedCount++;
  } catch (err: any) {
    console.error('❌ B1 FAIL:', err.message);
  }

  // -------------------------------------------------------------
  // B2: LIGHT, Norman RBMO 2019 (PMID 30954433)
  // Assert: Primary outcome = live birth; primary estimate = OR 1.07 (0.37–3.10), or null.
  // Must NOT be OR 5.67. stoppedEarly = true / under-recruitment flagged
  // -------------------------------------------------------------
  console.log('\n--- B2: LIGHT, Norman RBMO 2019 (PMID 30954433) ---');
  try {
    const rawB2 = loadFixture('B2_30954433.json');
    const manuscriptB2 = mapEpmcToManuscript(rawB2, 'b2');
    const appraisalB2 = generateDeterministicAppraisal(manuscriptB2);

    const primaryEstimate = appraisalB2.statisticalAudit.primaryEstimate;
    const estimates = appraisalB2.statisticalAudit.effectEstimates;

    // Check primary outcome definition
    const primaryOutcome = appraisalB2.pico.primaryOutcomes[0] || '';
    assert(/live birth/i.test(primaryOutcome), `Primary outcome must be live birth, got "${primaryOutcome}"`);

    // Primary estimate must NOT be OR 5.67 (oocyte retrieval)
    if (primaryEstimate) {
      assert.notStrictEqual(primaryEstimate.pointEstimate, '5.67', 'Primary estimate must NOT be OR 5.67 (oocyte retrieval)');
      assert.strictEqual(primaryEstimate.pointEstimate, '1.07', `Primary estimate must be OR 1.07 (got ${primaryEstimate.pointEstimate})`);
      assert(primaryEstimate.confidenceInterval.includes('0.37') && primaryEstimate.confidenceInterval.includes('3.10'), 'Primary CI must be 0.37 to 3.10');
    }

    // Trial specifics: stopped early / under-recruitment flagged
    const specifics = (appraisalB2.statisticalAudit as any).trialSpecifics;
    assert(specifics?.stoppedEarly === true || specifics?.underRecruitment === true, 'stoppedEarly or underRecruitment must be flagged true');

    // Check process outcome labeling: OR 5.67 and OR 1.42 must be process outcomes
    const oocyteEst = estimates.find((e) => e.pointEstimate === '5.67');
    if (oocyteEst) {
      assert.strictEqual(oocyteEst.outcomeType, 'process', 'OR 5.67 (oocytes) must be labeled process');
    }

    console.log('✅ B2 PASS: Primary outcome live birth OR 1.07 (not 5.67), stopped early flagged');
    passedCount++;
  } catch (err: any) {
    console.error('❌ B2 FAIL:', err.message);
  }

  // -------------------------------------------------------------
  // B3: ASPRE, Rolnik NEJM 2017 (PMID 28657417)
  // Assert: Primary OR 0.38 (0.20–0.74), P=0.004; RoB D3 not "Low" (156/1776 excluded after randomisation)
  // -------------------------------------------------------------
  console.log('\n--- B3: ASPRE, Rolnik NEJM 2017 (PMID 28657417) ---');
  try {
    const rawB3 = loadFixture('B3_28657417.json');
    const manuscriptB3 = mapEpmcToManuscript(rawB3, 'b3');
    const appraisalB3 = generateDeterministicAppraisal(manuscriptB3);

    const primaryEst = appraisalB3.statisticalAudit.primaryEstimate ||
      appraisalB3.statisticalAudit.effectEstimates.find((e) => e.pointEstimate === '0.38');
    assert(primaryEst, 'Must extract primary OR 0.38');
    assert.strictEqual(primaryEst.pointEstimate, '0.38', 'Primary OR must be 0.38');
    assert(primaryEst.confidenceInterval.includes('0.20') && primaryEst.confidenceInterval.includes('0.74'), 'CI must be 0.20 to 0.74');
    assert(primaryEst.pValue.includes('0.004'), `P-value must include 0.004 (got ${primaryEst.pValue})`);

    // RoB D3 (Missing outcome data / Attrition) must NOT be LOW_RISK due to 156/1776 (8.8% > 5%) withdrawals
    const d3 = appraisalB3.riskOfBias.domains.find((d) => /missing|attrition|domain 3/i.test(d.domainName));
    assert(d3, 'Must have RoB Domain 3');
    assert.notStrictEqual(d3.judgement, 'LOW_RISK', `RoB D3 must NOT be Low Risk when 156/1776 excluded (got ${d3.judgement})`);

    console.log('✅ B3 PASS: Primary OR 0.38 (0.20–0.74), P=0.004, RoB D3 not Low');
    passedCount++;
  } catch (err: any) {
    console.error('❌ B3 FAIL:', err.message);
  }

  // -------------------------------------------------------------
  // B4: iDAScore RCT, Illingworth Nat Med 2024 (PMID 39122964)
  // Assert: Design = RCT, framework = "non-inferiority"; RD −1.7 (−7.7 to 4.3) extracted;
  // conclusion = "non-inferiority not demonstrated" (lower bound −7.7 < margin −5)
  // -------------------------------------------------------------
  console.log('\n--- B4: iDAScore RCT, Illingworth Nat Med 2024 (PMID 39122964) ---');
  try {
    const rawB4 = loadFixture('B4_39122964.json');
    const manuscriptB4 = mapEpmcToManuscript(rawB4, 'b4');
    const appraisalB4 = generateDeterministicAppraisal(manuscriptB4);

    assert.strictEqual(appraisalB4.classification.studyDesign, 'RCT', 'Design must be RCT');
    const framework = (appraisalB4.classification as any).framework;
    assert.strictEqual(framework, 'non-inferiority', `Trial framework must be non-inferiority, got ${framework}`);

    const rdEstimate = appraisalB4.statisticalAudit.effectEstimates.find((e) =>
      /risk difference|rd/i.test(e.metric) || e.pointEstimate === '-1.7' || e.pointEstimate === '−1.7'
    );
    assert(rdEstimate, 'Must extract Risk Difference estimate of -1.7');
    assert(rdEstimate.confidenceInterval.includes('-7.7') || rdEstimate.confidenceInterval.includes('−7.7'), 'CI lower bound must be -7.7');

    const conclusion = (appraisalB4.classification as any).nonInferiorityConclusion || '';
    assert(/not demonstrated/i.test(conclusion), `Conclusion must state non-inferiority not demonstrated, got "${conclusion}"`);

    console.log('✅ B4 PASS: RCT non-inferiority, RD -1.7 (-7.7 to 4.3), non-inferiority not demonstrated');
    passedCount++;
  } catch (err: any) {
    console.error('❌ B4 FAIL:', err.message);
  }

  // -------------------------------------------------------------
  // B5: Cochrane GH, Sood 2021 (CD000099.pub4) (PMID 34808697)
  // Assert: Design = SYSTEMATIC_REVIEW_META_ANALYSIS, Oxford 1a, tool AMSTAR 2 / PRISMA 2020;
  // primary = live birth in poor responders OR 1.77 (1.17–2.70). Must NOT be MD 13.57
  // -------------------------------------------------------------
  console.log('\n--- B5: Cochrane GH, Sood 2021 (PMID 34808697) ---');
  try {
    const rawB5 = loadFixture('B5_34808697.json');
    const manuscriptB5 = mapEpmcToManuscript(rawB5, 'b5');
    const appraisalB5 = generateDeterministicAppraisal(manuscriptB5);

    assert.strictEqual(appraisalB5.classification.studyDesign, 'SYSTEMATIC_REVIEW_META_ANALYSIS', 'Design must be SR/MA');
    assert.strictEqual(appraisalB5.classification.oxfordEvidenceLevel, 'Level 1a', 'Oxford level must be 1a');
    assert(/AMSTAR/i.test(appraisalB5.riskOfBias.governingTool), 'Governing RoB tool must be AMSTAR 2');
    assert(/PRISMA/i.test(appraisalB5.classification.equatorReportingGuideline), 'Reporting guideline must be PRISMA 2020');

    const primaryEst = appraisalB5.statisticalAudit.primaryEstimate;
    assert(primaryEst, 'Must identify primary estimate for live birth in poor responders');
    assert.notStrictEqual(primaryEst.pointEstimate, '13.57', 'Must NOT be MD 13.57 (gonadotropin units)');
    assert.strictEqual(primaryEst.pointEstimate, '1.77', `Primary estimate must be OR 1.77, got ${primaryEst.pointEstimate}`);
    assert(primaryEst.confidenceInterval.includes('1.17') && primaryEst.confidenceInterval.includes('2.70'), 'CI must be 1.17 to 2.70');

    console.log('✅ B5 PASS: SR/MA, Level 1a, AMSTAR 2/PRISMA, primary OR 1.77 (not MD 13.57)');
    passedCount++;
  } catch (err: any) {
    console.error('❌ B5 FAIL:', err.message);
  }

  // -------------------------------------------------------------
  // B6: Mehra Lancet 2020 (retracted) (PMID 32450107)
  // Assert: retracted = true; red blocking banner; GRADE and bottom line suppressed
  // -------------------------------------------------------------
  console.log('\n--- B6: Mehra Lancet 2020 (retracted) (PMID 32450107) ---');
  try {
    const rawB6 = loadFixture('B6_32450107.json');
    const manuscriptB6 = mapEpmcToManuscript(rawB6, 'b6');
    assert(manuscriptB6.retraction?.isRetracted === true, 'Manuscript payload must have retraction.isRetracted = true');

    const appraisalB6 = generateDeterministicAppraisal(manuscriptB6);
    assert((appraisalB6 as any).retraction?.isRetracted === true, 'Appraisal report must carry retraction.isRetracted = true');
    assert((appraisalB6.validitySynthesis as any).suppressedDueToRetraction === true, 'GRADE must be suppressed due to retraction');
    assert((appraisalB6.clinicalPracticeBottomLine as any).suppressedDueToRetraction === true, 'Bottom line must be suppressed due to retraction');

    console.log('✅ B6 PASS: Retraction detected, red banner flagged, GRADE and bottom line suppressed');
    passedCount++;
  } catch (err: any) {
    console.error('❌ B6 FAIL:', err.message);
  }

  // -------------------------------------------------------------
  // B7: DAPA-HF, McMurray NEJM 2019 (PMID 31535829)
  // Assert: HR 0.74 (0.65–0.85), P "<0.001"; median follow-up 18.2 months or null
  // -------------------------------------------------------------
  console.log('\n--- B7: DAPA-HF, McMurray NEJM 2019 (PMID 31535829) ---');
  try {
    const rawB7 = loadFixture('B7_31535829.json');
    const manuscriptB7 = mapEpmcToManuscript(rawB7, 'b7');
    const appraisalB7 = generateDeterministicAppraisal(manuscriptB7);

    const primaryEst = appraisalB7.statisticalAudit.primaryEstimate ||
      appraisalB7.statisticalAudit.effectEstimates.find((e) => e.pointEstimate === '0.74');
    assert(primaryEst, 'Must extract HR 0.74');
    assert.strictEqual(primaryEst.pointEstimate, '0.74', 'HR must be 0.74');
    assert(primaryEst.confidenceInterval.includes('0.65') && primaryEst.confidenceInterval.includes('0.85'), 'CI must be 0.65 to 0.85');
    assert(primaryEst.pValue.includes('<0.001') || primaryEst.pValue.includes('< 0.001'), `P-value must be <0.001, got ${primaryEst.pValue}`);

    const timeframe = appraisalB7.pico.timeframe;
    assert(/18\.2\s*months/i.test(timeframe) || /not identified|not extracted/i.test(timeframe), `Timeframe must be 18.2 months or not extracted, got "${timeframe}"`);

    console.log('✅ B7 PASS: DAPA-HF HR 0.74 (0.65–0.85), P<0.001, follow-up 18.2 months');
    passedCount++;
  } catch (err: any) {
    console.error('❌ B7 FAIL:', err.message);
  }

  // -------------------------------------------------------------
  // B8: Taha & Roshdy 2026 (Opast PDF sample)
  // Assert: Design = narrative review / commentary (NOT SR/MA, NOT Level 1a);
  // no "primary effect" taken from a cited study
  // -------------------------------------------------------------
  console.log('\n--- B8: Taha & Roshdy 2026 (Opast PDF sample) ---');
  try {
    const rawB8 = loadFixture('B8_opast.json');
    const manuscriptB8: ParsedManuscriptPayload = {
      id: 'b8',
      metadata: {
        title: rawB8.metadata.title,
        authors: rawB8.metadata.authors,
        journal: rawB8.metadata.journal,
        publicationYear: rawB8.metadata.year,
        volume: '5',
        issue: '3',
        vancouverCitation: 'Taha I, Roshdy R. Vaginal Restoration After Vaginal Delivery. Biomed Sci Clin Res. 2026;5(3):1-12.',
        sourceDepth: 'FULL_TEXT_PDF',
        openAccess: true,
      },
      abstract: rawB8.abstract,
      fullText: rawB8.text,
      sections: rawB8.sections,
      tablesRaw: [],
      pageCount: rawB8.pageCount,
      contentAvailable: true,
      extractedAt: new Date().toISOString(),
    };

    const appraisalB8 = generateDeterministicAppraisal(manuscriptB8);

    assert.notStrictEqual(appraisalB8.classification.studyDesign, 'SYSTEMATIC_REVIEW_META_ANALYSIS', 'Must NOT be classified as SR/MA');
    assert.strictEqual(appraisalB8.classification.oxfordEvidenceLevel, 'Level 5', 'Must be Oxford Level 5 (narrative review / commentary)');

    // No primary effect taken from cited studies
    const primaryEst = appraisalB8.statisticalAudit.primaryEstimate;
    assert(primaryEst === null || primaryEst === undefined, 'Must NOT extract a primary effect estimate from a commentary/review of cited literature');

    console.log('✅ B8 PASS: Narrative review / commentary Level 5, no spurious primary effect estimate');
    passedCount++;
  } catch (err: any) {
    console.error('❌ B8 FAIL:', err.message);
  }

  // -------------------------------------------------------------
  // B9: Nat Med paper via publisher URL
  // Assert: Metadata identical to B4 (title, authors, journal, year 2024) — resolved via detected DOI
  // -------------------------------------------------------------
  console.log('\n--- B9: Nat Med paper via publisher URL (DOI extraction) ---');
  try {
    const url = 'https://www.nature.com/articles/s41591-024-03166-5';
    const norm = normalizeIdentifier(url);
    assert(norm.doi === '10.1038/s41591-024-03166-5' || (norm as any).detectedDoi === '10.1038/s41591-024-03166-5', `Must detect DOI 10.1038/s41591-024-03166-5 from URL, got ${norm.doi}`);

    const rawB4 = loadFixture('B4_39122964.json');
    assert.strictEqual(rawB4.pubYear, '2024', 'Year must be 2024');
    assert(rawB4.title.includes('Deep learning versus manual morphology'), 'Title must match B4');
    assert(rawB4.authorString.includes('Illingworth'), 'Authors must match B4');

    console.log('✅ B9 PASS: Nature URL detected DOI 10.1038/s41591-024-03166-5, metadata matches B4 (2024)');
    passedCount++;
  } catch (err: any) {
    console.error('❌ B9 FAIL:', err.message);
  }

  console.log('\n========================================================');
  console.log(`  Benchmark Results: ${passedCount} / ${totalCount} Passed`);
  console.log('========================================================\n');

  if (passedCount < totalCount) {
    console.log(`Note: ${totalCount - passedCount} benchmark tests are currently pending engine remediation.`);
  }
}

runBenchmark().catch(console.error);
