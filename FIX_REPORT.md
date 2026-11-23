# AppraisAI Audit Remediation Report

**Date:** November 23, 2026  
**Remediation Branch:** `fix/audit-2026-11`  
**Target Repository:** `C:\Users\raouf.RAOUFDESKTOP\.gemini\antigravity\scratch\apprais-ai`  
**Benchmark Suite Status:** 9 / 9 Passed (100%)  
**Full Test Suite Status:** 31 Unit/Integration Tests Passed, 12-Point Regression Passed, 0 Failures  
**Build Status:** `next build` compiled cleanly (Zero lint/type errors)

---

## Executive Summary

This report documents the end-to-end technical, scientific, and UX remediation of **AppraisAI** following an exhaustive independent audit. 

All 23 remediation tasks across Phase A (Scientific Integrity), Phase B (Reporting Checklists & Workflow), and Phase C (UI, Typography, Contrast & Polish) have been completely implemented, verified offline with realistic manuscript fixtures, and validated in live browser sessions at desktop (1440px) and mobile (390px) viewports.

Every statistic, metric label, and clinical claim presented by AppraisAI is now strictly grounded in source manuscript text or explicitly designated as `"Not identified"` / `"Not assessed"`. The zero-fabrication policy is enforced deterministically across all appraisal passes and export formats.

---

## 1. Task Completion Status Matrix

| Task ID | Task Description | Target File(s) | Status | Verification Evidence |
| :--- | :--- | :--- | :---: | :--- |
| **A0** | Build offline benchmark regression suite B1–B9 | `tests/benchmark.test.ts` | **Complete** | 9/9 benchmark fixtures pass in `npm run test:benchmark` |
| **A1** | Primary vs secondary outcome distinction & process metric filter | `deterministic-appraisal.ts` | **Complete** | B2 LIGHT selects live birth OR 1.07; suppresses oocyte retrieval (5.67) |
| **A2** | Non-inferiority framework detection & clinical direction labeling | `deterministic-appraisal.ts` | **Complete** | B4 iDAScore extracts RD -1.7 (-7.7 to 4.3); flags non-inferiority not shown |
| **A3** | Retraction hard gate (red banner, suppress GRADE & recommendations) | `deterministic-appraisal.ts`, UI | **Complete** | B6 Mehra Lancet displays red retraction alert, suppresses GRADE & Bottom Line |
| **A4** | Adherence/compliance extraction in PICO & validity synthesis | `deterministic-appraisal.ts` | **Complete** | B1 ASPREE extracts adherence range (62.1%–64.1%) into validity narrative |
| **A5** | Follow-up timeframe extraction with unescaped regexes | `deterministic-appraisal.ts` | **Complete** | B1 ASPREE extracts 4.7y; B7 DAPA-HF extracts 18.2 months |
| **A6** | Commercial funder / COI flag in Validity Synthesis | `deterministic-appraisal.ts` | **Complete** | B4 iDAScore flags Vitrolife commercial funding and author equity |
| **A7** | Oxford CEBM 2011 Level 5 for commentary / narrative reviews | `framework-router.ts` | **Complete** | B8 Taha & Roshdy commentary routes to Level 5 and SANRA tool |
| **A8** | Publisher URL DOI/PMID normalizer | `identifier-normalizer.ts` | **Complete** | B9 Nature URL extracts `10.1038/s41591-024-03166-5` and matches B4 |
| **A9** | XML tag stripper preserving mathematical inequalities (`<0.001`) | `jats-parser.ts`, `europepmc.ts` | **Complete** | B7 DAPA-HF extracts `P < 0.001` without swallowing subsequent conclusion text |
| **B1** | CONSORT 2025 item numbering & distinct evidence span guarantee | `framework-router.ts`, `deterministic-appraisal.ts` | **Complete** | Uses 2025 item codes (Item 1a–30); no single sentence reused across items |
| **B2** | Stopped-early trial flag in Validity Synthesis | `deterministic-appraisal.ts` | **Complete** | B2 LIGHT flags premature study termination / under-recruitment |
| **B3** | Methodology references update (CONSORT 2025, OCEBM 2011, Savović J) | `framework-router.ts` | **Complete** | Removed "Clarke M" from CONSORT 2025, updated to 2011 OCEBM, kept Savović diacritic |
| **B4** | Replace native dialogs (`alert`, `confirm`) with accessible modals | `ConfirmationModal.tsx`, UI | **Complete** | Accessible modal with `role="dialog"`, Esc key handler, inline attribution error |
| **B5** | Ingest UX status line, cancel button & free-text input gating | `IdentifierInput.tsx` | **Complete** | Added step indicator, live elapsed timer, `AbortController` cancel button |
| **B6** | DOCX export watermarking & author surname sanitizer | `docx-builder.ts`, `title-sanitizer.ts` | **Complete** | Siddiqi HK produces `Critical_Appraisal_Siddiqi_2020.docx`; watermarked headers |
| **C1** | Typography scale & visual hierarchy refinement | UI components | **Complete** | Georgia serif for medical headings, Segoe UI body, explicit 11px/12px badges |
| **C2** | Responsive chrome & horizontal table scrolling | `page.tsx`, `ExportToolbar.tsx`, tables | **Complete** | Header unpins on mobile `<640px`; toolbar inline; tables have `overflow-x-auto` |
| **C3** | Accessible RoB badges (shapes + colors + ≥4.5:1 contrast) | `RiskOfBiasMatrix.tsx` | **Complete** | Distinct icons (check, alert, cross, question) + accessible color tokens |
| **C4** | Statistical audit viewer contrast & responsive grid | `StatisticalAuditViewer.tsx` | **Complete** | Muted labels upgraded to `#475569`, horizontal scroll container added |
| **C5** | Modal keyboard accessibility & focus management | Modals | **Complete** | Escape key support added to Confirmation, LLM Settings, and Manuscript Preview |
| **C6** | LocalStorage cache management & reset button | `LlmSettingsModal.tsx` | **Complete** | "Clear cached data" button added to safely purge stored appraisals |
| **C7** | Vancouver citation formatter typo & journal name cleanup | `vancouver-formatter.ts` | **Complete** | Fixed duplicate `et al..` period; added `formatJournalTitle` acronym handler |

---

## 2. Benchmark Evaluation Comparison (Before vs. After)

| Benchmark Fixture | Target Manuscript / Condition | Baseline Audit Finding | Post-Remediation Benchmark Result |
| :--- | :--- | :--- | :--- |
| **B1 (ASPREE)** | McNeil NEJM 2018 (PMID 30221596) | Follow-up timeframe missing; HR 1.38 misclassified as protective benefit | **PASS:** Extracted Major haemorrhage HR 1.38 (1.18–1.62), classified as `harm`, `P < 0.001`, follow-up 4.7 years |
| **B2 (LIGHT)** | Norman RBMO 2019 (PMID 30954433) | Selected surrogate process outcome (oocyte retrieval 5.67) instead of primary | **PASS:** Selected live birth OR 1.07 (0.37–3.10); flagged early termination / under-recruitment; oocyte labeled process |
| **B3 (ASPRE)** | Rolnik NEJM 2017 (PMID 28657417) | RoB Domain 3 falsely marked Low Risk despite 8.8% post-randomization attrition | **PASS:** Primary OR 0.38 (0.20–0.74), `P = 0.004`; RoB Domain 3 flagged away from Low Risk due to >5% attrition (156/1776) |
| **B4 (iDAScore)** | Illingworth Nat Med 2024 (PMID 39122964) | Non-inferiority framework missed; effect direction unclear | **PASS:** Detected non-inferiority design; extracted RD -1.7 (-7.7 to 4.3); concluded non-inferiority not demonstrated (-7.7 < -5%) |
| **B5 (Cochrane GH)** | Sood Cochrane 2021 (PMID 34808697) | Spurious MD 13.57 selected over clinical primary effect | **PASS:** Classified `SYSTEMATIC_REVIEW_META_ANALYSIS`, Oxford Level 1a; AMSTAR 2 & PRISMA; extracted live birth OR 1.77 (1.17–2.70) |
| **B6 (Mehra Lancet)** | Mehra Lancet 2020 (PMID 32450107) | Treated retracted article as valid evidence with active clinical recommendations | **PASS:** Retraction detected; prominent red alert banner displayed; GRADE certainty and clinical bottom line strictly suppressed |
| **B7 (DAPA-HF)** | McMurray NEJM 2019 (PMID 31535829) | Unescaped `<0.001` wiped conclusions in parser; P-value missing | **PASS:** Extracted HR 0.74 (0.65–0.85), `P < 0.001`, median follow-up 18.2 months |
| **B8 (Taha & Roshdy)** | Narrative commentary (Opast sample) | Misclassified as Level 1b RCT; hallucinated effect estimates | **PASS:** Classified as commentary / narrative review (`OTHER`), Oxford Level 5; routed to SANRA; zero spurious effect estimates |
| **B9 (Nat Med URL)** | `https://www.nature.com/articles/s41591-024-03166-5` | Ingestion failed on raw article web URLs | **PASS:** Normalized URL to DOI `10.1038/s41591-024-03166-5`; extracted complete B4 metadata (Nat Med 2024) |

**Overall Benchmark Score:** **9 / 9 Passed (100%)**

---

## 3. UI Verification Evidence & Screenshots

All responsive states and visual integrity criteria were validated in automated browser sessions at `http://localhost:3000`.

### Desktop Completed Report (1440px Viewport)
Full appraisal report rendering DAPA-HF (PMID 31535829), displaying PICO card, Cochrane RoB 2.0 evaluation, CONSORT 2025 compliance table, biostatistical audit card, GRADE certainty badge, and Vancouver references:

![Desktop Appraisal Report (1440px)](file:///C:/Users/raouf.RAOUFDESKTOP/.gemini/antigravity/brain/c1586e73-da44-4833-a5dc-192d626e98c0/audit_screenshots/desktop_dapa_hf_1440.png)

### Retracted Manuscript Hard-Gate Banner (1440px Viewport)
Retraction banner and clinical suppression triggered for Mehra et al. (Lancet 2020, PMID 32450107):

![Retraction Suppression Banner](file:///C:/Users/raouf.RAOUFDESKTOP/.gemini/antigravity/brain/c1586e73-da44-4833-a5dc-192d626e98c0/audit_screenshots/retraction_alert_desktop.png)

### Mobile Responsive Layout (390px iPhone Viewport)
Mobile responsive layout showing unpinned scrolling header, inline export toolbar, and horizontally contained scrollable tables:

![Mobile Inline Toolbar (390px)](file:///C:/Users/raouf.RAOUFDESKTOP/.gemini/antigravity/brain/c1586e73-da44-4833-a5dc-192d626e98c0/audit_screenshots/mobile_390_toolbar.png)

![Mobile Horizontal Table Scroll (390px)](file:///C:/Users/raouf.RAOUFDESKTOP/.gemini/antigravity/brain/c1586e73-da44-4833-a5dc-192d626e98c0/audit_screenshots/mobile_390_table_scroll.png)

---

## 4. Key Architectural & Methodological Enhancements

### 4.1 Zero Fabrication & Mathematical Inequality Parsing
- **Europe PMC XML Tag Stripper:** Europe PMC abstracts frequently return unescaped mathematical inequality signs (e.g. `<0.001`). Previous regular expressions (`<[^>]+>`) treated `<0.001 ... >` as a single XML tag, stripping out all text between the inequality and subsequent HTML tags. Replaced with `/<\/?[a-zA-Z][^>]*>/g` to match only alphabetic HTML/XML tags, preserving mathematical inequalities intact.
- **Abbreviation Protection in Sentence Splitting:** Lookbehind sentence splitters (`(?<=[.?!])\s+`) were splitting sentences on abbreviations such as `vs.` and `et al.`. Protecting abbreviations prior to tokenization ensures outcome labels and subsequent numerical hazard ratios remain in the same sentence span.

### 4.2 Primary Outcome Anchoring & Surrogate Filtering
- Prioritized relative risk metrics (OR, HR, RR) when multiple candidate effect estimates match the primary clinical endpoint.
- Identified process metrics (e.g. number of oocytes retrieved, laboratory surrogate measurements) and labeled them as secondary/process outcomes, preventing them from overriding true clinical primary endpoints (e.g. live birth rate).

### 4.3 Non-Inferiority Framework & Clinical Direction
- Automated scanning for non-inferiority hypothesis testing, extraction of pre-specified non-inferiority margins ($\Delta$), and evaluation of whether lower/upper confidence bounds breach the margin.
- Automatic labeling of effect direction (`benefit`, `harm`, `neutral`, `non-inferiority demonstrated`, `non-inferiority not demonstrated`).

### 4.4 CONSORT 2025 Standard Compliance & Evidence Uniqueness
- Upgraded the RCT reporting audit to the official CONSORT 2025 statement itemization (Item 1a title, 1b abstract, 2 registration, 3 protocol/SAP, 5a-b funding/COI, 6 background, 7 objectives, 16a sample size, 17a sequence generation, 18 allocation concealment, 20a blinding, 22a participant flow, 24 outcomes/estimation, 30 limitations).
- Introduced `usedEvidenceSpans` tracking to enforce that no single sentence or quote can satisfy multiple EQUATOR checklist items.

### 4.5 Retraction Safeguard Engine
- Integrated automated Crossref and Europe PMC retraction and expression of concern detection.
- When an article is flagged as retracted:
  1. A prominent red alert banner is rendered at the top of the report and in the clinical translation card.
  2. GRADE certainty synthesis is overridden to `NOT_GRADED_HEURISTIC`.
  3. Clinical Practice Bottom Line recommendations are completely suppressed.
  4. Word (.docx) export stamps a bold red retraction warning on every page header.

### 4.6 Native Dialog Elimination & Accessibility Polish
- Replaced all legacy `window.alert()` and `window.confirm()` calls with a modern `ConfirmationModal` component complying with WAI-ARIA modal guidelines (`role="dialog"`, `aria-modal="true"`, focus trap, and Escape key listeners).
- Enhanced DOCX export toolbar with an inline popover validating appraiser attribution and autofocusing the input field on validation errors.
- Added working client-side `AbortController` cancellation to manuscript ingestion with a live progress indicator.

---

## 5. Verification Checklist

- [x] All 9 benchmark tests in `tests/benchmark.test.ts` pass offline (100%).
- [x] Full integration suite (31 tests in `tests/suite.test.ts`) passes cleanly.
- [x] Vancouver citation formatter, JATS parser, and regression tests pass without errors.
- [x] `next build` produces an optimized production bundle with zero TypeScript or ESLint errors.
- [x] No hardcoded template leakage in PICO, Risk of Bias, or Validity cards.
- [x] DOCX export filenames cleanly formatted (`Critical_Appraisal_Siddiqi_2020.docx`).
- [x] DOCX headers include heuristic draft watermark stamp.
- [x] UI responsive on 1440px desktop and 390px mobile viewports.
- [x] WCAG AA contrast ratio achieved for all status badges and muted text.
- [x] Git branch `fix/audit-2026-11` committed cleanly with descriptive commit history.
