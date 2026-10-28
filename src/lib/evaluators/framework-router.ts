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
        equatorGuidelineName: 'CONSORT 2010',
        equatorGuidelineCitation:
          'Schulz KF, Altman DG, Moher D; CONSORT Group. CONSORT 2010 Statement: updated guidelines for reporting parallel group randomised trials. BMJ. 2010;340:c332.',
        riskOfBiasToolName: 'Cochrane Risk of Bias 2.0 (RoB 2)',
        riskOfBiasToolCitation:
          'Sterne JAC, Savovic J, Page MJ, et al. RoB 2: a revised tool for assessing risk of bias in randomised trials. BMJ. 2019;366:l4898.',
        defaultOxfordLevel: 'Level 1b',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Randomisation process', description: 'Generation of random sequence and allocation concealment' },
          { domainName: 'Domain 2: Deviations from intended interventions', description: 'Blinding of participants/personnel and protocol adherence' },
          { domainName: 'Domain 3: Missing outcome data', description: 'Attrition, follow-up completeness, and intention-to-treat analysis' },
          { domainName: 'Domain 4: Measurement of the outcome', description: 'Blinding of outcome assessors and validity of measurement instruments' },
          { domainName: 'Domain 5: Selection of the reported result', description: 'Adherence to pre-specified analysis plan/trial registry' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1a: Title', requirement: 'Identification as a randomised trial in the title' },
          { itemNumberAndSection: 'Item 2a/b: Introduction', requirement: 'Scientific background, rational, and specific objectives/hypotheses' },
          { itemNumberAndSection: 'Item 8a/b: Randomisation - Allocation Concealment', requirement: 'Mechanism to implement random allocation and concealment' },
          { itemNumberAndSection: 'Item 11a/b: Blinding', requirement: 'Who was blinded after assignment (participants, care providers, assessors)' },
          { itemNumberAndSection: 'Item 13a/b: Participant Flow', requirement: 'Flow of participants through each stage (enrolment, allocation, follow-up, analysis)' },
          { itemNumberAndSection: 'Item 17a: Outcomes and Estimation', requirement: 'For each primary/secondary outcome, results and precision (e.g. 95% CI)' },
          { itemNumberAndSection: 'Item 20: Limitations', requirement: 'Trial limitations, addressing sources of potential bias and imprecision' },
        ],
      };

    case 'SYSTEMATIC_REVIEW_META_ANALYSIS':
      return {
        studyDesign: 'SYSTEMATIC_REVIEW_META_ANALYSIS',
        equatorGuidelineName: 'PRISMA 2020',
        equatorGuidelineCitation:
          'Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ. 2021;372:n71.',
        riskOfBiasToolName: 'AMSTAR-2 / ROBIS',
        riskOfBiasToolCitation:
          'Shea BJ, Reeves BC, Wells G, et al. AMSTAR 2: a critical appraisal tool for systematic reviews that include randomised or non-randomised studies of healthcare interventions. BMJ. 2017;358:j4008.',
        defaultOxfordLevel: 'Level 1a',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Protocol Registration & Search Strategy', description: 'A priori protocol registration (PROSPERO) and comprehensive database queries' },
          { domainName: 'Domain 2: Study Selection & Data Extraction Dual-Screening', description: 'Duplicate independent eligibility screening and extraction' },
          { domainName: 'Domain 3: Risk of Bias Assessment of Included Studies', description: 'Use of formal validated RoB instruments (e.g. RoB 2, ROBINS-I)' },
          { domainName: 'Domain 4: Appropriateness of Meta-analytical Synthesis', description: 'Handling of clinical/statistical heterogeneity (I2) and pooling models' },
          { domainName: 'Domain 5: Publication Bias & Small-Study Effects', description: 'Funnel plot analysis or Egger/Begg tests' },
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
    case 'CASE_CONTROL_STUDY':
      return {
        studyDesign: design,
        equatorGuidelineName: 'STROBE (Observational)',
        equatorGuidelineCitation:
          'von Elm E, Altman DG, Egger M, et al. The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) Statement. Lancet. 2007;370(9596):1453-1457.',
        riskOfBiasToolName: 'Newcastle-Ottawa Scale (NOS) / ROBINS-I',
        riskOfBiasToolCitation:
          'Wells GA, Shea B, O’Connell D, et al. The Newcastle-Ottawa Scale (NOS) for assessing the quality of nonrandomised studies in meta-analyses. Ottawa Hospital Research Institute; 2021.',
        defaultOxfordLevel: 'Level 2b',
        robMandatoryDomains: [
          { domainName: 'Selection: Representativeness of Exposed/Cohort', description: 'Selection bias and ascertainment of exposure status' },
          { domainName: 'Comparability: Confounding Adjustment', description: 'Adjustment for key prognostic factors via multivariable regression or propensity matching' },
          { domainName: 'Outcome: Assessment & Follow-Up Duration', description: 'Blinded/objective outcome assessment and adequacy of follow-up (<20% attrition)' },
          { domainName: 'Information Bias: Measurement Error', description: 'Recall bias or misclassification of exposures/outcomes' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Title & Abstract', requirement: 'State study design with commonly used terms' },
          { itemNumberAndSection: 'Item 6: Participants', requirement: 'Eligibility criteria and sources/methods of selection' },
          { itemNumberAndSection: 'Item 12: Statistical Methods', requirement: 'Describe all statistical methods, including those used to control for confounding' },
          { itemNumberAndSection: 'Item 14: Descriptive Data', requirement: 'Characteristics of study participants and missing data details' },
          { itemNumberAndSection: 'Item 16: Main Results', requirement: 'Unadjusted and confounder-adjusted estimates and 95% confidence intervals' },
        ],
      };

    case 'DIAGNOSTIC_ACCURACY':
      return {
        studyDesign: 'DIAGNOSTIC_ACCURACY',
        equatorGuidelineName: 'STARD 2015',
        equatorGuidelineCitation:
          'Bossuyt PM, Reitsma JB, Bruns DE, et al. STARD 2015: an updated list of essential items for reporting diagnostic accuracy studies. BMJ. 2015;351:h5527.',
        riskOfBiasToolName: 'QUADAS-2',
        riskOfBiasToolCitation:
          'Whiting PF, Rutjes AW, Westwood ME, et al. QUADAS-2: a revised tool for the quality assessment of diagnostic accuracy studies. Ann Intern Med. 2011;155(8):529-536.',
        defaultOxfordLevel: 'Level 1b',
        robMandatoryDomains: [
          { domainName: 'Domain 1: Patient Selection', description: 'Consecutive or random sample; avoidance of inappropriate exclusions' },
          { domainName: 'Domain 2: Index Test', description: 'Index test interpreted without knowledge of reference standard (blinding)' },
          { domainName: 'Domain 3: Reference Standard', description: 'Gold standard verified independently without knowledge of index test' },
          { domainName: 'Domain 4: Flow and Timing', description: 'Appropriate interval between tests and all patients received reference standard' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Title', requirement: 'Identify as a study of diagnostic accuracy' },
          { itemNumberAndSection: 'Item 6: Eligibility Criteria', requirement: 'Inclusion/exclusion criteria and recruitment setting' },
          { itemNumberAndSection: 'Item 10: Index & Reference Tests', requirement: 'Sufficient detail to permit replication' },
          { itemNumberAndSection: 'Item 23: Estimates of Accuracy', requirement: 'Sensitivity, specificity, predictive values, or likelihood ratios with 95% CIs' },
        ],
      };

    default:
      return {
        studyDesign: design,
        equatorGuidelineName: 'EQUATOR General Guidance / STROBE',
        equatorGuidelineCitation:
          'Simera I, Moher D, Hirst A, et al. Transparent and accurate reporting increases reliability, utility, and impact of research. BMJ. 2010;340:c1370.',
        riskOfBiasToolName: 'CASP Critical Appraisal Tool',
        riskOfBiasToolCitation:
          'Critical Appraisal Skills Programme. CASP Checklists. Oxford: CASP; 2018.',
        defaultOxfordLevel: 'Level 3a',
        robMandatoryDomains: [
          { domainName: 'Clear Clinical Question', description: 'Focused population, intervention/exposure, and outcomes' },
          { domainName: 'Methodological Rigor', description: 'Adequacy of design and control for bias' },
          { domainName: 'Validity of Results', description: 'Precision of effect estimates and confidence intervals' },
          { domainName: 'Clinical Applicability', description: 'Generalizability to patient care' },
        ],
        equatorMandatoryItems: [
          { itemNumberAndSection: 'Item 1: Rationale & Objectives', requirement: 'Explicit scientific background and question' },
          { itemNumberAndSection: 'Item 2: Methodological Design', requirement: 'Clear description of sample, variables, and measurements' },
          { itemNumberAndSection: 'Item 3: Findings & Limitations', requirement: 'Accurate reporting of primary findings and limitations' },
        ],
      };
  }
}
