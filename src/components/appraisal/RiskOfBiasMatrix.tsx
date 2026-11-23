'use client';

import React from 'react';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import { BiasJudgement } from '@/lib/schemas/appraisal.schema';
import { isVerbatimInManuscript } from '@/lib/parsers/quote-verifier';
import { ShieldAlert, CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

export const RiskOfBiasMatrix: React.FC = () => {
  const {
    currentAppraisal,
    currentManuscript,
    isEditMode,
    updateRoBDomainJudgement,
    overrideOverallRoB,
    updateAppraisalField,
  } = useAppraisalStore();

  if (!currentAppraisal) return null;

  const { riskOfBias, equatorChecklist } = currentAppraisal;

  const handleOverallRiskChange = (newVal: BiasJudgement) => {
    const reason = window.prompt('Please enter justification for overriding overall Risk of Bias:', 'Appraiser clinical judgement based on study protocol');
    if (reason && reason.trim()) {
      overrideOverallRoB(newVal, reason.trim());
    }
  };

  const renderJudgementBadge = (judgement: BiasJudgement) => {
    switch (judgement) {
      case 'LOW_RISK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
            <CheckCircle className="w-3.5 h-3.5 text-[#166534]" /> Low Risk
          </span>
        );
      case 'SOME_CONCERNS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[#FEF9C3] text-[#854D0E] border border-[#FDE047]">
            <AlertTriangle className="w-3.5 h-3.5 text-[#854D0E]" /> Some Concerns
          </span>
        );
      case 'HIGH_RISK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">
            <XCircle className="w-3.5 h-3.5 text-[#991B1B]" /> High Risk
          </span>
        );
      case 'UNCLEAR_NOT_REPORTED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1]">
            <HelpCircle className="w-3.5 h-3.5 text-[#64748B]" /> Unclear / Not Reported
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-6">
      {/* RoB Header & Overall Score */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#0f6b6b]" />
            {riskOfBias.governingTool} Assessment Matrix
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Domain-specific methodological audit with direct evidentiary grounding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-medium text-slate-700">Overall Risk of Bias:</span>
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <select
                value={riskOfBias.overallRisk}
                onChange={(e) => handleOverallRiskChange(e.target.value as BiasJudgement)}
                className="p-1 border border-slate-300 rounded text-xs bg-white font-bold"
              >
                <option value="LOW_RISK">Low Risk</option>
                <option value="SOME_CONCERNS">Some Concerns</option>
                <option value="HIGH_RISK">High Risk</option>
                <option value="UNCLEAR_NOT_REPORTED">Unclear / Not Reported</option>
              </select>
              {riskOfBias.manuallyOverridden && (
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 rounded px-1.5 py-0.5">
                  Overridden: {riskOfBias.overrideJustification}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {renderJudgementBadge(riskOfBias.overallRisk)}
              {riskOfBias.manuallyOverridden && (
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5" title={riskOfBias.overrideJustification}>
                  (Overridden)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RoB Table */}
      <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs sm:text-sm">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
              <th className="py-2.5 px-4 w-1/4">Bias Domain</th>
              <th className="py-2.5 px-3 w-1/6">Judgement</th>
              <th className="py-2.5 px-4 w-1/3">Supportive Text Evidence</th>
              <th className="py-2.5 px-4">Methodological Significance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {riskOfBias.domains.map((d, idx) => (
              <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3 px-4 font-semibold text-slate-800">{d.domainName}</td>
                <td className="py-3 px-3">
                  {isEditMode ? (
                    <select
                      value={d.judgement}
                      onChange={(e) => updateRoBDomainJudgement(idx, e.target.value as BiasJudgement)}
                      className="p-1 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="LOW_RISK">Low Risk</option>
                      <option value="SOME_CONCERNS">Some Concerns</option>
                      <option value="HIGH_RISK">High Risk</option>
                      <option value="UNCLEAR_NOT_REPORTED">Unclear / Not Reported</option>
                    </select>
                  ) : (
                    renderJudgementBadge(d.judgement)
                  )}
                </td>
                <td className="py-3 px-4 leading-relaxed">
                  {isEditMode ? (
                    <textarea
                      value={d.supportiveEvidence}
                      onChange={(e) =>
                        updateAppraisalField(`riskOfBias.domains.${idx}.supportiveEvidence`, e.target.value)
                      }
                      className="w-full p-1.5 border border-slate-300 rounded text-xs font-sans not-italic"
                      rows={2}
                    />
                  ) : isVerbatimInManuscript(d.supportiveEvidence, currentManuscript) ? (
                    <span className="font-serif italic text-slate-800">
                      <span className="not-italic text-[10px] font-sans font-bold uppercase text-[#0f6b6b] bg-[#e3f2f2] border border-[#0f6b6b]/30 rounded px-1.5 py-0.5 mr-1.5 inline-block">
                        Quote
                      </span>
                      &ldquo;{d.supportiveEvidence}&rdquo;
                    </span>
                  ) : (
                    <span className="font-sans text-slate-600 not-italic text-xs">
                      <span className="text-[10px] font-sans font-bold uppercase text-slate-600 bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 mr-1.5 inline-block">
                        {currentAppraisal.engineUsed === 'llm' ? 'Appraiser note' : 'Engine note (heuristic)'}
                      </span>
                      {d.supportiveEvidence}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-slate-700 leading-relaxed">{d.criticalSignificance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* EQUATOR Checklist Compliance Matrix */}
      {equatorChecklist && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-800 tracking-normal">
                {equatorChecklist.guidelineName} Reporting Compliance Audit
              </h4>
              <p className="text-xs text-slate-600">
                Evaluation of transparent reporting under EQUATOR Network standards.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {equatorChecklist.subsetLabel ? (
                <span className="text-xs font-bold text-[#0f6b6b] bg-[#e3f2f2] border border-[#0f6b6b]/30 rounded-md px-2.5 py-1">
                  {equatorChecklist.subsetLabel}
                </span>
              ) : (
                <>
                  <div className="w-32 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0f6b6b] h-full rounded-full transition-all"
                      style={{ width: `${equatorChecklist.overallCompliancePercentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[#0f6b6b] font-mono">
                    {equatorChecklist.overallCompliancePercentage}% Compliant
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs sm:text-sm">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3 w-1/4">Item & Section</th>
                  <th className="py-2.5 px-3 w-1/3">Requirement</th>
                  <th className="py-2.5 px-3 w-1/6">Status</th>
                  <th className="py-2.5 px-3">Location / Text Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equatorChecklist.criticalItemsAudit.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.itemNumberAndSection}</td>
                    <td className="py-2.5 px-3 text-slate-600">{item.requirement}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'REPORTED'
                            ? 'bg-[#DCFCE7] text-[#166534]'
                            : item.status === 'PARTIALLY_REPORTED'
                            ? 'bg-[#FEF9C3] text-[#854D0E]'
                            : item.status === 'NOT_REPORTED'
                            ? 'bg-[#FEE2E2] text-[#991B1B]'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 text-xs sm:text-sm leading-relaxed">
                      {isVerbatimInManuscript(item.evidenceOrPageLocation, currentManuscript) ? (
                        <span className="font-serif italic text-slate-800">
                          <span className="not-italic text-[10px] font-sans font-bold uppercase text-[#0f6b6b] bg-[#e3f2f2] border border-[#0f6b6b]/30 rounded px-1.5 py-0.5 mr-1.5 inline-block">
                            Quote
                          </span>
                          &ldquo;{item.evidenceOrPageLocation}&rdquo;
                        </span>
                      ) : (
                        <span className="font-sans text-slate-600 not-italic">
                          <span className="text-[10px] font-sans font-bold uppercase text-slate-600 bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 mr-1.5 inline-block">
                            {currentAppraisal.engineUsed === 'llm' ? 'Appraiser note' : 'Engine note (heuristic)'}
                          </span>
                          {item.evidenceOrPageLocation}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
  );
};
