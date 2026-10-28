import { z } from 'zod';
import { executeStructuredLlmCall, LlmConfig } from '../llm/llm-client';
import {
  MasterAppraisalReport,
  StudyDesignEnum,
  OxfordEvidenceLevelEnum,
  PicoSchema,
  RiskOfBiasMatrixSchema,
  StatisticalAuditSchema,
  EquatorComplianceMatrixSchema,
  GradeCertaintyEnum,
} from '../schemas/appraisal.schema';
import { ParsedManuscriptPayload } from '../schemas/ingestion.schema';
import { getGoverningFrameworkRules } from './framework-router';
import { synthesizeGradeCertainty } from './grade-engine';
import crypto from 'crypto';

export type PipelineStageCallback = (stage: number, stageName: string, detail: string) => void;

// --- Stage 1 Schema ---
const Pass1Schema = z.object({
  studyDesign: StudyDesignEnum,
  oxfordEvidenceLevel: OxfordEvidenceLevelEnum,
  studyDesignRationale: z.string(),
  pico: PicoSchema,
  executiveAbstract: z.object({
    background: z.string(),
    methodologicalSummary: z.string(),
    keyFindings: z.string(),
    criticalVerdict: z.string(),
  }),
});

// --- Stage 2 Schema ---
const Pass2Schema = z.object({
  riskOfBias: RiskOfBiasMatrixSchema,
  equatorChecklist: EquatorComplianceMatrixSchema,
});

// --- Stage 3 Schema ---
const Pass3Schema = z.object({
  statisticalAudit: StatisticalAuditSchema,
});

// --- Stage 4 Schema ---
const Pass4Schema = z.object({
  internalValidity: z.string(),
  externalValidityAndGeneralizability: z.string(),
  conflictsOfInterestAndFundingCritique: z.string(),
  imprecisionIdentified: z.boolean(),
  inconsistencyOrHeterogeneity: z.boolean(),
  indirectnessIdentified: z.boolean(),
  publicationBiasSuspected: z.boolean(),
  largeEffectSize: z.boolean(),
  doseResponseGradient: z.boolean(),
  clinicalPracticeBottomLine: z.object({
    applicabilityToPractice: z.string(),
    keyTakeawayForClinicians: z.string(),
    recommendationsForFutureResearch: z.string(),
  }),
});

/**
 * Truncates full manuscript text to safe context limits if unusually long.
 */
function prepareManuscriptContext(manuscript: ParsedManuscriptPayload): string {
  const meta = manuscript.metadata;
  const header = `TITLE: ${meta.title}
AUTHORS: ${meta.authors.join(', ')}
JOURNAL: ${meta.journal} (${meta.publicationYear})
SOURCE DEPTH: ${meta.sourceDepth}
DOI: ${meta.doi || 'N/A'}
PMID: ${meta.pmid || 'N/A'}`;

  const body = manuscript.fullText.length > 35000
    ? manuscript.fullText.slice(0, 35000) + '\n\n[... Manuscript body truncated for context efficiency ...]'
    : manuscript.fullText;

  return `${header}\n\nABSTRACT:\n${manuscript.abstract}\n\nMANUSCRIPT CONTENT:\n${body}`;
}

/**
 * Orchestrates the 4-Pass Critical Appraisal Pipeline.
 */
export async function execute4PassAppraisalPipeline(
  manuscript: ParsedManuscriptPayload,
  config?: LlmConfig,
  onProgress?: PipelineStageCallback
): Promise<MasterAppraisalReport> {
  const manuscriptContext = prepareManuscriptContext(manuscript);
  const isAbstractOnly = manuscript.metadata.sourceDepth === 'ABSTRACT_ONLY_FALLBACK';

  // ----------------------------------------------------
  // PASS 1: Study Classification, PICO/PECO & Abstract
  // ----------------------------------------------------
  onProgress?.(1, 'Pass 1: Study Classification & PICO', 'Deconstructing study design, Oxford CEBM level, and PICO/PECO framework...');

  const pass1System = `You are a Principal Epidemiologist and Methodologist.
Analyze the scientific paper text provided. Accurately detect the primary study design (RCT, SYSTEMATIC_REVIEW_META_ANALYSIS, COHORT_STUDY, CASE_CONTROL_STUDY, CROSS_SECTIONAL, DIAGNOSTIC_ACCURACY, CLINICAL_PRACTICE_GUIDELINE, OTHER).
Deconstruct the PICO/PECO components thoroughly and write a four-part Executive Structured Commentary Abstract (Background, Methodological Summary, Key Findings, Critical Verdict).
If the source depth is ABSTRACT_ONLY_FALLBACK, explicitly note this in the methodological summary.`;

  const pass1User = `Manuscript:\n${manuscriptContext}\n\nPerform Pass 1 appraisal. Return JSON strictly matching the schema.`;

  const pass1Result = await executeStructuredLlmCall({
    systemPrompt: pass1System,
    userPrompt: pass1User,
    schema: Pass1Schema,
    config,
  });

  const governingRules = getGoverningFrameworkRules(pass1Result.studyDesign);

  // ----------------------------------------------------
  // PASS 2: EQUATOR Checklist & Risk of Bias Matrix
  // ----------------------------------------------------
  onProgress?.(2, 'Pass 2: EQUATOR & Risk of Bias', `Enforcing ${governingRules.equatorGuidelineName} and ${governingRules.riskOfBiasToolName}...`);

  const pass2System = `You are an expert Reviewer conducting a rigorous Risk of Bias assessment using ${governingRules.riskOfBiasToolName} and compliance check with ${governingRules.equatorGuidelineName}.
Mandatory Risk of Bias Domains to assess:
${governingRules.robMandatoryDomains.map((d) => `- ${d.domainName}: ${d.description}`).join('\n')}

Mandatory EQUATOR items to audit:
${governingRules.equatorMandatoryItems.map((i) => `- ${i.itemNumberAndSection}: ${i.requirement}`).join('\n')}

CRITICAL GUARDRAIL:
${isAbstractOnly ? 'NOTE: The manuscript text provided is ABSTRACT ONLY due to a publisher paywall. For any domain or item that cannot be reliably assessed from the abstract alone (such as allocation concealment mechanics, exact sequence generation, or protocol deviations), you MUST grade it as UNCLEAR_NOT_REPORTED with an explicit note that full text was behind a paywall.' : 'Quote exact text evidence from the manuscript for each judgment.'}`;

  const pass2User = `Manuscript Text:\n${manuscriptContext}\n\nPerform Pass 2 Risk of Bias (${governingRules.riskOfBiasToolName}) and EQUATOR (${governingRules.equatorGuidelineName}) compliance audit. Return JSON strictly matching the schema.`;

  const pass2Result = await executeStructuredLlmCall({
    systemPrompt: pass2System,
    userPrompt: pass2User,
    schema: Pass2Schema,
    config,
  });

  // ----------------------------------------------------
  // PASS 3: Statistical & Rigor Audit + Spin Analysis
  // ----------------------------------------------------
  onProgress?.(3, 'Pass 3: Statistical Rigor & Spin Audit', 'Evaluating power calculation, ITT vs PP, subgroup multiplicity, and abstract spin...');

  const pass3System = `You are a Senior Biomedical Biostatistician.
Audit the statistical rigor of the paper:
1. Sample size / power calculations (alpha, power, assumed effect size).
2. Analysis population (Intention-To-Treat vs Per-Protocol vs As-Treated).
3. Missing data handling (complete case, multiple imputation, LOCF).
4. Confounding and covariate adjustment (propensity scores, multivariable regression).
5. Multiplicity and subgroup audit (pre-specified vs post-hoc, interaction tests).
6. Main effect estimates (RR, HR, OR, MD, 95% CI, p-values, clinical vs statistical significance).
7. Spin and Discrepancy detection: Carefully compare the primary outcome results in the body/tables against the claims made in the Abstract/Conclusion. Detect any spin or unjustified overinterpretation.
8. Categorize major methodological strengths, fatal flaws, and minor limitations.`;

  const pass3User = `Manuscript Text:\n${manuscriptContext}\n\nPerform Pass 3 Statistical & Rigor Audit. Return JSON strictly matching the schema.`;

  const pass3Result = await executeStructuredLlmCall({
    systemPrompt: pass3System,
    userPrompt: pass3User,
    schema: Pass3Schema,
    config,
  });

  // ----------------------------------------------------
  // PASS 4: Validity Synthesis, GRADE & References
  // ----------------------------------------------------
  onProgress?.(4, 'Pass 4: GRADE Certainty & Synthesis', 'Synthesizing internal/external validity, GRADE rating, and compiling Vancouver references...');

  const pass4System = `You are the Lead Clinical Methodologist.
Synthesize the internal validity (bias, confounding, chance), external validity (generalizability to real-world patient cohorts), and funding/conflict of interest implications.
Evaluate the 5 GRADE downgrading factors (Risk of Bias, Imprecision, Inconsistency, Indirectness, Publication bias) and potential upgrading factors.
Formulate practical bottom-line recommendations for practicing clinicians and future research.`;

  const pass4User = `Manuscript Text:\n${manuscriptContext}\n\nPass 1 Design: ${pass1Result.studyDesign}\nPass 2 Overall RoB: ${pass2Result.riskOfBias.overallRisk}\nPass 3 Spin Detected: ${pass3Result.statisticalAudit.spinAndDiscrepancyAudit.spinDetected}\n\nPerform Pass 4 Validity Synthesis. Return JSON matching schema.`;

  const pass4Result = await executeStructuredLlmCall({
    systemPrompt: pass4System,
    userPrompt: pass4User,
    schema: Pass4Schema,
    config,
  });

  // Programmatically synthesize GRADE certainty using rule engine
  const gradeEngineOutput = synthesizeGradeCertainty({
    studyDesign: pass1Result.studyDesign,
    overallRiskOfBias: pass2Result.riskOfBias.overallRisk,
    imprecisionIdentified: pass4Result.imprecisionIdentified,
    inconsistencyOrHeterogeneity: pass4Result.inconsistencyOrHeterogeneity,
    indirectnessIdentified: pass4Result.indirectnessIdentified,
    publicationBiasSuspected: pass4Result.publicationBiasSuspected,
    largeEffectSize: pass4Result.largeEffectSize,
    doseResponseGradient: pass4Result.doseResponseGradient,
  });

  // Compile standard Vancouver Reference List
  const references = [
    {
      number: 1,
      vancouverCitation: manuscript.metadata.vancouverCitation,
      doiOrUrl: manuscript.metadata.doi ? `https://doi.org/${manuscript.metadata.doi}` : undefined,
    },
    {
      number: 2,
      vancouverCitation: governingRules.equatorGuidelineCitation,
      doiOrUrl: undefined,
    },
    {
      number: 3,
      vancouverCitation: governingRules.riskOfBiasToolCitation,
      doiOrUrl: undefined,
    },
    {
      number: 4,
      vancouverCitation:
        'Guyatt GH, Oxman AD, Vist GE, et al. GRADE: an emerging consensus on rating quality of evidence and strength of recommendations. BMJ. 2008;336(7650):924-926.',
      doiOrUrl: 'https://doi.org/10.1136/bmj.39489.470347.AD',
    },
  ];

  const fullReport: MasterAppraisalReport = {
    id: crypto.randomUUID(),
    metadata: manuscript.metadata,
    classification: {
      studyDesign: pass1Result.studyDesign,
      oxfordEvidenceLevel: pass1Result.oxfordEvidenceLevel,
      equatorReportingGuideline: governingRules.equatorGuidelineName,
      studyDesignRationale: pass1Result.studyDesignRationale,
    },
    executiveAbstract: pass1Result.executiveAbstract,
    pico: pass1Result.pico,
    equatorChecklist: pass2Result.equatorChecklist,
    riskOfBias: pass2Result.riskOfBias,
    statisticalAudit: pass3Result.statisticalAudit,
    validitySynthesis: {
      internalValidity: pass4Result.internalValidity,
      externalValidityAndGeneralizability: pass4Result.externalValidityAndGeneralizability,
      conflictsOfInterestAndFundingCritique: pass4Result.conflictsOfInterestAndFundingCritique,
      gradeCertainty: gradeEngineOutput.finalCertainty,
      gradeDowngradingFactors: gradeEngineOutput.downgradingFactors,
      gradeRationale: gradeEngineOutput.rationale,
    },
    clinicalPracticeBottomLine: pass4Result.clinicalPracticeBottomLine,
    references,
    completedAt: new Date().toISOString(),
  };

  return fullReport;
}
