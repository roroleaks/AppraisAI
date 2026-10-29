'use client';

import React from 'react';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import {
  BarChart2,
  AlertOctagon,
  CheckCircle,
  XCircle,
  HelpCircle,
  Layers,
  Scale,
  Zap,
} from 'lucide-react';

export const StatisticalAuditViewer: React.FC = () => {
  const { currentAppraisal, isEditMode, updateAppraisalField } = useAppraisalStore();
  if (!currentAppraisal) return null;

  const { statisticalAudit } = currentAppraisal;
  const { spinAndDiscrepancyAudit, strengthsAndLimitations } = statisticalAudit;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            Statistical & Methodological Rigor Audit
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit of power calculation, analysis populations, effect sizes, and abstract spin.
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-md">
          Analysis Type: {statisticalAudit.analysisType.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Spin Alert Banner if Detected */}
      {spinAndDiscrepancyAudit.spinDetected ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 space-y-1">
            <p className="font-bold text-sm text-red-950">
              Spin / Overinterpretation Warning Detected
            </p>
            <p className="font-serif leading-relaxed">
              {spinAndDiscrepancyAudit.discrepancyDetails}
            </p>
            <p className="text-[11px] font-sans font-medium text-red-800 pt-1">
              <strong>Recommendation:</strong> {spinAndDiscrepancyAudit.recommendationForInterpretation}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>No Spin Detected:</strong> Abstract and conclusion claims appear justified by the primary outcome data.
          </span>
        </div>
      )}

      {/* Grid: Power Calculation + Confounding & Subgroups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-brand-600" /> Sample Size & Power Calculation
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                statisticalAudit.sampleSizePowerCalculation.reported
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {statisticalAudit.sampleSizePowerCalculation.reported ? 'Reported' : 'Not Reported'}
            </span>
          </div>
          {isEditMode ? (
            <textarea
              value={statisticalAudit.sampleSizePowerCalculation.adequacyAssessment}
              onChange={(e) =>
                updateAppraisalField(
                  'statisticalAudit.sampleSizePowerCalculation.adequacyAssessment',
                  e.target.value
                )
              }
              className="w-full p-1.5 border border-slate-300 rounded text-xs font-sans"
              rows={2}
            />
          ) : (
            <p className="text-slate-600 leading-relaxed">
              {statisticalAudit.sampleSizePowerCalculation.adequacyAssessment}
            </p>
          )}
          {(statisticalAudit.sampleSizePowerCalculation.alphaAndPower ||
            statisticalAudit.sampleSizePowerCalculation.assumedEffectSize) && (
            <div className="pt-1 text-[11px] text-slate-500 font-mono">
              {statisticalAudit.sampleSizePowerCalculation.alphaAndPower && (
                <div>Power/Alpha: {statisticalAudit.sampleSizePowerCalculation.alphaAndPower}</div>
              )}
              {statisticalAudit.sampleSizePowerCalculation.assumedEffectSize && (
                <div>Assumed Effect: {statisticalAudit.sampleSizePowerCalculation.assumedEffectSize}</div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" /> Confounding & Multiplicity Control
          </span>
          <div>
            <span className="font-semibold text-slate-700 text-[11px] block">Covariate Adjustment:</span>
            <p className="text-slate-600 leading-relaxed">
              {statisticalAudit.confoundingAndCovariateAdjustment}
            </p>
          </div>
          <div className="pt-1">
            <span className="font-semibold text-slate-700 text-[11px] block">Subgroups & Multiplicity:</span>
            <p className="text-slate-600 leading-relaxed">
              {statisticalAudit.multiplicityAndSubgroupAudit}
            </p>
          </div>
        </div>
      </div>

      {/* Effect Estimates Table */}
      {statisticalAudit.effectEstimates.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Primary & Secondary Effect Estimates
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3">Outcome</th>
                  <th className="py-2.5 px-3">Metric</th>
                  <th className="py-2.5 px-3 font-mono">Point Estimate</th>
                  <th className="py-2.5 px-3 font-mono">95% CI</th>
                  <th className="py-2.5 px-3 font-mono">P-Value</th>
                  <th className="py-2.5 px-3">Clinical vs Statistical Significance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statisticalAudit.effectEstimates.map((est, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={est.outcome}
                          onChange={(e) =>
                            updateAppraisalField(`statisticalAudit.effectEstimates.${idx}.outcome`, e.target.value)
                          }
                          className="w-full p-1 border border-slate-300 rounded text-xs"
                        />
                      ) : (
                        est.outcome
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-indigo-700">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={est.metric}
                          onChange={(e) =>
                            updateAppraisalField(`statisticalAudit.effectEstimates.${idx}.metric`, e.target.value)
                          }
                          className="w-24 p-1 border border-slate-300 rounded text-xs"
                        />
                      ) : (
                        est.metric
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={est.pointEstimate}
                          onChange={(e) =>
                            updateAppraisalField(`statisticalAudit.effectEstimates.${idx}.pointEstimate`, e.target.value)
                          }
                          className="w-16 p-1 border border-slate-300 rounded text-xs font-mono"
                        />
                      ) : (
                        est.pointEstimate
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={est.confidenceInterval}
                          onChange={(e) =>
                            updateAppraisalField(
                              `statisticalAudit.effectEstimates.${idx}.confidenceInterval`,
                              e.target.value
                            )
                          }
                          className="w-28 p-1 border border-slate-300 rounded text-xs font-mono"
                        />
                      ) : (
                        est.confidenceInterval
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={est.pValue}
                          onChange={(e) =>
                            updateAppraisalField(`statisticalAudit.effectEstimates.${idx}.pValue`, e.target.value)
                          }
                          className="w-20 p-1 border border-slate-300 rounded text-xs font-mono"
                        />
                      ) : (
                        est.pValue
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 leading-tight">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={est.clinicalVsStatisticalSignificance}
                          onChange={(e) =>
                            updateAppraisalField(
                              `statisticalAudit.effectEstimates.${idx}.clinicalVsStatisticalSignificance`,
                              e.target.value
                            )
                          }
                          className="w-full p-1 border border-slate-300 rounded text-xs"
                        />
                      ) : (
                        est.clinicalVsStatisticalSignificance
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Methodological Strengths, Fatal Flaws & Minor Limitations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2">
          <span className="font-bold text-emerald-900 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> Methodological Strengths
          </span>
          <ul className="list-disc pl-4 space-y-1 text-emerald-950">
            {strengthsAndLimitations.majorStrengths.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="p-3 bg-red-50/60 border border-red-200 rounded-lg space-y-2">
          <span className="font-bold text-red-900 flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-600" /> Fatal Flaws / Critical Biases
          </span>
          <ul className="list-disc pl-4 space-y-1 text-red-950">
            {strengthsAndLimitations.fatalMethodologicalFlaws.length > 0 ? (
              strengthsAndLimitations.fatalMethodologicalFlaws.map((f, idx) => (
                <li key={idx}>{f}</li>
              ))
            ) : (
              <li className="italic text-slate-500">No fatal methodological flaws identified.</li>
            )}
          </ul>
        </div>

        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2">
          <span className="font-bold text-amber-900 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-600" /> Minor Limitations
          </span>
          <ul className="list-disc pl-4 space-y-1 text-amber-950">
            {strengthsAndLimitations.minorLimitations.map((l, idx) => (
              <li key={idx}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
