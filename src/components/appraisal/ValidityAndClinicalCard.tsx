'use client';

import React from 'react';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import { GradeCertainty } from '@/lib/schemas/appraisal.schema';
import {
  Award,
  Globe,
  ShieldCheck,
  Stethoscope,
  BookOpen,
  ArrowDownCircle,
  ExternalLink,
} from 'lucide-react';

export const ValidityAndClinicalCard: React.FC = () => {
  const { currentAppraisal, isEditMode, overrideGradeCertainty, updateAppraisalField } =
    useAppraisalStore();

  if (!currentAppraisal) return null;

  const { validitySynthesis, clinicalPracticeBottomLine, references } = currentAppraisal;

  const handleGradeChange = (newVal: GradeCertainty) => {
    const reason = window.prompt('Please enter justification for overriding GRADE certainty rating:', 'Appraiser clinical rationale based on external evidence');
    if (reason && reason.trim()) {
      overrideGradeCertainty(newVal, reason.trim());
    }
  };

  const renderGradeBadge = (grade: GradeCertainty) => {
    if ((validitySynthesis as any).suppressedDueToRetraction) {
      return (
        <span className="px-3 py-1 bg-red-100 text-red-900 border border-red-300 font-bold rounded-md text-xs">
          Suppressed (Retracted Paper)
        </span>
      );
    }

    switch (grade) {
      case 'NOT_GRADED_HEURISTIC':
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-md text-xs">
            Not graded (heuristic mode)
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold rounded-md text-xs">
            HIGH Certainty
          </span>
        );
      case 'MODERATE':
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-900 border border-blue-300 font-bold rounded-md text-xs">
            MODERATE Certainty
          </span>
        );
      case 'LOW':
        return (
          <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-md text-xs">
            LOW Certainty
          </span>
        );
      case 'VERY_LOW':
      default:
        return (
          <span className="px-3 py-1 bg-red-100 text-red-900 border border-red-300 font-bold rounded-md text-xs">
            VERY LOW Certainty
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      {/* Header & GRADE Certainty */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            GRADE Certainty of Evidence & Validity Synthesis
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Synthesis across internal validity, generalizability, and GRADE Working Group criteria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">GRADE Rating:</span>
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <select
                value={validitySynthesis.gradeCertainty}
                onChange={(e) => handleGradeChange(e.target.value as GradeCertainty)}
                className="p-1 border border-slate-300 rounded text-xs bg-white font-bold"
              >
                <option value="HIGH">HIGH</option>
                <option value="MODERATE">MODERATE</option>
                <option value="LOW">LOW</option>
                <option value="VERY_LOW">VERY LOW</option>
              </select>
              {validitySynthesis.manuallyOverridden && (
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 rounded px-1.5 py-0.5">
                  Overridden: {validitySynthesis.overrideJustification}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {renderGradeBadge(validitySynthesis.gradeCertainty)}
              {validitySynthesis.manuallyOverridden && (
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5" title={validitySynthesis.overrideJustification}>
                  (Overridden)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GRADE Rationale & Downgrading Factors */}
      <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2 text-xs">
        <span className="font-bold text-amber-950 flex items-center gap-1.5">
          <ArrowDownCircle className="w-4 h-4 text-amber-600" /> GRADE Evaluation Rationale
        </span>
        <p className="text-amber-900 font-serif leading-relaxed">
          {validitySynthesis.gradeRationale}
        </p>
        {validitySynthesis.gradeDowngradingFactors.length > 0 && (
          <div className="pt-1">
            <span className="font-semibold text-amber-950 block text-[11px]">Downgrading factors:</span>
            <ul className="list-disc pl-4 space-y-0.5 text-amber-900 text-[11px]">
              {validitySynthesis.gradeDowngradingFactors.map((f, idx) => (
                <li key={idx}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Internal & External Validity Narratives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-serif leading-relaxed">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <span className="font-sans font-bold text-slate-800 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Internal Validity (Bias & Confounding)
          </span>
          {isEditMode ? (
            <textarea
              value={validitySynthesis.internalValidity}
              onChange={(e) => updateAppraisalField('validitySynthesis.internalValidity', e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs font-sans"
              rows={3}
            />
          ) : (
            <p className="text-slate-700">{validitySynthesis.internalValidity}</p>
          )}
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <span className="font-sans font-bold text-slate-800 flex items-center gap-1.5 mb-1">
            <Globe className="w-4 h-4 text-indigo-600" /> External Validity (Generalizability)
          </span>
          {isEditMode ? (
            <textarea
              value={validitySynthesis.externalValidityAndGeneralizability}
              onChange={(e) =>
                updateAppraisalField('validitySynthesis.externalValidityAndGeneralizability', e.target.value)
              }
              className="w-full p-1.5 border border-slate-300 rounded text-xs font-sans"
              rows={3}
            />
          ) : (
            <p className="text-slate-700">{validitySynthesis.externalValidityAndGeneralizability}</p>
          )}
        </div>
      </div>

      {/* Funding & Conflict of Interest */}
      <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg text-xs">
        <span className="font-bold text-slate-800 block mb-1">
          Conflicts of Interest & Funding Source Critique
        </span>
        <p className="text-slate-600 font-serif leading-relaxed">
          {validitySynthesis.conflictsOfInterestAndFundingCritique}
        </p>
      </div>

      {/* Clinical Practice Translation / Bottom Line */}
      {(clinicalPracticeBottomLine as any).suppressedDueToRetraction ? (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg space-y-1 text-xs sm:text-sm text-red-900">
          <span className="font-bold text-red-950 flex items-center gap-1.5">
            <Stethoscope className="w-4 h-4 text-red-700" /> Clinical Translation Suppressed (Retracted Paper)
          </span>
          <p className="font-serif leading-relaxed">
            This manuscript has been officially retracted. Therapeutic recommendations and clinical conclusions are suppressed and must not be implemented in clinical practice.
          </p>
        </div>
      ) : (
        <div className="p-4 bg-[#e3f2f2] border border-[#0f6b6b]/30 rounded-lg space-y-2 text-xs sm:text-sm">
          <span className="font-bold text-[#0f6b6b] flex items-center gap-1.5">
            <Stethoscope className="w-4 h-4 text-[#0f6b6b]" /> Clinical Practice Bottom Line & Recommendations
          </span>
          {isEditMode ? (
            <div className="space-y-2">
              <div>
                <label className="font-bold text-slate-900 block text-xs">Key Takeaway for Clinicians:</label>
                <textarea
                  value={clinicalPracticeBottomLine.keyTakeawayForClinicians}
                  onChange={(e) =>
                    updateAppraisalField('clinicalPracticeBottomLine.keyTakeawayForClinicians', e.target.value)
                  }
                  className="w-full p-1.5 border border-slate-300 rounded text-xs font-sans"
                  rows={2}
                />
              </div>
              <div>
                <label className="font-bold text-slate-900 block text-xs">Direct Applicability:</label>
                <textarea
                  value={clinicalPracticeBottomLine.applicabilityToPractice}
                  onChange={(e) =>
                    updateAppraisalField('clinicalPracticeBottomLine.applicabilityToPractice', e.target.value)
                  }
                  className="w-full p-1.5 border border-slate-300 rounded text-xs font-sans"
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-slate-900 font-serif leading-relaxed">
                <strong>Key Takeaway for Clinicians:</strong> {clinicalPracticeBottomLine.keyTakeawayForClinicians}
              </p>
              <p className="text-slate-800 font-serif leading-relaxed">
                <strong>Direct Applicability:</strong> {clinicalPracticeBottomLine.applicabilityToPractice}
              </p>
            </>
          )}
        </div>
      )}
            <p className="text-brand-800 text-[11px] font-sans">
              <strong>Future Research Needs:</strong> {clinicalPracticeBottomLine.recommendationsForFutureResearch}
            </p>
          </>
        )}
      </div>

      {/* Numbered Vancouver References */}
      <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
        <h4 className="font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Formatted Vancouver References
        </h4>
        <ol className="list-decimal pl-5 space-y-1 text-slate-700 font-serif">
          {references.map((ref, idx) => (
            <li key={ref.number} className="leading-relaxed">
              {isEditMode ? (
                <textarea
                  value={ref.vancouverCitation}
                  onChange={(e) => updateAppraisalField(`references.${idx}.vancouverCitation`, e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded text-xs font-sans not-italic"
                  rows={2}
                />
              ) : (
                <>
                  {ref.vancouverCitation}
                  {ref.doiOrUrl && (
                    <a
                      href={ref.doiOrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 ml-1 text-brand-700 hover:underline font-sans text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
