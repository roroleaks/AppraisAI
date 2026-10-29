import { isValidIdentifierInput } from '../src/components/ingestion/IdentifierInput';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

async function runInvalidInputTests() {
  console.log('--- Testing Identifier Input Validation Gating ---');

  // Negative tests: invalid random text must be disabled
  assert(!isValidIdentifierInput('invalid random text that is not a DOI'), 'Reject random text');
  assert(!isValidIdentifierInput('not-a-DOI'), 'Reject "not-a-DOI" string');
  assert(!isValidIdentifierInput(''), 'Reject empty string');
  assert(!isValidIdentifierInput('    '), 'Reject whitespace only');
  assert(!isValidIdentifierInput('some random words here'), 'Reject arbitrary prose');
  assert(!isValidIdentifierInput('1234567890123'), 'Reject >9 digit numbers that are not PMIDs');

  // Positive tests: valid identifiers must enable the button
  assert(isValidIdentifierInput('31535829'), 'Accept valid PMID: 31535829');
  assert(isValidIdentifierInput('PMID: 31535829'), 'Accept prefixed PMID: "PMID: 31535829"');
  assert(isValidIdentifierInput('10.1056/NEJMoa1800722'), 'Accept standard DOI');
  assert(isValidIdentifierInput('doi: 10.1056/NEJMoa1800722'), 'Accept DOI with "doi:" prefix');
  assert(isValidIdentifierInput('https://doi.org/10.1056/NEJMoa1800722'), 'Accept https://doi.org/ URL');
  assert(isValidIdentifierInput('PMC7118652'), 'Accept PMCID PMC7118652');
  assert(isValidIdentifierInput('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7118652/'), 'Accept PMC article URL');
  assert(isValidIdentifierInput('https://www.opastpublishers.com/article.pdf'), 'Accept direct article PDF URL');

  console.log('✅ All invalid input gating tests passed successfully!');
}

runInvalidInputTests().catch((err) => {
  console.error('Invalid input test runner error:', err);
  process.exit(1);
});
