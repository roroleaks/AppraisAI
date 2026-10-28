import { create } from 'zustand';
import { ParsedManuscriptPayload } from '@/lib/schemas/ingestion.schema';
import {
  MasterAppraisalReport,
  BiasJudgement,
  GradeCertainty,
} from '@/lib/schemas/appraisal.schema';
import { LlmProvider } from '@/lib/llm/llm-client';

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
  updateGradeCertainty: (grade: GradeCertainty) => void;

  setLlmConfig: (provider: LlmProvider, apiKey: string, model: string) => void;
  resetAll: () => void;
}

export const useAppraisalStore = create<AppraisalState>((set) => ({
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

  updateRoBDomainJudgement: (index, judgement) =>
    set((state) => {
      if (!state.currentAppraisal) return state;
      const copy = JSON.parse(JSON.stringify(state.currentAppraisal));
      if (copy.riskOfBias?.domains?.[index]) {
        copy.riskOfBias.domains[index].judgement = judgement;
      }
      return { currentAppraisal: copy };
    }),

  updateGradeCertainty: (grade) =>
    set((state) => {
      if (!state.currentAppraisal) return state;
      const copy = JSON.parse(JSON.stringify(state.currentAppraisal));
      copy.validitySynthesis.gradeCertainty = grade;
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
}));
