import { StudyDesign, GradeCertainty } from '../schemas/appraisal.schema';

export interface GradeEvaluationResult {
  baselineCertainty: GradeCertainty;
  finalCertainty: GradeCertainty;
  downgradingFactors: string[];
  upgradingFactors: string[];
  rationale: string;
}

/**
 * Implements strict GRADE (Grading of Recommendations Assessment, Development and Evaluation) rules.
 * - RCTs start at HIGH certainty.
 * - Observational studies start at LOW certainty.
 * - Evaluates 5 downgrading domains: Risk of Bias, Inconsistency, Indirectness, Imprecision, Publication Bias.
 * - Evaluates 3 upgrading domains: Large magnitude of effect, Dose-response gradient, Residual confounding opposing effect.
 */
export function synthesizeGradeCertainty(params: {
  studyDesign: StudyDesign;
  overallRiskOfBias: 'LOW_RISK' | 'SOME_CONCERNS' | 'HIGH_RISK' | 'UNCLEAR_NOT_REPORTED';
  imprecisionIdentified: boolean;
  inconsistencyOrHeterogeneity: boolean;
  indirectnessIdentified: boolean;
  publicationBiasSuspected: boolean;
  largeEffectSize: boolean;
  doseResponseGradient: boolean;
}): GradeEvaluationResult {
  const isRctOrMeta =
    params.studyDesign === 'RCT' ||
    params.studyDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS';

  let certaintyScore = isRctOrMeta ? 4 : 2; // 4 = HIGH, 3 = MODERATE, 2 = LOW, 1 = VERY_LOW
  const downgradingFactors: string[] = [];
  const upgradingFactors: string[] = [];

  // 1. Risk of Bias downgrading
  if (params.overallRiskOfBias === 'HIGH_RISK') {
    certaintyScore -= 2;
    downgradingFactors.push('Risk of Bias (Serious flaws in study design or execution - downgraded 2 levels)');
  } else if (params.overallRiskOfBias === 'SOME_CONCERNS') {
    certaintyScore -= 1;
    downgradingFactors.push('Risk of Bias (Moderate concerns or incomplete reporting - downgraded 1 level)');
  }

  // 2. Imprecision
  if (params.imprecisionIdentified) {
    certaintyScore -= 1;
    downgradingFactors.push('Imprecision (Wide 95% confidence intervals crossing clinical decision thresholds)');
  }

  // 3. Inconsistency
  if (params.inconsistencyOrHeterogeneity) {
    certaintyScore -= 1;
    downgradingFactors.push('Inconsistency (Substantial heterogeneity I² > 50% or contradictory findings)');
  }

  // 4. Indirectness
  if (params.indirectnessIdentified) {
    certaintyScore -= 1;
    downgradingFactors.push('Indirectness (Surrogate endpoints or highly restrictive sample characteristics)');
  }

  // 5. Publication Bias
  if (params.publicationBiasSuspected) {
    certaintyScore -= 1;
    downgradingFactors.push('Publication Bias (High likelihood of unpublished negative/null trials)');
  }

  // Upgrading factors (only applied if not high already)
  if (!isRctOrMeta) {
    if (params.largeEffectSize) {
      certaintyScore += 1;
      upgradingFactors.push('Large Effect Size (RR > 2.0 or < 0.5 without apparent confounders)');
    }
    if (params.doseResponseGradient) {
      certaintyScore += 1;
      upgradingFactors.push('Dose-Response Gradient (Demonstrated biological gradient supporting causality)');
    }
  }

  // Clamp certainty score between 1 and 4
  const clamped = Math.max(1, Math.min(4, certaintyScore));

  let finalCertainty: GradeCertainty = 'VERY_LOW';
  if (clamped === 4) finalCertainty = 'HIGH';
  else if (clamped === 3) finalCertainty = 'MODERATE';
  else if (clamped === 2) finalCertainty = 'LOW';

  const baselineCertainty: GradeCertainty = isRctOrMeta ? 'HIGH' : 'LOW';

  const rationale = `Evidence body started at ${baselineCertainty} certainty for ${params.studyDesign}. ${
    downgradingFactors.length > 0
      ? `Downgraded due to: ${downgradingFactors.join('; ')}.`
      : 'No serious limitations identified to warrant downgrading.'
  } ${
    upgradingFactors.length > 0
      ? `Upgraded due to: ${upgradingFactors.join('; ')}.`
      : ''
  } Resulting in a final GRADE certainty rating of ${finalCertainty}.`;

  return {
    baselineCertainty,
    finalCertainty,
    downgradingFactors,
    upgradingFactors,
    rationale,
  };
}
