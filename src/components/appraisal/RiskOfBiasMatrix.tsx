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

  const renderJudgementBadge = (judgement: BiasJudgement, supportiveEvidence?: string) => {
    if (supportiveEvidence?.startsWith('Favourable signal')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
          <HelpCircle className="w-3.5 h-3.5 text-[#B45309]" /> Unclear — favourable signal
        </span>
      );
    }
    switch (judgement) {
      case 'LOW_RISK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
            <CheckCircle className="w-3.5 h-3.5 text-[#047857]" /> Low Risk
          </span>
        );
      case 'SOME_CONCERNS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
            <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" /> Some Concerns
          </span>
        );
      case 'HIGH_RISK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
            <XCircle className="w-3.5 h-3.5 text-[#B91C1C]" /> High Risk
          </span>
        );
      case 'UNCLEAR_NOT_REPORTED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
            <HelpCircle className="w-3.5 h-3.5 text-[#475569]" /> Unclear / Not Reported
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-6">
      {/* RoB Header & Overall Score */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#0f6b6b]" />
            {riskOfBias.governingTool} Assessment Matrix
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Domain-specific methodological audit with direct evidentiary grounding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Overall Risk of Bias:</span>
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <select
                value={riskOfBias.overallRisk}
                onChange={(e) => handleOverallRiskChange(e.target.value as BiasJudgement)}
                className="p-1 border border-slate-300 rounded text-sm bg-white font-bold"
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
      <div
        role="region"
        aria-label={`${riskOfBias.governingTool} Assessment Matrix`}
        tabIndex={0}
        className="border border-slate-200 rounded-lg overflow-x-auto text-sm"
      >
        <table className="w-full text-left border-collapse min-w-full sm:min-w-[640px]">
          <thead className="hidden sm:table-header-group">
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
              <th className="py-2.5 px-4 w-1/4">Bias Domain</th>
              <th className="py-2.5 px-3 w-1/6">Judgement</th>
              <th className="py-2.5 px-4 w-1/3">Supportive Text Evidence</th>
              <th className="py-2.5 px-4">Methodological Significance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {riskOfBias.domains.map((d, idx) => (
              <tr key={idx} className="block sm:table-row p-3.5 sm:p-0 hover:bg-slate-50/60 transition-colors border-b sm:border-b-0 border-slate-200">
                <td className="block sm:table-cell py-1 sm:py-3 px-0 sm:px-4 font-semibold text-slate-800">
                  <span className="sm:hidden font-bold text-slate-500 mr-1.5">Domain:</span>
                  {d.domainName}
                </td>
                <td className="block sm:table-cell py-1 sm:py-3 px-0 sm:px-3">
                  <span className="sm:hidden font-bold text-slate-500 mr-1.5">Judgement:</span>
                  {isEditMode ? (
                    <select
                      value={d.judgement}
                      onChange={(e) => updateRoBDomainJudgement(idx, e.target.value as BiasJudgement)}
                      className="p-1 border border-slate-300 rounded text-sm bg-white"
                    >
                      <option value="LOW_RISK">Low Risk</option>
                      <option value="SOME_CONCERNS">Some Concerns</option>
                      <option value="HIGH_RISK">High Risk</option>
                      <option value="UNCLEAR_NOT_REPORTED">Unclear / Not Reported</option>
                    </select>
                  ) : (
                    renderJudgementBadge(d.judgement, d.supportiveEvidence)
                  )}
                </td>
                <td className="block sm:table-cell py-1 sm:py-3 px-0 sm:px-4 leading-relaxed">
                  <span className="sm:hidden font-bold text-slate-500 mr-1.5">Evidence:</span>
                  {isEditMode ? (
                    <textarea
                      value={d.supportiveEvidence}
                      onChange={(e) =>
                        updateAppraisalField(`riskOfBias.domains.${idx}.supportiveEvidence`, e.target.value)
                      }
                      className="w-full p-1.5 border border-slate-300 rounded text-sm font-sans not-italic"
                      rows={2}
                    />
                  ) : isVerbatimInManuscript(d.supportiveEvidence, currentManuscript) ? (
                    <span className="font-serif italic text-slate-800">
                      <span className="not-italic text-[10px] font-sans font-bold uppercase text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] rounded px-1.5 py-0.5 mr-1.5 inline-block">
                        Quote
                      </span>
                      &ldquo;{d.supportiveEvidence}&rdquo;
                    </span>
                  ) : (
                    <span className="font-sans text-slate-600 not-italic text-sm">
                      <span className="text-[10px] font-sans font-bold uppercase text-[#475569] bg-[#F1F5F9] border border-[#CBD5E1] rounded px-1.5 py-0.5 mr-1.5 inline-block">
                        {currentAppraisal.engineUsed === 'llm' ? 'Appraiser note' : 'Engine note (heuristic)'}
                      </span>
                      {d.supportiveEvidence}
                    </span>
                  )}
                </td>
                <td className="block sm:table-cell py-1 sm:py-3 px-0 sm:px-4 text-slate-700 leading-relaxed">
                  <span className="sm:hidden font-bold text-slate-500 mr-1.5">Significance:</span>
                  {d.criticalSignificance}
                </td>
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
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#0f6b6b]" />
                {equatorChecklist.guidelineName} Reporting Compliance Audit
              </h2>
              <p className="text-sm text-slate-600">
                Evaluation of transparent reporting under EQUATOR Network standards.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {equatorChecklist.subsetLabel ? (
                <span className="text-sm font-bold text-[#0f6b6b] bg-[#e3f2f2] border border-[#0f6b6b]/30 rounded-md px-2.5 py-1">
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
                  <span className="text-sm font-bold text-[#0f6b6b] font-mono">
                    {equatorChecklist.overallCompliancePercentage}% Compliant
                  </span>
                </>
              )}
            </div>
          </div>

          <div
            role="region"
            aria-label={`${equatorChecklist.guidelineName} Reporting Compliance Audit`}
            tabIndex={0}
            className="border border-slate-200 rounded-lg overflow-x-auto text-sm"
          >
            <table className="w-full text-left border-collapse min-w-full sm:min-w-[640px]">
              <thead className="hidden sm:table-header-group">
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3 w-1/4">Item & Section</th>
                  <th className="py-2.5 px-3 w-1/3">Requirement</th>
                  <th className="py-2.5 px-3 w-1/6">Status</th>
                  <th className="py-2.5 px-3">Location / Text Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equatorChecklist.criticalItemsAudit.map((item, idx) => (
                  <tr key={idx} className="block sm:table-row p-3.5 sm:p-0 hover:bg-slate-50/50 border-b sm:border-b-0 border-slate-200">
                    <td className="block sm:table-cell py-1 sm:py-2.5 px-0 sm:px-3 font-semibold text-slate-800">
                      <span className="sm:hidden font-bold text-slate-500 mr-1.5">Item:</span>
                      {item.itemNumberAndSection}
                    </td>
                    <td className="block sm:table-cell py-1 sm:py-2.5 px-0 sm:px-3 text-slate-600">
                      <span className="sm:hidden font-bold text-slate-500 mr-1.5">Requirement:</span>
                      {item.requirement}
                    </td>
                    <td className="block sm:table-cell py-1 sm:py-2.5 px-0 sm:px-3">
                      <span className="sm:hidden font-bold text-slate-500 mr-1.5">Status:</span>
                      {currentAppraisal.metadata.sourceDepth === 'ABSTRACT_ONLY_FALLBACK' &&
                      item.evidenceOrPageLocation.includes('Not found in the abstract') ? (
                        <span className="inline-flex items-center gap-1 text-sm text-[#475569] font-sans">
                          <HelpCircle className="w-3 h-3 text-[#475569]" /> Not found in abstract
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.status === 'REPORTED'
                              ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                              : item.status === 'PARTIALLY_REPORTED'
                              ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                              : item.status === 'NOT_REPORTED'
                              ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                              : 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
                          }`}
                        >
                          {item.status === 'REPORTED' ? (
                            <CheckCircle className="w-3 h-3 text-[#047857]" />
                          ) : item.status === 'PARTIALLY_REPORTED' ? (
                            <AlertTriangle className="w-3 h-3 text-[#B45309]" />
                          ) : item.status === 'NOT_REPORTED' ? (
                            <XCircle className="w-3 h-3 text-[#B91C1C]" />
                          ) : null}
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td className="block sm:table-cell py-1 sm:py-2.5 px-0 sm:px-3 text-slate-700 text-sm leading-relaxed">
                      <span className="sm:hidden font-bold text-slate-500 mr-1.5">Evidence:</span>
                      {isVerbatimInManuscript(item.evidenceOrPageLocation, currentManuscript) ? (
                        <span className="font-serif italic text-slate-800">
                          <span className="not-italic text-[10px] font-sans font-bold uppercase text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] rounded px-1.5 py-0.5 mr-1.5 inline-block">
                            Quote
                          </span>
                          &ldquo;{item.evidenceOrPageLocation}&rdquo;
                        </span>
                      ) : (
                        <span className="font-sans text-slate-600 not-italic">
                          <span className="text-[10px] font-sans font-bold uppercase text-[#475569] bg-[#F1F5F9] border border-[#CBD5E1] rounded px-1.5 py-0.5 mr-1.5 inline-block">
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
};
