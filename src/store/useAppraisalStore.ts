import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ParsedManuscriptPayload } from '@/lib/schemas/ingestion.schema';
import {
  MasterAppraisalReport,
  BiasJudgement,
  GradeCertainty,
} from '@/lib/schemas/appraisal.schema';
import { LlmProvider } from '@/lib/llm/llm-client';
import { synthesizeGradeCertainty } from '@/lib/evaluators/grade-engine';

interface AppraisalState {
  // Ingested Manuscript
  currentManuscript: ParsedManuscriptPayload | null;
  isIngesting: boolean;
  ingestionError: string | null;

  // Active Appraisal
  currentAppraisal: MasterAppraisalReport | null;
  isAppraising: boolean;
  appraisalProgressStep: number; // 0 = idle, 1 = PICO, 2 = EQUATOR/RoB, 3 = Stats, 4 = GRADE
  currentStepMessage: string;
  appraisalError: string | null;
  isEditMode: boolean;

  // In-Browser LLM Config
  llmProvider: LlmProvider;
  llmApiKey: string;
  llmModel: string;

  // Actions
  setManuscript: (manuscript: ParsedManuscriptPayload) => void;
  clearManuscript: () => void;
  setIngesting: (isIngesting: boolean) => void;
  setIngestionError: (error: string | null) => void;

  setAppraisal: (appraisal: MasterAppraisalReport) => void;
  setAppraising: (isAppraising: boolean) => void;
  setAppraisalStep: (step: number, message?: string) => void;
  setAppraisalError: (error: string | null) => void;
  setEditMode: (editMode: boolean) => void;

  updateAppraisalField: (path: string, value: any) => void;
  updateRoBDomainJudgement: (index: number, judgement: BiasJudgement) => void;
  overrideOverallRoB: (judgement: BiasJudgement, justification: string) => void;
  updateGradeCertainty: (grade: GradeCertainty) => void;
  overrideGradeCertainty: (grade: GradeCertainty, justification: string) => void;

  setLlmConfig: (provider: LlmProvider, apiKey: string, model: string) => void;
  resetAll: () => void;
}

export const useAppraisalStore = create<AppraisalState>()(
  persist(
    (set) => ({
      currentManuscript: null,
      isIngesting: false,
      ingestionError: null,

      currentAppraisal: null,
      isAppraising: false,
      appraisalProgressStep: 0,
      currentStepMessage: '',
      appraisalError: null,
      isEditMode: false,

      llmProvider: 'gemini',
      llmApiKey: '',
      llmModel: 'gemini-2.5-flash',

      setManuscript: (manuscript) => set({ currentManuscript: manuscript, ingestionError: null }),
      clearManuscript: () =>
        set({ currentManuscript: null, currentAppraisal: null, appraisalProgressStep: 0, appraisalError: null }),
      setIngesting: (isIngesting) => set({ isIngesting }),
      setIngestionError: (ingestionError) => set({ ingestionError }),

      setAppraisal: (appraisal) =>
        set({ currentAppraisal: appraisal, isAppraising: false, appraisalError: null, appraisalProgressStep: 4 }),
      setAppraising: (isAppraising) => set({ isAppraising }),
      setAppraisalStep: (step, message = '') => set({ appraisalProgressStep: step, currentStepMessage: message }),
      setAppraisalError: (appraisalError) => set({ appraisalError, isAppraising: false }),
      setEditMode: (isEditMode) => set({ isEditMode }),

      updateAppraisalField: (path, value) =>
        set((state) => {
          if (!state.currentAppraisal) return state;
          const copy = JSON.parse(JSON.stringify(state.currentAppraisal));
          const parts = path.split('.');
          let current = copy;
          for (let i = 0; i < parts.length - 1; i++) {
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = value;
          return { currentAppraisal: copy };
        }),

      // Recompute overall RoB (worst-domain rule) and GRADE certainty on domain update (P1-10)
      updateRoBDomainJudgement: (index, judgement) =>
        set((state) => {
          if (!state.currentAppraisal) return state;
          const copy: MasterAppraisalReport = JSON.parse(JSON.stringify(state.currentAppraisal));
          if (!copy.riskOfBias?.domains?.[index]) return state;

          copy.riskOfBias.domains[index].judgement = judgement;

          // Worst-domain rule for overall RoB
          const domains = copy.riskOfBias.domains;
          let computedOverall: BiasJudgement = 'UNCLEAR_NOT_REPORTED';
          if (domains.some((d) => d.judgement === 'HIGH_RISK')) {
            computedOverall = 'HIGH_RISK';
          } else if (domains.some((d) => d.judgement === 'SOME_CONCERNS')) {
            computedOverall = 'SOME_CONCERNS';
          } else if (domains.every((d) => d.judgement === 'LOW_RISK')) {
            computedOverall = 'LOW_RISK';
          }

          copy.riskOfBias.overallRisk = computedOverall;
          copy.riskOfBias.manuallyOverridden = false;
          copy.riskOfBias.overrideJustification = undefined;

          // Recompute GRADE certainty dynamically
          const gradeResult = synthesizeGradeCertainty({
            studyDesign: copy.classification.studyDesign,
            overallRiskOfBias: computedOverall,
            imprecisionIdentified: copy.validitySynthesis.gradeDowngradingFactors.some((f) =>
              f.toLowerCase().includes('imprecision')
            ),
            inconsistencyOrHeterogeneity: copy.validitySynthesis.gradeDowngradingFactors.some((f) =>
              f.toLowerCase().includes('inconsistency')
            ),
            indirectnessIdentified: copy.validitySynthesis.gradeDowngradingFactors.some((f) =>
              f.toLowerCase().includes('indirectness')
            ),
            publicationBiasSuspected: copy.validitySynthesis.gradeDowngradingFactors.some((f) =>
              f.toLowerCase().includes('publication bias')
            ),
            largeEffectSize: false,
            doseResponseGradient: false,
          });

          copy.validitySynthesis.gradeCertainty = gradeResult.finalCertainty;
          copy.validitySynthesis.gradeDowngradingFactors = gradeResult.downgradingFactors;
          copy.validitySynthesis.gradeRationale = gradeResult.rationale;
          copy.validitySynthesis.manuallyOverridden = false;
          copy.validitySynthesis.overrideJustification = undefined;

          return { currentAppraisal: copy };
        }),

      // User override of overall RoB with required justification (P1-10)
      overrideOverallRoB: (judgement, justification) =>
        set((state) => {
          if (!state.currentAppraisal) return state;
          const copy: MasterAppraisalReport = JSON.parse(JSON.stringify(state.currentAppraisal));
          copy.riskOfBias.overallRisk = judgement;
          copy.riskOfBias.manuallyOverridden = true;
          copy.riskOfBias.overrideJustification = justification;

          // Recompute GRADE based on user-overridden RoB
          const gradeResult = synthesizeGradeCertainty({
            studyDesign: copy.classification.studyDesign,
            overallRiskOfBias: judgement,
            imprecisionIdentified: copy.validitySynthesis.gradeDowngradingFactors.some((f) =>
              f.toLowerCase().includes('imprecision')
            ),
            inconsistencyOrHeterogeneity: copy.validitySynthesis.gradeDowngradingFactors.some((f) =>
              f.toLowerCase().includes('inconsistency')
            ),
            indirectnessIdentified: copy.validitySynthesis.gradeDowngradingFactors.some((f) =>
              f.toLowerCase().includes('indirectness')
            ),
            publicationBiasSuspected: copy.validitySynthesis.gradeDowngradingFactors.some((f) =>
              f.toLowerCase().includes('publication bias')
            ),
            largeEffectSize: false,
            doseResponseGradient: false,
          });

          copy.validitySynthesis.gradeCertainty = gradeResult.finalCertainty;
          copy.validitySynthesis.gradeDowngradingFactors = gradeResult.downgradingFactors;
          copy.validitySynthesis.gradeRationale = gradeResult.rationale;

          return { currentAppraisal: copy };
        }),

      updateGradeCertainty: (grade) =>
        set((state) => {
          if (!state.currentAppraisal) return state;
          const copy = JSON.parse(JSON.stringify(state.currentAppraisal));
          copy.validitySynthesis.gradeCertainty = grade;
          return { currentAppraisal: copy };
        }),

      overrideGradeCertainty: (grade, justification) =>
        set((state) => {
          if (!state.currentAppraisal) return state;
          const copy: MasterAppraisalReport = JSON.parse(JSON.stringify(state.currentAppraisal));
          copy.validitySynthesis.gradeCertainty = grade;
          copy.validitySynthesis.manuallyOverridden = true;
          copy.validitySynthesis.overrideJustification = justification;
          return { currentAppraisal: copy };
        }),

      setLlmConfig: (llmProvider, llmApiKey, llmModel) =>
        set({ llmProvider, llmApiKey, llmModel }),

      resetAll: () =>
        set({
          currentManuscript: null,
          isIngesting: false,
          ingestionError: null,
          currentAppraisal: null,
          isAppraising: false,
          appraisalProgressStep: 0,
          currentStepMessage: '',
          appraisalError: null,
          isEditMode: false,
        }),
    }),
    {
      name: 'appraisai_current_session',
      partialize: (state) => ({
        currentManuscript: state.currentManuscript,
        currentAppraisal: state.currentAppraisal,
        llmProvider: state.llmProvider,
        llmModel: state.llmModel,
        // P5-3: llmApiKey is NOT persisted in localStorage
      }),
    }
  )
);
