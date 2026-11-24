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
      <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[#0f6b6b]" />
            Statistical Rigor, Effect Estimates & Spin Audit
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Audit of power calculation, analysis populations, effect sizes, and abstract spin.
          </p>
        </div>
        <span className="text-sm font-mono px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-md">
          Analysis Type: {statisticalAudit.analysisType.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Trial Specifics Banner (Non-inferiority, Adherence, Stopping) */}
      {(statisticalAudit.trialSpecifics?.framework === 'non-inferiority' ||
        statisticalAudit.trialSpecifics?.adherence ||
        statisticalAudit.trialSpecifics?.stoppedEarly) && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm text-slate-700">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-[#0f6b6b]" />
            <span>Trial Specific Parameters & Governance:</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {statisticalAudit.trialSpecifics.framework === 'non-inferiority' && (
              <div className="bg-white border border-slate-200 rounded-md p-2 flex-1 min-w-[240px]">
                <p className="font-bold text-sm text-slate-800">Non-Inferiority Framework</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  Margin: <strong>{statisticalAudit.trialSpecifics.nonInferiorityMargin || 'Not identified'}</strong>
                </p>
                {statisticalAudit.trialSpecifics.nonInferiorityConclusion && (
                  <p className="text-sm text-amber-800 font-medium mt-1">
                    {statisticalAudit.trialSpecifics.nonInferiorityConclusion}
                  </p>
                )}
              </div>
            )}
            {statisticalAudit.trialSpecifics.adherence && (
              <div className="bg-white border border-slate-200 rounded-md p-2 flex-1 min-w-[200px]">
                <p className="font-bold text-sm text-slate-800">Protocol Adherence</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  Reported adherence: <strong>{statisticalAudit.trialSpecifics.adherence}</strong>
                </p>
              </div>
            )}
            {statisticalAudit.trialSpecifics.stoppedEarly && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 flex-1 min-w-[200px]">
                <p className="font-bold text-sm text-amber-900">Premature Trial Termination</p>
                <p className="text-sm text-amber-800 mt-0.5">
                  Trial stopped early / planned sample size not achieved.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spin Alert Banner if Detected (Task A5: Tri-state) */}
      {spinAndDiscrepancyAudit.spinStatus === 'not-assessed' ? (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-sm text-slate-700">
          <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            <strong>Spin & Discrepancy Audit:</strong> Not assessed by heuristic screening engine (requires full text peer review or neural LLM pass).
          </span>
        </div>
      ) : spinAndDiscrepancyAudit.spinDetected ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-900 space-y-1">
            <p className="font-bold text-sm text-red-950">
              Spin / Overinterpretation Warning Detected
            </p>
            <p className="font-serif leading-relaxed">
              {spinAndDiscrepancyAudit.discrepancyDetails}
            </p>
            <p className="text-sm font-sans font-medium text-red-800 pt-1">
              <strong>Recommendation:</strong> {spinAndDiscrepancyAudit.recommendationForInterpretation}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>No Spin Identified:</strong> Abstract claims independently audited against primary outcome data.
          </span>
        </div>
      )}

      {/* Grid: Power Calculation + Confounding & Subgroups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-[#0f6b6b]" /> Sample Size & Power Calculation
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                statisticalAudit.sampleSizePowerCalculation.reported
                  ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                  : 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
              }`}
            >
              {statisticalAudit.sampleSizePowerCalculation.reported ? (
                <>
                  <CheckCircle className="w-3 h-3 text-[#047857]" />
                  <span>Reported</span>
                </>
              ) : (
                <>
                  <HelpCircle className="w-3 h-3 text-[#475569]" />
                  <span>Not Reported</span>
                </>
              )}
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
              className="w-full p-1.5 border border-slate-300 rounded text-sm font-sans"
              rows={2}
            />
          ) : (
            <p className="text-slate-600 leading-relaxed">
              {statisticalAudit.sampleSizePowerCalculation.adequacyAssessment}
            </p>
          )}
          {(statisticalAudit.sampleSizePowerCalculation.alphaAndPower ||
            statisticalAudit.sampleSizePowerCalculation.assumedEffectSize) && (
            <div className="pt-1 text-sm text-slate-500 font-mono">
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
            <span className="font-semibold text-slate-700 text-sm block">Covariate Adjustment:</span>
            <p className="text-slate-600 leading-relaxed">
              {statisticalAudit.confoundingAndCovariateAdjustment}
            </p>
          </div>
          <div className="pt-1">
            <span className="font-semibold text-slate-700 text-sm block">Subgroups & Multiplicity:</span>
            <p className="text-slate-600 leading-relaxed">
              {statisticalAudit.multiplicityAndSubgroupAudit}
            </p>
          </div>
        </div>
      </div>

      {/* Effect Estimates Table */}
      {statisticalAudit.effectEstimates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            Primary & Secondary Effect Estimates
          </h3>
          <div
            className="border border-slate-200 rounded-lg overflow-x-auto text-sm"
            role="region"
            aria-label="Statistical Effect Estimates Table"
            tabIndex={0}
          >
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3">Outcome & Type</th>
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
                          className="w-full p-1 border border-slate-300 rounded text-sm"
                        />
                      ) : (
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900">{est.outcome}</span>
                            {est.isPrimary && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0f6b6b] text-white">
                                PRIMARY
                              </span>
                            )}
                          </div>
                          {(() => {
                            const t = est.outcomeType || 'unlabelled';
                            const map: Record<string, [string, string, React.ReactNode]> = {
                              benefit: [
                                'Favours intervention',
                                'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
                                <CheckCircle key="icon" className="w-3 h-3 text-[#047857]" />,
                              ],
                              harm: [
                                'Favours comparator',
                                'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
                                <XCircle key="icon" className="w-3 h-3 text-[#B91C1C]" />,
                              ],
                              'no-clear-difference': [
                                'No clear difference',
                                'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]',
                                <HelpCircle key="icon" className="w-3 h-3 text-[#475569]" />,
                              ],
                              process: [
                                'Process measure',
                                'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
                                <Zap key="icon" className="w-3 h-3 text-[#0369A1]" />,
                              ],
                              unlabelled: [
                                'Direction not interpretable',
                                'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]',
                                <HelpCircle key="icon" className="w-3 h-3 text-[#475569]" />,
                              ],
                            };
                            const [label, cls, icon] = map[t] ?? map.unlabelled;
                            return (
                              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-sm font-semibold border ${cls}`}>
                                {icon}
                                <span>{label}</span>
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#0f6b6b]">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={est.metric}
                          onChange={(e) =>
                            updateAppraisalField(`statisticalAudit.effectEstimates.${idx}.metric`, e.target.value)
                          }
                          className="w-24 p-1 border border-slate-300 rounded text-sm"
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
                          className="w-16 p-1 border border-slate-300 rounded text-sm font-mono"
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
                          className="w-28 p-1 border border-slate-300 rounded text-sm font-mono"
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
                          className="w-20 p-1 border border-slate-300 rounded text-sm font-mono"
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
                          className="w-full p-1 border border-slate-300 rounded text-sm"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pt-2">
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
            {strengthsAndLimitations.flawsStatus === 'not-assessed' ? (
              <li className="italic text-slate-500">Not assessed by heuristic screening engine (requires full manuscript audit).</li>
            ) : strengthsAndLimitations.fatalMethodologicalFlaws.length > 0 ? (
              strengthsAndLimitations.fatalMethodologicalFlaws.map((f, idx) => (
                <li key={idx}>{f}</li>
              ))
            ) : (
              <li className="italic text-slate-500">None identified upon formal audit.</li>
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
