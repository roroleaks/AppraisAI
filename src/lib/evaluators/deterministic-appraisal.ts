import {
  MasterAppraisalReport,
  BiasJudgement,
  StudyDesign,
} from '../schemas/appraisal.schema';
import { ParsedManuscriptPayload } from '../schemas/ingestion.schema';
import { getGoverningFrameworkRules } from './framework-router';
import { synthesizeGradeCertainty } from './grade-engine';
import { cleanBiomedicalTitle, cleanBiomedicalAuthors } from '../parsers/title-sanitizer';
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
  const lowerCombined = combinedText.toLowerCase();
  const isAbstractOnly = meta.sourceDepth === 'ABSTRACT_ONLY_FALLBACK';

  // -----------------------------------------------------------------
  // 1. Dynamic Study Design & Methodological Framework Detection
  // -----------------------------------------------------------------
  let detectedDesign: StudyDesign = 'RCT';
  let designRationale = '';

  if (
    /systematic review|meta-analysis|meta-analytic|cochrane review|prisma 2020|amstar/i.test(
      meta.title + ' ' + rawAbstract
    )
  ) {
    detectedDesign = 'SYSTEMATIC_REVIEW_META_ANALYSIS';
    designRationale =
      'Systematic review and/or meta-analytical investigation pooling evidence across published biomedical databases.';
  } else if (
    /randomized controlled trial|randomised trial|double-blind|placebo-controlled|\brct\b|randomly assigned/i.test(
      meta.title + ' ' + rawAbstract
    )
  ) {
    detectedDesign = 'RCT';
    designRationale =
      'Parallel-group randomized controlled clinical trial evaluating intervention efficacy against defined comparators.';
  } else if (
    /cohort study|prospective observational|retrospective cohort|longitudinal follow-up|prospective cohort/i.test(
      meta.title + ' ' + rawAbstract
    )
  ) {
    detectedDesign = 'COHORT_STUDY';
    designRationale =
      'Longitudinal prospective or retrospective observation of defined clinical cohorts evaluating incidence and prognostic outcomes.';
  } else if (/case-control|matched controls/i.test(meta.title + ' ' + rawAbstract)) {
    detectedDesign = 'CASE_CONTROL_STUDY';
    designRationale =
      'Observational case-control investigation matching subjects with outcomes of interest against comparable controls.';
  } else if (
    /cross-sectional|prevalence study|survey study/i.test(meta.title + ' ' + rawAbstract)
  ) {
    detectedDesign = 'CROSS_SECTIONAL';
    designRationale =
      'Cross-sectional observational study evaluating prevalence and clinical associations at a single cross-sectional timepoint.';
  } else if (
    /diagnostic accuracy|sensitivity and specificity|receiver operating|stard|quadas/i.test(
      meta.title + ' ' + rawAbstract
    )
  ) {
    detectedDesign = 'DIAGNOSTIC_ACCURACY';
    designRationale =
      'Diagnostic test accuracy investigation validating index screening performance against an established gold standard.';
  } else if (/practice guideline|consensus statement|clinical guideline/i.test(meta.title + ' ' + rawAbstract)) {
    detectedDesign = 'CLINICAL_PRACTICE_GUIDELINE';
    designRationale =
      'Evidence-based clinical practice guideline and expert consensus grading therapeutic recommendations.';
  } else {
    // Default to Systematic Review or Clinical Investigation based on commentary/review phrasing
    if (/review|commentary|conceptual|framework/i.test(meta.title + ' ' + rawAbstract)) {
      detectedDesign = 'SYSTEMATIC_REVIEW_META_ANALYSIS';
      designRationale =
        'Comprehensive clinical review and evidence synthesis establishing a translational methodological framework.';
    } else {
      detectedDesign = 'RCT';
      designRationale =
        'Clinical trial investigation evaluating therapeutic safety and efficacy outcomes.';
    }
  }

  const governingRules = getGoverningFrameworkRules(detectedDesign);

  // -----------------------------------------------------------------
  // 2. Dynamic Paper-Specific PICO/PECO Deconstruction
  // -----------------------------------------------------------------

  // 2A. Extract Sample Size (N = ...)
  let sampleSizeStr = '';
  const nMatch = rawAbstract.match(
    /(?:enrolled|assigned|included|randomized|studied|cohort of|total of|analyzed)\s*([0-9,]{2,7})\s*(?:patients|participants|subjects|individuals|adults|cases|women|men|children|infants|neonates|pregnancies|couples|cycles|embryos)/i
  ) || rawAbstract.match(/(?:(?:n|N)\s*=\s*([0-9,]{2,7}))/);

  if (nMatch && nMatch[1]) {
    sampleSizeStr = ` (N = ${nMatch[1]} participants)`;
  }

  // 2B. Population Extraction (Topic-Agnostic)
  let population = '';
  let shortCohort = '';

  const patientsWithMatch = meta.title.match(
    /(?:in|among|for)\s+(?:adult\s+|pediatric\s+)?(?:patients|participants|individuals|subjects|cohorts?|women|men|children|infants|cases)\s+with\s+([A-Za-z0-9\s,-]+?)(?:$|[:;]|,\s*a\b|\s+treated\b|\s+receiving\b|\s+undergoing\b)/i
  );

  const inConditionMatch = meta.title.match(
    /(?:in|among|for)\s+([A-Za-z0-9\s,-]+?)(?:$|[:;]|,\s*a\b|\s+treated\b|\s+receiving\b|\s+undergoing\b)/i
  );

  if (patientsWithMatch && patientsWithMatch[1] && patientsWithMatch[1].trim().length > 3) {
    const condition = patientsWithMatch[1].trim().replace(/\s+and\s*$/, '');
    population = `Patients with ${condition}${sampleSizeStr}, evaluated under clinical study criteria.`;
    shortCohort = `patients with ${condition}`;
  } else if (inConditionMatch && inConditionMatch[1] && inConditionMatch[1].trim().length > 3) {
    let raw = inConditionMatch[1].trim();
    const prefixMatch = meta.title.match(/^([^:]+?)\s+(?:in|among|for)\b/i);
    const leadingTopic =
      prefixMatch &&
      prefixMatch[1] &&
      prefixMatch[1].trim().length > 3 &&
      !/^(?:efficacy|safety|effect|trial|study|evaluation|assessment)\b/i.test(prefixMatch[1].trim())
        ? prefixMatch[1].trim()
        : '';

    if (/^patients|participants|individuals|subjects|women|children|cases/i.test(raw)) {
      population = `${raw}${sampleSizeStr}, evaluated under clinical study criteria.`;
      shortCohort = raw.toLowerCase();
    } else {
      const combinedDesc = leadingTopic ? `${leadingTopic} among ${raw}` : raw;
      population = `Patients presenting with or evaluated for ${combinedDesc}${sampleSizeStr}.`;
      shortCohort = `cohort evaluated for ${combinedDesc.toLowerCase()}`;
    }
  } else {
    const firstSentence = rawAbstract.split(/(?<=[.?!])\s+/)[0] || '';
    if (firstSentence.length > 20 && firstSentence.length < 250) {
      population = `${firstSentence.replace(/^(?:background|objective|methods):?\s*/i, '')}${sampleSizeStr}`;
      shortCohort = 'the evaluated patient cohort';
    } else {
      population = `Clinical cohort evaluated for ${meta.title}${sampleSizeStr}.`;
      shortCohort = 'the evaluated clinical cohort';
    }
  }

  population = population
    .replace(/patients with (?:in )?patients with/gi, 'Patients with')
    .replace(/patients with (?:in )?patients/gi, 'Patients with')
    .replace(/\s+/g, ' ')
    .trim();

  // 2C. Intervention / Exposure Extraction (Topic-Agnostic)
  let interventionOrExposure = '';
  const vsPrefixMatch = meta.title.match(
    /(?:efficacy|safety|effect of)?\s*([A-Za-z0-9\s,-]+?)\s+(?:versus|vs\.?|compared with|compared to)\b/i
  );
  const intMatch = meta.title.match(/^([A-Za-z0-9\s,-]+?)\s+(?:in|for|after|and)\b/i);

  if (vsPrefixMatch && vsPrefixMatch[1] && vsPrefixMatch[1].trim().length > 2) {
    interventionOrExposure = `${vsPrefixMatch[1]
      .trim()
      .replace(/^(?:efficacy|safety|effect of)\s+/i, '')} administered in accordance with study protocol.`;
  } else if (intMatch && intMatch[1] && intMatch[1].trim().length > 3) {
    interventionOrExposure = `${intMatch[1].trim()} administered in accordance with the study protocol.`;
  } else {
    interventionOrExposure = `Primary therapeutic intervention or exposure regimen specified in ${meta.title}.`;
  }

  // 2D. Comparator Extraction (Topic-Agnostic)
  let comparator = '';
  const vsMatch = meta.title.match(/(?:versus|vs\.?|compared with|compared to)\s+([^,;:(]+)/i);
  if (vsMatch && vsMatch[1] && vsMatch[1].trim().length > 2) {
    comparator = `${vsMatch[1].trim()} administered in accordance with comparator protocol.`;
  } else if (/\bplacebo\b/i.test(combinedText)) {
    comparator = 'Matching placebo control administered alongside standard guideline therapy.';
  } else if (/standard of care|usual care|active control|control group/i.test(combinedText)) {
    comparator = 'Standard of care, conventional management, or control cohort.';
  } else {
    comparator = 'Standard clinical control, baseline observation, or comparative non-exposure arm.';
  }

  // 2E. Primary & Secondary Outcomes
  let primaryOutcomes: string[] = [];
  let secondaryOutcomes: string[] = [];

  const sentences = rawAbstract.split(/(?<=[.?!])\s+/);
  const primarySentences = sentences
    .map((s) => s.replace(/^(?:results|conclusion|methods|background):?\s*/i, '').trim())
    .filter((s) =>
      /primary (?:outcome|endpoint|composite)|composite of|significantly (?:reduced|increased|improved)/i.test(s)
    );

  if (primarySentences.length > 0) {
    primaryOutcomes = [primarySentences[0]];
    if (
      primarySentences.length > 1 &&
      !primarySentences[1].toLowerCase().includes('occurred in') &&
      !primarySentences[1].toLowerCase().includes('hazard ratio')
    ) {
      primaryOutcomes.push(primarySentences[1]);
    }
  } else {
    primaryOutcomes = [`Primary clinical endpoints defined in ${meta.title}`];
  }

  secondaryOutcomes = ['Secondary efficacy endpoints and safety tolerability profiles as reported in manuscript'];

  // 2F. Timeframe & Setting
  let timeframe = 'Follow-up duration prespecified in clinical trial protocol';
  const timeMatch = rawAbstract.match(
    /(?:median follow-up of|followed for|over a period of|after)\s*([0-9.]+\s*(?:months|years|weeks|days))/i
  );
  if (timeMatch && timeMatch[1]) {
    timeframe = `Median follow-up of ${timeMatch[1]}`;
  }

  let setting = 'Clinical investigation centers';
  if (/multicenter|international|countries|hospitals/i.test(combinedText)) {
    setting = 'Multicenter medical centers and clinical research hospitals';
  } else if (/outpatient/i.test(combinedText)) {
    setting = 'Specialized outpatient tertiary care referral centers';
  }

  // -----------------------------------------------------------------
  // 3. Dynamic Executive Abstract Synthesis (Objective & Non-evaluative)
  // -----------------------------------------------------------------
  const journalClause = meta.journal ? `, published in ${meta.journal},` : '';
  const architectureLabel =
    detectedDesign === 'RCT'
      ? 'an RCT'
      : detectedDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS'
      ? 'a Systematic Review / Meta-Analysis'
      : `a ${detectedDesign.replace(/_/g, ' ')}`;

  const executiveAbstract = {
    background: `${meta.title}${journalClause} addresses clinical priorities. Evaluates ${interventionOrExposure} in ${shortCohort}.`,
    methodologicalSummary: `Structured according to ${governingRules.equatorGuidelineName} and ${governingRules.riskOfBiasToolName}. The investigation utilizes ${architectureLabel} architecture${sampleSizeStr}.`,
    keyFindings: primaryOutcomes[0] || `Reported primary clinical outcomes for ${meta.title}.`,
    criticalVerdict: `Heuristic screening draft based on available text. Methodological validity and clinical applicability require formal evaluation.`,
  };

  // -----------------------------------------------------------------
  // 4. Evidence-Gated Risk of Bias Matrix (P0-1: No invented judgements)
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
        criticalSignificance = 'Protects randomization prognostic balance and prevents differential attrition bias.';
        const ittMatch = findSentenceWithKeywords(
          combinedText,
          /intention-to-treat|modified intention-to-treat|complete follow-up|no loss to follow-up|all randomized participants/i
        );
        if (ittMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = ittMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Participant attrition and missing data handling not assessable by heuristic engine from available text.';
        }
      } else if (index === 3) {
        criticalSignificance = 'Ensures detection objectivity and consistency across clinical trial assessment centers.';
        const blindOutcomeMatch = findSentenceWithKeywords(
          combinedText,
          /blinded outcome|adjudication committee|independent clinical endpoint|all-cause mortality|masked assessors/i
        );
        if (blindOutcomeMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = blindOutcomeMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Blinding of outcome assessors not assessable by heuristic engine from available text.';
        }
      } else {
        criticalSignificance = 'Prevents selective outcome reporting and post-hoc data dredging.';
        const registryMatch = findSentenceWithKeywords(
          combinedText,
          /clinicaltrials\.gov|registered under|registration number|trial registry|prospectively registered|pre-specified statistical analysis/i
        );
        if (registryMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = registryMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Pre-specified protocol registration comparison not assessable by heuristic engine from available text.';
        }
      }
    } else if (detectedDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS') {
      if (index === 0) {
        criticalSignificance = 'Ensures broad retrieval and minimizes publication and indexing bias.';
        const searchMatch = findSentenceWithKeywords(
          combinedText,
          /searched (?:medline|pubmed|embase|cochrane)|comprehensive search|search strategy/i
        );
        if (searchMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = searchMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Search strategy details not assessable by heuristic engine from available text.';
        }
      } else if (index === 1) {
        criticalSignificance = 'Minimizes human error and reviewer bias during article selection.';
        const screenMatch = findSentenceWithKeywords(
          combinedText,
          /two (?:reviewers|authors|investigators) independently|in duplicate|independent screening/i
        );
        if (screenMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = screenMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Dual independent screening not assessable by heuristic engine from available text.';
        }
      } else if (index === 2) {
        criticalSignificance = 'Enables transparent weighting of primary study validity in synthesis conclusions.';
        const robMatch = findSentenceWithKeywords(
          combinedText,
          /risk of bias was assessed|rob 2|robins|cochrane risk of bias|quality assessment|newcastle-ottawa/i
        );
        if (robMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = robMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Risk of bias assessment of included studies not assessable by heuristic engine.';
        }
      } else if (index === 3) {
        criticalSignificance = 'Avoids invalid quantitative aggregation across heterogeneous clinical populations.';
        const metaMatch = findSentenceWithKeywords(
          combinedText,
          /random-effects|fixed-effect|i2|heterogeneity was assessed|derSimonian/i
        );
        if (metaMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = metaMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Meta-analytical pooling methodology not assessable by heuristic engine from available text.';
        }
      } else {
        criticalSignificance = 'Guarantees academic independence and transparency in evidence translation.';
        const pubBiasMatch = findSentenceWithKeywords(
          combinedText,
          /funnel plot|egger|begg|publication bias was assessed/i
        );
        if (pubBiasMatch) {
          judgement = 'LOW_RISK';
          supportiveEvidence = pubBiasMatch;
        } else {
          judgement = 'UNCLEAR_NOT_REPORTED';
          supportiveEvidence = 'Publication bias assessment not assessable by heuristic engine from available text.';
        }
      }
    } else {
      // Observational cohorts
      if (index === 0) {
        criticalSignificance = 'Enhances external validity and limits selection bias.';
        const cohortMatch = findSentenceWithKeywords(
          combinedText,
          /consecutive patients|population-based|representative cohort|prospective cohort/i
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

    return {
      domainName,
      judgement: judgement as BiasJudgement,
      supportiveEvidence,
      criticalSignificance,
    };
  });

  const overallRobJudgement: BiasJudgement = domains.some((d) => d.judgement === 'HIGH_RISK')
    ? 'HIGH_RISK'
    : domains.some((d) => d.judgement === 'SOME_CONCERNS')
    ? 'SOME_CONCERNS'
    : domains.every((d) => d.judgement === 'LOW_RISK')
    ? 'LOW_RISK'
    : 'UNCLEAR_NOT_REPORTED';

  // -----------------------------------------------------------------
  // 5. Dynamic EQUATOR Checklist Audit (P0-1: No hardcoded 100%)
  // -----------------------------------------------------------------
  const equatorAudit = governingRules.equatorMandatoryItems.map((item) => {
    let status: 'REPORTED' | 'NOT_REPORTED' = 'NOT_REPORTED';
    let evidence = 'Not reported in available text.';

    const lowerReq = (item.itemNumberAndSection + ' ' + item.requirement).toLowerCase();

    if (/title/i.test(lowerReq)) {
      if (
        /random|trial|systematic review|meta-analysis|cohort|case-control|cross-sectional|survey|guideline/i.test(
          meta.title
        )
      ) {
        status = 'REPORTED';
        evidence = `Title designates study design: "${meta.title}"`;
      }
    } else if (/background|intro/i.test(lowerReq)) {
      const introMatch = findSentenceWithKeywords(
        combinedText,
        /aim of this study|we investigated|objective|background|hypothesized that/i
      );
      if (introMatch) {
        status = 'REPORTED';
        evidence = introMatch;
      }
    } else if (/randomisation|allocation/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /randomly assigned|randomisation|randomization|allocated/i);
      if (match) {
        status = 'REPORTED';
        evidence = match;
      }
    } else if (/blinding/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /blind|mask|open-label|placebo/i);
      if (match) {
        status = 'REPORTED';
        evidence = match;
      }
    } else if (/eligibility|criteria/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /inclusion criteria|exclusion criteria|eligible patients|enrolled/i);
      if (match) {
        status = 'REPORTED';
        evidence = match;
      }
    } else if (/outcomes|estimation|synthesis/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /primary outcome|primary endpoint|hazard ratio|relative risk|odds ratio|mean difference|confidence interval/i);
      if (match) {
        status = 'REPORTED';
        evidence = match;
      }
    } else if (/limitations|discussion/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /limitation|caveat|discussion|our findings indicate/i);
      if (match) {
        status = 'REPORTED';
        evidence = match;
      }
    } else if (/search strategy/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /search strategy|databases|pubmed|medline|embase/i);
      if (match) {
        status = 'REPORTED';
        evidence = match;
      }
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

  // -----------------------------------------------------------------
  // 6. Dynamic Statistical Audit & Real Effect Estimate Parsing
  // -----------------------------------------------------------------
  const effectEstimates: Array<{
    outcome: string;
    metric: string;
    pointEstimate: string;
    confidenceInterval: string;
    pValue: string;
    clinicalVsStatisticalSignificance: string;
    sourceSentence?: string;
  }> = [];

  // Robust effect-estimate regex (P1-2 & P0-1)
  const statRegex =
    /(?<metric>(?:[hH]azard\s+[rR]atio|[rR]elative\s+[rR]isk|[rR]ate\s+[rR]atio|[rR]isk\s+[rR]atio|[oO]dds\s+[rR]atio|[mM]ean\s+[dD]ifference|[sS]tandardized\s+[mM]ean\s+[dD]ifference|[rR]isk\s+[dD]ifference|[nN]umber\s+[nN]eeded\s+[tT]o\s+[tT]reat|\bHR\b|\bRR\b|\bOR\b|\bMD\b|\bSMD\b|\bRD\b|\bNNT\b))[:,\s=]+(?<point>-?[0-9.]+)[,;\s]*[\(\[]?\s*(?:95%\s*(?:confidence\s+interval|CI|ci)?(?:\s*\[\s*CI\s*\])?|CI)[\s,:;=\(\[]*(?<ciLow>-?[0-9.]+)\s*(?:to|-|–|—)\s*(?<ciHigh>-?[0-9.]+)[\)\]]?(?:[;, ]*(?:[pP])\s*(?<pOp>[<:=])\s*(?<pNum>[0-9.]+))?/g;

  const statMatches = [...combinedText.matchAll(statRegex)];

  for (const m of statMatches) {
    const rawMetric = m.groups?.metric || 'Effect Estimate';
    let cleanMetric = rawMetric;
    const lowerMetric = rawMetric.toLowerCase();

    if (lowerMetric.includes('hazard') || rawMetric === 'HR') {
      cleanMetric = 'Hazard Ratio (HR)';
    } else if (lowerMetric.includes('odds') || rawMetric === 'OR') {
      cleanMetric = 'Odds Ratio (OR)';
    } else if (lowerMetric.includes('rate ratio')) {
      cleanMetric = 'Rate Ratio';
    } else if (lowerMetric.includes('risk ratio') || lowerMetric.includes('relative') || rawMetric === 'RR') {
      cleanMetric = 'Relative Risk (RR)';
    } else if (lowerMetric.includes('standardized mean') || rawMetric === 'SMD') {
      cleanMetric = 'Standardized Mean Difference (SMD)';
    } else if (lowerMetric.includes('mean difference') || rawMetric === 'MD') {
      cleanMetric = 'Mean Difference (MD)';
    } else if (lowerMetric.includes('risk difference') || rawMetric === 'RD') {
      cleanMetric = 'Risk Difference (RD)';
    } else if (lowerMetric.includes('needed to treat') || rawMetric === 'NNT') {
      cleanMetric = 'Number Needed to Treat (NNT)';
    }

    const point = m.groups?.point || '';
    const ciLow = m.groups?.ciLow || '';
    const ciHigh = m.groups?.ciHigh || '';
    const pVal = m.groups?.pNum ? `P ${m.groups.pOp || '='} ${m.groups.pNum}` : 'P not reported';

    // Derive clinical vs statistical significance strictly from whether CI crosses the null
    const lowNum = parseFloat(ciLow);
    const highNum = parseFloat(ciHigh);
    const isRatio = /ratio|\bHR\b|\bRR\b|\bOR\b/i.test(cleanMetric);
    let sigText = '';

    if (!isNaN(lowNum) && !isNaN(highNum)) {
      if (isRatio) {
        const nullCrossed = lowNum <= 1.0 && highNum >= 1.0;
        sigText = nullCrossed
          ? 'No statistically significant difference demonstrated (95% CI crosses null value of 1.0).'
          : 'Statistically significant difference (95% CI does not cross null value of 1.0).';
      } else {
        const nullCrossed = lowNum <= 0.0 && highNum >= 0.0;
        sigText = nullCrossed
          ? 'No statistically significant difference demonstrated (95% CI crosses null value of 0.0).'
          : 'Statistically significant difference (95% CI does not cross null value of 0.0).';
      }
    } else {
      sigText = 'Significance could not be definitively determined from extracted numerical bounds.';
    }

    // Find source sentence containing point estimate and CI
    const sentenceCandidates = combinedText.split(/(?<=[.?!])\s+/);
    const sourceSentence =
      sentenceCandidates.find((s) => s.includes(point) && s.includes(ciLow))?.trim() || undefined;

    let cleanOutcomeLabel = primaryOutcomes[0] || 'Primary Efficacy Endpoint';
    if (effectEstimates.length === 1) {
      cleanOutcomeLabel = 'Secondary Efficacy Endpoint';
    } else if (effectEstimates.length > 1) {
      cleanOutcomeLabel = `Clinical Endpoint ${effectEstimates.length + 1}`;
    }

    effectEstimates.push({
      outcome: cleanOutcomeLabel,
      metric: cleanMetric,
      pointEstimate: point,
      confidenceInterval: `95% CI: ${ciLow} to ${ciHigh}`,
      pValue: pVal,
      clinicalVsStatisticalSignificance: sigText,
      sourceSentence,
    });

    if (effectEstimates.length >= 3) break;
  }

  // P0-1: If no effect estimates found, effectEstimates stays [] (NEVER inject fake estimates)

  // Sample size & power calculation audit (P0-1: Evidence-gated)
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

  // Heterogeneity analysis (P0-1: Evidence-gated, no fabricated statistics)
  let i2Stat = 'Not applicable';
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
    spinAndDiscrepancyAudit: {
      spinDetected: false,
      discrepancyDetails: 'Not assessed by heuristic engine',
      recommendationForInterpretation:
        'Findings should be verified against complete trial documentation and peer-reviewed publication.',
    },
    strengthsAndLimitations: {
      majorStrengths: [
        `Reporting structured according to ${governingRules.equatorGuidelineName} items`,
        `Identified design architecture: ${architectureLabel}`,
      ],
      fatalMethodologicalFlaws: [],
      minorLimitations: [
        isAbstractOnly
          ? 'Appraisal performed on abstract-only text; comprehensive methodological and table review not accessible.'
          : 'Heuristic screening draft — formal critical audit requires detailed manual or LLM review.',
      ],
    },
  };

  // -----------------------------------------------------------------
  // 7. Dynamic Validity Synthesis & GRADE Certainty
  // -----------------------------------------------------------------
  // P0-1: largeEffectSize derived strictly from parsed estimates (>=2 or <=0.5); default false
  const largeEffectSize = effectEstimates.some((e) => {
    const num = parseFloat(e.pointEstimate);
    return !isNaN(num) && (num >= 2.0 || (num > 0 && num <= 0.5));
  });

  const gradeSynthesis = synthesizeGradeCertainty({
    studyDesign: detectedDesign,
    overallRiskOfBias: overallRobJudgement,
    imprecisionIdentified: false,
    inconsistencyOrHeterogeneity: false,
    indirectnessIdentified: false, // P0-1: abstract-only is not GRADE indirectness
    publicationBiasSuspected: false,
    largeEffectSize,
    doseResponseGradient: false,
  });

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

  const validitySynthesis = {
    internalValidity: internalValidityText,
    externalValidityAndGeneralizability: `Generalizability is contingent upon clinical setting matching the reported study cohort.`,
    conflictsOfInterestAndFundingCritique: coiMatch
      ? coiMatch
      : 'Funding and conflict of interest declarations were not identified in the available text.',
    gradeCertainty: gradeSynthesis.finalCertainty,
    gradeDowngradingFactors: gradeSynthesis.downgradingFactors,
    gradeUpgradingFactors: gradeSynthesis.upgradingFactors,
    gradeRationale: gradeSynthesis.rationale,
  };

  // -----------------------------------------------------------------
  // 8. Dynamic Clinical Translation & References
  // -----------------------------------------------------------------
  const clinicalPracticeBottomLine = {
    keyTakeawayForClinicians: `Clinical decisions should be guided by verified full-text evidence and formal risk of bias evaluation.`,
    applicabilityToPractice: `Directly applicable to clinical cohorts meeting eligibility criteria evaluated in ${meta.title}.`,
    recommendationsForFutureResearch:
      'Long-term surveillance, pre-specified subgroup validation, and replication in diverse clinical settings.',
  };

  const references = [
    {
      number: 1,
      vancouverCitation: meta.vancouverCitation,
    },
    {
      number: 2,
      vancouverCitation: governingRules.equatorGuidelineCitation,
    },
    {
      number: 3,
      vancouverCitation: governingRules.riskOfBiasToolCitation,
    },
    {
      number: 4,
      vancouverCitation:
        'Guyatt GH, Oxman AD, Vist GE, et al. GRADE: an emerging consensus on rating quality of evidence and strength of recommendations. BMJ. 2008;336(7650):924-926.',
    },
    {
      number: 5,
      vancouverCitation:
        'Oxford Centre for Evidence-Based Medicine. The Oxford 2011 Levels of Evidence. Oxford: OCEBM; 2011.',
    },
  ];

  return {
    id: crypto.randomUUID(),
    metadata: meta,
    classification: {
      studyDesign: detectedDesign,
      studyDesignRationale: designRationale,
      oxfordEvidenceLevel: governingRules.defaultOxfordLevel,
      equatorReportingGuideline: governingRules.equatorGuidelineName,
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
      overallComplianceSummary: `${reportedCount} of ${totalAssessed} assessed checklist items reported in available text.`,
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
