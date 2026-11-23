# AppraisAI Remediation Plan (`FIX_PLAN.md`)
Date: 23 Nov 2026
Branch: `fix/audit-2026-11`

## Repository Mapping
- **Ingestion Routes & Handlers:**
  - `src/app/api/ingest/identifier/route.ts`: API endpoint for DOI/PMID/URL resolution
  - `src/lib/parsers/identifier-normalizer.ts`: Regex & normalization for DOIs, PMIDs, PMCIDs, URLs
  - `src/lib/parsers/europe-pmc.ts`: Europe PMC REST API, pubTypeList, commentCorrectionList, JATS XML
  - `src/lib/parsers/crossref.ts`: Crossref API, relation/update-to, abstracts
  - `src/lib/parsers/pdf-extractor.ts`: PDF text & header extraction
  - `src/lib/parsers/title-sanitizer.ts`: Biomedical title cleaner, author surname parsing, download filename
  - `src/lib/parsers/vancouver-formatter.ts`: Vancouver citation generation
- **Heuristic & Framework Engines:**
  - `src/lib/evaluators/deterministic-appraisal.ts`: PICO extraction, statistical audit, spin audit, RoB heuristics
  - `src/lib/evaluators/framework-router.ts`: Study design classification, EQUATOR checklist, RoB domains, references
  - `src/lib/evaluators/grade-engine.ts`: GRADE synthesis, downgrading/upgrading criteria
- **Schemas:**
  - `src/lib/schemas/appraisal.schema.ts`: MasterAppraisalReportSchema, PICO schema, RoB, statistics, GRADE
  - `src/lib/schemas/ingestion.schema.ts`: ParsedManuscriptPayload, RetractionInfo
- **UI Components & Pages:**
  - `src/app/page.tsx`: Main landing, tabs, banners, bottom navigation
  - `src/components/ingestion/IdentifierInput.tsx`: Identifier input form, sample chips, helper text
  - `src/components/ingestion/ManuscriptPreviewCard.tsx`: Abstract preview, markdown rendering, action bar
  - `src/components/preview/ExportToolbar.tsx`: Sticky toolbar, responsive height, popovers, export actions
  - `src/components/preview/ManuscriptPreviewModal.tsx`: Print preview modal, accessibility, focus trap
  - `src/components/appraisal/AppraisalProgressStepper.tsx`: 4-pass pipeline stepper status
  - `src/components/appraisal/PicoSummaryCard.tsx`: PICO display, provenance chips
  - `src/components/appraisal/RiskOfBiasMatrix.tsx`: RoB domains, semantic colors, horizontal scroll
  - `src/components/appraisal/StatisticalAuditViewer.tsx`: Effect sizes, outcome types, spin audit
  - `src/components/appraisal/ValidityAndClinicalCard.tsx`: GRADE certainty, clinical bottom line, Vancouver refs
  - `src/components/common/LlmSettingsModal.tsx`: LLM config modal, accessibility, focus trap
  - `src/store/useAppraisalStore.ts`: Zustand store, localStorage persistence, clear my data
- **Export & DOCX Generator:**
  - `src/app/api/export/docx/route.ts`: DOCX export endpoint
  - `src/lib/docx/docx-builder.ts`: Document generation, heading styles, font sizes, watermarking
  - `src/lib/docx/styles.ts`: Color palette, table cell formatting

---

## Phase A: Scientific Integrity (Release-Blocking)
- [ ] **A0**: Create `tests/benchmark/` with fixtures B1–B9 and `tests/benchmark.test.ts`. Wire to `npm run test:benchmark`.
  - Files: `tests/benchmark/*.json`, `tests/benchmark.test.ts`, `package.json`
- [ ] **A1 (P0-1)**: Primary-effect extraction anchored to primary outcome.
  - Files: `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/schemas/appraisal.schema.ts`
- [ ] **A2 (P0-2)**: Retraction and correction gate.
  - Files: `src/lib/parsers/europe-pmc.ts`, `src/lib/parsers/crossref.ts`, `src/lib/schemas/ingestion.schema.ts`, `src/lib/schemas/appraisal.schema.ts`, `src/lib/evaluators/deterministic-appraisal.ts`, `src/components/ingestion/IdentifierInput.tsx`, `src/app/page.tsx`, `src/lib/docx/docx-builder.ts`
- [ ] **A3 (P0-3)**: Metadata-first study-design classification.
  - Files: `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/evaluators/framework-router.ts`, `src/components/appraisal/PicoSummaryCard.tsx`
- [ ] **A4 (P0-4)**: Outcome-type labelling (benefit / harm / process).
  - Files: `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/schemas/appraisal.schema.ts`, `src/components/appraisal/StatisticalAuditViewer.tsx`
- [ ] **A5 (P0-5)**: No default negative claims (tri-state assessed-positive | assessed-negative | not-assessed).
  - Files: `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/evaluators/grade-engine.ts`, `src/components/appraisal/StatisticalAuditViewer.tsx`, `src/components/appraisal/ValidityAndClinicalCard.tsx`, `src/lib/docx/docx-builder.ts`
- [ ] **A6 (P1-1)**: PICO from evidence, not templates.
  - Files: `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/schemas/appraisal.schema.ts`
- [ ] **A7 (P1-4)**: One truthful status model (badges, unverified text).
  - Files: `src/components/preview/ExportToolbar.tsx`, `src/components/appraisal/AppraisalProgressStepper.tsx`, `src/components/ingestion/SourceDepthBadge.tsx`, `src/app/page.tsx`, `src/lib/docx/docx-builder.ts`
- [ ] **A8 (P1-8)**: P-value and comparator parsing (`P<0.001`, `P = 0.004`, etc.).
  - Files: `src/lib/evaluators/deterministic-appraisal.ts`
- [ ] **A9 (P1-5)**: DOI-first metadata for URLs and PDFs.
  - Files: `src/app/api/ingest/identifier/route.ts`, `src/lib/parsers/pdf-extractor.ts`, `src/lib/parsers/europe-pmc.ts`, `src/lib/parsers/identifier-normalizer.ts`

---

## Phase B: Reporting Checklists & Workflow
- [ ] **B1 (P1-2, P1-3)**: CONSORT 2025 item numbering, unique evidence spans, PRISMA 2020 / STROBE.
  - Files: `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/evaluators/framework-router.ts`, `src/components/appraisal/RiskOfBiasMatrix.tsx`
- [ ] **B2**: Trial-specific logic (non-inferiority, early stopping, attrition, adherence, COI).
  - Files: `src/lib/evaluators/deterministic-appraisal.ts`, `src/lib/evaluators/grade-engine.ts`, `src/lib/schemas/appraisal.schema.ts`
- [ ] **B3**: Fix methodology references (Hopewell et al. without Clarke M, OCEBM 2011, Savović J).
  - Files: `src/lib/evaluators/framework-router.ts`, `src/lib/evaluators/deterministic-appraisal.ts`
- [ ] **B4 (P1-6)**: In-app modals for confirmations & validation instead of native window dialogs.
  - Files: `src/components/preview/ExportToolbar.tsx`, `src/app/page.tsx`, `src/components/appraisal/ValidityAndClinicalCard.tsx`
- [ ] **B5**: Ingest UX: parallel lookups, streaming status, cancel button, free-text helper.
  - Files: `src/components/ingestion/IdentifierInput.tsx`, `src/app/api/ingest/identifier/route.ts`
- [ ] **B6**: Export safeguards & correct author surname parsing in DOCX filename.
  - Files: `src/lib/parsers/title-sanitizer.ts`, `src/lib/docx/docx-builder.ts`, `src/components/preview/ExportToolbar.tsx`

---

## Phase C: UI, Typography, Responsive, Accessibility
- [ ] **C1**: Type scale & hierarchy (15-16px body, 20-22px H3, 16-18px H4, H1/H2 outline).
  - Files: `src/app/globals.css`, `src/app/page.tsx`, `src/components/appraisal/*.tsx`
- [ ] **C2**: Sticky chrome, responsive desktop/mobile toolbar, horizontal table scroll.
  - Files: `src/components/preview/ExportToolbar.tsx`, `src/components/appraisal/*.tsx`
- [ ] **C3**: Semantic RoB colors with icons and labels.
  - Files: `src/components/appraisal/RiskOfBiasMatrix.tsx`, `src/lib/docx/styles.ts`, `src/lib/docx/docx-builder.ts`
- [ ] **C4**: Per-field provenance chips (Quoted, Inferred, Not extracted).
  - Files: `src/components/appraisal/PicoSummaryCard.tsx`, `src/components/appraisal/StatisticalAuditViewer.tsx`
- [ ] **C5**: Accessibility (:focus-visible, dialog focus trap + Escape, tablist/tab, ≥44px touch targets).
  - Files: `src/components/common/LlmSettingsModal.tsx`, `src/components/preview/ManuscriptPreviewModal.tsx`, `src/app/page.tsx`
- [ ] **C6**: DOCX typography (11pt body, 10pt tables, real heading styles, remove executive band in heuristic).
  - Files: `src/lib/docx/docx-builder.ts`, `src/lib/docx/styles.ts`
- [ ] **C7**: Small polish items (et al. fix, markdown in preview, rationale typo, status reload restore, popover z-index, title-case journals, citation volume/pages, Clear my data).
  - Files: `src/lib/parsers/vancouver-formatter.ts`, `src/components/ingestion/ManuscriptPreviewCard.tsx`, `src/components/preview/ExportToolbar.tsx`, `src/store/useAppraisalStore.ts`, `src/app/page.tsx`
