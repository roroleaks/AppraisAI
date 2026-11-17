# AppraisAI Technical, Methodological & Scientific Remediation Changelog

This document provides a comprehensive audit trail of all architectural, technical, methodological, and scientific integrity remediations executed on the **AppraisAI** platform.

---

## Remediation Summary Matrix

| Phase | Category | Scope | Commits | Test Suite Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Baseline Audit | Repository audit, test split, plan generation | `4a6b8d5` | 3 suites, 48 assertions passing |
| **Phase 1** | P0: Scientific Integrity | Zero-fabrication, evidence grounding, quote verification | `2458dce` | 4 suites, 60 assertions passing |
| **Phase 2** | P1: Correctness Bugs | Classification scoring, effect-size parsing, GRADE, tables | `8e8955c` | 5 suites, 74 assertions passing |
| **Phase 3** | P2: Methodological Alignment | CONSORT 2025, AMSTAR 2 critical domains, OCEBM 2009 | `87d15eb` | 5 suites, 74 assertions passing |
| **Phase 4** | P3: Publication DOCX | Word navigation outlines, table pagination, RevMan strip | `87d15eb` | 5 suites, 74 assertions passing |
| **Phase 5** | P4/P5: Security & UI | SSRF protection, 25MB limits, %PDF- magic bytes, session storage | `dbd9dbc` | 5 suites, 74 assertions passing |
| **Phase 6** | P6: Verification & Docs | 12-point regression suite, documentation, DoD verification | Current | 6 suites, 107 assertions passing |

---

## Detailed Task Breakdown

### Phase 0: Baseline & Test Safety Split
- **P0-Baseline-1:** Separated offline integration tests from live network tests. Configured `npm test` to run completely offline without relying on external network stability or API keys. Added `npm run test:live` for optional Europe PMC live network smoke tests.
- **P0-Baseline-2:** Generated comprehensive remediation plan `docs/REMEDIATION_PLAN.md`.
- **Files Modified:** `package.json`, `tests/suite.test.ts`, `tests/europe-pmc-live.test.ts`, `docs/REMEDIATION_PLAN.md`.

### Phase 1: P0 Scientific Integrity & Fabrications Removal
- **P0-1:** Eliminated all hardcoded demo statistics (`HR = 0.74 [0.65, 0.85]`, `I² = 28%`, `dapagliflozin`) from all parsing and fallback code paths in `src/`. Missing data now explicitly returns `"Not reported / Not assessable from available text"`.
- **P0-2:** Repaired neural LLM pipeline JSON handling:
  - Gemini responses now parse `candidates[0].content.parts[].text`.
  - Appended target JSON schema to prompt prompts using `zod-to-json-schema`.
  - Added one-cycle repair retry before throwing `LlmValidationError`.
  - Sent Gemini API key via `x-goog-api-key` header rather than exposing it in query parameters.
- **P0-3:** Added visible provenance badges and alert banners distinguishing Neural LLM evaluations from Heuristic Screening Drafts in UI, export modals, and DOCX monographs.
- **P0-4:** Blocked appraisal initiation when only bibliographic metadata is returned from registries (`contentAvailable: false`).
- **P0-5:** Introduced verbatim quote verifier (`quote-verifier.ts`) to validate whether supportive evidence strings are substrings of the ingested manuscript. Unverified AI summaries are labeled `[Appraiser note (AI-generated)]`.
- **P0-6:** Removed hardcoded author names ("Inas Taha"). Configured lead clinical appraiser attribution to Dr. Raouf Roshdy with ISO 7064 MOD 11-2 validated ORCID (`0009-0001-4841-1656`).
- **Files Modified:** `src/lib/evaluators/pipeline.ts`, `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/llm/llm-client.ts`, `src/lib/parsers/quote-verifier.ts`, `src/lib/parsers/title-sanitizer.ts`, `src/components/preview/ExportToolbar.tsx`.

### Phase 2: P1 Correctness Bugs
- **P1-1:** Implemented scored multi-candidate study design classifier in `deterministic-appraisal.ts`. Scored evaluation is strictly constrained to `title + abstract + methodsText` (never scans discussion or references). Rejected "odds ratio" as a case-control signal.
- **P1-2:** Developed comprehensive effect-size extraction regex supporting HR, RR, Rate Ratio, Risk Ratio, OR, MD, SMD, RD, ARR, and NNT with multiple CI formats (brackets, en-dash, unicode minus) and verbatim `sourceSentence` preservation.
- **P1-3:** Expanded sample size regex to recognize multi-domain biomedical nouns (`women`, `infants`, `cycles`, `embryos`, `pregnancies`, `couples`, `neonates`, `participants`) and `n = 750` notation.
- **P1-4:** Fixed Vancouver author formatting in `vancouver-formatter.ts` to strip trailing periods (`"Jones KL." -> "Jones KL"`).
- **P1-5:** Single source of truth for citations via `metadata.vancouverCitation`.
- **P1-6:** Fixed Europe PMC capture group indexing (`match(regex)?.[0]`).
- **P1-7:** Added Europe PMC `EXT_ID:${cleanQuery} AND SRC:MED` query optimization with return PMID verification.
- **P1-8:** Extracted JATS XML `<table>` and `<td>` cells into `tablesRaw` and appended markdown table representations to `fullText` under `"## Tables"`.
- **P1-9:** Refined GRADE engine: `UNCLEAR_NOT_REPORTED` RoB downgrades 1 level; Systematic reviews of observational studies baseline at `LOW`.
- **P1-10:** Zustand store updates automatically recompute overall RoB via the worst-domain rule and GRADE certainty on domain edits; added manual override flags with user justification fields.
- **P1-11:** Replaced fake `setTimeout` timers with real Server-Sent Events (SSE) streaming from `/api/appraise` with `onProgress` callbacks.
- **P1-12:** Restricted PDF DOI detection to the first page / pre-abstract text to eliminate references DOI hijacking.
- **P1-13:** Configured Zustand `persist` middleware for `currentManuscript` and `currentAppraisal` while strictly excluding API keys from localStorage.
- **P1-14:** Enforced ISO date format (`YYYY-MM-DD`) in export routes and preview modals.
- **Files Modified:** `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/evaluators/grade-engine.ts`, `src/lib/parsers/vancouver-formatter.ts`, `src/lib/parsers/europe-pmc.ts`, `src/lib/parsers/jats-parser.ts`, `src/store/useAppraisalStore.ts`, `src/app/api/appraise/route.ts`.

### Phase 3: P2 Methodological Alignment
- **P2-1:** Updated RCT reporting guidelines to **CONSORT 2025** (*Hopewell S, Clarke M, Moher D, et al. BMJ 2025;389:e081123, doi:10.1136/bmj-2024-081123*) with 2025 item numbers (Items 1, 2, 3, 8, 11, 13, 17, 20).
- **P2-2:** Aligned Systematic Review RoB to **AMSTAR 2** with the 7 critical domains: Protocol Registration (Item 2), Comprehensive Search (Item 4), Excluded Studies Justification (Item 7), RoB Assessment (Item 9), Meta-Analytical Methods (Item 11), RoB Interpretation (Item 13), and Publication Bias (Item 15).
- **P2-3:** Relabeled GRADE certainty for single trials as `"GRADE-informed Certainty of Evidence (Single Study)"` across UI and DOCX monographs.
- **P2-4:** Implemented the **JBI Analytical Cross-Sectional Checklist** (5 domains) for cross-sectional studies.
- **P2-5:** Updated diagnostic accuracy evaluation to **QUADAS-2** with dual Risk of Bias and Applicability rows.
- **P2-6:** Structured practice guidelines under the **RIGHT Statement** and **AGREE II** (6 domains).
- **P2-7:** Harmonized Oxford CEBM 2009 Evidence Levels: Level 3b for case-control, Level 4 for cross-sectional, and Level 5 for narrative reviews / commentaries.
- **Files Modified:** `src/lib/evaluators/framework-router.ts`, `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/evaluators/pipeline.ts`.

### Phase 4: P3 Publication-Grade DOCX Report Layout
- **P3-1:** Added Word navigation heading levels (`heading: HeadingLevel.HEADING_1` and `HeadingLevel.HEADING_2`) to all major section titles and subsections.
- **P3-2:** Anti-orphan table pagination: applied `tableHeader: true` and `cantSplit: true` to every table header row, and `cantSplit: true` to all table body rows across all 8 monograph sections.
- **P3-3:** Configured dynamic page geometry with default **A4** (11906x16838 dxa) and optional **US Letter** (12240x15840 dxa); dynamically aligned all tables to `contentWidth`.
- **P3-4:** Formatted running 2-line header: Line 1 specifies publication category and monograph scope; Line 2 renders truncated target article title, DOI/PMID, and bottom border rule.
- **P3-5:** Enforced strict typographic hierarchy: 18pt title bold, 15pt Section 1-8 headings bold, 12.5pt subsection headings bold, 10.5pt justified body.
- **P3-6:** Aligned Cochrane RevMan-style traffic-light summary strip with exact column widths summing to printable width.
- **P3-7:** Separated EQUATOR status tokens (`getEquatorStatusTokens`) from RoB tokens so unassessed items render `[N/A] NOT ASSESSED` rather than `HIGH RISK`.
- **P3-8:** Added Data Provenance and Evidence Grounding callout box on Page 1 reporting appraisal engine, mode, and count of verbatim grounded quotes.
- **P3-9:** Formatted PICO primary outcomes as bulleted list; separated secondary endpoints into their own row.
- **P3-10:** Styled spin callout box with emerald/crimson soft-alert backgrounds.
- **P3-11:** Added explicit Upgrading Factors row to the GRADE Certainty Table.
- **P3-12:** Formatted Vancouver references list to guarantee DOIs/URLs are printed for all standard methodological guidelines.
- **Files Modified:** `src/lib/docx/docx-builder.ts`, `src/lib/docx/styles.ts`.

### Phase 5: P4/P5 UI Hardening, SSRF Mitigation & Security Controls
- **P5-1:** Built SSRF guard module `src/lib/security/ssrf-guard.ts`:
  - Enforced strict `https:` scheme validation.
  - Resolved DNS and blocked all private, loopback, link-local, and cloud metadata ranges (`127.0.0.0/8`, `10.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`).
  - Capped redirects at 3 with DNS re-validation on every redirect hop.
  - Enforced a 15-second timeout and 25MB response size limit.
- **P5-2:** Upload route hardening:
  - Enforced 25MB max file upload limit (HTTP 413).
  - Validated `%PDF-` magic bytes (`0x25, 0x50, 0x44, 0x46, 0x2D`) at offset 0 (HTTP 422).
- **P5-3:** Added "Remember on this device" checkbox in `LlmSettingsModal.tsx`. Default is unchecked (stores in `sessionStorage` only). Keys are removed from `localStorage` unless explicitly requested.
- **P5-4:** Error message sanitization in `/api/appraise`: stripped API keys, bearer tokens, prompt internals, and stack frames from all error responses.
- **P5-5:** Added prominent Abstract-Only Warning Alert Banner to both the Ingested Manuscript Summary Card and the Active Appraisal Workspace.
- **Files Modified:** `src/lib/security/ssrf-guard.ts`, `src/app/api/ingest/identifier/route.ts`, `src/app/api/ingest/upload/route.ts`, `src/components/common/LlmSettingsModal.tsx`, `src/app/api/appraise/route.ts`, `src/app/page.tsx`.

### Phase 6: Offline Regression Suite & Verification
- **P6-1:** Created 12 offline test fixtures in `tests/fixtures/`.
- **P6-2:** Built comprehensive test runner `tests/regression.test.ts` verifying all 12 key integrity scenarios.
- **P6-3:** Added regression runner to `npm test` script in `package.json`.
- **P6-4:** Updated `README.md` with complete architecture diagram, security guidelines, and verified author ORCID.
- **P6-5:** Executed Definition of Done grep verification confirming zero occurrences of forbidden legacy strings across `src/`.
- **Files Created/Modified:** `tests/fixtures/*`, `tests/regression.test.ts`, `package.json`, `README.md`, `docs/CHANGELOG_REMEDIATION.md`.
