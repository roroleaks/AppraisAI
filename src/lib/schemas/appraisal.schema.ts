import { z } from 'zod';
import { IngestionSourceDepthEnum, BibliographicMetadataSchema } from './ingestion.schema';

// --- Study Classification & Oxford Levels ---
export const StudyDesignEnum = z.enum([
  'RCT',
  'SYSTEMATIC_REVIEW_META_ANALYSIS',
  'COHORT_STUDY',
  'CASE_CONTROL_STUDY',
  'CROSS_SECTIONAL',
  'DIAGNOSTIC_ACCURACY',
  'CLINICAL_PRACTICE_GUIDELINE',
  'OTHER'
]);

export type StudyDesign = z.infer<typeof StudyDesignEnum>;

export const OxfordEvidenceLevelEnum = z.enum([
  'Level 1a', 'Level 1b', 'Level 1c',
  'Level 2a', 'Level 2b', 'Level 2c',
  'Level 3a', 'Level 3b',
  'Level 4',
  'Level 5'
]);

export type OxfordEvidenceLevel = z.infer<typeof OxfordEvidenceLevelEnum>;

export const GradeCertaintyEnum = z.enum(['HIGH', 'MODERATE', 'LOW', 'VERY_LOW']);
export type GradeCertainty = z.infer<typeof GradeCertaintyEnum>;

export const BiasJudgementEnum = z.enum(['LOW_RISK', 'SOME_CONCERNS', 'HIGH_RISK', 'UNCLEAR_NOT_REPORTED']);
export type BiasJudgement = z.infer<typeof BiasJudgementEnum>;

// --- Pass 1: PICO / PECO Deconstruction ---
export const PicoSchema = z.object({
  population: z.string().describe('Target demographic, clinical inclusion and exclusion criteria'),
  interventionOrExposure: z.string().describe('Primary intervention, drug, dose, regimen, or exposure'),
  comparator: z.string().describe('Active control, placebo, standard of care, or unexposed group'),
  primaryOutcomes: z.array(z.string()).describe('Primary clinical endpoints with pre-specified timeline'),
  secondaryOutcomes: z.array(z.string()).describe('Secondary endpoints, safety metrics, or biomarkers'),
  timeframe: z.string().describe('Duration of follow-up or observation period'),
  setting: z.string().describe('Multi-center, single-center, inpatient, primary care, geography')
});

export type Pico = z.infer<typeof PicoSchema>;

// --- Pass 2: EQUATOR Checklist Matrix ---
export const EquatorChecklistItemStatusEnum = z.enum([
  'REPORTED',
  'PARTIALLY_REPORTED',
  'NOT_REPORTED',
  'NOT_APPLICABLE'
]);

export const EquatorChecklistItemSchema = z.object({
  itemNumberAndSection: z.string().describe('e.g., "1a: Title", "8b: Allocation Concealment", "14a: Outcomes"'),
  requirement: z.string().describe('Governing checklist reporting requirement description'),
  status: EquatorChecklistItemStatusEnum,
  evidenceOrPageLocation: z.string().describe('Explicit quotation or paragraph/section location from the paper'),
});

export const EquatorComplianceMatrixSchema = z.object({
  guidelineName: z.string().describe('e.g., CONSORT 2010, PRISMA 2020, STROBE, STARD 2015, AGREE II'),
  overallCompliancePercentage: z.number().min(0).max(100),
  criticalItemsAudit: z.array(EquatorChecklistItemSchema),
  overallComplianceSummary: z.string(),
});

export type EquatorComplianceMatrix = z.infer<typeof EquatorComplianceMatrixSchema>;

// --- Pass 2: Risk of Bias Assessment Matrix ---
export const BiasDomainItemSchema = z.object({
  domainName: z.string().describe('e.g., Randomization process, Missing outcome data, Confounding, Selection of participants'),
  judgement: BiasJudgementEnum,
  supportiveEvidence: z.string().describe('Direct quotes or paragraph evidence from the paper justifying judgment'),
  criticalSignificance: z.string().describe('Methodological impact on point estimates or observed effect')
});

export const RiskOfBiasMatrixSchema = z.object({
  governingTool: z.string().describe('e.g., Cochrane RoB 2.0, Newcastle-Ottawa Scale, AMSTAR-2, QUADAS-2'),
  overallRisk: BiasJudgementEnum,
  domains: z.array(BiasDomainItemSchema),
  overallRationale: z.string()
});

export type RiskOfBiasMatrix = z.infer<typeof RiskOfBiasMatrixSchema>;

// --- Pass 3: Statistical & Methodological Rigor Audit ---
export const EffectEstimateItemSchema = z.object({
  outcome: z.string(),
  metric: z.string().describe('e.g., RR, HR, OR, MD, SMD, ARR, NNT'),
  pointEstimate: z.string(),
  confidenceInterval: z.string(),
  pValue: z.string(),
  clinicalVsStatisticalSignificance: z.string()
});

export const StrengthsAndLimitationsSchema = z.object({
  majorStrengths: z.array(z.string()).describe('List of methodological strengths (e.g. rigorous blinding, low attrition)'),
  fatalMethodologicalFlaws: z.array(z.string()).describe('Fatal flaws (e.g. high differential loss, unadjusted critical confounders)'),
  minorLimitations: z.array(z.string()).describe('Minor limitations (e.g. short follow-up, surrogate endpoint)'),
});

export const StatisticalAuditSchema = z.object({
  sampleSizePowerCalculation: z.object({
    reported: z.boolean(),
    assumedEffectSize: z.string().nullable(),
    alphaAndPower: z.string().nullable(),
    adequacyAssessment: z.string()
  }),
  analysisType: z.enum(['INTENTION_TO_TREAT', 'MODIFIED_ITT', 'PER_PROTOCOL', 'AS_TREATED', 'UNSPECIFIED']),
  missingDataHandling: z.string().describe('Complete case analysis, multiple imputation, LOCF, etc.'),
  confoundingAndCovariateAdjustment: z.string().describe('Evaluation of multivariable adjustment, propensity scores, or stratification'),
  multiplicityAndSubgroupAudit: z.string().describe('Evaluation of alpha-spending, hierarchical testing, pre-specified vs post-hoc subgroups, interaction tests'),
  effectEstimates: z.array(EffectEstimateItemSchema),
  heterogeneityAnalysis: z.object({
    i2Statistic: z.string().nullable(),
    pForHeterogeneity: z.string().nullable(),
    modelType: z.enum(['FIXED_EFFECTS', 'RANDOM_EFFECTS', 'NOT_APPLICABLE']),
    interpretation: z.string().nullable()
  }),
  spinAndDiscrepancyAudit: z.object({
    spinDetected: z.boolean(),
    discrepancyDetails: z.string().describe('Contrasts between primary outcome results and abstract/conclusion claims'),
    recommendationForInterpretation: z.string()
  }),
  strengthsAndLimitations: StrengthsAndLimitationsSchema,
});

export type StatisticalAudit = z.infer<typeof StatisticalAuditSchema>;

// --- Structured References ---
export const ReportReferenceSchema = z.object({
  number: z.number().int().positive(),
  vancouverCitation: z.string(),
  doiOrUrl: z.string().optional(),
});

export type ReportReference = z.infer<typeof ReportReferenceSchema>;

// --- Full Master Appraisal Document Schema ---
export const MasterAppraisalReportSchema = z.object({
  id: z.string().uuid().or(z.string()),
  metadata: BibliographicMetadataSchema,
  classification: z.object({
    studyDesign: StudyDesignEnum,
    oxfordEvidenceLevel: OxfordEvidenceLevelEnum,
    equatorReportingGuideline: z.string().describe('e.g., CONSORT 2010, PRISMA 2020, STROBE'),
    studyDesignRationale: z.string()
  }),
  executiveAbstract: z.object({
    background: z.string(),
    methodologicalSummary: z.string(),
    keyFindings: z.string(),
    criticalVerdict: z.string()
  }),
  pico: PicoSchema,
  equatorChecklist: EquatorComplianceMatrixSchema,
  riskOfBias: RiskOfBiasMatrixSchema,
  statisticalAudit: StatisticalAuditSchema,
  validitySynthesis: z.object({
    internalValidity: z.string(),
    externalValidityAndGeneralizability: z.string(),
    conflictsOfInterestAndFundingCritique: z.string(),
    gradeCertainty: GradeCertaintyEnum,
    gradeDowngradingFactors: z.array(z.string()).describe('Risk of bias, Imprecision, Inconsistency, Indirectness, Publication bias'),
    gradeRationale: z.string()
  }),
  clinicalPracticeBottomLine: z.object({
    applicabilityToPractice: z.string(),
    keyTakeawayForClinicians: z.string(),
    recommendationsForFutureResearch: z.string()
  }),
  references: z.array(ReportReferenceSchema),
  completedAt: z.string().datetime(),
});

export type MasterAppraisalReport = z.infer<typeof MasterAppraisalReportSchema>;
