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
import { includedDesigns } from './review-designs';
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
 * Prepares manuscript context prioritizing Abstract + Methods + Results sections,
 * followed by Discussion, while discarding references (P0-2).
 */
function prepareManuscriptContext(manuscript: ParsedManuscriptPayload): string {
  const meta = manuscript.metadata;
  const header = `TITLE: ${meta.title}
AUTHORS: ${meta.authors.join(', ')}
JOURNAL: ${meta.journal} (${meta.publicationYear})
SOURCE DEPTH: ${meta.sourceDepth}
DOI: ${meta.doi || 'N/A'}
PMID: ${meta.pmid || 'N/A'}`;

  let body = '';
  if (manuscript.sections && manuscript.sections.length > 0) {
    const isMethods = (h: string) => /method|material|protocol|study design|participants/i.test(h);
    const isResults = (h: string) => /result|finding|efficacy|outcome|tables/i.test(h);
    const isDiscussion = (h: string) => /discussion|interpretation|comment/i.test(h);
    const isRef = (h: string) => /reference|bibliography|literature cited/i.test(h);

    const methodsSecs = manuscript.sections.filter((s) => isMethods(s.heading));
    const resultsSecs = manuscript.sections.filter((s) => isResults(s.heading));
    const discussionSecs = manuscript.sections.filter((s) => isDiscussion(s.heading));
    const otherSecs = manuscript.sections.filter(
      (s) => !isMethods(s.heading) && !isResults(s.heading) && !isDiscussion(s.heading) && !isRef(s.heading)
    );

    const ordered = [...methodsSecs, ...resultsSecs, ...discussionSecs, ...otherSecs];
    body = ordered.map((s) => `### ${s.heading}\n${s.content}`).join('\n\n');
  } else {
    body = manuscript.fullText;
  }

  const maxBodyLength = 35000;
  const truncatedBody =
    body.length > maxBodyLength
      ? body.slice(0, maxBodyLength) + '\n\n[... Manuscript body truncated for context efficiency ...]'
      : body;

  return `${header}\n\nABSTRACT:\n${manuscript.abstract}\n\nMANUSCRIPT CONTENT:\n${truncatedBody}`;
}

const INTEGRITY_RULE =
  "\n\nCRITICAL INTEGRITY INSTRUCTION: Use ONLY the provided manuscript text. NEVER invent numbers, estimates, or claims. If information is absent, write 'Not reported'. Every supportiveEvidence or evidenceOrPageLocation MUST contain a verbatim quote of <=40 words from the manuscript, or the string 'Not reported'.";

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
Analyze the scientific paper text provided. Accurately detect the primary study design (RCT, SYSTEMATIC_REVIEW_META_ANALYSIS, COHORT_STUDY, CASE_CONTROL_STUDY, CROSS_SECTIONAL, DIAGNOSTIC_ACCURACY, PREDICTION_MODEL, CLINICAL_PRACTICE_GUIDELINE, OTHER).
Deconstruct the PICO/PECO components thoroughly and write a four-part Executive Structured Commentary Abstract (Background, Methodological Summary, Key Findings, Critical Verdict).
If the source depth is ABSTRACT_ONLY_FALLBACK, explicitly note this in the methodological summary.${INTEGRITY_RULE}`;

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
${isAbstractOnly ? 'NOTE: The manuscript text provided is ABSTRACT ONLY due to a publisher paywall. For any domain or item that cannot be reliably assessed from the abstract alone (such as allocation concealment mechanics, exact sequence generation, or protocol deviations), you MUST grade it as UNCLEAR_NOT_REPORTED with an explicit note that full text was behind a paywall.' : 'Quote exact text evidence from the manuscript for each judgment.'}${INTEGRITY_RULE}`;

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
8. Categorize major methodological strengths, fatal flaws, and minor limitations.${INTEGRITY_RULE}`;

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
Formulate practical bottom-line recommendations for practicing clinicians and future research.${INTEGRITY_RULE}`;

  // P0-2: Pass Pass 2 domain judgements and Pass 3 effect estimates into Pass 4 prompt
  const pass4User = `Manuscript Text:\n${manuscriptContext}\n\nPass 1 Design: ${pass1Result.studyDesign}\nPass 2 Risk of Bias Domains:\n${JSON.stringify(
    pass2Result.riskOfBias.domains.map((d) => ({
      domain: d.domainName,
      judgement: d.judgement,
      evidence: d.supportiveEvidence,
    })),
    null,
    2
  )}\nPass 2 Overall RoB: ${pass2Result.riskOfBias.overallRisk}\nPass 3 Effect Estimates:\n${JSON.stringify(
    pass3Result.statisticalAudit.effectEstimates,
    null,
    2
  )}\nPass 3 Spin Audit: ${JSON.stringify(
    pass3Result.statisticalAudit.spinAndDiscrepancyAudit,
    null,
    2
  )}\n\nPerform Pass 4 Validity Synthesis. Return JSON matching schema.`;

  const pass4Result = await executeStructuredLlmCall({
    systemPrompt: pass4System,
    userPrompt: pass4User,
    schema: Pass4Schema,
    config,
  });

  // Programmatically synthesize GRADE certainty using rule engine
  const rawInc = pass1Result.studyDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS'
    ? includedDesigns(`${manuscript.abstract} ${manuscript.fullText.slice(0, 6000)}`)
    : undefined;
  const mappedDesigns = (rawInc === 'MODEL_PERFORMANCE' || rawInc === 'UNKNOWN')
    ? 'OBSERVATIONAL'
    : rawInc;

  const gradeEngineOutput = synthesizeGradeCertainty({
    studyDesign: pass1Result.studyDesign,
    overallRiskOfBias: pass2Result.riskOfBias.overallRisk,
    imprecisionIdentified: pass4Result.imprecisionIdentified,
    inconsistencyOrHeterogeneity: pass4Result.inconsistencyOrHeterogeneity,
    indirectnessIdentified: pass4Result.indirectnessIdentified,
    publicationBiasSuspected: pass4Result.publicationBiasSuspected,
    largeEffectSize: pass4Result.largeEffectSize,
    doseResponseGradient: pass4Result.doseResponseGradient,
    includedStudyDesigns: mappedDesigns,
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
      doiOrUrl: governingRules.equatorGuidelineCitation.match(/doi:\s*([^\s,;]+)/i)?.[1]
        ? `https://doi.org/${governingRules.equatorGuidelineCitation.match(/doi:\s*([^\s,;]+)/i)![1]}`
        : undefined,
    },
    {
      number: 3,
      vancouverCitation: governingRules.riskOfBiasToolCitation,
      doiOrUrl: governingRules.riskOfBiasToolCitation.match(/doi:\s*([^\s,;]+)/i)?.[1]
        ? `https://doi.org/${governingRules.riskOfBiasToolCitation.match(/doi:\s*([^\s,;]+)/i)![1]}`
        : governingRules.riskOfBiasToolCitation.match(/URL:\s*([^\s,;]+)/i)?.[1] || undefined,
    },
    {
      number: 4,
      vancouverCitation:
        'Guyatt GH, Oxman AD, Vist GE, et al. GRADE: an emerging consensus on rating quality of evidence and strength of recommendations. BMJ. 2008;336(7650):924-926.',
      doiOrUrl: 'https://doi.org/10.1136/bmj.39489.470347.AD',
    },
    {
      number: 5,
      vancouverCitation:
        'Oxford Centre for Evidence-Based Medicine: Levels of Evidence (March 2009). Oxford: OCEBM; 2009.',
      doiOrUrl:
        'https://www.cebm.ox.ac.uk/resources/levels-of-evidence/oxford-centre-for-evidence-based-medicine-levels-of-evidence-march-2009',
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
      gradeUpgradingFactors: gradeEngineOutput.upgradingFactors,
      gradeRationale: gradeEngineOutput.rationale,
    },
    clinicalPracticeBottomLine: pass4Result.clinicalPracticeBottomLine,
    references,
    manuscriptAbstract: manuscript.abstract,
    manuscriptFullText: manuscript.fullText,
    engineUsed: 'llm',
    completedAt: new Date().toISOString(),
  };

  return fullReport;
}
