<p align="center">
  <img src="public/appraisai-icon.png" width="130" alt="AppraisAI App Icon" style="border-radius: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.2);" />
</p>

# AppraisAI

> **Automated Scientific Medical Paper Critical Appraisal & Publication-Ready Report Generation Platform**  
> Formatted according to **EQUATOR Network** reporting guidelines (**CONSORT 2025**, **PRISMA 2020**, **STROBE**, **STARD 2015**, **RIGHT**), **Cochrane Risk of Bias 2.0 (RoB 2)**, **AMSTAR 2**, **ROBINS-I**, **QUADAS-2**, **JBI**, **Oxford CEBM Levels of Evidence (2009)**, and the **GRADE Working Group** certainty framework.

---

## 🌟 Clinical Architecture & Workflow

```mermaid
flowchart TD
    subgraph Ingestion["Dual-Mode Ingestion Engine"]
        A1[Biomedical PDF Upload] -->|Magic byte %PDF- & size check <=25MB| P[Normalized Manuscript Payload]
        A2[DOI / PMID / PMCID / URL] -->|SSRF-Hardened HTTPS Fetch / Europe PMC & Crossref| P
        P --> D{Source Depth}
        D -->|Open Access / PDF| D1[Full Text & JATS XML Tables]
        D -->|Paywalled DOI| D2[Abstract-Only Paywall Fallback]
    end

    subgraph DualEngines["Dual-Mode Appraisal Engines"]
        P --> E{Mode Selection}
        E -->|Deterministic (No API Key)| HE[Evidence-Gated Heuristic Screening Engine]
        E -->|Neural LLM (API Key)| NE[4-Pass Governing LLM Pipeline]
        HE -->|Preliminary Draft / Grounded Quotes| Draft[Heuristic Screening Report]
        NE -->|Deep Synthesis / Zod Schema Validation| Full[Full Critical Appraisal Report]
    end

    subgraph Export["Publication-Grade DOCX & UI Workspace"]
        Draft --> UI[Interactive Appraisal Dashboard]
        Full --> UI
        UI --> Modal[Manuscript Print-Preview Modal]
        UI --> Docx[Publication-Grade .docx Compiler (A4 / US Letter)]
        Docx --> File[Downloadable Academic Word Monograph]
    end
```

---

## 🛡️ Scientific Integrity & Zero-Fabrication Guarantee

AppraisAI adheres strictly to academic integrity standards:
- **Zero Fabrication:** The tool never invents study populations, sample sizes, numerical effect estimates, or bias judgements. When data are absent from the manuscript text, domains are explicitly classified as `"Not reported / Not assessable from available text"`.
- **Evidence-Gated Grounding:** Risk of bias judgements in heuristic mode require direct verbatim text quotes from the manuscript. No domain is graded low risk without grounded primary evidence.
- **Transparent Mode Watermarking:** When running without neural LLMs, reports carry prominent visual banners marking them as `"Heuristic Screening Draft — Not a Critical Appraisal"`.
- **SSRF Hardened:** Direct URL ingestion enforces strict `https:` scheme validation, DNS resolution against private/reserved/cloud-metadata ranges (`127.0.0.0/8`, `10.0.0.0/8`, `169.254.0.0/16`, `192.168.0.0/16`, `::1`, `fc00::/7`), 3-redirect caps, 15-second timeouts, and a 25MB response cap.

---

## 🚀 Key Features

1. **Dual-Mode Paper Ingestion Engine:**
   - **Direct PDF Upload:** Validates `%PDF-` magic bytes, enforces a 25MB file limit, and extracts multi-column layouts via `unpdf`.
   - **Identifier Resolution:** Resolves DOIs (`10.xxxx/...`), PMIDs, PMCIDs, and direct article URLs via **Europe PMC REST & JATS XML API** and **Crossref API**.
   - **Source Depth Tracking:** Transparently watermarks documents as `FULL_TEXT_PDF`, `FULL_TEXT_JATS_XML`, or `ABSTRACT_ONLY_FALLBACK` to guard against paywall hallucinations.

2. **Methodological Alignment Across Study Designs:**
   - **Randomized Controlled Trials:** Evaluated under **CONSORT 2025** (*Hopewell S, et al. BMJ 2025;389:e081123*) and **Cochrane RoB 2.0** (5 core domains, Oxford Level 1b).
   - **Systematic Reviews & Meta-Analyses:** Governed by **PRISMA 2020** and **AMSTAR 2** (7 critical domains, Oxford Level 1a).
   - **Observational Cohort Studies:** Structured under **STROBE** and **ROBINS-I / Newcastle-Ottawa Scale** (Oxford Level 2b).
   - **Case-Control Studies:** Evaluated with **STROBE** and **Newcastle-Ottawa Scale** (Oxford Level 3b).
   - **Cross-Sectional Studies:** Evaluated using **STROBE** and the **JBI Analytical Cross-Sectional Checklist** (Oxford Level 4).
   - **Diagnostic Accuracy:** Governed by **STARD 2015** and **QUADAS-2** with dual Risk of Bias and Applicability rows (Oxford Level 1b).
   - **Practice Guidelines:** Structured under the **RIGHT Statement** and **AGREE II** (Oxford Level 1a).
   - **Narrative Reviews & Commentaries:** Categorized as **Level 5** with explicit disclaimers that formal RoB tools do not apply.

3. **Publication-Grade Academic Word (`.docx`) Compiler:**
   - Formatted in accordance with international medical monograph standards:
     - Default **A4** geometry (with configurable **US Letter** support).
     - Strict Word navigation outline (`Heading 1` and `Heading 2`).
     - Running 2-line headers with truncated title, DOI/PMID, and bottom border rules.
     - Footers with dynamic page numbering (`Page X of Y`) and appraiser attribution.
     - Color-coded RevMan-style traffic-light summary strip.
     - Anti-orphan page split controls (`cantSplit` and `tableHeader` on all tables).
     - ICMJE / Vancouver references with verified DOIs and URLs.

4. **Multi-Provider & Zero-Friction Operation:**
   - **Zero-Friction Deterministic Engine:** Operates fully offline without requiring any third-party API key.
   - **Neural LLM Mode:** Supports **Google Gemini** (`gemini-2.5-flash`), **Groq** (`llama-3.3-70b-versatile`), and **OpenAI** (`gpt-4o-mini`).
   - **Privacy Controls:** API keys default to in-memory/session storage, with an optional persistent device checkbox. Keys are never transmitted to server logs or third-party telemetry.

---

## 🛠️ Technology Stack

- **Framework:** Next.js 15 (App Router, Node.js runtime, TypeScript)
- **Styling:** Tailwind CSS with evidence-based medicine teal palette
- **Document Parsers:** `unpdf`, Europe PMC REST API, Crossref API, `fast-xml-parser`
- **Document Generation:** `docx` (npm) with programmatic table XML shading, cell margins, and border styles
- **State Management:** Zustand with client-side localStorage and sessionStorage segregation
- **Validation:** Zod schemas with JSON Schema inclusion and repair retry loop

---

## 💻 Local Development & Testing

```bash
# Clone the repository
git clone https://github.com/roroleaks/AppraisAI.git
cd AppraisAI

# Install dependencies
npm install

# Run the full offline test suite (6 suites, 107+ assertions)
npm test

# Run build verification
npm run build

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👨‍⚕️ Author & Clinical Methodology

**Dr. Raouf Roshdy, MD**  
*Department of Clinical Epidemiology & Evidence-Based Medicine*  
ORCID: [0009-0001-4841-1656](https://orcid.org/0009-0001-4841-1656)  
Governance: Structured under EQUATOR Network, OCEBM 2009, and GRADE Working Group criteria.
