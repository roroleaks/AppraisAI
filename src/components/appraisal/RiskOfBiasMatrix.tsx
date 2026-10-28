'use client';

import React from 'react';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import { BiasJudgement } from '@/lib/schemas/appraisal.schema';
import { ShieldAlert, CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

export const RiskOfBiasMatrix: React.FC = () => {
  const { currentAppraisal, isEditMode, updateRoBDomainJudgement, updateAppraisalField } =
    useAppraisalStore();

  if (!currentAppraisal) return null;

  const { riskOfBias, equatorChecklist } = currentAppraisal;

  const renderJudgementBadge = (judgement: BiasJudgement) => {
    switch (judgement) {
      case 'LOW_RISK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Low Risk
          </span>
        );
      case 'SOME_CONCERNS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Some Concerns
          </span>
        );
      case 'HIGH_RISK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-3.5 h-3.5 text-red-600" /> High Risk
          </span>
        );
      case 'UNCLEAR_NOT_REPORTED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" /> Unclear / Not Reported
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      {/* RoB Header & Overall Score */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-brand-600" />
            {riskOfBias.governingTool} Assessment Matrix
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Domain-specific methodological audit with direct evidentiary grounding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Overall Risk of Bias:</span>
          {renderJudgementBadge(riskOfBias.overallRisk)}
        </div>
      </div>

      {/* RoB Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
        <table className="w-full text-left border-collapse">
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
                <td className="py-3 px-4 font-serif text-slate-600 italic leading-relaxed">
                  &ldquo;{d.supportiveEvidence}&rdquo;
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
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {equatorChecklist.guidelineName} Reporting Compliance Audit
              </h4>
              <p className="text-[11px] text-slate-500">
                Evaluation of transparent reporting under EQUATOR Network standards.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-brand-600 h-full rounded-full transition-all"
                  style={{ width: `${equatorChecklist.overallCompliancePercentage}%` }}
                />
              </div>
              <span className="text-xs font-bold text-brand-700 font-mono">
                {equatorChecklist.overallCompliancePercentage}% Compliant
              </span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2 px-3 w-1/4">Item & Section</th>
                  <th className="py-2 px-3 w-1/3">Requirement</th>
                  <th className="py-2 px-3 w-1/6">Status</th>
                  <th className="py-2 px-3">Location / Text Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equatorChecklist.criticalItemsAudit.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-semibold text-slate-800">{item.itemNumberAndSection}</td>
                    <td className="py-2 px-3 text-slate-600">{item.requirement}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'REPORTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'PARTIALLY_REPORTED'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'NOT_REPORTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-serif text-[11px]">
                      {item.evidenceOrPageLocation}
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
