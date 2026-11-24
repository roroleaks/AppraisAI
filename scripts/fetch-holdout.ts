import fs from 'fs';
import path from 'path';

const OUT = 'tests/generalisation/live';
const SEEN = new Set(
  ['tests/benchmark', 'tests/holdout/fixtures', 'tests/generalisation/fixtures']
    .filter((d) => fs.existsSync(d))
    .flatMap((d) => fs.readdirSync(d))
    .map((f) => (f.match(/(\d{7,9})/) || [])[1])
    .filter(Boolean) as string[]
);

const QUERIES: [string, number][] = [
  ['PUB_TYPE:"Randomized Controlled Trial" AND (TITLE:"in vitro fertilization" OR TITLE:"IVF" OR TITLE:"embryo transfer" OR TITLE:"ovarian stimulation") AND HAS_ABSTRACT:y AND PUB_YEAR:[2015 TO 2025]', 6],
  ['(PUB_TYPE:"Systematic Review" OR PUB_TYPE:"Meta-Analysis") AND (TITLE:"IVF" OR TITLE:"infertility" OR TITLE:"embryo") AND HAS_ABSTRACT:y AND PUB_YEAR:[2018 TO 2025]', 5],
  ['(TITLE:"artificial intelligence" OR TITLE:"deep learning" OR TITLE:"machine learning") AND (TITLE:"embryo" OR TITLE:"blastocyst" OR TITLE:"IVF") AND HAS_ABSTRACT:y', 5],
  ['PUB_TYPE:"Randomized Controlled Trial" AND (JOURNAL:"N Engl J Med" OR JOURNAL:"Lancet") AND (TITLE:"pregnancy" OR TITLE:"preterm" OR TITLE:"preeclampsia" OR TITLE:"labor") AND HAS_ABSTRACT:y', 5],
  ['PUB_TYPE:"Randomized Controlled Trial" AND JOURNAL:"N Engl J Med" AND HAS_ABSTRACT:y AND PUB_YEAR:[2019 TO 2024]', 4],
  ['(TITLE:"cohort" OR TITLE:"registry") AND (TITLE:"IVF" OR TITLE:"assisted reproduction" OR TITLE:"pregnancy") AND HAS_ABSTRACT:y AND PUB_YEAR:[2016 TO 2025]', 3],
];

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  let n = 0;
  for (const [q, want] of QUERIES) {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=${want * 3}&sort=CITED%20desc&query=${encodeURIComponent(q + ' AND SRC:MED')}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const j: any = await resp.json();
    let got = 0;
    for (const r of j.resultList?.result ?? []) {
      if (got >= want) break;
      if (!r.pmid || SEEN.has(r.pmid) || !r.abstractText) continue;
      SEEN.add(r.pmid);
      fs.writeFileSync(path.join(OUT, `L_${r.pmid}.json`), JSON.stringify(r, null, 1));
      got++; n++;
      console.log(`+ ${r.pmid}  ${(r.pubTypeList?.pubType || []).slice(0, 2).join('/')}  ${String(r.title).slice(0, 90)}`);
    }
    if (got < want) console.log(`! query returned only ${got}/${want}: ${q.slice(0, 80)}…`);
  }
  console.log(`\nSaved ${n} new held-out fixtures to ${OUT}`);
}
run();
