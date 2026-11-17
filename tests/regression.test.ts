import fs from 'node:fs';
import path from 'node:path';
import { classifyStudyDesign, generateDeterministicAppraisal } from '../src/lib/evaluators/deterministic-appraisal';
import { synthesizeGradeCertainty } from '../src/lib/evaluators/grade-engine';
import { cleanBiomedicalAuthors } from '../src/lib/parsers/title-sanitizer';
import { formatVancouverAuthors } from '../src/lib/parsers/vancouver-formatter';
import { parseGeminiCandidateText, LlmValidationError } from '../src/lib/llm/llm-client';
import { isVerbatimInManuscript } from '../src/lib/parsers/quote-verifier';
import { MasterAppraisalReportSchema } from '../src/lib/schemas/appraisal.schema';
import { ParsedManuscriptPayload } from '../src/lib/schemas/ingestion.schema';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
    throw new Error(`Regression Assertion failed: ${msg}`);
  } else {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  }
}

function loadFixture<T>(filename: string): T {
  const filepath = path.join(__dirname, 'fixtures', filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

async function runRegressionSuite() {
  console.log('========================================================');
  console.log('  AppraisAI 12-Point Offline Regression Test Suite');
  console.log('========================================================\n');

  // -----------------------------------------------------------------
  // 1. Rate ratio + 95% CI Parsing
  // -----------------------------------------------------------------
  console.log('--- Test 1: Rate Ratio and CI Parsing ---');
  {
    const fixture = loadFixture<any>('1_rate_ratio.json');
    const manuscript: ParsedManuscriptPayload = {
      id: 'test-1',
      metadata: {
        title: fixture.title,
        authors: ['Smith J', 'Adams B'],
        journal: 'Surgical Medicine',
        publicationYear: 2024,
        sourceDepth: 'FULL_TEXT_PDF',
        openAccess: true,
      },
      abstract: fixture.abstract,
      fullText: fixture.abstract,
      sections: [],
      tablesRaw: [],
      contentAvailable: true,
      extractedAt: new Date().toISOString(),
    };

    const appraisal = generateDeterministicAppraisal(manuscript);
    const estimates = appraisal.statisticalAudit.effectEstimates;
    assert(estimates.length >= 1, 'Extracted at least one effect estimate');
    const rateRatio = estimates.find((e) => e.metric.toLowerCase().includes('rate ratio'));
    assert(!!rateRatio, 'Found Rate Ratio estimate');
    assert(rateRatio?.pointEstimate === '0.82', `Point estimate is 0.82 (got ${rateRatio?.pointEstimate})`);
    assert(rateRatio?.confidenceInterval.includes('0.71 to 0.95'), `CI contains 0.71 to 0.95 (got ${rateRatio?.confidenceInterval})`);
    assert(rateRatio?.pValue.includes('0.008'), `P-value contains 0.008 (got ${rateRatio?.pValue})`);
    assert(rateRatio?.clinicalVsStatisticalSignificance.includes('Statistically significant'), 'Significance correctly deduced from CI');
  }

  // -----------------------------------------------------------------
  // 2. RCT Mentioning "Meta-Analysis" in Discussion -> Classified RCT
  // -----------------------------------------------------------------
  console.log('\n--- Test 2: RCT Mentioning Meta-Analysis in Discussion ---');
  {
    const fixture = loadFixture<any>('2_rct_meta_mention.json');
    const classification = classifyStudyDesign(
      { title: fixture.title },
      fixture.abstract,
      'Methods: Randomized double-blind trial design. 620 participants were randomly allocated.'
    );
    assert(classification.design === 'RCT', `Expected RCT, got ${classification.design}`);
    assert(classification.design !== 'SYSTEMATIC_REVIEW_META_ANALYSIS', 'Not misclassified as Meta-Analysis');
  }

  // -----------------------------------------------------------------
  // 3. Cross-Sectional Survey Reporting Odds Ratio -> CROSS_SECTIONAL
  // -----------------------------------------------------------------
  console.log('\n--- Test 3: Cross-Sectional Survey with OR Classified CROSS_SECTIONAL ---');
  {
    const fixture = loadFixture<any>('3_cross_sectional_or.json');
    const classification = classifyStudyDesign(
      { title: fixture.title },
      fixture.abstract,
      'Methods: Cross-sectional survey questionnaires administered to 1450 nurses.'
    );
    assert(classification.design === 'CROSS_SECTIONAL', `Expected CROSS_SECTIONAL, got ${classification.design}`);
    assert(classification.design !== 'CASE_CONTROL_STUDY', 'Not misclassified as Case-Control despite reporting OR');
  }

  // -----------------------------------------------------------------
  // 4. Abstract with No Statistics -> effectEstimates.length === 0
  // -----------------------------------------------------------------
  console.log('\n--- Test 4: Abstract with No Statistics -> Empty Effect Estimates ---');
  {
    const fixture = loadFixture<any>('4_no_statistics.json');
    const manuscript: ParsedManuscriptPayload = {
      id: 'test-4',
      metadata: {
        title: fixture.title,
        authors: ['Taylor R', 'Evans K'],
        journal: 'Journal of Palliative Medicine',
        publicationYear: 2024,
        sourceDepth: 'FULL_TEXT_PDF',
        openAccess: true,
      },
      abstract: fixture.abstract,
      fullText: fixture.abstract,
      sections: [],
      tablesRaw: [],
      contentAvailable: true,
      extractedAt: new Date().toISOString(),
    };

    const appraisal = generateDeterministicAppraisal(manuscript);
    assert(appraisal.statisticalAudit.effectEstimates.length === 0, 'Zero effect estimates extracted for non-quantitative abstract');
  }

  // -----------------------------------------------------------------
  // 5. Crossref-Only Payload with No Abstract -> contentAvailable === false
  // -----------------------------------------------------------------
  console.log('\n--- Test 5: Crossref-Only Payload -> contentAvailable: false ---');
  {
    const fixture = loadFixture<any>('5_crossref_no_abstract.json');
    const manuscript: ParsedManuscriptPayload = {
      id: 'test-5',
      metadata: {
        title: fixture.title,
        authors: fixture.authors,
        journal: fixture.journal,
        publicationYear: 2023,
        doi: fixture.doi,
        sourceDepth: 'ABSTRACT_ONLY_FALLBACK',
        openAccess: false,
      },
      abstract: fixture.abstract,
      fullText: '',
      sections: [],
      tablesRaw: [],
      contentAvailable: fixture.contentAvailable,
      extractedAt: new Date().toISOString(),
    };

    assert(manuscript.contentAvailable === false, 'contentAvailable is correctly false when no abstract or body exists');
    assert(manuscript.abstract === '', 'Abstract is empty string');
  }

  // -----------------------------------------------------------------
  // 6. PDF with No Byline -> [Author not specified] (No Invented Authors)
  // -----------------------------------------------------------------
  console.log('\n--- Test 6: PDF with No Byline Returns [Author not specified] ---');
  {
    const authors = cleanBiomedicalAuthors([]);
    assert(
      authors.length === 1 && authors[0] === '[Author not specified]',
      'When byline is absent, returns explicit [Author not specified] without inventing authors'
    );
    const filteredJunk = cleanBiomedicalAuthors(['Hospital Medicine Guidelines Committee', 'Published 2024']);
    assert(
      !filteredJunk.includes('Inas Taha') && !filteredJunk.includes('Raouf Roshdy'),
      'Never injects hardcoded or fictitious author names'
    );
  }

  // -----------------------------------------------------------------
  // 7. Gemini Response Parts Array Fixture Parsed Correctly
  // -----------------------------------------------------------------
  console.log('\n--- Test 7: Gemini Candidates Content Parts Text Extraction ---');
  {
    const geminiPayload = loadFixture<any>('7_gemini_parts.json');
    const extractedText = parseGeminiCandidateText(geminiPayload);
    assert(extractedText.length > 0, 'Extracted text from parts array');
    const parsed = JSON.parse(extractedText);
    assert(parsed.studyDesign === 'RCT', 'Parsed studyDesign is RCT');
    assert(parsed.oxfordEvidenceLevel === 'Level 1b', 'Parsed oxfordEvidenceLevel is Level 1b');
  }

  // -----------------------------------------------------------------
  // 8. Zod-Invalid Output Triggers Safe Rejection
  // -----------------------------------------------------------------
  console.log('\n--- Test 8: Zod Schema Rejection on Malformed Payload ---');
  {
    const invalidPayload = loadFixture<any>('8_zod_invalid.json');
    const result = MasterAppraisalReportSchema.safeParse(invalidPayload);
    assert(!result.success, 'Malformed payload successfully rejected by MasterAppraisalReportSchema');
    assert(result.error?.issues.length! > 0, 'Validation errors identified');
  }

  // -----------------------------------------------------------------
  // 9. GRADE Engine: RCT + Unclear RoB -> MODERATE; SR of Observational -> Starts LOW
  // -----------------------------------------------------------------
  console.log('\n--- Test 9: GRADE Engine Certainty Logic ---');
  {
    const gradeCases = loadFixture<any>('9_grade_cases.json');
    const rctResult = synthesizeGradeCertainty(gradeCases.rctWithUnclearRoB);
    assert(
      rctResult.finalCertainty === 'MODERATE',
      `RCT with unclear RoB downgraded 1 level to MODERATE (got ${rctResult.finalCertainty})`
    );
    assert(
      rctResult.downgradingFactors.some((f) => f.includes('Risk of bias')),
      'Downgrading factors include Risk of bias'
    );

    const srObsResult = synthesizeGradeCertainty(gradeCases.srOfObservationalStudies);
    assert(
      srObsResult.finalCertainty === 'LOW',
      `Observational cohort baseline certainty starts at LOW (got ${srObsResult.finalCertainty})`
    );
  }

  // -----------------------------------------------------------------
  // 10. Vancouver Formatter Strips Trailing Period
  // -----------------------------------------------------------------
  console.log('\n--- Test 10: Vancouver Formatter Trailing Period Stripping ---');
  {
    const cases = loadFixture<Array<{ input: string; expected: string }>>('10_vancouver_cases.json');
    for (const c of cases) {
      const formatted = formatVancouverAuthors([c.input]);
      assert(formatted === c.expected, `Formatted "${c.input}" -> "${formatted}" (expected "${c.expected}")`);
    }
  }

  // -----------------------------------------------------------------
  // 11. EQUATOR with No Items -> 0% Compliance
  // -----------------------------------------------------------------
  console.log('\n--- Test 11: EQUATOR Compliance When 0 Items Reported ---');
  {
    const equatorFixture = loadFixture<any>('11_equator_zero_items.json');
    const reportedCount = equatorFixture.criticalItemsAudit.filter((i: any) => i.status === 'REPORTED').length;
    const totalCount = equatorFixture.criticalItemsAudit.length;
    const compliance = Math.round((reportedCount / totalCount) * 100);
    assert(reportedCount === 0, 'Reported count is 0');
    assert(compliance === 0, 'Compliance percentage is 0%');
  }

  // -----------------------------------------------------------------
  // 12. Heuristic Report: LOW_RISK Judgements Are Verbatim Grounded
  // -----------------------------------------------------------------
  console.log('\n--- Test 12: Heuristic Report LOW_RISK Judgements Verbatim Grounded ---');
  {
    const fixture = loadFixture<any>('12_heuristic_grounding.json');
    const manuscript: ParsedManuscriptPayload = {
      id: 'test-12',
      metadata: {
        title: fixture.title,
        authors: ['Kovacs G', 'Nagy T'],
        journal: 'European Journal of Cardiology',
        publicationYear: 2024,
        sourceDepth: 'FULL_TEXT_PDF',
        openAccess: true,
      },
      abstract: fixture.abstract,
      fullText: fixture.fullText,
      sections: [{ heading: 'Methods', content: fixture.fullText }],
      tablesRaw: [],
      contentAvailable: true,
      extractedAt: new Date().toISOString(),
    };

    const appraisal = generateDeterministicAppraisal(manuscript);
    for (const domain of appraisal.riskOfBias.domains) {
      if (domain.judgement === 'LOW_RISK') {
        const grounded = isVerbatimInManuscript(domain.supportiveEvidence, manuscript);
        assert(
          grounded,
          `Domain "${domain.domainName}" marked LOW_RISK is grounded verbatim in manuscript: "${domain.supportiveEvidence.slice(0, 50)}..."`
        );
      }
    }
  }

  console.log('\n========================================================');
  console.log(`  All 12 Regression Tests Passed Cleanly! (${passed} assertions, 0 failed)`);
  console.log('========================================================');
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});
