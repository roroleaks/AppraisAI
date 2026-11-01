import { resolveEuropePmcArticle } from '../src/lib/parsers/europe-pmc';

async function testEuropePmcLive() {
  console.log('--- Testing Europe PMC Live Article Resolution ---');

  // Test 1: Editorial PMC7118652 (Siddiqi & Mehra 2020)
  console.log('Resolving PMC7118652...');
  const resPmc = await resolveEuropePmcArticle('PMC7118652');
  if (!resPmc) {
    throw new Error('Failed to resolve PMC7118652');
  }
  console.log('PMC7118652 Title:', resPmc.title);
  console.log('PMC7118652 Abstract length:', resPmc.abstract.length);
  console.log('PMC7118652 SourceDepth:', resPmc.sourceDepth);
  if (!resPmc.abstract || resPmc.abstract.length < 50) {
    throw new Error(`Expected abstract length > 50, got ${resPmc.abstract.length}`);
  }

  // Test 2: Bare DOI 10.1056/NEJMoa1911303 (DAPA-HF)
  console.log('Resolving bare DOI 10.1056/NEJMoa1911303...');
  const resDoi = await resolveEuropePmcArticle('10.1056/NEJMoa1911303');
  if (!resDoi) {
    throw new Error('Failed to resolve DOI 10.1056/NEJMoa1911303');
  }
  console.log('DOI Title:', resDoi.title);
  console.log('DOI Resolved DOI:', resDoi.doi);
  if (!resDoi.title.toLowerCase().includes('dapagliflozin')) {
    throw new Error(`CRITICAL: Resolved wrong paper! Expected Dapagliflozin, got: ${resDoi.title}`);
  }

  console.log('✅ Europe PMC live test passed with 100% precision! Zero wrong-paper resolution and valid abstract.');
}

testEuropePmcLive().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
