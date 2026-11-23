import fs from 'fs';
import { extractBiomedicalPdf } from '../src/lib/parsers/pdf-extractor';

async function run() {
  const buf = fs.readFileSync('tests/benchmark/B8_opast.pdf');
  const extracted = await extractBiomedicalPdf(new Uint8Array(buf));
  console.log('Title:', extracted.metadata.title);
  console.log('Authors:', extracted.metadata.authors);
  console.log('Year:', extracted.metadata.year);
  console.log('Journal:', extracted.metadata.journal);
  console.log('DOI:', extracted.metadata.doi);
  console.log('Abstract length:', extracted.abstract.length);
  fs.writeFileSync('tests/benchmark/B8_opast.json', JSON.stringify(extracted, null, 2));
  console.log('Successfully saved B8_opast.json');
}

run().catch(console.error);
