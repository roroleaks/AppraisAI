'use client';

import React from 'react';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import { BookOpen, Users, Activity, Target, Shield, Clock, MapPin, Award } from 'lucide-react';

export const PicoSummaryCard: React.FC = () => {
  const { currentAppraisal, isEditMode, updateAppraisalField } = useAppraisalStore();
  if (!currentAppraisal) return null;

  const { classification, pico, executiveAbstract } = currentAppraisal;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      {/* Classification Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
            Governing Framework & Classification
          </span>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="px-3 py-1 bg-brand-50 text-brand-800 border border-brand-200 text-xs font-bold rounded-md">
              {classification.studyDesign.replace(/_/g, ' ')}
            </span>
            <span className="px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold rounded-md flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              {classification.equatorReportingGuideline}
            </span>
            <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-md flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              CEBM Oxford {classification.oxfordEvidenceLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Executive Structured Abstract */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Executive Structured Commentary Abstract
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-serif leading-relaxed">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-sans font-bold text-slate-700 block mb-1">Background</span>
            {isEditMode ? (
              <textarea
                value={executiveAbstract.background}
                onChange={(e) => updateAppraisalField('executiveAbstract.background', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-xs font-sans"
                rows={3}
              />
            ) : (
              <p className="text-slate-700">{executiveAbstract.background}</p>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-sans font-bold text-slate-700 block mb-1">Methodological Summary</span>
            {isEditMode ? (
              <textarea
                value={executiveAbstract.methodologicalSummary}
                onChange={(e) => updateAppraisalField('executiveAbstract.methodologicalSummary', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-xs font-sans"
                rows={3}
              />
            ) : (
              <p className="text-slate-700">{executiveAbstract.methodologicalSummary}</p>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-sans font-bold text-slate-700 block mb-1">Key Findings</span>
            {isEditMode ? (
              <textarea
                value={executiveAbstract.keyFindings}
                onChange={(e) => updateAppraisalField('executiveAbstract.keyFindings', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-xs font-sans"
                rows={3}
              />
            ) : (
              <p className="text-slate-700">{executiveAbstract.keyFindings}</p>
            )}
          </div>

          <div className="p-3 bg-brand-50/60 rounded-lg border border-brand-200">
            <span className="font-sans font-bold text-brand-900 block mb-1">Critical Verdict</span>
            {isEditMode ? (
              <textarea
                value={executiveAbstract.criticalVerdict}
                onChange={(e) => updateAppraisalField('executiveAbstract.criticalVerdict', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-xs font-sans"
                rows={3}
              />
            ) : (
              <p className="text-brand-950 font-medium">{executiveAbstract.criticalVerdict}</p>
            )}
          </div>
        </div>
      </div>

      {/* Structured PICO/PECO Matrix */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Structured PICO / PECO Deconstruction Table
        </h4>
        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <tbody>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <td className="w-36 px-4 py-3 font-semibold text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-600" /> Population (P)
                </td>
                <td className="px-4 py-3 text-slate-800 leading-relaxed">
                  {isEditMode ? (
                    <textarea
                      value={pico.population}
                      onChange={(e) => updateAppraisalField('pico.population', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-xs font-sans"
                      rows={2}
                    />
                  ) : (
                    pico.population
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-700 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" /> Intervention (I)
                </td>
                <td className="px-4 py-3 text-slate-800 leading-relaxed">
                  {isEditMode ? (
                    <textarea
                      value={pico.interventionOrExposure}
                      onChange={(e) => updateAppraisalField('pico.interventionOrExposure', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-xs font-sans"
                      rows={2}
                    />
                  ) : (
                    pico.interventionOrExposure
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <td className="px-4 py-3 font-semibold text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600" /> Comparator (C)
                </td>
                <td className="px-4 py-3 text-slate-800 leading-relaxed">
                  {isEditMode ? (
                    <textarea
                      value={pico.comparator}
                      onChange={(e) => updateAppraisalField('pico.comparator', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-xs font-sans"
                      rows={2}
                    />
                  ) : (
                    pico.comparator
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-700 flex items-center gap-2">
                  <Target className="w-4 h-4 text-crimson-600" /> Primary Outcomes (O)
                </td>
                <td className="px-4 py-3 text-slate-800 leading-relaxed">
                  {isEditMode ? (
                    <textarea
                      value={pico.primaryOutcomes.join('\n')}
                      onChange={(e) =>
                        updateAppraisalField(
                          'pico.primaryOutcomes',
                          e.target.value.split('\n').filter((s) => s.trim().length > 0)
                        )
                      }
                      className="w-full p-2 border border-slate-300 rounded text-xs font-sans"
                      rows={3}
                      placeholder="One outcome per line"
                    />
                  ) : (
                    <ul className="list-disc pl-4 space-y-1">
                      {pico.primaryOutcomes.map((o, idx) => (
                        <li key={idx}>{o}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <td className="px-4 py-3 font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" /> Timeframe & Setting
                </td>
                <td className="px-4 py-3 text-slate-800 leading-relaxed">
                  {isEditMode ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={pico.timeframe}
                        onChange={(e) => updateAppraisalField('pico.timeframe', e.target.value)}
                        className="p-1.5 border border-slate-300 rounded text-xs font-sans"
                        placeholder="Follow-up timeframe"
                      />
                      <input
                        type="text"
                        value={pico.setting}
                        onChange={(e) => updateAppraisalField('pico.setting', e.target.value)}
                        className="p-1.5 border border-slate-300 rounded text-xs font-sans"
                        placeholder="Clinical setting"
                      />
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-700">Follow-up:</span> {pico.timeframe} |{' '}
                      <span className="font-semibold text-slate-700">Setting:</span> {pico.setting}
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
