import { formatVancouverAuthors, buildVancouverCitation } from '../src/lib/parsers/vancouver-formatter';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

async function runVancouverTests() {
  console.log('--- Testing Vancouver Author & Citation Formatter (P1-4) ---');

  // Test 1: Author with trailing period
  const author1 = formatVancouverAuthors(['Jones KL.']);
  assert(author1 === 'Jones KL', `Trailing period stripped: expected "Jones KL", got "${author1}"`);

  // Test 2: Multi-part surname with prefix
  const author2 = formatVancouverAuthors(['van der Berg A']);
  assert(author2 === 'van der Berg A', `Prefix surname preserved: expected "van der Berg A", got "${author2}"`);

  // Test 3: Name with apostrophe
  const author3 = formatVancouverAuthors(["O'Neil P"]);
  assert(author3 === "O'Neil P", `Apostrophe surname preserved: expected "O'Neil P", got "${author3}"`);

  // Test 4: Hyphenated name
  const author4 = formatVancouverAuthors(['Smith-Jones KL']);
  assert(author4 === 'Smith-Jones KL', `Hyphenated name preserved: expected "Smith-Jones KL", got "${author4}"`);

  // Test 5: Full first + middle + last name
  const author5 = formatVancouverAuthors(['John J.V. McMurray']);
  assert(author5 === 'McMurray JJ', `Full name with initials: expected "McMurray JJ", got "${author5}"`);

  // Test 6: Crossref object author input
  const author6 = formatVancouverAuthors([
    { family: 'Siddiqi', given: 'Hasan K.' },
    { family: 'Mehra', given: 'Mandeep R.' },
  ]);
  assert(author6 === 'Siddiqi HK, Mehra MR', `Object authors converted: expected "Siddiqi HK, Mehra MR", got "${author6}"`);

  // Test 7: >6 authors produces et al.
  const author7 = formatVancouverAuthors([
    'Author One A',
    'Author Two B',
    'Author Three C',
    'Author Four D',
    'Author Five E',
    'Author Six F',
    'Author Seven G',
  ]);
  assert(author7.includes('et al.'), `More than 6 authors uses et al.: "${author7}"`);

  console.log('✅ All Vancouver formatter tests PASSED successfully!');
}

runVancouverTests().catch((err) => {
  console.error('Vancouver test failed:', err);
  process.exit(1);
});
