import {
  MasterAppraisalReport,
  BiasJudgement,
  StudyDesign,
  EffectEstimateItem,
} from '../schemas/appraisal.schema';
import { ParsedManuscriptPayload } from '../schemas/ingestion.schema';
import { getGoverningFrameworkRules } from './framework-router';
import { cleanBiomedicalTitle, cleanBiomedicalAuthors } from '../parsers/title-sanitizer';
import { extractEffectEstimates, crossesNull } from './effect-parser';
import {
  selectPrimaryEstimate,
  primaryOutcomeDefinition as readPrimaryDefinition,
  outcomeNature,
  effectDirection,
  nonInferiorityVerdict,
} from './outcome-logic';
import { extractArms, armsFromTitle, extractFollowUp } from './pico-arms';
import { includedDesigns, reviewOxfordLevel, isPredictionModelStudy, aiValidationSignals } from './review-designs';
import { findCue, CHECKLIST_CUES, AMSTAR_CUES } from './evidence-cues';
import { detectIndustryInvolvement } from './trial-integrity';
import crypto from 'crypto';

/**
 * Finds the first sentence in text containing a regex pattern.
 */
function findSentenceWithKeywords(text: string, pattern: RegExp): string | null {
  if (!text) return null;
  const sentences = text.split(/(?<=[.?!])\s+/);
  for (const s of sentences) {
    if (pattern.test(s) && s.trim().length > 15 && s.trim().length < 350) {
      return s.trim();
    }
  }
  return null;
}

/**
 * Metadata-first study design classification (Task A3).
 * Signals ordered strictly:
 * 1. PubMed/EPMC publication types and MeSH
 * 2. Explicit title / abstract phrasing
 * 3. Scored heuristics fallback
 */
export function classifyStudyDesign(
  meta: { title: string; publicationTypes?: string[]; meshHeadings?: string[] },
  rawAbstract: string,
  methodsText: string = ''
): { design: StudyDesign; rationale: string } {
  const pubTypes = meta.publicationTypes || [];
  const lowerTitle = meta.title.toLowerCase();

  // 1. PubMed / EPMC Publication Type Signals
  if (pubTypes.some((p) => /systematic[ -]review|meta-analysis/i.test(p))) {
    return {
      design: 'SYSTEMATIC_REVIEW_META_ANALYSIS',
      rationale: 'Indexed as Systematic Review / Meta-Analysis in PubMed/Europe PMC publication type registry.',
    };
  }
  if (pubTypes.some((p) => /randomized controlled trial|controlled clinical trial/i.test(p))) {
    return {
      design: 'RCT',
      rationale: 'Indexed as Randomized Controlled Trial in publication type registry.',
    };
  }
  if (pubTypes.some((p) => /editorial|comment|letter/i.test(p)) && !pubTypes.some((p) => /clinical trial/i.test(p))) {
    return {
      design: 'OTHER',
      rationale: 'Indexed as Editorial / Commentary in publication type registry.',
    };
  }

  // 1b. Structured systematic-review abstract (Cochrane / PRISMA headings), even without publication types
  const srSignals = [/\bsearch methods\b/i, /\bselection criteria\b/i, /\bdata collection and analysis\b/i, /\bwe searched\b/i, /\bincluded (?:\d+|[a-z-]+) (?:randomi[sz]ed )?(?:trials|studies|RCTs)\b/i, /\bcochrane\b/i]
    .filter((re) => re.test(rawAbstract)).length;
  if (srSignals >= 2) {
    return { design: 'SYSTEMATIC_REVIEW_META_ANALYSIS', rationale: 'Systematic-review structure detected in abstract (search methods / selection criteria / data collection).' };
  }

  // 2. Explicit Title Phrases
  if (
    /\b(?:commentary review|clinical commentary|narrative review|expert review|state-of-the-art review|critical commentary|editorial perspective|perspective review)\b/i.test(
      lowerTitle
    ) ||
    (/\b(?:commentary|review|editorial|perspective)\b/i.test(lowerTitle) &&
      !/systematic review|meta-analysis|meta-analytic/i.test(lowerTitle))
  ) {
    return {
      design: 'OTHER',
      rationale: 'Narrative review / clinical commentary — not appraisable with formal clinical trial or systematic review risk of bias tools.',
    };
  }

  if (/systematic review|meta-analysis|meta-analytic|cochrane review/i.test(lowerTitle)) {
    return {
      design: 'SYSTEMATIC_REVIEW_META_ANALYSIS',
      rationale: 'Explicitly identified as Systematic Review / Meta-Analysis in study title.',
    };
  }

  if (
    /randomi[sz]ed(?:,?\s+[a-z-]+){0,3}\s+(?:controlled\s+)?trial|double-blind.*placebo-controlled|placebo-controlled.*randomi[sz]ed|\brct\b/i.test(
      lowerTitle
    )
  ) {
    return {
      design: 'RCT',
      rationale: 'Parallel-group randomized controlled clinical trial evaluating intervention efficacy against defined comparators.',
    };
  }

  if (/cohort study|prospective cohort|retrospective cohort|longitudinal cohort|multinational registry analysis|registry analysis/i.test(lowerTitle)) {
    return {
      design: 'COHORT_STUDY',
      rationale: 'Longitudinal prospective or retrospective observation / registry analysis of defined clinical cohorts.',
    };
  }

  // Abstract signals for Cochrane reviews or RCTs
  if (
    /cochrane|primary review outcome/i.test(rawAbstract) &&
    /systematic review|included (?:[0-9]+|\w+)\s+(?:rcts|trials|studies)/i.test(rawAbstract)
  ) {
    return {
      design: 'SYSTEMATIC_REVIEW_META_ANALYSIS',
      rationale: 'Cochrane Systematic Review methodology identified in abstract.',
    };
  }

  // 2b. AI / prediction-model development or validation study (not a trial of AI-guided care)
  if (isPredictionModelStudy(meta.title, rawAbstract)) {
    return { design: 'PREDICTION_MODEL', rationale: 'Develops or evaluates an AI / prediction model (performance metrics such as AUC, accuracy, calibration). Appraised with PROBAST+AI and TRIPOD+AI, not trial tools.' };
  }

  // 3. Scored Heuristics Fallback
  const scores: Record<StudyDesign, number> = {
    RCT: 0,
    SYSTEMATIC_REVIEW_META_ANALYSIS: 0,
    COHORT_STUDY: 0,
    CASE_CONTROL_STUDY: 0,
    CROSS_SECTIONAL: 0,
    DIAGNOSTIC_ACCURACY: 0,
    CLINICAL_PRACTICE_GUIDELINE: 0,
    PREDICTION_MODEL: 0,
    OTHER: 0,
  };

  if (/systematic review|meta-analysis|meta-analytic|cochrane review/i.test(meta.title)) scores.SYSTEMATIC_REVIEW_META_ANALYSIS += 15;
  if (/systematic review|meta-analysis|meta-analytic|cochrane review|prisma 2020|amstar/i.test(rawAbstract)) scores.SYSTEMATIC_REVIEW_META_ANALYSIS += 10;
  if (/prisma|search strategy|databases? (?:searched|queried)|pubmed.*embase|screened for eligibility|inclusion criteria/i.test(methodsText)) scores.SYSTEMATIC_REVIEW_META_ANALYSIS += 8;

  if (/randomi[sz]ed (?:controlled )?trial|randomi[sz]ed clinical trial|double-blind|placebo-controlled|\brct\b/i.test(meta.title)) scores.RCT += 15;
  if (/randomi[sz]ed(?:,?\s+[a-z-]+){0,3}\s+trial|randomly (?:assigned|allocated)|we (?:randomi[sz]ed|assigned)|double-blind|placebo-controlled|\brct\b|parallel-group/i.test(rawAbstract)) scores.RCT += 10;
  if (/randomly assigned|random allocation|randomization sequence|randomisation sequence|computer-generated random|allocation concealment|intention-to-treat/i.test(methodsText)) scores.RCT += 8;

  if (/cohort study|prospective cohort|retrospective cohort|longitudinal study/i.test(meta.title)) scores.COHORT_STUDY += 15;
  if (/cohort study|prospective cohort|retrospective cohort|longitudinal follow-up|prospective observational/i.test(rawAbstract)) scores.COHORT_STUDY += 10;
  if (/cohort was followed|loss to follow-up|incidence rate|hazard ratio|survival analysis|multivariable cox/i.test(methodsText)) scores.COHORT_STUDY += 8;

  if (/case-control|matched controls|nested case-control/i.test(meta.title)) scores.CASE_CONTROL_STUDY += 15;
  if (/case-control study|cases and controls|matched controls|nested case-control/i.test(rawAbstract)) scores.CASE_CONTROL_STUDY += 10;
  if (/cases were identified|controls were selected|matched for age and|cases and \d+ controls/i.test(methodsText)) scores.CASE_CONTROL_STUDY += 8;

  if (/cross-sectional|prevalence study|survey study|cross sectional/i.test(meta.title)) scores.CROSS_SECTIONAL += 15;
  if (/cross-sectional study|cross-sectional survey|prevalence of|survey questionnaire/i.test(rawAbstract)) scores.CROSS_SECTIONAL += 10;

  if (/diagnostic accuracy|sensitivity and specificity|receiver operating|stard|quadas/i.test(meta.title)) scores.DIAGNOSTIC_ACCURACY += 15;
  if (/diagnostic accuracy|sensitivity and specificity|receiver operating characteristic|roc curve|area under the curve|\bauc\b/i.test(rawAbstract)) scores.DIAGNOSTIC_ACCURACY += 10;

  if (/practice guideline|consensus statement|clinical guideline|recommendations of the/i.test(meta.title)) scores.CLINICAL_PRACTICE_GUIDELINE += 15;
  if (/practice guideline|consensus statement|clinical guideline|formal consensus/i.test(rawAbstract)) scores.CLINICAL_PRACTICE_GUIDELINE += 10;

  const candidateEntries = (Object.entries(scores) as [StudyDesign, number][]).filter(([d]) => d !== 'OTHER');
  candidateEntries.sort((a, b) => b[1] - a[1]);
  const [topDesign, topScore] = candidateEntries[0];

  if (topScore >= 8) {
    let rationale = '';
    if (topDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS') {
      rationale = 'Systematic review and/or meta-analytical investigation pooling evidence across published biomedical databases.';
    } else if (topDesign === 'RCT') {
      rationale = 'Parallel-group randomized controlled clinical trial evaluating intervention efficacy against defined comparators.';
    } else if (topDesign === 'COHORT_STUDY') {
      rationale = 'Longitudinal prospective or retrospective observation of defined clinical cohorts evaluating incidence and prognostic outcomes.';
    } else if (topDesign === 'CASE_CONTROL_STUDY') {
      rationale = 'Observational case-control investigation matching subjects with outcomes of interest against comparable controls.';
    } else if (topDesign === 'CROSS_SECTIONAL') {
      rationale = 'Cross-sectional observational study evaluating prevalence and clinical associations at a single cross-sectional timepoint.';
    } else if (topDesign === 'DIAGNOSTIC_ACCURACY') {
      rationale = 'Diagnostic test accuracy investigation validating index screening performance against an established gold standard.';
    } else if (topDesign === 'CLINICAL_PRACTICE_GUIDELINE') {
      rationale = 'Evidence-based clinical practice guideline and expert consensus grading therapeutic recommendations.';
    }
    return { design: topDesign, rationale };
  }

  return {
    design: 'OTHER',
    rationale: 'Study design could not be definitively classified from available title, abstract, and methods text.',
  };
}

/**
 * Extracts a concise noun phrase representing the primary outcome definition.
 */
function extractPrimaryOutcomeDefinition(abstract: string, _title?: string): string {
  // Text only. NEVER derive an outcome from the title.
  return readPrimaryDefinition(abstract) ?? '';
}

/**
 * Heuristic screening draft engine.
 * Employs evidence-gated parsing to extract study design, PICO parameters,
 * and numerical effect estimates directly from manuscript text.
 * When data are absent or cannot be verified, explicitly reports 'Not reported'
 * or 'Not assessed by heuristic engine' — NEVER fabricates estimates or judgements.
 */
export function generateDeterministicAppraisal(
  manuscript: ParsedManuscriptPayload
): MasterAppraisalReport {
  const meta = { ...manuscript.metadata };
  meta.title = cleanBiomedicalTitle(meta.title);
  meta.authors = cleanBiomedicalAuthors(meta.authors);

  const rawAbstract = manuscript.abstract || '';
  const rawFullText = manuscript.fullText || '';
  const combinedText = `${meta.title} ${rawAbstract} ${rawFullText}`;
  const isAbstractOnly = meta.sourceDepth === 'ABSTRACT_ONLY_FALLBACK';

  // Extract Methods and Results sections from manuscript.sections if available
  let methodsText = '';
  let resultsText = '';

  if (manuscript.sections && manuscript.sections.length > 0) {
    methodsText = manuscript.sections
      .filter((s) => /method|material|protocol|study design|participants|patients and methods/i.test(s.heading))
      .map((s) => s.content)
      .join('\n\n');
    resultsText = manuscript.sections
      .filter((s) => /result|finding|efficacy|outcome|tables/i.test(s.heading))
      .map((s) => s.content)
      .join('\n\n');
  }

  // 1. Dynamic Study Design & Methodological Framework Detection (Task A3)
  const { design: detectedDesign, rationale: designRationale } = classifyStudyDesign(
    meta,
    rawAbstract,
    methodsText
  );

  const governingRules = getGoverningFrameworkRules(detectedDesign);

  // 1B. Trial Framework (Superiority vs Non-inferiority) (Task B2)
  let trialFramework: 'superiority' | 'non-inferiority' | 'equivalence' = 'superiority';
  let nonInferiorityMargin: string | undefined = undefined;
  let nonInferiorityConclusion: string | undefined = undefined;

  if (/non-?inferiority|noninferiority|equivalence/i.test(rawAbstract + ' ' + meta.title)) {
    trialFramework = 'non-inferiority';
    const marginMatch = rawAbstract.match(/(?:non-?inferiority\s+margin\s+(?:of|was)\s*([−-]?[0-9.]+%?)|margin\s+of\s*([−-]?[0-9.]+%?))/i);
    if (marginMatch) {
      nonInferiorityMargin = marginMatch[1] || marginMatch[2];
    }
  }

  // 1C. Trial Specifics: Early Stopping, Under-recruitment, Attrition, Adherence & COI (Task B2)
  const stoppedEarly = /stopped\s+after\s+\d+|study\s+was\s+stopped|trial\s+was\s+terminated|terminated\s+early|planned\s+participant\s+numbers\s+were\s+not\s+reached|under-recruitment/i.test(
    rawAbstract
  );
  const underRecruitment = /planned\s+participant\s+numbers\s+were\s+not\s+reached|under-recruitment|failed\s+to\s+recruit/i.test(
    rawAbstract
  );

  // Adherence: extract reported percentage
  let adherenceRate: string | undefined = undefined;
  const adherenceMatch = rawAbstract.match(/(?:adherence\s+(?:rate|to\s+the\s+assigned\s+intervention)?\s+was\s+([0-9.]+%[^\.;]+))/i);
  if (adherenceMatch && adherenceMatch[1]) {
    adherenceRate = adherenceMatch[1].trim();
  }

  // Industry / commercial manufacturer funding & disclosure detection
  const industry = detectIndustryInvolvement(`${rawAbstract} ${rawFullText}`, meta.affiliations || []);
  const fundingManufacturerConflict = industry.industryFunded;

  // General post-randomization attrition / exclusions rule (D06, D07: >5% invalidates Low Risk on Domain 3)
  let postRandomizationExclusionsCount = 0;
  const attritionMatches = [...rawAbstract.matchAll(/(\d{1,4})\s+(?:women|patients|participants|subjects)?\s*(?:withdrew(?:\s+consent)?|were\s+withdrawn|lost\s+to\s+follow-?up)/gi)];
  if (attritionMatches.length > 0) {
    postRandomizationExclusionsCount = attritionMatches.reduce((acc, m) => acc + parseInt(m[1], 10), 0);
  } else {
    const exclusionMatch = rawAbstract.match(
      /(?:withdrew\s+consent|lost\s+to\s+follow-?up|withdrawn|lost)[^.]*?(\d{1,4})/i
    );
    if (exclusionMatch && exclusionMatch[1]) {
      postRandomizationExclusionsCount = parseInt(exclusionMatch[1], 10);
    }
  }

  // -----------------------------------------------------------------
  // 2. Dynamic Paper-Specific PICO/PECO Deconstruction (Task A6 - No templates)
  // -----------------------------------------------------------------

  // 2A. Extract Sample Size (N = ...)
  let sampleSizeStr = '';
  const nounsPattern =
    'patients|participants|subjects|individuals|adults|cases|women|men|children|infants|neonates|pregnancies|couples|cycles|embryos';

  const verbFirst = new RegExp(
    `(?:enrolled|assigned|included|randomized|randomised|studied|recruited|analyzed|analysed|admitted|evaluated|cohort of|total of|sample of)\\s*(?:a total of\\s*)?([0-9,]{1,7})\\s*(?:${nounsPattern})`,
    'i'
  );

  const numFirst = new RegExp(
    `(?:a total of\\s*)?([0-9,]{1,7})\\s*(?:${nounsPattern})\\s*(?:were|was)?\\s*(?:randomly assigned|enrolled|included|randomized|randomised|studied|recruited|analyzed|analysed|evaluated)`,
    'i'
  );

  const nNotation = /(?:(?:\b[nN]\s*=\s*)|(?:\b[nN]\s*:\s*))([0-9,]{1,7})/;

  const nMatch =
    rawAbstract.match(verbFirst) ||
    rawAbstract.match(numFirst) ||
    (methodsText ? methodsText.match(verbFirst) || methodsText.match(numFirst) : null) ||
    rawAbstract.match(nNotation);

  let sampleSizeNum = 0;
  if (nMatch && nMatch[1]) {
    sampleSizeStr = ` (N = ${nMatch[1]} participants)`;
    sampleSizeNum = parseInt(nMatch[1].replace(/,/g, ''), 10);
  }

  // 2B. Population Extraction (No templates)
  let population = '';
  const inPatientsMatch = meta.title.match(/(?:in|among|for)\s+([A-Za-z0-9\s,-]+?)(?:$|[:;]|,\s*a\b|\s+treated\b|\s+receiving\b|\s+undergoing\b)/i);

  if (inPatientsMatch && inPatientsMatch[1] && inPatientsMatch[1].trim().length > 3) {
    const rawPop = inPatientsMatch[1].trim().replace(/\s+and\s*$/, '');
    population = `${rawPop}${sampleSizeStr}`;
  } else {
    // Look at first sentence of abstract for clinical population
    const firstSentence = rawAbstract.split(/(?<=[.?!])\s+/)[0] || '';
    const cleanFirst = firstSentence.replace(/^(?:background|objective|research question):?\s*/i, '').trim();
    if (cleanFirst.length > 20 && cleanFirst.length < 200) {
      population = `${cleanFirst}${sampleSizeStr}`;
    } else {
      population = sampleSizeStr ? `Not extracted${sampleSizeStr}` : 'Not extracted';
    }
  }

  // Clean double words and whitespace
  population = population
    .replace(/patients with (?:in )?patients with/gi, 'Patients with')
    .replace(/patients with (?:in )?patients/gi, 'Patients with')
    .replace(/\s+/g, ' ')
    .trim();

  // 2C/2D. Intervention & comparator — methods sentence first, explicit "X versus Y" title second, else not extracted
  const armsText = extractArms(rawAbstract);
  const armsTitle = armsFromTitle(meta.title);
  const interventionOrExposure = armsText.intervention ?? armsTitle.intervention ?? 'Not extracted';
  const comparator = armsText.comparator ?? armsTitle.comparator ?? (/\bplacebo\b/i.test(rawAbstract) ? 'Placebo' : 'Not extracted');

  // 2E. Primary & Secondary Outcomes (Task A1, A6)
  const primaryOutcomeDefinition = extractPrimaryOutcomeDefinition(rawAbstract);
  let primaryOutcomes: string[] = [];
  if (primaryOutcomeDefinition) {
    primaryOutcomes = [primaryOutcomeDefinition];
  } else {
    primaryOutcomes = ['Primary outcome not explicitly defined in available abstract text'];
  }

  let secondaryOutcomes: string[] = [];
  const secDefMatch = rawAbstract.match(/(?:the\s+)?secondary\s+(?:review\s+)?(?:outcomes?|end\s*points?)\s+(?:were|was|included|is)\s+([^.;]+)/i);
  if (secDefMatch && secDefMatch[1]) {
    secondaryOutcomes = [secDefMatch[1].trim()];
  } else {
    secondaryOutcomes = ['Secondary outcomes not detailed in abstract'];
  }

  // 2F. Timeframe & Setting (Task A6)
  let timeframe = 'Not reported / Not assessable from available text';
  // Specific median follow-up patterns (e.g. median of 4.7 years, median of 18.2 months)
  const medianTimeMatch = rawAbstract.match(
    /(?:(?:at|over)\s+a\s+median\s+of|median\s+(?:of\s+)?(?:\w+\s+)?(?:follow-?up(?:\s+of)?|follow-?up\s+duration))\s*([0-9.]+\s*(?:months|years|weeks|days))/i
  );
  if (medianTimeMatch && medianTimeMatch[1]) {
    timeframe = `${medianTimeMatch[1].trim()} (median follow-up)`;
  } else {
    const generalFollowUp = rawAbstract.match(/(?:followed\s+for|follow-?up\s+period\s+of)\s*([0-9.]+\s*(?:months|years|weeks|days))/i);
    if (generalFollowUp && generalFollowUp[1] && !/stopped after/i.test(generalFollowUp[0])) {
      timeframe = generalFollowUp[1].trim();
    } else {
      const extracted = extractFollowUp(rawAbstract);
      if (extracted) {
        timeframe = extracted;
      }
    }
  }

  // Setting
  let setting = 'Not reported';
  const clinicMatch = rawAbstract.match(/(?:across\s+)?(\d+\s*(?:in\s+vitro\s+fertilization\s+clinics|clinics|centers|hospitals|sites)[^.,;]*)/i);
  if (clinicMatch && clinicMatch[1]) {
    setting = clinicMatch[1].trim();
  } else if (/multicenter|international/i.test(combinedText)) {
    setting = 'Multicenter trial sites';
  }

  // -----------------------------------------------------------------
  // 3. Dynamic Executive Abstract Synthesis
  // -----------------------------------------------------------------
  const journalClause = meta.journal ? `, published in ${meta.journal},` : '';
  const architectureLabel =
    detectedDesign === 'RCT'
      ? 'an RCT'
      : detectedDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS'
      ? 'a Systematic Review / Meta-Analysis'
      : `a ${detectedDesign.replace(/_/g, ' ')}`;

  const executiveAbstract = {
    // First sentence of the paper's own background, or nothing — no generated filler
    background:
      (rawAbstract
        .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
        .replace(/^\s*(?:BACKGROUND|Background|Introduction|INTRODUCTION|Context|Objectives?|OBJECTIVES?)\s*:?\s*/, '')
        .match(/^([A-Z][^]{20,450}?\.)(?=\s|$)/)?.[1] ?? 'Not extracted').trim(),
    methodologicalSummary: `Structured according to ${governingRules.equatorGuidelineName} and ${governingRules.riskOfBiasToolName}. The investigation utilizes ${architectureLabel} architecture${sampleSizeStr}.`,
    keyFindings: 'Primary result not identified in available text — see the effect-estimate table.',
    criticalVerdict: `Heuristic screening draft based on available text. Methodological validity and clinical applicability require formal evaluation.`,
  };

  // -----------------------------------------------------------------
  // 4. Evidence-Gated Risk of Bias Matrix (Task B2: Attrition rule on Domain 3)
  // -----------------------------------------------------------------
  const domains = governingRules.robMandatoryDomains.map((d, index) => {
    const domainName = typeof d === 'string' ? d : d.domainName;
    let judgement: BiasJudgement = 'UNCLEAR_NOT_REPORTED';
    let supportiveEvidence = '';
    let criticalSignificance = '';

    if (detectedDesign === 'RCT') {
      if (index === 0) {
        criticalSignificance = 'Minimizes baseline confounding and selection bias between study arms.';
        const match = findSentenceWithKeywords(
          combinedText,
          /central computer|interactive (?:web|voice) response|web-based random|permuted block|block random|opaque sealed envelope|allocation concealment|sequentially numbered/i
        );
        if (match) {
          judgement = 'LOW_RISK';
          supportiveEvidence = match;
        } else {
          const mentionRandom = findSentenceWithKeywords(combinedText, /\brandom(?:ly|ized|ised)?\b/i);
          if (mentionRandom) {
            judgement = 'UNCLEAR_NOT_REPORTED';
            supportiveEvidence = 'Random assignment mentioned, but sequence generation mechanics and allocation concealment are not detailed in available text.';
          } else {
            judgement = 'UNCLEAR_NOT_REPORTED';
            supportiveEvidence = 'Not assessable by heuristic engine from available text — requires manual protocol verification.';
          }
        }
      } else if (index === 1) {
        criticalSignificance = 'Limits performance bias and ensures observed differences are attributable to intervention.';
        const doubleBlindMatch = findSentenceWithKeywords(
          combinedText,
          /double-blind|triple-blind|placebo-controlled|identical appearance|matching placebo|sham-controlled/i
        );
        const openLabelMatch = findSentenceWithKeywords(combinedText, /open-label|unblinded|open label/i);
        if (doubleBlindMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = doubleBlindMatch;
        } else if (openLabelMatch) {
          judgement = 'HIGH_RISK';
          supportiveEvidence = openLabelMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Blinding status and protocol deviation management not assessable by heuristic engine from available text.';
        }
      } else if (index === 2) {
        // Domain 3: Missing outcome data & Attrition (Task B2 / B3 check)
        criticalSignificance = 'Protects randomization prognostic balance and prevents differential attrition bias.';
        const attritionPercentage = sampleSizeNum > 0 ? (postRandomizationExclusionsCount / sampleSizeNum) * 100 : 0;

        if (postRandomizationExclusionsCount > 0 && (attritionPercentage > 5 || postRandomizationExclusionsCount >= 50)) {
          judgement = 'SOME_CONCERNS';
          supportiveEvidence = `Post-randomisation exclusions identified (${postRandomizationExclusionsCount} participants excluded or withdrew consent, exceeding 5% threshold).`;
        } else {
          const ittMatch = findSentenceWithKeywords(
            combinedText,
            /intention-to-treat|modified intention-to-treat|complete follow-up|no loss to follow-up|all randomized participants/i
          );
          if (ittMatch) {
            judgement = 'LOW_RISK';
            supportiveEvidence = ittMatch;
          } else {
            judgement = 'UNCLEAR_NOT_REPORTED';
            supportiveEvidence = 'Completeness of follow-up and handling of missing outcome data not detailed in available text.';
          }
        }
      } else if (index === 3) {
        criticalSignificance = 'Prevents detection bias in endpoint adjudication.';
        const assessorBlindMatch = findSentenceWithKeywords(
          combinedText,
          /blinded to treatment|blinded outcome|independent adjudication committee|objective laboratory|central adjudication/i
        );
        if (assessorBlindMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = assessorBlindMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Blinding of outcome assessors not explicit in available text.';
        }
      } else {
        criticalSignificance = 'Ensures reporting fidelity against pre-specified endpoints and minimizes outcome reporting bias.';
        const registryMatch = findSentenceWithKeywords(
          combinedText,
          /clinicaltrials\.gov|isrctn|anzctr|pre-specified analysis plan|prospero/i
        );
        if (registryMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = registryMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Trial registration identifier or protocol comparison not assessable by heuristic engine.';
        }
      }
    } else if (detectedDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS') {
      // AMSTAR 2 critical domains — matched by domain NAME, never by position
      const rule = AMSTAR_CUES.find((r) => r.domain.test(domainName));
      criticalSignificance = typeof d === 'string' ? '' : d.description;
      const hit = rule ? findCue(`${rawAbstract} ${rawFullText}`, rule.cue) : null;
      if (hit) {
        judgement = 'LOW_RISK'; // converted below to "favourable signal — verify"
        supportiveEvidence = hit;
      } else {
        judgement = 'UNCLEAR_NOT_REPORTED';
        supportiveEvidence = rule ? rule.note : 'Not assessable by heuristic engine from available text.';
      }
    } else {
      // Cohort & observational studies
      if (index === 0) {
        criticalSignificance = 'Enhances external validity and limits selection bias.';
        const cohortMatch = findSentenceWithKeywords(
          combinedText,
          /consecutive patients|population-based|representative cohort|prospective cohort|multinational registry/i
        );
        if (cohortMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = cohortMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Cohort selection and representativeness not assessable by heuristic engine from available text.';
        }
      } else if (index === 1) {
        criticalSignificance = 'Mitigates confounding by indication inherent to observational designs.';
        const confoundMatch = findSentenceWithKeywords(
          combinedText,
          /multivariable|multivariate|adjusted for|propensity score|regression model/i
        );
        if (confoundMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = confoundMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Confounder adjustment methods not assessable by heuristic engine from available text.';
        }
      } else if (index === 2) {
        criticalSignificance = 'Prevents misclassification and measurement bias.';
        const expMatch = findSentenceWithKeywords(
          combinedText,
          /laboratory-confirmed|standardized diagnostic|medical records|validated questionnaire/i
        );
        if (expMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = expMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Exposure ascertainment details not assessable by heuristic engine from available text.';
        }
      } else if (index === 3) {
        criticalSignificance = 'Minimizes ascertainment bias.';
        const outMatch = findSentenceWithKeywords(
          combinedText,
          /electronic health records|objective clinical outcome|blinded to exposure|adjudicated/i
        );
        if (outMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = outMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Outcome ascertainment details not assessable by heuristic engine from available text.';
        }
      } else {
        criticalSignificance = 'Ensures sufficient latency for observation of meaningful clinical outcomes.';
        const followMatch = findSentenceWithKeywords(
          combinedText,
          /median follow-up|loss to follow-up|complete follow-up|duration of follow-up/i
        );
        if (followMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = followMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Attrition and follow-up duration details not assessable by heuristic engine from available text.';
        }
      }
    }

    // A keyword match cannot establish LOW risk. Keep the quote, downgrade the verdict to "verify".
    if (judgement === 'LOW_RISK') {
      judgement = 'UNCLEAR_NOT_REPORTED';
      supportiveEvidence = `Favourable signal — verify in full text (heuristic cannot rate Low risk): ${supportiveEvidence}`;
    }

    return {
      domainName,
      judgement: judgement as BiasJudgement,
      supportiveEvidence,
      criticalSignificance,
    };
  });

  // Worst-domain rule for overall RoB
  let overallRobJudgement: BiasJudgement = 'UNCLEAR_NOT_REPORTED';
  if (domains.some((d) => d.judgement === 'HIGH_RISK')) {
    overallRobJudgement = 'HIGH_RISK';
  } else if (domains.some((d) => d.judgement === 'SOME_CONCERNS')) {
    overallRobJudgement = 'SOME_CONCERNS';
  } else if (domains.every((d) => d.judgement === 'LOW_RISK')) {
    overallRobJudgement = 'LOW_RISK';
  }

  // -----------------------------------------------------------------
  // 5. EQUATOR Checklist Matrix (Task B1: real CONSORT 2025 numbering & unique evidence spans)
  // -----------------------------------------------------------------
  const isStructuredAbstract = /<h4>|\b(?:background|objectives?|purpose|introduction|research question)\b[\s\S]{0,1500}?\b(?:methods?|design|search methods)\b[\s\S]{0,3000}?\b(?:results|findings|main results)\b/i.test(rawAbstract);

  const TITLE_DESIGN: Record<string, RegExp> = {
    RCT: /randomi[sz]ed|\btrial\b/i,
    SYSTEMATIC_REVIEW_META_ANALYSIS: /systematic review|meta-analy/i,
    COHORT_STUDY: /cohort|registry|longitudinal/i,
    CASE_CONTROL_STUDY: /case-control/i,
    CROSS_SECTIONAL: /cross-sectional|survey|prevalence/i,
    DIAGNOSTIC_ACCURACY: /accuracy|diagnostic/i,
    PREDICTION_MODEL: /predict|model|algorithm|machine learning|deep learning|artificial intelligence/i,
  };
  const checklistText = `${rawAbstract} ${rawFullText}`;
  const introText = [
    rawAbstract,
    ...(Array.isArray(manuscript.sections) ? manuscript.sections : [])
      .filter((s: any) => /introduction|background/i.test(s.heading || ''))
      .map((s: any) => s.content),
  ].join(' ');
  const equatorAudit = governingRules.equatorMandatoryItems.map((item) => {
    const label = `${item.itemNumberAndSection} ${item.requirement}`;
    const rule = CHECKLIST_CUES.find((r) => r.label.test(item.itemNumberAndSection)) ?? CHECKLIST_CUES.find((r) => r.label.test(label));
    let status: 'REPORTED' | 'NOT_REPORTED' = 'NOT_REPORTED';
    let evidence = isAbstractOnly ? 'Not found in the abstract (may be in the full text).' : 'Not found in available text.';
    if (rule?.structural === 'title-design') {
      const re = TITLE_DESIGN[detectedDesign];
      if (re && re.test(meta.title)) { status = 'REPORTED'; evidence = meta.title; }
    } else if (rule?.structural === 'structured-abstract') {
      if (isStructuredAbstract) { status = 'REPORTED'; evidence = 'Structured abstract with labelled sections.'; }
    } else if (rule) {
      const hit = findCue(
        /background|rationale/i.test(item.itemNumberAndSection) ? introText : checklistText,
        rule.cue,
        rule.reject
      );
      if (hit) { status = 'REPORTED'; evidence = hit; }
    }
    return {
      itemNumberAndSection: item.itemNumberAndSection,
      requirement: item.requirement,
      status,
      evidenceOrPageLocation: evidence,
    };
  });

  const reportedCount = equatorAudit.filter((i) => i.status === 'REPORTED').length;
  const totalAssessed = equatorAudit.length;
  const compliancePercentage = totalAssessed > 0 ? Math.round((reportedCount / totalAssessed) * 100) : 0;
  const subsetLabel = detectedDesign === 'RCT' ? `Screening subset (${totalAssessed} items of 30)` : undefined;
  const overallComplianceSummary = subsetLabel
    ? `${subsetLabel} evaluated: ${reportedCount} reported, ${totalAssessed - reportedCount} unassessed/not reported in available text.`
    : `Compliance: ${reportedCount} of ${totalAssessed} items reported (${compliancePercentage}%).`;

  // -----------------------------------------------------------------
  // 6. Dynamic Statistical Audit & Real Effect Estimate Parsing (Tasks A1, A4, A8)
  // -----------------------------------------------------------------
  const effectEstimates: EffectEstimateItem[] = [];
  let primaryEstimate: EffectEstimateItem | null = null;
  const statsSearchText = [rawAbstract, resultsText].filter(Boolean).join(' ') || combinedText;

  // Narrative reviews / commentaries: never lift estimates from cited studies
  if (detectedDesign !== 'OTHER') {
    const parsed = extractEffectEstimates(statsSearchText, 12);
    const primaryParsed = selectPrimaryEstimate(parsed, primaryOutcomeDefinition || null);
    for (const e of parsed) {
      const nature = outcomeNature(e.outcomeHint, e === primaryParsed ? primaryOutcomeDefinition : null);
      const direction = effectDirection(e, nature);
      const label = e.outcomeHint
        ? `${e.outcomeHint}${e.subgroupHint ? ` (${e.subgroupHint})` : ''}`
        : 'Unlabelled outcome';
      const nullText = e.isRatio ? '1.0' : '0.0';
      const sig = crossesNull(e)
        ? `No statistically significant difference demonstrated (95% CI crosses null value of ${nullText}).`
        : `Statistically significant difference (95% CI does not cross null value of ${nullText})${direction.startsWith('favours') ? ` — ${direction}` : ''}.`;
      const item: EffectEstimateItem = {
        outcome: label,
        outcomeLabel: label,
        metric: `${e.adjusted ? 'Adjusted ' : ''}${e.metric}`,
        pointEstimate: e.raw.point,
        confidenceInterval: `95% CI: ${e.raw.lo} to ${e.raw.hi}`,
        pValue: e.pValue,
        clinicalVsStatisticalSignificance: sig,
        sourceSentence: e.sentence,
        sourceQuote: e.sentence,
        outcomeType: nature === 'process' ? 'process' : direction === 'no clear difference' ? 'no-clear-difference' : direction === 'favours intervention' ? 'benefit' : direction === 'favours comparator' ? 'harm' : 'unlabelled',
        confidence: e.outcomeHint ? 'high' : 'low',
        isPrimary: e === primaryParsed,
      };
      if (item.isPrimary) primaryEstimate = item;
      effectEstimates.push(item);
    }
    // Non-inferiority: compare the CI bound of the PRIMARY difference estimate with the stated margin
    if (trialFramework === 'non-inferiority' && primaryParsed && nonInferiorityMargin) {
      const margin = Math.abs(parseFloat(nonInferiorityMargin.replace(/[^0-9.]/g, '')));
      const higherIsBetter = outcomeNature(primaryParsed.outcomeHint, primaryOutcomeDefinition) !== 'adverse';
      const v = nonInferiorityVerdict(primaryParsed, isNaN(margin) ? null : margin, higherIsBetter);
      if (v !== 'not assessable') {
        nonInferiorityConclusion = `Non-inferiority ${v}: 95% CI ${primaryParsed.ciLow} to ${primaryParsed.ciHigh} vs margin ${margin}.`;
      }
    }
  }

  // Key finding = the primary RESULT (not the outcome definition, not the title)
  if (primaryEstimate) {
    const pe = primaryEstimate as EffectEstimateItem;
    executiveAbstract.keyFindings = `${pe.outcomeLabel}: ${pe.metric} ${pe.pointEstimate} (${pe.confidenceInterval.replace(/^95% CI:\s*/, '95% CI ')}), ${pe.pValue}. ${pe.clinicalVsStatisticalSignificance}${nonInferiorityConclusion ? ` ${nonInferiorityConclusion}` : ''}`;
  }

  // Sample size & power calculation audit
  const powerMatch = findSentenceWithKeywords(
    combinedText,
    /(?:power calculation|sample size calculation|powered to detect|80%\s*power|90%\s*power|alpha\s*=\s*0\.05)/i
  );

  const sampleSizePowerCalculation = powerMatch
    ? {
        reported: true,
        adequacyAssessment: powerMatch,
        alphaAndPower: 'Prespecified in study methodology',
        assumedEffectSize: 'Documented in study protocol',
      }
    : {
        reported: false,
        adequacyAssessment: 'Not assessed by heuristic engine',
        alphaAndPower: 'Not reported / Not assessable from available text',
        assumedEffectSize: 'Not reported / Not assessable from available text',
      };

  // Heterogeneity analysis
  let i2Stat: string | null = 'Not applicable';
  let pHetero: string | null = null;
  if (detectedDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS') {
    const i2Match = combinedText.match(/I[²2]\s*=\s*([0-9.]+%?)/i);
    if (i2Match && i2Match[1]) {
      i2Stat = `I² = ${i2Match[1]}`;
    } else {
      i2Stat = 'Not reported / Not assessable from available text';
    }
  }

  const statisticalAudit = {
    sampleSizePowerCalculation,
    analysisType: (
      /intention-to-treat|modified intention-to-treat/i.test(combinedText)
        ? 'INTENTION_TO_TREAT'
        : /per-protocol/i.test(combinedText)
        ? 'PER_PROTOCOL'
        : 'UNSPECIFIED'
    ) as 'INTENTION_TO_TREAT' | 'PER_PROTOCOL' | 'UNSPECIFIED',
    missingDataHandling: 'Not reported / Not assessable from available text',
    confoundingAndCovariateAdjustment: 'Not reported / Not assessable from available text',
    multiplicityAndSubgroupAudit: 'Not reported / Not assessable from available text',
    heterogeneityAnalysis: {
      i2Statistic: i2Stat,
      pForHeterogeneity: pHetero,
      modelType: (detectedDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS' ? 'RANDOM_EFFECTS' : 'NOT_APPLICABLE') as any,
      interpretation: 'Not assessed by heuristic engine',
    },
    effectEstimates,
    primaryEstimate: primaryEstimate || null,
    trialSpecifics: {
      stoppedEarly,
      underRecruitment,
      attritionRate: sampleSizeNum > 0 ? (postRandomizationExclusionsCount / sampleSizeNum) * 100 : undefined,
      adherence: adherenceRate,
      funderConflictOfInterest: fundingManufacturerConflict,
      framework: trialFramework,
      nonInferiorityMargin,
      nonInferiorityConclusion,
    },
    spinAndDiscrepancyAudit: {
      spinDetected: false,
      spinStatus: 'not-assessed' as const,
      discrepancyDetails: 'Spin audit not assessable in deterministic heuristic mode. Requires neural LLM or manual peer review.',
      recommendationForInterpretation:
        'Findings should be verified against complete trial documentation and peer-reviewed publication.',
    },
    strengthsAndLimitations: {
      majorStrengths: [
        `Reporting structured according to ${governingRules.equatorGuidelineName} items`,
        `Identified design architecture: ${architectureLabel}`,
      ],
      fatalMethodologicalFlaws: ['Not assessed in deterministic heuristic mode'],
      flawsStatus: 'not-assessed' as const,
      minorLimitations: [
        ...(stoppedEarly ? ['Premature trial termination / under-recruitment: trial ended prior to planned sample accrual, introducing potential risk of imprecision.'] : []),
        ...(industry.evidence.length > 0
          ? [
              `Industry involvement detected — ${industry.evidence.join('; ')}. Verify whether the company makes or sells the intervention.`,
            ]
          : []),
        ...((detectedDesign === 'PREDICTION_MODEL' || (detectedDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS' && includedDesigns(rawAbstract) === 'MODEL_PERFORMANCE'))
          ? aiValidationSignals(`${rawAbstract} ${rawFullText}`)
              .filter((s) => !s.found)
              .map((s) => `AI validation — not found in available text: ${s.item}. Model performance metrics are not evidence of clinical benefit.`)
          : []),
        isAbstractOnly
          ? 'Appraisal performed on abstract-only text; comprehensive methodological and table review not accessible.'
          : 'Heuristic screening draft — formal critical audit requires detailed manual or LLM review.',
      ],
    },
  };

  // -----------------------------------------------------------------
  // 7. Dynamic Validity Synthesis & GRADE (Task A5: Heuristic mode not graded)
  // -----------------------------------------------------------------
  let internalValidityText = '';
  if (overallRobJudgement === 'LOW_RISK') {
    internalValidityText = `Preliminary low risk of bias identified across assessed domains under ${governingRules.riskOfBiasToolName} criteria.`;
  } else if (overallRobJudgement === 'SOME_CONCERNS') {
    internalValidityText = `Moderate internal validity with some methodological concerns identified under ${governingRules.riskOfBiasToolName} criteria.`;
  } else if (overallRobJudgement === 'HIGH_RISK') {
    internalValidityText = `High risk of bias identified under ${governingRules.riskOfBiasToolName} criteria, necessitating cautious clinical interpretation.`;
  } else {
    internalValidityText = `Risk of bias cannot be definitively graded by heuristic screening engine without full protocol and trial documentation review.`;
  }

  const coiMatch = findSentenceWithKeywords(
    combinedText,
    /conflict of interest|conflicts of interest|competing interests|financial disclosure|funded by|supported by grant/i
  );

  const isRetracted = manuscript.retraction?.isRetracted === true;

  const validitySynthesis = {
    internalValidity: isRetracted ? 'Suppressed: Article has been retracted from publication.' : internalValidityText,
    externalValidityAndGeneralizability: isRetracted
      ? 'Suppressed: Article has been retracted.'
      : `Generalizability is contingent upon clinical setting matching the reported study cohort.`,
    conflictsOfInterestAndFundingCritique: coiMatch
      ? coiMatch
      : 'Funding and conflict of interest declarations were not identified in the available text.',
    gradeCertainty: 'NOT_GRADED_HEURISTIC' as const,
    gradeDowngradingFactors: isRetracted ? ['Article retracted'] : ['Heuristic screening mode — formal GRADE rating omitted'],
    gradeUpgradingFactors: [],
    gradeRationale: isRetracted
      ? 'Appraisal suppressed: Manuscript was retracted from the scientific literature.'
      : 'GRADE certainty is not formally rated in deterministic heuristic mode (heuristic screening draft).',
    isHeuristicMode: true,
    suppressedDueToRetraction: isRetracted,
  };

  // -----------------------------------------------------------------
  // 8. Dynamic Clinical Translation & References (Task B3: Updated citations)
  // -----------------------------------------------------------------
  const clinicalPracticeBottomLine = {
    keyTakeawayForClinicians: isRetracted
      ? 'Suppressed: This manuscript has been retracted from the scientific literature.'
      : `Clinical decisions should be guided by verified full-text evidence and formal risk of bias evaluation.`,
    applicabilityToPractice: isRetracted
      ? 'Suppressed: Retracted study findings must not be applied in clinical practice.'
      : `Directly applicable to clinical cohorts meeting eligibility criteria evaluated in ${meta.title}.`,
    recommendationsForFutureResearch: isRetracted
      ? 'Independent replication and scientific integrity audits.'
      : 'Long-term surveillance, pre-specified subgroup validation, and replication in diverse clinical settings.',
    suppressedDueToRetraction: isRetracted,
  };

  const references = [
    {
      number: 1,
      vancouverCitation: meta.vancouverCitation,
      doiOrUrl: meta.doi ? `https://doi.org/${meta.doi}` : undefined,
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
        'OCEBM Levels of Evidence Working Group. "The Oxford 2011 Levels of Evidence". Oxford Centre for Evidence-Based Medicine.',
      doiOrUrl: 'https://www.cebm.ox.ac.uk/resources/levels-of-evidence/ocebm-levels-of-evidence',
    },
  ];

  return {
    id: crypto.randomUUID(),
    metadata: meta,
    retraction: manuscript.retraction,
    classification: {
      studyDesign: detectedDesign,
      studyDesignRationale: designRationale,
      // A review is only Level 1a if it pooled randomised trials
      oxfordEvidenceLevel:
        detectedDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS'
          ? reviewOxfordLevel(includedDesigns(`${rawAbstract} ${rawFullText.slice(0, 6000)}`))
          : governingRules.defaultOxfordLevel,
      equatorReportingGuideline: governingRules.equatorGuidelineName,
      framework: trialFramework,
      nonInferiorityMargin,
      nonInferiorityConclusion,
    },
    executiveAbstract,
    pico: {
      population,
      interventionOrExposure,
      comparator,
      primaryOutcomes,
      secondaryOutcomes,
      timeframe,
      setting,
    },
    riskOfBias: {
      governingTool: governingRules.riskOfBiasToolName,
      overallRisk: overallRobJudgement,
      domains,
      overallRationale: `Overall risk of bias judged as ${overallRobJudgement.replace(/_/g, ' ')} under ${governingRules.riskOfBiasToolName} criteria.`,
    },
    equatorChecklist: {
      guidelineName: governingRules.equatorGuidelineName,
      overallCompliancePercentage: compliancePercentage,
      criticalItemsAudit: equatorAudit,
      overallComplianceSummary,
      subsetLabel,
    },
    statisticalAudit,
    validitySynthesis,
    clinicalPracticeBottomLine,
    references,
    manuscriptAbstract: manuscript.abstract,
    manuscriptFullText: manuscript.fullText,
    engineUsed: 'deterministic',
    completedAt: new Date().toISOString(),
  };
}
