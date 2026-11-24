import {
  StudyDesign,
  OxfordEvidenceLevel,
  RiskOfBiasMatrix,
  EquatorComplianceMatrix,
} from '../schemas/appraisal.schema';

export interface GoverningFrameworkRules {
  studyDesign: StudyDesign;
  equatorGuidelineName: string;
  equatorGuidelineCitation: string;
  riskOfBiasToolName: string;
  riskOfBiasToolCitation: string;
  defaultOxfordLevel: OxfordEvidenceLevel;
  robMandatoryDomains: Array<{
    domainName: string;
    description: string;
  }>;
  equatorMandatoryItems: Array<{
    itemNumberAndSection: string;
    requirement: string;
  }>;
}

export function getGoverningFrameworkRules(design: StudyDesign): GoverningFrameworkRules {
  switch (design) {
    case 'RCT':
      return {
        studyDesign: 'RCT',
        equatorGuidelineName: 'CONSORT 2025',
        equatorGuidelineCitation:
          'Hopewell S, Chan AW, Collins GS, et al. CONSORT 2025 statement: updated guideline for reporting randomised trials. BMJ. 2025;389:e081123. doi:10.1136/bmj-2024-081123',
        riskOfBiasToolName: 'Cochrane Risk of Bias 2.0 (RoB 2)',
        riskOfBiasToolCitation:
          'Sterne JAC, Savović J, Page MJ, et al. RoB 2: a revised tool for assessing risk of bias in randomised trials. BMJ. 2019;366:l4898. doi:10.1136/bmj.l4898',
        defaultOxfordLevel: 'Level 1b',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Bias arising from the randomisation process', description: 'Generation of random sequence and allocation concealment' },
          { domainName: 'Domain 2: Deviations from intended interventions (effect of assignment)', description: 'Deviations from intended interventions reflecting effect of assignment' },
          { domainName: 'Domain 3: Bias due to missing outcome data', description: 'Completeness of follow-up and intention-to-treat analysis' },
          { domainName: 'Domain 4: Bias in measurement of the outcome', description: 'Blinding of outcome assessors and validity of measurement instruments' },
          { domainName: 'Domain 5: Bias in selection of the reported result', description: 'Adherence to pre-specified analysis plan or trial registry' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1a: Title', requirement: 'Identification as a randomised trial in the title' },
          { itemNumberAndSection: 'Item 1b: Structured abstract', requirement: 'Structured summary of trial design, methods, results, and conclusions' },
          { itemNumberAndSection: 'Item 2: Trial registration', requirement: 'Trial registration name and unique registry identifier' },
          { itemNumberAndSection: 'Item 3: Protocol & SAP', requirement: 'Where the full trial protocol and statistical analysis plan can be accessed' },
          { itemNumberAndSection: 'Item 5a-b: Funding & COI', requirement: 'Sources of trial funding, role of funders, and competing interests of authors' },
          { itemNumberAndSection: 'Item 6: Background', requirement: 'Scientific background and explanation of clinical rationale' },
          { itemNumberAndSection: 'Item 7: Objectives', requirement: 'Specific objectives or hypotheses addressed by the trial' },
          { itemNumberAndSection: 'Item 16a: Sample size', requirement: 'How sample size was determined and power calculation parameters' },
          { itemNumberAndSection: 'Item 17a: Sequence generation', requirement: 'Method used to generate the random allocation sequence' },
          { itemNumberAndSection: 'Item 18: Allocation concealment', requirement: 'Mechanism to implement random allocation (e.g. central randomisation, sealed envelopes)' },
          { itemNumberAndSection: 'Item 20a: Blinding / Masking', requirement: 'Blinding of participants, healthcare providers, and outcome assessors' },
          { itemNumberAndSection: 'Item 22a: Participant flow', requirement: 'Participant flow through enrollment, allocation, follow-up, and analysis' },
          { itemNumberAndSection: 'Item 24: Outcomes & Estimation', requirement: 'Primary and secondary outcome estimates with precision (e.g. 95% CI)' },
          { itemNumberAndSection: 'Item 30: Limitations', requirement: 'Trial limitations addressing potential bias, imprecision, and multiplicity' },
        ],
      };

    case 'SYSTEMATIC_REVIEW_META_ANALYSIS':
      return {
        studyDesign: 'SYSTEMATIC_REVIEW_META_ANALYSIS',
        equatorGuidelineName: 'PRISMA 2020',
        equatorGuidelineCitation:
          'Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ. 2021;372:n71. doi:10.1136/bmj.n71',
        riskOfBiasToolName: 'AMSTAR 2',
        riskOfBiasToolCitation:
          'Shea BJ, Reeves BC, Wells G, et al. AMSTAR 2: a critical appraisal tool for systematic reviews that include randomised or non-randomised studies of healthcare interventions. BMJ. 2017;358:j4008. doi:10.1136/bmj.j4008',
        defaultOxfordLevel: 'Level 1a',
        robMandatoryDomains: [
          { domainName: 'Critical Domain 2: Protocol Registration', description: 'A priori protocol established prior to review conduct (PROSPERO)' },
          { domainName: 'Critical Domain 4: Comprehensive Search Strategy', description: 'Comprehensive search of >=2 databases, grey literature, and trial registries' },
          { domainName: 'Critical Domain 7: Justification of Excluded Studies', description: 'List of excluded potentially eligible studies with explicit rationale' },
          { domainName: 'Critical Domain 9: Risk of Bias Assessment', description: 'Use of formal validated RoB instruments (RoB 2, ROBINS-I)' },
          { domainName: 'Critical Domain 11: Statistical Pooling Methods', description: 'Appropriate quantitative meta-analytical models and heterogeneity handling' },
          { domainName: 'Critical Domain 13: RoB Consideration in Interpretation', description: 'Impact of primary study risk of bias on pooled conclusions' },
          { domainName: 'Critical Domain 15: Publication Bias Assessment', description: 'Investigation and discussion of small-study effects and funnel plot asymmetry' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Title', requirement: 'Identify the report as a systematic review/meta-analysis' },
          { itemNumberAndSection: 'Item 5: Eligibility Criteria', requirement: 'Pre-specified inclusion and exclusion criteria' },
          { itemNumberAndSection: 'Item 7: Search Strategy', requirement: 'Full search strategy for at least one database' },
          { itemNumberAndSection: 'Item 11: Study Risk of Bias Assessment', requirement: 'Methods used to assess risk of bias in included studies' },
          { itemNumberAndSection: 'Item 13a-f: Synthesis Methods', requirement: 'Statistical methods to pool and assess heterogeneity' },
          { itemNumberAndSection: 'Item 23a-d: Discussion', requirement: 'Limitations of evidence included and review processes' },
        ],
      };

    case 'COHORT_STUDY':
      return {
        studyDesign: 'COHORT_STUDY',
        equatorGuidelineName: 'STROBE (Cohort Studies)',
        equatorGuidelineCitation:
          'von Elm E, Altman DG, Egger M, et al. The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) Statement. Lancet. 2007;370(9596):1453-1457. doi:10.1016/S0140-6736(07)61602-X',
        riskOfBiasToolName: 'ROBINS-I / Newcastle-Ottawa Scale (NOS)',
        riskOfBiasToolCitation:
          'Sterne JA, Hernán MA, Reeves BC, et al. ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions. BMJ. 2016;355:i4919. doi:10.1136/bmj.i4919',
        defaultOxfordLevel: 'Level 2b',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Bias due to confounding', description: 'Adjustment for key prognostic factors via multivariable regression or propensity matching' },
          { domainName: 'Domain 2: Selection of participants into the study', description: 'Selection bias and ascertainment of exposed vs unexposed cohorts' },
          { domainName: 'Domain 3: Classification of interventions / exposures', description: 'Objective ascertainment of exposure status and validation against records' },
          { domainName: 'Domain 4: Deviations from intended interventions', description: 'Protocol adherence and co-intervention balance during follow-up' },
          { domainName: 'Domain 5: Missing data & attrition', description: 'Completeness of follow-up (<20% attrition) and handling of missing variables' },
          { domainName: 'Domain 6: Measurement of outcomes', description: 'Objective or blinded outcome ascertainment independent of exposure' },
          { domainName: 'Domain 7: Selection of the reported result', description: 'Pre-specified analytical plan and multiple outcome testing' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Title & Abstract', requirement: 'State study design with commonly used terms' },
          { itemNumberAndSection: 'Item 6: Participants', requirement: 'Eligibility criteria and sources/methods of selection' },
          { itemNumberAndSection: 'Item 12: Statistical Methods', requirement: 'Describe all statistical methods, including those used to control for confounding' },
          { itemNumberAndSection: 'Item 14: Descriptive Data', requirement: 'Characteristics of study participants and missing data details' },
          { itemNumberAndSection: 'Item 16: Main Results', requirement: 'Unadjusted and confounder-adjusted estimates and 95% confidence intervals' },
        ],
      };

    case 'CASE_CONTROL_STUDY':
      return {
        studyDesign: 'CASE_CONTROL_STUDY',
        equatorGuidelineName: 'STROBE (Case-Control Studies)',
        equatorGuidelineCitation:
          'von Elm E, Altman DG, Egger M, et al. The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) Statement. Lancet. 2007;370(9596):1453-1457. doi:10.1016/S0140-6736(07)61602-X',
        riskOfBiasToolName: 'Newcastle-Ottawa Scale (NOS) for Case-Control Studies',
        riskOfBiasToolCitation:
          'Wells GA, Shea B, O’Connell D, et al. The Newcastle-Ottawa Scale (NOS) for assessing the quality of nonrandomised studies in meta-analyses. Ottawa: OHRI; 2021. URL: https://www.ohri.ca/programs/clinical_epidemiology/oxford.asp',
        defaultOxfordLevel: 'Level 3b',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Case Definition & Selection', description: 'Validation of disease state against independent diagnostic criteria' },
          { domainName: 'Domain 2: Representativeness & Control Selection', description: 'Controls derived from same source population as cases' },
          { domainName: 'Domain 3: Comparability of Cases and Controls', description: 'Design or analysis matching for core demographic/prognostic confounders' },
          { domainName: 'Domain 4: Ascertainment of Exposure', description: 'Blinded structured interview or verified medical record extraction' },
          { domainName: 'Domain 5: Non-Response Rate', description: 'Comparable non-response rates between case and control series' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Title & Abstract', requirement: 'Identify as a case-control investigation in title or abstract' },
          { itemNumberAndSection: 'Item 6: Selection Criteria', requirement: 'Eligibility criteria, sources, and matching ratios' },
          { itemNumberAndSection: 'Item 12: Statistical Adjustment', requirement: 'Methods to adjust for confounding in odds ratio calculations' },
          { itemNumberAndSection: 'Item 16: Odds Ratio Estimates', requirement: 'Point estimates and 95% confidence intervals for exposure associations' },
        ],
      };

    case 'CROSS_SECTIONAL':
      return {
        studyDesign: 'CROSS_SECTIONAL',
        equatorGuidelineName: 'STROBE (Cross-Sectional Studies)',
        equatorGuidelineCitation:
          'von Elm E, Altman DG, Egger M, et al. The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) Statement. Lancet. 2007;370(9596):1453-1457. doi:10.1016/S0140-6736(07)61602-X',
        riskOfBiasToolName: 'JBI Critical Appraisal Checklist for Analytical Cross-Sectional Studies',
        riskOfBiasToolCitation:
          'Moola S, Munn Z, Tufanaru C, et al. Systematic reviews of etiology and risk. In: Aromataris E, Munn Z, eds. JBI Manual for Evidence Synthesis. JBI; 2020. doi:10.46658/JBIMES-20-01',
        defaultOxfordLevel: 'Level 4',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Inclusion Criteria Clarity', description: 'Clearly defined clinical inclusion and exclusion parameters' },
          { domainName: 'Domain 2: Study Subject & Setting Detail', description: 'Adequate characterization of sample demographics and clinical setting' },
          { domainName: 'Domain 3: Valid Exposure Measurement', description: 'Valid and reliable measurement of exposure/predictor variables' },
          { domainName: 'Domain 4: Objective Outcome Criteria', description: 'Standardized and objective measurement of clinical condition' },
          { domainName: 'Domain 5: Confounder Identification & Adjustment', description: 'Identification of confounding factors and multivariable statistical control' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Title & Abstract', requirement: 'State study design with commonly used terms' },
          { itemNumberAndSection: 'Item 6: Participants', requirement: 'Eligibility criteria and sources of participants' },
          { itemNumberAndSection: 'Item 12: Statistical Methods', requirement: 'Describe statistical methods including handling of confounding' },
          { itemNumberAndSection: 'Item 16: Prevalence Estimates', requirement: 'Main results with precision (e.g. 95% confidence intervals)' },
        ],
      };

    case 'DIAGNOSTIC_ACCURACY':
      return {
        studyDesign: 'DIAGNOSTIC_ACCURACY',
        equatorGuidelineName: 'STARD 2015',
        equatorGuidelineCitation:
          'Bossuyt PM, Reitsma JB, Bruns DE, et al. STARD 2015: an updated list of essential items for reporting diagnostic accuracy studies. BMJ. 2015;351:h5527. doi:10.1136/bmj.h5527',
        riskOfBiasToolName: 'QUADAS-2',
        riskOfBiasToolCitation:
          'Whiting PF, Rutjes AW, Westwood ME, et al. QUADAS-2: a revised tool for the quality assessment of diagnostic accuracy studies. Ann Intern Med. 2011;155(8):529-536. doi:10.7326/0003-4819-155-8-201110180-00009',
        defaultOxfordLevel: 'Level 1b',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Patient Selection (Risk of Bias)', description: 'Consecutive or random sample; avoidance of inappropriate exclusions' },
          { domainName: 'Domain 1: Patient Selection (Applicability)', description: 'Concerns that included patients do not match the review question' },
          { domainName: 'Domain 2: Index Test (Risk of Bias)', description: 'Index test interpreted without knowledge of reference standard (blinding)' },
          { domainName: 'Domain 2: Index Test (Applicability)', description: 'Concerns that index test execution does not match clinical practice' },
          { domainName: 'Domain 3: Reference Standard (Risk of Bias)', description: 'Gold standard verified independently without knowledge of index test' },
          { domainName: 'Domain 3: Reference Standard (Applicability)', description: 'Concerns that target condition defined by reference does not match review question' },
          { domainName: 'Domain 4: Flow and Timing (Risk of Bias)', description: 'Appropriate interval between tests and all patients received reference standard' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Title', requirement: 'Identify as a study of diagnostic accuracy' },
          { itemNumberAndSection: 'Item 6: Eligibility Criteria', requirement: 'Inclusion/exclusion criteria and recruitment setting' },
          { itemNumberAndSection: 'Item 10: Index & Reference Tests', requirement: 'Sufficient detail to permit replication' },
          { itemNumberAndSection: 'Item 23: Estimates of Accuracy', requirement: 'Sensitivity, specificity, predictive values, or likelihood ratios with 95% CIs' },
        ],
      };

    case 'PREDICTION_MODEL':
      return {
        studyDesign: 'PREDICTION_MODEL',
        equatorGuidelineName: 'TRIPOD+AI',
        equatorGuidelineCitation:
          'Collins GS, Moons KGM, Dhiman P, et al. TRIPOD+AI statement: updated guidance for reporting clinical prediction models that use regression or machine learning methods. BMJ. 2024;385:e078378. doi:10.1136/bmj-2023-078378',
        riskOfBiasToolName: 'PROBAST+AI',
        riskOfBiasToolCitation:
          'Moons KGM, Damen JAA, Kaul T, et al. PROBAST+AI: an updated quality, risk of bias, and applicability assessment tool for prediction models using regression or artificial intelligence methods. BMJ. 2025;388:e082505. doi:10.1136/bmj-2024-082505',
        defaultOxfordLevel: 'Level 3b',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Participants and data sources', description: 'Representative data source; inclusions/exclusions; no leakage between development and test data' },
          { domainName: 'Domain 2: Predictors', description: 'Predictors (images, clinical variables) defined and available at the time of use' },
          { domainName: 'Domain 3: Outcome', description: 'Outcome (e.g. implantation, clinical pregnancy, live birth) defined and determined without knowledge of predictions' },
          { domainName: 'Domain 4: Analysis', description: 'Adequate sample size; discrimination AND calibration; internal and external validation; overfitting handled' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Title', requirement: 'Identifies the study as developing or evaluating a prediction model, the target population and outcome' },
          { itemNumberAndSection: 'Item 5: Data source', requirement: 'Source of data, dates and setting (centres, countries)' },
          { itemNumberAndSection: 'Item 8: Outcome', requirement: 'Outcome definition and how/when it was assessed' },
          { itemNumberAndSection: 'Item 10: Sample size', requirement: 'Study size and how it was arrived at' },
          { itemNumberAndSection: 'Item 12: Analysis — performance', requirement: 'Discrimination and calibration measures with uncertainty' },
          { itemNumberAndSection: 'Item 12e: Validation', requirement: 'Internal validation method and any external / temporal / geographic validation' },
          { itemNumberAndSection: 'Item 14: Fairness', requirement: 'Performance across relevant subgroups' },
          { itemNumberAndSection: 'Item 27: Limitations', requirement: 'Limitations, including generalisability and risk of bias' },
        ],
      };

    case 'CLINICAL_PRACTICE_GUIDELINE':
      return {
        studyDesign: 'CLINICAL_PRACTICE_GUIDELINE',
        equatorGuidelineName: 'RIGHT Statement (Practice Guidelines)',
        equatorGuidelineCitation:
          'Chen Y, Yang K, Marušic A, et al. A Reporting Tool for Practice Guidelines in Health Care: The RIGHT Statement. Ann Intern Med. 2017;166(2):128-132. doi:10.7326/M16-1561',
        riskOfBiasToolName: 'AGREE II',
        riskOfBiasToolCitation:
          'Brouwers MC, Kho ME, Browman GP, et al. AGREE II: advancing guideline development, reporting and evaluation in healthcare. CMAJ. 2010;182(18):E839-E842. doi:10.1503/cmaj.090449',
        defaultOxfordLevel: 'Level 1a',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Scope and Purpose', description: 'Overall objective, health questions, and target population described' },
          { domainName: 'Domain 2: Stakeholder Involvement', description: 'Multidisciplinary group, patient views sought, and target users defined' },
          { domainName: 'Domain 3: Rigour of Development', description: 'Systematic search methods, evidence selection, and link between evidence and recommendations' },
          { domainName: 'Domain 4: Clarity of Presentation', description: 'Specific, unambiguous, easily identifiable recommendations' },
          { domainName: 'Domain 5: Applicability', description: 'Facilitators, barriers, resource implications, and monitoring criteria addressed' },
          { domainName: 'Domain 6: Editorial Independence', description: 'Funding body influence minimized and competing interests recorded' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Title & Subtitle', requirement: 'Identify report as clinical practice guideline' },
          { itemNumberAndSection: 'Item 4: Evidence Synthesis', requirement: 'Systematic evidence retrieval and grading methodologies' },
          { itemNumberAndSection: 'Item 7: Recommendations', requirement: 'Clear actionable recommendations with certainty ratings' },
        ],
      };

    default:
      return {
        studyDesign: design,
        equatorGuidelineName: 'EQUATOR General Reporting Framework',
        equatorGuidelineCitation:
          'Simera I, Moher D, Hirst A, et al. Transparent and accurate reporting increases reliability, utility, and impact of research. BMJ. 2010;340:c1370. doi:10.1136/bmj.c1370',
        riskOfBiasToolName: 'Narrative Synthesis Appraisal / SANRA',
        riskOfBiasToolCitation:
          'Baethge C, Goldbeck-Wood S, Mertens S. SANRA—a scale for the quality assessment of narrative review articles. Res Integr Peer Rev. 2019;4:5. doi:10.1186/s41073-019-0064-8',
        defaultOxfordLevel: 'Level 5',
        robMandatoryDomains: [
          { domainName: 'Item 1: Justification of article importance', description: 'Evaluation of scientific rationale and clinical significance for the readership' },
          { domainName: 'Item 2: Statement of concrete aims / questions', description: 'Explicit formulation of key review inquiry or clinical questions' },
          { domainName: 'Item 3: Description of literature search', description: 'Transparency regarding bibliographic databases, search terms, and inclusion limits' },
          { domainName: 'Item 4: Referencing of primary evidence', description: 'Direct grounding of clinical claims in cited primary studies' },
          { domainName: 'Item 5: Scientific reasoning and critical balance', description: 'Balanced presentation of conflicting evidence and clinical caveats' },
          { domainName: 'Item 6: Appropriate presentation of data', description: 'Clear presentation of outcome data and synthesis findings' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Importance & Rationale', requirement: 'Explicit scientific background and readership importance' },
          { itemNumberAndSection: 'Item 2: Concrete Aims', requirement: 'Formulation of concrete review aims and focus' },
          { itemNumberAndSection: 'Item 3: Search Strategy', requirement: 'Description of bibliographic search and databases' },
          { itemNumberAndSection: 'Item 4: Evidence Referencing', requirement: 'Comprehensive citation of primary studies' },
          { itemNumberAndSection: 'Item 5: Critical Reasoning', requirement: 'Unbiased scientific synthesis and balanced caveats' },
          { itemNumberAndSection: 'Item 6: Synthesis & Presentation', requirement: 'Transparent presentation of clinical conclusions' },
        ],
      };
  }
}
