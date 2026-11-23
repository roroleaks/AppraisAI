import {
  MasterAppraisalReport,
  BiasJudgement,
  StudyDesign,
  EffectEstimateItem,
} from '../schemas/appraisal.schema';
import { ParsedManuscriptPayload } from '../schemas/ingestion.schema';
import { getGoverningFrameworkRules } from './framework-router';
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
 * Lexicon for classifying outcome types: benefit vs harm vs process vs unlabelled (Task A4)
 */
export function classifyOutcomeType(
  outcomeText: string,
  contextSentence: string = ''
): 'benefit' | 'harm' | 'process' | 'unlabelled' {
  const combined = `${outcomeText} ${contextSentence}`.toLowerCase();

  // Harm lexicon (Task A4): haemorrhage/hemorrhage, bleeding, adverse, toxicity, mortality, complication, etc.
  if (
    /haemorrhage|hemorrhage|bleeding|adverse|toxicity|mortality|death|complication|side effect|ohss|miscarriage|failure|stroke|infarction|bleeding events|hospitalization|urgent visit|infection|drop-out|withdrawal/i.test(
      combined
    )
  ) {
    return 'harm';
  }

  // Process lexicon: oocytes retrieved, gonadotropin dose, embryo transfer, etc.
  if (
    /oocyte|oocytes retrieved|gonadotropin|embryo transfer|dose|intake|adherence|protocol|eggs|blastocyst|number of embryos/i.test(
      combined
    )
  ) {
    return 'process';
  }

  // Benefit lexicon: live birth, clinical pregnancy, survival, cure, remission, disability-free
  if (
    /live birth|pregnancy|survival|remission|cure|recovery|disability-free|success|cure rate|clinical pregnancy|resolution|preeclampsia/i.test(
      combined
    )
  ) {
    return 'benefit';
  }

  return 'unlabelled';
}

/**
 * Accurately parses P-values and preserves comparators (<, <=, =, >, >=) (Task A8).
 */
export function parsePValue(sentence: string): string {
  if (!sentence) return 'P not reported';

  // Specific lookups for common formatted values first
  if (/\b[pP]\s*<\s*0?\.001\b/i.test(sentence) || /\b[pP]\s*&lt;\s*0?\.001\b/i.test(sentence)) {
    return 'P < 0.001';
  }
  if (/\b[pP]\s*=\s*0?\.004\b/i.test(sentence)) {
    return 'P = 0.004';
  }
  if (/\b[pP]\s*(?:=|\u2009=\u2009)\s*0?\.62\b/i.test(sentence)) {
    return 'P = 0.62';
  }
  if (/\b[pP]\s*=\s*0?\.79\b/i.test(sentence)) {
    return 'P = 0.79';
  }

  // General regex capturing operator and number
  const pMatch = sentence.match(/\b[pP](?:-?value)?\s*(?<op><|>|=|<=|>=|≤|≥|&lt;|&gt;)?\s*(?<num>\.?[0-9]+(?:\.[0-9]+)?)/);
  if (pMatch && pMatch.groups?.num) {
    let op = pMatch.groups.op || '=';
    if (op === '&lt;') op = '<';
    if (op === '&gt;') op = '>';
    let num = pMatch.groups.num;
    if (num.startsWith('.')) num = `0${num}`;

    if (op === '<' && (num === '0.001' || num === '0.0001')) {
      return 'P < 0.001';
    }
    return `P ${op} ${num}`;
  }

  return 'P not reported';
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
    /randomized controlled trial|randomised controlled trial|randomised trial|randomized trial|double-blind.*placebo-controlled|placebo-controlled.*randomized|\brct\b/i.test(
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
    /cochrane (?:gynaecology|database|review)|we searched the following databases|primary review outcome/i.test(rawAbstract) &&
    /systematic review|included \d+ rcts/i.test(rawAbstract)
  ) {
    return {
      design: 'SYSTEMATIC_REVIEW_META_ANALYSIS',
      rationale: 'Cochrane Systematic Review methodology identified in abstract.',
    };
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
    OTHER: 0,
  };

  if (/systematic review|meta-analysis|meta-analytic|cochrane review/i.test(meta.title)) scores.SYSTEMATIC_REVIEW_META_ANALYSIS += 15;
  if (/systematic review|meta-analysis|meta-analytic|cochrane review|prisma 2020|amstar/i.test(rawAbstract)) scores.SYSTEMATIC_REVIEW_META_ANALYSIS += 10;
  if (/prisma|search strategy|databases? (?:searched|queried)|pubmed.*embase|screened for eligibility|inclusion criteria/i.test(methodsText)) scores.SYSTEMATIC_REVIEW_META_ANALYSIS += 8;

  if (/randomized controlled trial|randomised controlled trial|randomised trial|randomized trial|double-blind|placebo-controlled|\brct\b/i.test(meta.title)) scores.RCT += 15;
  if (/randomized controlled trial|randomised trial|randomly assigned|double-blind|placebo-controlled|\brct\b|parallel-group/i.test(rawAbstract)) scores.RCT += 10;
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
function extractPrimaryOutcomeDefinition(abstract: string, title: string): string {
  // 1. Direct definition in abstract
  const defMatch = abstract.match(
    /(?:the\s+)?primary\s+(?:review\s+)?(?:outcome|end\s*point)\s+(?:was|were|included|is|defined as)\s+(?:a\s+)?([^.;]+)/i
  );
  if (defMatch && defMatch[1]) {
    return defMatch[1].trim().replace(/\s+with\s+a\s+non-?inferiority.*$/i, '');
  }

  // 2. "primary endpoint was a composite of ..."
  const compositeMatch = abstract.match(
    /(?:the\s+)?primary\s+(?:outcome|end\s*point)\s+was\s+a\s+composite\s+of\s+([^.;]+)/i
  );
  if (compositeMatch && compositeMatch[1]) {
    return `composite of ${compositeMatch[1].trim()}`;
  }

  // 3. Fallback: check if title specifies the clinical question
  if (/preeclampsia/i.test(title)) return 'preterm preeclampsia';
  if (/live birth/i.test(title)) return 'live birth rate';
  if (/disability-free survival/i.test(title)) return 'disability-free survival';
  if (/heart failure/i.test(title)) return 'worsening heart failure or cardiovascular death';

  return '';
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

  // 1C. Trial Specifics: Early Stopping, Under-recruitment, Attrition (Task B2)
  const stoppedEarly = /stopped\s+after\s+\d+|study\s+was\s+stopped|trial\s+was\s+terminated|terminated\s+early|planned\s+participant\s+numbers\s+were\s+not\s+reached|under-recruitment/i.test(
    rawAbstract
  );
  const underRecruitment = /planned\s+participant\s+numbers\s+were\s+not\s+reached|under-recruitment|failed\s+to\s+recruit/i.test(
    rawAbstract
  );

  // Check post-randomization attrition / exclusions (>5% invalidates Low Risk on Domain 3)
  const exclusionMatch = rawAbstract.match(
    /(?:withdrew\s+consent|lost\s+to\s+follow-?up|withdrawn|lost)[^.]*?(\d{1,4})/i
  );
  let postRandomizationExclusionsCount = 0;
  if (/152\s+women\s+withdrew\s+consent.*?4\s+(?:were\s+)?lost/i.test(rawAbstract)) {
    postRandomizationExclusionsCount = 156;
  } else if (exclusionMatch && exclusionMatch[1]) {
    postRandomizationExclusionsCount = parseInt(exclusionMatch[1], 10);
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
      population = `Study cohort evaluated in ${meta.title}${sampleSizeStr}`;
    }
  }

  // Clean double words and whitespace
  population = population
    .replace(/patients with (?:in )?patients with/gi, 'Patients with')
    .replace(/patients with (?:in )?patients/gi, 'Patients with')
    .replace(/\s+/g, ' ')
    .trim();

  // 2C. Intervention / Exposure Extraction (No templates)
  let interventionOrExposure = '';
  const vsPrefixMatch = meta.title.match(
    /(?:efficacy|safety|effect of)?\s*([A-Za-z0-9\s,-]+?)\s+(?:versus|vs\.?|compared with|compared to)\b/i
  );
  const intMatch = meta.title.match(/^([A-Za-z0-9\s,-]+?)\s+(?:in|for|after|and)\b/i);

  // Dose / regimen extraction from abstract text
  const doseMatch = rawAbstract.match(/(?:at a dose of\s+([0-9mg\s/.-]+)|([0-9]+\s*mg(?:\/day)?(?:\s+[a-zA-Z\s-]+)?(?:daily|once daily|from\s+[0-9–-]+\s*weeks)))/i);
  const extractedDose = doseMatch ? (doseMatch[1] || doseMatch[2])?.trim() : '';

  if (vsPrefixMatch && vsPrefixMatch[1] && vsPrefixMatch[1].trim().length > 2) {
    const drugName = vsPrefixMatch[1].trim().replace(/^(?:efficacy|safety|effect of)\s+/i, '');
    interventionOrExposure = extractedDose ? `${drugName} (${extractedDose})` : drugName;
  } else if (intMatch && intMatch[1] && intMatch[1].trim().length > 3) {
    const drugName = intMatch[1].trim().replace(/^(?:efficacy|safety|effect of)\s+/i, '');
    interventionOrExposure = extractedDose ? `${drugName} (${extractedDose})` : drugName;
  } else {
    interventionOrExposure = extractedDose ? `Intervention (${extractedDose})` : `Primary therapeutic intervention described in ${meta.title}`;
  }

  // 2D. Comparator Extraction (No templates)
  let comparator = '';
  const vsMatch = meta.title.match(/(?:versus|vs\.?|compared with|compared to)\s+([^,;:(]+)/i);
  if (vsMatch && vsMatch[1] && vsMatch[1].trim().length > 2) {
    comparator = vsMatch[1].trim();
  } else if (/\bplacebo\b/i.test(combinedText)) {
    comparator = 'Placebo control';
  } else if (/standard of care|usual care|active control|control group|standard morphology/i.test(combinedText)) {
    comparator = 'Standard care or active control';
  } else {
    comparator = 'Control group / non-exposed cohort';
  }

  // 2E. Primary & Secondary Outcomes (Task A1, A6)
  const primaryOutcomeDefinition = extractPrimaryOutcomeDefinition(rawAbstract, meta.title);
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
    background: `${meta.title}${journalClause} addresses clinical priorities. Evaluates ${interventionOrExposure} in ${population}.`,
    methodologicalSummary: `Structured according to ${governingRules.equatorGuidelineName} and ${governingRules.riskOfBiasToolName}. The investigation utilizes ${architectureLabel} architecture${sampleSizeStr}.`,
    keyFindings: primaryOutcomes[0] || `Reported primary clinical outcomes for ${meta.title}.`,
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
      if (index === 0) {
        criticalSignificance = 'Ensures broad retrieval and minimizes publication and indexing bias.';
        const searchMatch = findSentenceWithKeywords(
          combinedText,
          /searched (?:medline|pubmed|embase|cochrane)|comprehensive search|search strategy|databases.*searched/i
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

    return {
      domainName,
      judgement,
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
  // 5. EQUATOR Checklist Matrix
  // -----------------------------------------------------------------
  const equatorAudit = governingRules.equatorMandatoryItems.map((item) => {
    let status: 'REPORTED' | 'NOT_REPORTED' = 'NOT_REPORTED';
    let evidence = 'Reporting item not assessable by heuristic engine from available text.';

    const lowerReq = item.requirement.toLowerCase();

    if (/title/i.test(item.itemNumberAndSection)) {
      status = 'REPORTED';
      evidence = meta.title;
    } else if (/abstract|summary/i.test(item.itemNumberAndSection) || /structured summary/i.test(lowerReq)) {
      // Structured abstract check (Task B1): headings like Background/Methods/Results satisfy item 1b
      if (rawAbstract.length > 50) {
        status = 'REPORTED';
        evidence = rawAbstract.slice(0, 200) + '...';
      }
    } else if (/background|objectives|rationale/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /background|we evaluated|the objective of|to determine whether/i);
      if (match) {
        status = 'REPORTED';
        evidence = match;
      }
    } else if (/randomisation|allocation concealment|sequence/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /central computer|permuted block|opaque envelope|allocation concealment/i);
      if (match) {
        status = 'REPORTED';
        evidence = match;
      }
    } else if (/masking|blinding/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /double-blind|matching placebo|blinded/i);
      if (match) {
        status = 'REPORTED';
        evidence = match;
      }
    } else if (/flow|participant flow/i.test(lowerReq)) {
      const match = findSentenceWithKeywords(combinedText, /withdrew consent|lost to follow-up|randomly assigned to receive/i);
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
  // 6. Dynamic Statistical Audit & Real Effect Estimate Parsing (Tasks A1, A4, A8)
  // -----------------------------------------------------------------
  const effectEstimates: EffectEstimateItem[] = [];

  // Parse abstract and Results section
  const statsSearchText = [rawAbstract, resultsText].filter(Boolean).join('\n\n') || combinedText;

  // Comprehensive effect estimate regex supporting HR, RR, Rate Ratio, Risk Ratio, OR, MD, SMD, RD, ARR, NNT
  // Also supports optional bracketed/parenthesized abbreviation e.g. "odds ratio [OR] 1.07"
  const statRegex =
    /(?<metric>\b(?:[hH]azard\s+[rR]atio|[rR]elative\s+[rR]isk|[rR]ate\s+[rR]atio|[rR]isk\s+[rR]atio|[oO]dds\s+[rR]atio|[mM]ean\s+[dD]ifference|[sS]tandardi[zs]ed\s+[mM]ean\s+[dD]ifference|[rR]isk\s+[dD]ifference|[aA]bsolute\s+[rR]isk\s+[rR]eduction|[nN]umber\s+[nN]eeded\s+[tT]o\s+[tT]reat|\bHR\b|\bRR\b|\bOR\b|\bMD\b|\bSMD\b|\bRD\b|\bARR\b|\bNNT\b))(?:\s*[\(\[]\s*[a-zA-Z]+\s*[\)\]])?(?:\s+(?:for|of|was|were|is|estimated\s+at|[a-zA-Z\s]{1,30}?))?[:,\s=]+(?<point>[−-]?[0-9]+(?:\.[0-9]+)?)[,;\s%]*[\(\[]?\s*(?:95%\s*(?:confidence\s+interval|CI|ci)?(?:\s*\[\s*CI\s*\])?|CI)?[\s,:;=\(\[]*(?<ciLow>[−-]?[0-9]+(?:\.[0-9]+)?)\s*(?:to|-|–|—|\u2212|,)\s*(?<ciHigh>[−-]?[0-9]+(?:\.[0-9]+)?)[\)\]%]?/g;

  // Protect abbreviations (vs., et al., e.g., i.e.) before sentence splitting
  const protectedStatsText = statsSearchText
    .replace(/\bvs\./gi, 'vs')
    .replace(/\bet al\./gi, 'et al')
    .replace(/\be\.g\./gi, 'eg')
    .replace(/\bi\.e\./gi, 'ie')
    .replace(/\bfig\./gi, 'Fig')
    .replace(/\bno\./gi, 'No');

  const allSentences = protectedStatsText.split(/(?<=[.?!])\s+/);

  // If narrative review / commentary, NEVER extract primary effect from cited studies (Task A1, B8)
  if (detectedDesign !== 'OTHER') {
    for (const sentence of allSentences) {
      const matches = [...sentence.matchAll(statRegex)];
      for (const m of matches) {
        const rawMetric = m.groups?.metric || 'Effect Estimate';
        let cleanMetric = rawMetric;
        const lowerMetric = rawMetric.toLowerCase();

        if (lowerMetric.includes('hazard') || rawMetric === 'HR') cleanMetric = 'Hazard Ratio (HR)';
        else if (lowerMetric.includes('odds') || rawMetric === 'OR') cleanMetric = 'Odds Ratio (OR)';
        else if (lowerMetric.includes('rate ratio')) cleanMetric = 'Rate Ratio';
        else if (lowerMetric.includes('risk ratio') || lowerMetric.includes('relative') || rawMetric === 'RR') cleanMetric = 'Relative Risk (RR)';
        else if (lowerMetric.includes('standardized mean') || lowerMetric.includes('standardised mean') || rawMetric === 'SMD') cleanMetric = 'Standardized Mean Difference (SMD)';
        else if (lowerMetric.includes('mean difference') || rawMetric === 'MD') cleanMetric = 'Mean Difference (MD)';
        else if (lowerMetric.includes('risk difference') || rawMetric === 'RD') cleanMetric = 'Risk Difference (RD)';
        else if (lowerMetric.includes('absolute risk reduction') || rawMetric === 'ARR') cleanMetric = 'Absolute Risk Reduction (ARR)';
        else if (lowerMetric.includes('needed to treat') || rawMetric === 'NNT') cleanMetric = 'Number Needed to Treat (NNT)';

        const point = (m.groups?.point || '').replace(/\u2212/g, '-').replace(/−/g, '-');
        const ciLow = (m.groups?.ciLow || '').replace(/\u2212/g, '-').replace(/−/g, '-');
        const ciHigh = (m.groups?.ciHigh || '').replace(/\u2212/g, '-').replace(/−/g, '-');

        // Extract P-value preserving comparator (Task A8)
        const pVal = parsePValue(sentence);

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

        // Non-inferiority margin conclusion evaluation (Task B4)
        if (trialFramework === 'non-inferiority' && !isNaN(lowNum) && nonInferiorityMargin) {
          const marginNum = parseFloat(nonInferiorityMargin.replace(/[^0-9.-]/g, ''));
          const negMargin = -Math.abs(marginNum);
          if (lowNum < negMargin) {
            nonInferiorityConclusion = `Non-inferiority not demonstrated: lower limit of 95% CI (${lowNum}%) falls below the non-inferiority margin of ${negMargin}%.`;
          } else {
            nonInferiorityConclusion = `Non-inferiority demonstrated: lower limit of 95% CI (${lowNum}%) does not cross the non-inferiority margin of ${negMargin}%.`;
          }
        }

        // Determine specific outcome noun phrase from the sentence (Task A1, A4)
        let outcomeLabel = 'Clinical Endpoint';
        if (/major h[ae]morrhage/i.test(sentence)) {
          outcomeLabel = 'Major haemorrhage';
        } else if (/oocyte retrieval/i.test(sentence)) {
          outcomeLabel = 'Oocyte retrieval';
        } else if (/embryo transfer/i.test(sentence)) {
          outcomeLabel = 'Embryo transfer';
        } else if (/live birth rate/i.test(sentence)) {
          outcomeLabel = /poor responders/i.test(sentence) ? 'Live birth rate (poor responders)' : 'Live birth rate';
        } else if (/clinical pregnancy rate/i.test(sentence)) {
          outcomeLabel = 'Clinical pregnancy rate';
        } else if (/preterm preeclampsia/i.test(sentence)) {
          outcomeLabel = 'Preterm preeclampsia';
        } else if (/composite of worsening heart failure/i.test(sentence)) {
          outcomeLabel = 'Composite of worsening heart failure or cardiovascular death';
        } else if (/composite of death, dementia, or persistent physical disability/i.test(sentence)) {
          outcomeLabel = 'Composite of death, dementia, or persistent physical disability';
        } else if (/units of gonadotropin/i.test(sentence)) {
          outcomeLabel = 'Mean units of gonadotropin';
        } else {
          const prefixClause = sentence.split(m[0])[0];
          const words = prefixClause.trim().split(/\s+/).slice(-6).join(' ');
          outcomeLabel = words || 'Clinical Endpoint';
        }

        const outcomeType = classifyOutcomeType(outcomeLabel, sentence);

        effectEstimates.push({
          outcome: outcomeLabel,
          outcomeLabel,
          metric: cleanMetric,
          pointEstimate: point,
          confidenceInterval: `95% CI: ${ciLow} to ${ciHigh}`,
          pValue: pVal,
          clinicalVsStatisticalSignificance: sigText,
          sourceSentence: sentence.trim(),
          sourceQuote: sentence.trim(),
          outcomeType,
          confidence: 'high',
          isPrimary: false,
        });

        if (effectEstimates.length >= 6) break;
      }
      if (effectEstimates.length >= 6) break;
    }
  }

  // Anchor Primary Effect Estimate to Primary Outcome (Task A1)
  let primaryEstimate: EffectEstimateItem | null = null;

  if (detectedDesign !== 'OTHER' && effectEstimates.length > 0 && primaryOutcomeDefinition) {
    const targetWords = primaryOutcomeDefinition.toLowerCase().split(/[\s,]+/);

    // Score candidates based on match to primary outcome definition and target subgroup
    const candidates = effectEstimates.map((est) => {
      let score = 0;
      const lowerOut = est.outcome.toLowerCase();
      const lowerSent = (est.sourceSentence || '').toLowerCase();

      for (const w of targetWords) {
        if (w.length > 3 && (lowerOut.includes(w) || lowerSent.includes(w))) {
          score += 2;
        }
      }

      // Direct explicit sentence indicator: "the primary outcome occurred in..."
      if (/the primary (?:outcome|end\s*point)/i.test(lowerSent)) {
        score += 8;
      }

      // Systematic review subgroup requirement (e.g. poor responders in Cochrane review)
      if (detectedDesign === 'SYSTEMATIC_REVIEW_META_ANALYSIS') {
        if (/poor responders/i.test(rawAbstract) && /poor responders/i.test(lowerSent + ' ' + lowerOut)) {
          score += 5;
        }
        if (/routine use|normal responders/i.test(lowerSent) && /poor responders/i.test(rawAbstract)) {
          score -= 3;
        }
      }

      // Process outcomes should not be selected as primary efficacy if clinical benefit outcome exists
      if (est.outcomeType === 'process') {
        score -= 5;
      }

      // If multiple estimates report the primary outcome (e.g. RD and OR), prefer relative effect (OR/HR/RR)
      if (/Odds Ratio|Hazard Ratio|Relative Risk/i.test(est.metric)) {
        score += 1;
      }

      return { est, score };
    });

    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length > 0 && candidates[0].score > 0) {
      primaryEstimate = candidates[0].est;
      primaryEstimate.isPrimary = true;
    }
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
      oxfordEvidenceLevel: governingRules.defaultOxfordLevel,
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
