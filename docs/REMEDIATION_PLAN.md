# AppraisAI — Integrity, Correctness & Report-Layout Remediation Plan

**Date:** 2026-11-17  
**Project:** AppraisAI (`https://github.com/roroleaks/AppraisAI`)  
**Lead Engineer & Clinical Epidemiologist Collaboration**  

---

## 1. Baseline Verification (Phase 0)

- **`npm ci`**: Completed successfully (120 packages audited).
- **`npx tsc --noEmit`**: 0 errors.
- **`npm run build`**: Next.js 15.5.28 production build compiled successfully.
- **Offline Test Suites**:
  - `tests/suite.test.ts`: 30/30 passed.
  - `tests/jats-parser.test.ts`: 11/11 passed.
  - `tests/invalid-input.test.ts`: 14/14 passed.
  - `tests/appraisal-content-parity.test.ts`: 10/10 passed.
- **Live Test Suite**: `tests/europe-pmc-live.test.ts` isolated to `npm run test:live`.
- **`package.json`**: Split `test` (offline suites) and `test:live` (network live test).

---

## 2. Phase-by-Phase Task Breakdown & Touched Files

### Phase 1 (P0) — Scientific Integrity (Blocking)

| Task ID | Description | Primary Files Touched |
|---|---|---|
| **P0-1** | Eliminate all fabricated numbers, fake RoB text, hardcoded EQUATOR 100%, and topic hardcodes. Rename mode to "Heuristic screening draft — not a critical appraisal". | `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/docx/docx-builder.ts`, `src/components/appraisal/*`, `src/app/page.tsx` |
| **P0-2** | Fix broken LLM pipeline: Gemini JSON path, `zod-to-json-schema` generation, validation retry/repair, balanced-brace JSON scanner, timeout/backoff, OpenAI `gpt-4o-mini`, structured prompts, Methods/Results prioritization. | `src/lib/llm/llm-client.ts`, `src/lib/evaluators/pipeline.ts`, `package.json` |
| **P0-3** | Disclose engine provenance clearly (`llm`, `deterministic-fallback`, `deterministic`), reason for fallback in yellow banner, persistent badges in UI and DOCX. | `src/app/api/appraise/route.ts`, `src/lib/schemas/appraisal.schema.ts`, `src/app/page.tsx`, `src/components/preview/ExportToolbar.tsx`, `src/lib/docx/docx-builder.ts` |
| **P0-4** | Never appraise placeholder strings ("Abstract unavailable..."). Extract Crossref abstracts, gate appraisal with `contentAvailable: boolean`. | `src/app/api/ingest/identifier/route.ts`, `src/lib/parsers/europe-pmc.ts`, `src/lib/parsers/crossref.ts`, `src/lib/schemas/ingestion.schema.ts`, `src/components/ingestion/ManuscriptPreviewCard.tsx` |
| **P0-5** | Ensure quotation integrity. Add `isVerbatimInManuscript` helper. Render quotes only for text genuinely appearing in manuscript; label others "Appraiser note (AI-generated)". | `src/lib/parsers/quote-verifier.ts`, `src/components/appraisal/RiskOfBiasMatrix.tsx`, `src/lib/docx/docx-builder.ts` |
| **P0-6** | Remove hardcoded author/journal fallbacks. Update default author/appraiser attribution; require appraiser name; validate ORCID (0009-0001-4841-1656) with MOD 11-2; disclaimer verification checkbox. | `src/lib/parsers/pdf-extractor.ts`, `src/lib/parsers/title-sanitizer.ts`, `src/components/preview/ExportToolbar.tsx`, `src/lib/docx/docx-builder.ts` |

---

### Phase 2 (P1) — Correctness Bugs

| Task ID | Description | Primary Files Touched |
|---|---|---|
| **P1-1** | Scored study design classifier on title + abstract + methods; reject "odds ratio" as case-control signal; default unknown to `OTHER`. | `src/lib/evaluators/deterministic-appraisal.ts` |
| **P1-2** | Comprehensive effect-size regex (HR, RR, rate ratio, risk ratio, OR, MD, SMD, RD/ARR, NNT) with CI variants and source sentence retention. | `src/lib/evaluators/deterministic-appraisal.ts` |
| **P1-3** | Sample-size noun expansion (women, infants, cycles, embryos, pregnancies, etc.) plus `n = 750` / `N=750`. | `src/lib/evaluators/deterministic-appraisal.ts` |
| **P1-4** | Vancouver author trailing-period fix ("Jones KL." -> "Jones KL") and name variations. | `src/lib/parsers/vancouver-formatter.ts`, `tests/vancouver.test.ts` |
| **P1-5** | Bibliographic callout in DOCX single source of truth via `meta.vancouverCitation`. | `src/lib/docx/docx-builder.ts` |
| **P1-6** | Europe PMC regex capture group bug fix (`match(regex)?.[0]`). | `src/lib/parsers/europe-pmc.ts` |
| **P1-7** | Europe PMC `EXT_ID:123456 AND SRC:MED` query and PMID verification. | `src/lib/parsers/europe-pmc.ts` |
| **P1-8** | JATS XML table cells extraction (thead/tbody pipe-delimited) into `tablesRaw` and fullText. | `src/lib/parsers/europe-pmc.ts` |
| **P1-9** | GRADE engine: unclear RoB downgrades 1 level; observational SR starts LOW. | `src/lib/evaluators/grade-engine.ts` |
| **P1-10** | Store auto-recomputation on user edit with manual override justification flag. | `src/store/useAppraisalStore.ts`, `src/components/appraisal/RiskOfBiasMatrix.tsx`, `src/components/appraisal/ValidityAndClinicalCard.tsx` |
| **P1-11** | Progress stepper: stream real server progress via SSE / NDJSON / state instead of fake timers. | `src/app/api/appraise/route.ts`, `src/components/ingestion/ManuscriptPreviewCard.tsx`, `src/store/useAppraisalStore.ts` |
| **P1-12** | First-page / pre-abstract DOI extraction only from PDFs. | `src/lib/parsers/pdf-extractor.ts` |
| **P1-13** | Report persistence in Zustand (localStorage) without persisting API keys; update README. | `src/store/useAppraisalStore.ts`, `README.md` |
| **P1-14** | ISO date formatting (`YYYY-MM-DD`) in DOCX export route. | `src/app/api/export/docx/route.ts` |

---

### Phase 3 (P2) — Methodological Alignment

| Task ID | Description | Primary Files Touched |
|---|---|---|
| **P2-0** | Update RCT reporting guideline to CONSORT 2025 (Hopewell S, et al. BMJ 2025;389:e081123). | `src/lib/evaluators/framework-router.ts`, `src/lib/docx/docx-builder.ts` |
| **P2-1** | RoB 2 judgement scale alignment: Low, Some concerns, High, Not assessed; worst-domain rule; fix Domain 2 naming. | `src/lib/schemas/appraisal.schema.ts`, `src/lib/evaluators/framework-router.ts`, `src/lib/evaluators/deterministic-appraisal.ts`, `src/components/appraisal/RiskOfBiasMatrix.tsx`, `src/lib/docx/docx-builder.ts` |
| **P2-2** | Tool per design: AMSTAR 2 (16 items, 7 critical) for SR/MA; ROBINS-I for non-randomized; STROBE+JBI for cross-sectional; AGREE II for guidelines; QUADAS-2 with applicability rows. | `src/lib/evaluators/framework-router.ts`, `src/lib/schemas/appraisal.schema.ts`, `src/lib/docx/docx-builder.ts`, `src/components/appraisal/RiskOfBiasMatrix.tsx` |
| **P2-3** | Single-study GRADE labelling ("GRADE-informed certainty (single study)"); mark Inconsistency & Publication bias as "Not assessable from single study"; rate per primary outcome. | `src/lib/evaluators/grade-engine.ts`, `src/lib/docx/docx-builder.ts`, `src/components/appraisal/ValidityAndClinicalCard.tsx` |
| **P2-4** | Oxford CEBM levels harmonization: resolve 2009 vs 2011 citation, correct case-control and cross-sectional levels. | `src/lib/evaluators/framework-router.ts`, `src/lib/docx/docx-builder.ts`, `src/lib/schemas/appraisal.schema.ts` |

---

### Phase 4 (P3) — DOCX Report Layout

| Task ID | Description | Primary Files Touched |
|---|---|---|
| **P3-1..12** | HeadingLevel.HEADING_1/2, `cantSplit: true`, repeating table headers (`tableHeader: true`), A4 default / Letter optional, word-boundary header truncation, outcome bulleting, natural case/syntax, comparator parsing ("X vs Y"), data provenance box on p.1, accessible status tokens, GRADE upgrading factors row, verified reference DOIs. | `src/lib/docx/docx-builder.ts`, `src/lib/docx/styles.ts` |

---

### Phase 5 (P4/P5) — UI & Security

| Task ID | Description | Primary Files Touched |
|---|---|---|
| **P5-1** | SSRF prevention on direct URL ingestion: HTTPS only, private IP / loopback / link-local / cloud metadata blocklist, redirect validation, 15 s timeout, 25 MB cap. | `src/app/api/ingest/identifier/route.ts` |
| **P5-2** | Upload limits: 25 MB max, PDF magic bytes check (`%PDF-`). | `src/app/api/ingest/upload/route.ts` |
| **P5-3** | API key security: default to sessionStorage ("remember on device" optional), never log headers, strip key from client errors. | `src/components/common/LlmSettingsModal.tsx`, `src/store/useAppraisalStore.ts` |
| **P5-4** | Sanitize error responses without leaking prompt/provider internals. | `src/app/api/appraise/route.ts` |
| **P5-5** | Abstract-only fallback UI banner warning regarding unassessable methodology. | `src/components/ingestion/ManuscriptPreviewCard.tsx`, `src/app/page.tsx` |

---

### Phase 6 — Tests & Documentation

| Task ID | Description | Primary Files Touched |
|---|---|---|
| **P6-1** | Content parity test update: assert no fallback text, verify `sourceSentence`. | `tests/appraisal-content-parity.test.ts` |
| **P6-2** | 12 offline regression fixtures and test suite. | `tests/fixtures/*`, `tests/regression.test.ts`, `package.json` |
| **P6-3** | Update README and produce `docs/CHANGELOG_REMEDIATION.md`. | `README.md`, `docs/CHANGELOG_REMEDIATION.md` |
