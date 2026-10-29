'use client';

import React, { useState } from 'react';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import { SourceDepthBadge } from './SourceDepthBadge';
import {
  BookOpen,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Sparkles,
  Layers,
  FileText,
  AlignLeft,
  ChevronDown,
  ChevronUp,
  Cpu,
} from 'lucide-react';

export const ManuscriptPreviewCard: React.FC = () => {
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const {
    currentManuscript,
    clearManuscript,
    isAppraising,
    setAppraising,
    setAppraisal,
    setAppraisalStep,
    setAppraisalError,
    llmProvider,
    llmApiKey,
    llmModel,
  } = useAppraisalStore();

  if (!currentManuscript) return null;

  const { metadata, abstract, sections, pageCount } = currentManuscript;
  const isAbstractOnly = metadata.sourceDepth === 'ABSTRACT_ONLY_FALLBACK';

  // Format and segment abstract into clean paragraphs
  const abstractParagraphs = abstract
    ? abstract
        .split(/(?:\r?\n){2,}|(?<=\.)\s+(?=[A-Z][a-z]+:)/g)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    : [];

  const handleLaunchAppraisal = async () => {
    setAppraising(true);
    setAppraisalError(null);
    setAppraisalStep(1, 'Pass 1: Deconstructing study design, Oxford CEBM level, and PICO...');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (llmApiKey) {
        headers['x-llm-provider'] = llmProvider;
        headers['x-llm-key'] = llmApiKey;
        headers['x-llm-model'] = llmModel;
      }

      // Step progress timers for live feedback while single-turn full pipeline executes
      const step2Timer = setTimeout(() => {
        setAppraisalStep(2, 'Pass 2: Enforcing EQUATOR checklist and Cochrane RoB 2.0 / AMSTAR-2 matrix...');
      }, 3500);

      const step3Timer = setTimeout(() => {
        setAppraisalStep(3, 'Pass 3: Auditing statistical rigor, power, ITT vs PP, and abstract spin...');
      }, 7500);

      const step4Timer = setTimeout(() => {
        setAppraisalStep(4, 'Pass 4: Synthesizing validity, GRADE certainty rating, and references...');
      }, 11500);

      const res = await fetch('/api/appraise', {
        method: 'POST',
        headers,
        body: JSON.stringify({ manuscript: currentManuscript }),
      });

      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
      clearTimeout(step4Timer);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete critical appraisal');
      }

      setAppraisal(data);
    } catch (err: any) {
      setAppraisalError(err.message || 'Critical appraisal encountered an error.');
    } finally {
      setAppraising(false);
    }
  };

  return (
    <div className="w-full bg-white border border-[#d8dee6] rounded-xl shadow-sm overflow-hidden transition-all">
      {/* Top Banner - Signature Teal */}
      <div className="bg-gradient-to-r from-[#0f6b6b] to-[#0a4a4a] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-[#99f6e4]" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-white font-serif">
              Ingested Manuscript Abstract & Metadata
            </h2>
            <p className="text-[11px] text-white/80">
              Manuscript ingested and parsed. Showing structured abstract overview for Step 2.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SourceDepthBadge sourceDepth={metadata.sourceDepth} />
          <button
            onClick={clearManuscript}
            disabled={isAppraising}
            className="text-xs text-white/90 hover:text-white flex items-center gap-1 transition-colors px-2.5 py-1 rounded bg-black/20 hover:bg-black/30 disabled:opacity-50 border border-white/20"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Change Paper
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Paywall Warning Banner */}
        {isAbstractOnly && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-semibold text-sm text-amber-950">
                Notice: Publisher Paywall Detected — Abstract-Only Ingestion
              </p>
              <p>
                This paper was resolved from an external metadata index, but the complete manuscript body is behind a paywall.
                For full methodological depth (e.g. detailed CONSORT/RoB-2 table evaluations and statistical precision checks), 
                we recommend uploading the complete PDF manuscript above.
              </p>
            </div>
          </div>
        )}

        {/* Paper Title & Citation Box */}
        <div>
          <h3 className="text-xl font-serif font-bold text-slate-900 leading-snug">
            {metadata.title}
          </h3>
          <div className="mt-3 p-3.5 bg-[#f6f8fa] border border-[#d8dee6] rounded-lg font-serif text-xs text-slate-800 leading-relaxed shadow-xs">
            <span className="font-sans font-semibold text-[#0f6b6b] uppercase tracking-wider text-[10px] block mb-1">
              ICMJE / Vancouver Style Citation
            </span>
            {metadata.vancouverCitation}
          </div>
        </div>

        {/* Key Bibliographic Specs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3.5 border-y border-slate-200 text-xs bg-slate-50/50 rounded-lg px-4">
          <div>
            <span className="text-slate-500 block text-[11px]">Journal</span>
            <span className="font-semibold text-slate-800 truncate block">{metadata.journal}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Year / Volume</span>
            <span className="font-semibold text-slate-800">
              {metadata.publicationYear} {metadata.volume ? `Vol. ${metadata.volume}` : ''}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Identifier</span>
            <span className="font-mono text-slate-800 truncate block">
              {metadata.doi ? `DOI: ${metadata.doi}` : metadata.pmid ? `PMID: ${metadata.pmid}` : 'Direct PDF'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Content Parsed</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {sections.length > 0 ? `${sections.length} Sections` : 'Abstract Body'}
              {pageCount ? ` (${pageCount} pgs)` : ''}
            </span>
          </div>
        </div>

        {/* Abstract Section - Arranged into Professional Paragraphs with 1500 char expander */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <AlignLeft className="w-4 h-4 text-[#0f6b6b]" />
              Structured Manuscript Abstract
            </h4>
            <span className="text-[11px] text-slate-500">
              Full text parsed and indexed for analytical pipeline
            </span>
          </div>

          <div className="p-5 bg-white border border-[#d8dee6] rounded-xl text-xs text-slate-800 font-serif leading-relaxed shadow-xs space-y-3 max-h-80 overflow-y-auto">
            {abstractParagraphs.length > 0 ? (
              (() => {
                const totalLength = abstract.length;
                const isLong = totalLength > 1500;
                let displayedText = abstract;
                if (isLong && !isAbstractExpanded) {
                  displayedText = abstract.slice(0, 1500) + '...';
                }
                const paras = displayedText
                  .split(/(?:\r?\n){2,}|(?<=\.)\s+(?=[A-Z][a-z]+:)/g)
                  .map((p) => p.trim())
                  .filter((p) => p.length > 0);

                return (
                  <>
                    {paras.map((paragraph, idx) => (
                      <p key={idx} className="text-justify leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                    {isLong && (
                      <div className="pt-2 text-center border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsAbstractExpanded(!isAbstractExpanded)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-sans font-semibold rounded-md transition"
                        >
                          {isAbstractExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" /> Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" /> Read More ({totalLength} chars)
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              <p className="italic text-slate-500">Abstract text unavailable.</p>
            )}
          </div>
        </div>

        {/* Proceed to 4-Pass Appraisal Action Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#0f6b6b]" />
              <span>Ready for 4-Pass Methodological Appraisal</span>
            </div>
            {llmApiKey ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Sparkles className="w-3 h-3 text-emerald-600" /> Neural LLM ({llmProvider.toUpperCase()})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <Cpu className="w-3 h-3 text-amber-600" /> Deterministic Mode Active
              </span>
            )}
          </div>

          <button
            onClick={handleLaunchAppraisal}
            disabled={isAppraising}
            className="w-full sm:w-auto px-6 py-3 bg-[#0f6b6b] hover:bg-[#0b5555] disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2"
          >
            {isAppraising ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing 4-Pass Methodological Engine...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Launch 4-Pass Governing Critical Appraisal
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
