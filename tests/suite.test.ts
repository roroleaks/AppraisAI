import { normalizeIdentifier } from '../src/lib/parsers/identifier-normalizer';
import { cleanBiomedicalTitle, cleanBiomedicalAuthors, getCleanDownloadFilename } from '../src/lib/parsers/title-sanitizer';
import { buildVancouverCitation } from '../src/lib/parsers/vancouver-formatter';
import { getGoverningFrameworkRules } from '../src/lib/evaluators/framework-router';
import { generateDeterministicAppraisal } from '../src/lib/evaluators/deterministic-appraisal';
import { buildAcademicDocxManuscript } from '../src/lib/docx/docx-builder';
import { MasterAppraisalReportSchema } from '../src/lib/schemas/appraisal.schema';
import { Packer } from 'docx';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  }
}

async function runAllTests() {
  console.log('========================================================');
  console.log('  AppraisAI Comprehensive Automated Integration Test Suite');
  console.log('========================================================\n');

  // -----------------------------------------------------------------
  // 1. IDENTIFIER NORMALIZATION TESTS
  // -----------------------------------------------------------------
  console.log('--- Step 1: Identifier Normalization Tests ---');
  {
    const doiTest = normalizeIdentifier('doi: 10.1056/NEJMoa1800722');
    assert(doiTest.type === 'DOI' && doiTest.normalizedValue === '10.1056/NEJMoa1800722', 'DOI normalized properly');

    const pmidTest = normalizeIdentifier('PMID: 31535829');
    assert(pmidTest.type === 'PMID' && pmidTest.normalizedValue === '31535829', 'PMID normalized properly');

    const pmcTest = normalizeIdentifier('PMC7118652');
    assert(pmcTest.type === 'PMCID' && pmcTest.normalizedValue === 'PMC7118652', 'PMCID normalized properly');

    const urlTest = normalizeIdentifier('https://www.opastpublishers.com/open-access-articles/vaginal-restoration.pdf');
    assert(urlTest.type === 'URL' && urlTest.normalizedValue.startsWith('https://'), 'Direct PDF URL recognized');
  }

  // -----------------------------------------------------------------
  // 2. METADATA SANITIZER & CITATION FORMATTER TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Step 2: Metadata Sanitizer & Vancouver Tests ---');
  {
    const messyTitle = 'Biomedical Science and Clinical Research Volume 1 | Issue 1 | 2026 Vaginal Restoration After Vaginal Delivery: Commentary Review Regarding Pathophysiology Submitted: 2026';
    const cleanedTitle = cleanBiomedicalTitle(messyTitle);
    assert(!cleanedTitle.includes('Volume 1') && !cleanedTitle.includes('Submitted'), 'Journal & Volume noise stripped from title');
    assert(cleanedTitle.includes('Vaginal Restoration'), 'Core title preserved');

    const dirtyAuthors = ['Author(s) Extracted from PDF', 'Dr. Inas Taha, MD', 'Dr. Raouf Roshdy, MD'];
    const cleanedAuthors = cleanBiomedicalAuthors(dirtyAuthors);
    assert(!cleanedAuthors.includes('Author(s) Extracted from PDF'), 'Junk author strings filtered out');
    assert(cleanedAuthors.includes('Dr. Inas Taha, MD') && cleanedAuthors.includes('Dr. Raouf Roshdy, MD'), 'Real author names preserved');

    const citation = buildVancouverCitation({
      authors: ['Taha I', 'Roshdy R'],
      title: 'Vaginal Restoration After Vaginal Delivery: Commentary Review',
      journal: 'Biomed Sci Clin Res',
      year: 2026,
      volume: '1',
      issue: '1',
      pages: '1-12',
      doi: '10.58489/2836-5089/012',
    });
    assert(citation.startsWith('Taha I, Roshdy R.') && citation.includes('Biomed Sci Clin Res'), 'Vancouver citation properly formatted');

    const dlFilename = getCleanDownloadFilename(['Dr. Inas Taha, MD', 'Dr. Raouf Roshdy, MD'], 2026);
    assert(dlFilename === 'Critical_Appraisal_Taha_2026.docx', 'Clean download filename matches convention');
  }

  // -----------------------------------------------------------------
  // 3. FRAMEWORK ROUTER & EQUATOR / ROB RULES TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Step 3: Framework Router Rules Tests ---');
  {
    const rctRules = getGoverningFrameworkRules('RCT');
    assert(rctRules.equatorGuidelineName === 'CONSORT 2010', 'RCT routes to CONSORT 2010');
    assert(rctRules.riskOfBiasToolName.includes('Cochrane'), 'RCT routes to Cochrane RoB 2.0');
    assert(rctRules.defaultOxfordLevel === 'Level 1b', 'RCT routes to Oxford Level 1b');

    const srRules = getGoverningFrameworkRules('SYSTEMATIC_REVIEW_META_ANALYSIS');
    assert(srRules.equatorGuidelineName === 'PRISMA 2020', 'Meta-analysis routes to PRISMA 2020');
    assert(srRules.riskOfBiasToolName.includes('AMSTAR-2'), 'Meta-analysis routes to AMSTAR-2 / ROBIS');
    assert(srRules.defaultOxfordLevel === 'Level 1a', 'Meta-analysis routes to Oxford Level 1a');

    const cohortRules = getGoverningFrameworkRules('COHORT_STUDY');
    assert(cohortRules.equatorGuidelineName.includes('STROBE'), 'Cohort routes to STROBE');
    assert(cohortRules.riskOfBiasToolName.includes('ROBINS-I'), 'Cohort routes to ROBINS-I / NOS');
  }

  // -----------------------------------------------------------------
  // 4. DETERMINISTIC APPRAISAL ENGINE (4-PASS VALIDATION)
  // -----------------------------------------------------------------
  console.log('\n--- Step 4: Deterministic Appraisal Engine Tests ---');
  {
    const mockManuscript = {
      id: 'test-manuscript-uuid',
      metadata: {
        title: 'Vaginal Restoration After Vaginal Delivery: Commentary Review Regarding Pathophysiology, Assessment and Evidence-Based Management',
        authors: ['Dr. Inas Taha, MD', 'Dr. Raouf Roshdy, MD'],
        journal: 'Biomedical Science and Clinical Research',
        publicationYear: 2026,
        vancouverCitation: 'Taha I, Roshdy R. Vaginal Restoration After Vaginal Delivery. Biomed Sci Clin Res. 2026;1(1):1-12.',
        sourceDepth: 'FULL_TEXT_PDF' as const,
        openAccess: true,
      },
      abstract: 'Objective: Review pathophysiology, pelvic floor assessment, and evidence-based management of vaginal laxity post delivery. Methods: Systematic review of trials and cohort studies. Conclusion: Multi-modal restoration with pelvic floor therapy and surgical repair demonstrates significant clinical improvement.',
      fullText: 'Full clinical review text discussing anatomy, pelvic floor disorders, clinical trials, and meta-analytic evidence...',
      sections: [
        { title: 'Background', content: 'Pelvic floor relaxation is common post-partum.' },
        { title: 'Pathophysiology', content: 'Damage to levator ani and endopelvic fascia.' },
        { title: 'Management', content: 'Conservative and surgical interventions.' },
      ],
      tablesRaw: [],
      pageCount: 12,
      extractedAt: new Date().toISOString(),
    };

    const appraisal = generateDeterministicAppraisal(mockManuscript);

    // Validate against MasterAppraisalReportSchema
    const parseResult = MasterAppraisalReportSchema.safeParse(appraisal);
    assert(parseResult.success, 'Appraisal output strictly conforms to MasterAppraisalReportSchema');

    // Check Pass 1: Classification & PICO
    assert(appraisal.classification.studyDesign.length > 0, 'Pass 1: Study design classified');
    assert(appraisal.classification.oxfordEvidenceLevel.length > 0, 'Pass 1: Oxford CEBM level assigned');
    assert(appraisal.pico.population.length > 0, 'Pass 1: Population deconstructed');

    // Check Pass 2: RoB & EQUATOR
    assert(appraisal.riskOfBias.domains.length >= 5, 'Pass 2: Cochrane RoB / AMSTAR domains evaluated (>= 5 domains)');
    assert(appraisal.equatorChecklist.criticalItemsAudit.length >= 6, 'Pass 2: EQUATOR checklist items scored');

    // Check Pass 3: Statistical Audit
    assert(appraisal.statisticalAudit.analysisType.length > 0, 'Pass 3: Statistical analysis type identified');
    assert(typeof appraisal.statisticalAudit.spinAndDiscrepancyAudit.spinDetected === 'boolean', 'Pass 3: Abstract spin audited');

    // Check Pass 4: GRADE Synthesis
    assert(['HIGH', 'MODERATE', 'LOW', 'VERY_LOW'].includes(appraisal.validitySynthesis.gradeCertainty), 'Pass 4: GRADE certainty rating synthesized');
    assert(appraisal.references.length >= 4, 'Pass 4: Vancouver references generated (>= 4 references)');
  }

  // -----------------------------------------------------------------
  // 5. WORD .DOCX COMPILER & GEOMETRY VERIFICATION
  // -----------------------------------------------------------------
  console.log('\n--- Step 5: Academic Word .docx Compiler Tests ---');
  {
    const mockManuscript = {
      id: 'test-docx-uuid',
      metadata: {
        title: 'Vaginal Restoration After Vaginal Delivery: Commentary Review',
        authors: ['Dr. Inas Taha, MD', 'Dr. Raouf Roshdy, MD'],
        journal: 'Biomedical Science and Clinical Research',
        publicationYear: 2026,
        vancouverCitation: 'Taha I, Roshdy R. Vaginal Restoration After Vaginal Delivery. Biomed Sci Clin Res. 2026;1(1):1-12.',
        sourceDepth: 'FULL_TEXT_PDF' as const,
        openAccess: true,
      },
      abstract: 'Abstract text here',
      fullText: 'Full text here',
      sections: [],
      tablesRaw: [],
      pageCount: 5,
      extractedAt: new Date().toISOString(),
    };

    const appraisal = generateDeterministicAppraisal(mockManuscript);
    const doc = buildAcademicDocxManuscript(appraisal, {
      name: 'Dr. Raouf Roshdy, MD',
      affiliation: 'Department of Clinical Epidemiology & Evidence-Based Medicine',
      orcid: '0000-0002-1825-0097',
    });

    const buffer = await Packer.toBuffer(doc);
    assert(buffer.length > 10000, `Word .docx successfully compiled into binary buffer (${buffer.length} bytes)`);

    // Verify OpenXML zip signature (PK\x03\x04)
    assert(buffer[0] === 0x50 && buffer[1] === 0x4b, 'Valid OpenXML ZIP magic bytes (PK)');
  }

  // -----------------------------------------------------------------
  // 6. LIVE API ENDPOINTS END-TO-END PIPELINE TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Step 6: Live HTTP API Pipeline Integration Tests ---');
  {
    const BASE_URL = 'http://localhost:3000';

    // 6A. Ingest via identifier
    console.log('Testing /api/ingest/identifier with PMCID PMC7118652...');
    const ingestRes = await fetch(`${BASE_URL}/api/ingest/identifier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: 'PMC7118652' }),
    });
    assert(ingestRes.status === 200, `POST /api/ingest/identifier returned HTTP 200 (Got ${ingestRes.status})`);
    const manuscript = await ingestRes.json();
    assert(manuscript && manuscript.metadata && manuscript.metadata.title, 'Ingestion returned valid manuscript payload with title');
    assert(manuscript.abstract && manuscript.abstract.length > 50, 'Ingested manuscript contains parsed abstract');

    // 6B. Appraise via API
    console.log('Testing /api/appraise with ingested manuscript...');
    const appraiseRes = await fetch(`${BASE_URL}/api/appraise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manuscript }),
    });
    assert(appraiseRes.status === 200, `POST /api/appraise returned HTTP 200 (Got ${appraiseRes.status})`);
    const appraisalReport = await appraiseRes.json();
    assert(appraisalReport.classification && appraisalReport.classification.studyDesign, 'Appraisal returned study design classification');
    assert(appraisalReport.riskOfBias && appraisalReport.riskOfBias.domains.length >= 5, 'Appraisal returned complete RoB domain matrix');
    assert(appraisalReport.validitySynthesis && appraisalReport.validitySynthesis.gradeCertainty, 'Appraisal returned GRADE certainty');

    // 6C. Export .docx via API
    console.log('Testing /api/export/docx with appraisal report...');
    const exportRes = await fetch(`${BASE_URL}/api/export/docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report: appraisalReport,
        appraiserMeta: {
          name: 'Dr. Raouf Roshdy, MD',
          affiliation: 'Department of Clinical Epidemiology & Evidence-Based Medicine',
          orcid: '0000-0002-1825-0097',
        },
      }),
    });
    assert(exportRes.status === 200, `POST /api/export/docx returned HTTP 200 (Got ${exportRes.status})`);
    const contentType = exportRes.headers.get('content-type') || '';
    assert(
      contentType.includes('wordprocessingml.document'),
      `Content-Type header is wordprocessingml.document (Got ${contentType})`
    );
    const docxArrayBuffer = await exportRes.arrayBuffer();
    assert(docxArrayBuffer.byteLength > 15000, `Exported .docx file size is valid (${docxArrayBuffer.byteLength} bytes)`);
  }

  console.log('\n========================================================');
  console.log(`  All Tests Completed: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
