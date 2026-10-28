'use client';

import React from 'react';
import { CheckCircle2, Clock, Loader2, Circle } from 'lucide-react';
import { useAppraisalStore } from '@/store/useAppraisalStore';

const STAGES = [
  { step: 1, title: 'Pass 1: PICO & Design', desc: 'Classification, Oxford CEBM & Abstract' },
  { step: 2, title: 'Pass 2: RoB & EQUATOR', desc: 'CONSORT/PRISMA & Cochrane RoB 2.0' },
  { step: 3, title: 'Pass 3: Statistical Audit', desc: 'Power, ITT vs PP & Spin detection' },
  { step: 4, title: 'Pass 4: Validity & GRADE', desc: 'GRADE Certainty & Vancouver references' },
];

export const AppraisalProgressStepper: React.FC = () => {
  const { appraisalProgressStep, isAppraising, currentStepMessage } = useAppraisalStore();

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Critical Appraisal Multi-Stage Pipeline
          </h3>
          <p className="text-sm font-bold text-slate-800 mt-0.5">
            {isAppraising
              ? currentStepMessage || 'Analyzing manuscript methodology...'
              : appraisalProgressStep === 4
              ? 'Appraisal Completed — All 4 Passes Verified'
              : 'Ready to Appraise'}
          </p>
        </div>
        {isAppraising && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-full border border-brand-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
            Analyzing Pass {appraisalProgressStep} of 4
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {STAGES.map((s) => {
          const isDone = appraisalProgressStep > s.step || (appraisalProgressStep === 4 && !isAppraising);
          const isCurrent = isAppraising && appraisalProgressStep === s.step;

          return (
            <div
              key={s.step}
              className={`p-3 rounded-lg border text-xs transition-all ${
                isDone
                  ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                  : isCurrent
                  ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-brand-600 animate-spin shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                )}
                <span className="font-bold">{s.title}</span>
              </div>
              <p className="text-[11px] opacity-80 pl-6 leading-tight">{s.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
