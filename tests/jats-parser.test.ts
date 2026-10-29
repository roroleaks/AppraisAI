import { parseJatsXmlToSections } from '../src/lib/parsers/europe-pmc';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

async function runJatsTests() {
  console.log('--- Testing JATS XML Parser ---');

  const jatsFixture = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2 20190208//EN" "JATS-archivearticle1.dtd">
<article xmlns:xlink="http://www.w3.org/1999/xlink" article-type="research-article">
  <front>
    <journal-meta>
      <journal-id journal-id-type="nlm-ta">J Heart Lung Transplant</journal-id>
      <journal-id journal-id-type="iso-abbrev">J. Heart Lung Transplant</journal-id>
      <journal-title-group>
        <journal-title>The Journal of Heart and Lung Transplantation</journal-title>
      </journal-title-group>
      <issn pub-type="ppub">1053-2498</issn>
      <issn pub-type="epub">1557-3117</issn>
    </journal-meta>
    <article-meta>
      <article-id pub-id-type="pmid">32278656</article-id>
      <article-id pub-id-type="pmc">7118652</article-id>
      <title-group>
        <article-title>COVID-19 Illness in Native and Immunosuppressed States: A Clinical-Therapeutic Staging Proposal</article-title>
      </title-group>
      <abstract>
        <sec>
          <title>Background</title>
          <p>The novel coronavirus disease 2019 (COVID-19) pandemic presents unprecedented challenges for solid organ transplant recipients and immunosuppressed hosts.</p>
        </sec>
        <sec>
          <title>Methods</title>
          <p>We conducted a systematic review and mechanistic synthesis of emerging clinical cohorts.</p>
        </sec>
        <sec>
          <title>Conclusion</title>
          <p>A 3-stage clinical classification framework distinguishes early viral response from systemic hyperinflammation.</p>
        </sec>
      </abstract>
      <kwd-group>
        <kwd>COVID-19</kwd>
        <kwd>SARS-CoV-2</kwd>
        <kwd>Transplantation</kwd>
      </kwd-group>
      <permissions>
        <copyright-statement>© 2020 International Society for Heart and Lung Transplantation</copyright-statement>
      </permissions>
    </article-meta>
  </front>
  <body>
    <sec id="sec1">
      <title>Introduction</title>
      <p>Coronaviruses are enveloped single-stranded RNA viruses causing respiratory infections.</p>
    </sec>
    <sec id="sec2">
      <title>Clinical Staging Proposal</title>
      <p>Stage I encompasses early infection characterized by mild constitutional symptoms and viral replication.</p>
      <p>Stage II is the pulmonary phase with localized tissue inflammation and viral pneumonia.</p>
    </sec>
  </body>
</article>`;

  const result = parseJatsXmlToSections(jatsFixture);

  // 1. Verify clean title extracted
  assert(
    result.title === 'COVID-19 Illness in Native and Immunosuppressed States: A Clinical-Therapeutic Staging Proposal',
    'Article title extracted correctly from <title-group>/<article-title>'
  );

  // 2. Verify structured abstract extracted
  assert(result.abstract.includes('Background') && result.abstract.includes('unprecedented challenges'), 'Abstract contains Background section');
  assert(result.abstract.includes('Conclusion') && result.abstract.includes('3-stage clinical classification'), 'Abstract contains Conclusion section');

  // 3. Verify body sections extracted
  assert(result.sections.length >= 2, `Body sections extracted (count: ${result.sections.length})`);
  assert(result.sections[0].heading === 'Introduction', 'First section heading is Introduction');
  assert(result.sections[1].heading === 'Clinical Staging Proposal', 'Second section heading is Clinical Staging Proposal');

  // 4. CRITICAL: Zero metadata leakage (<journal-id>, <issn>, etc.)
  assert(!result.abstract.includes('J Heart Lung Transplant'), 'Abstract has ZERO journal-id leakage');
  assert(!result.abstract.includes('1053-2498'), 'Abstract has ZERO ISSN leakage');
  assert(!result.fullText.includes('J Heart Lung Transplant'), 'FullText has ZERO journal-id leakage');
  assert(!result.fullText.includes('1053-2498'), 'FullText has ZERO ISSN leakage');
  assert(!result.fullText.includes('pheelsevier'), 'FullText has ZERO publisher metadata leakage');

  console.log('✅ All JATS XML parser tests passed cleanly!');
}

runJatsTests().catch((err) => {
  console.error('JATS parser test failed:', err);
  process.exit(1);
});
