'use client';

import React, { useState, useEffect } from 'react';
import { DropzoneUpload } from '@/components/ingestion/DropzoneUpload';
import { IdentifierInput } from '@/components/ingestion/IdentifierInput';
import { ManuscriptPreviewCard } from '@/components/ingestion/ManuscriptPreviewCard';
import { AppraisalProgressStepper } from '@/components/appraisal/AppraisalProgressStepper';
import { PicoSummaryCard } from '@/components/appraisal/PicoSummaryCard';
import { RiskOfBiasMatrix } from '@/components/appraisal/RiskOfBiasMatrix';
import { StatisticalAuditViewer } from '@/components/appraisal/StatisticalAuditViewer';
import { ValidityAndClinicalCard } from '@/components/appraisal/ValidityAndClinicalCard';
import { ExportToolbar } from '@/components/preview/ExportToolbar';
import { LlmSettingsModal } from '@/components/common/LlmSettingsModal';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { RetractionBanner } from '@/components/common/RetractionBanner';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import { reportStatus } from '@/lib/status';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import {
  FileText,
  Link2,
  ShieldCheck,
  BarChart3,
  Award,
  Sparkles,
  BookOpenCheck,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  ArrowUp,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'identifier' | 'upload'>('identifier');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [appUrl, setAppUrl] = useState('https://apprais-ai.vercel.app');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      setAppUrl(window.location.origin);
    }
  }, []);
  const {
    currentManuscript,
    currentAppraisal,
    isAppraising,
    appraisalError,
    clearAppraisal,
    resetAll,
    humanVerified,
    appraiserName,
    llmProvider,
    llmModel,
  } = useAppraisalStore();

  const status = currentAppraisal
    ? reportStatus(currentAppraisal, {
        humanVerified,
        appraiserName,
        provider: currentAppraisal.llmDetails?.provider ?? llmProvider,
        model: currentAppraisal.llmDetails?.model ?? llmModel,
      })
    : null;

  // Browser History & PopState Support for Seamless Back Navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (currentAppraisal) {
      if (window.location.hash !== '#appraisal') {
        window.history.pushState({ stage: 'appraisal' }, '', '#appraisal');
      }
    } else if (currentManuscript) {
      if (window.location.hash !== '#preview') {
        window.history.pushState({ stage: 'preview' }, '', '#preview');
      }
    } else {
      if (window.location.hash && window.location.hash !== '') {
        window.history.pushState({ stage: 'ingest' }, '', window.location.pathname);
      }
    }
  }, [currentManuscript, currentAppraisal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const hash = window.location.hash;
      if (!hash || hash === '' || hash === '#ingest') {
        if (useAppraisalStore.getState().currentAppraisal || useAppraisalStore.getState().currentManuscript) {
          useAppraisalStore.getState().resetAll();
        }
      } else if (hash === '#preview') {
        if (useAppraisalStore.getState().currentAppraisal) {
          useAppraisalStore.getState().clearAppraisal();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-[#1a2332] flex flex-col font-sans">
      {/* Skip to Content Accessible Link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:p-2 focus:bg-white focus:text-[#0f6b6b] focus:font-semibold focus:shadow-md focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Top Header */}
      <header className="bg-gradient-to-r from-[#0f6b6b] to-[#0a4a4a] text-white py-1 px-4 sm:px-8 shadow-md lg:sticky lg:top-0 z-30 h-13 flex items-center">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-2 min-w-0">
          {/* Left: Brand & Badges with Clickable Home Reset */}
          <div
            onClick={() => {
              if (currentManuscript || currentAppraisal) {
                setShowResetConfirmModal(true);
              }
            }}
            className="flex items-center gap-2.5 cursor-pointer group select-none min-w-0"
            title="AppraisAI Home / Reset"
          >
            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/40 shadow-sm shrink-0 bg-slate-900 group-hover:scale-105 transition-transform">
              <Image
                src="/appraisai-icon.png"
                alt="AppraisAI Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-white font-serif shrink-0">
                  Apprais<span className="text-[#99f6e4]">AI</span>
                </span>
                <span className="hidden lg:inline-flex bg-white/20 border border-white/40 text-white rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide shrink-0">
                  v1.0 PRISMA & RoB 2.0
                </span>
              </div>
              <p className="text-xs text-white/85 italic hidden lg:block truncate">
                Automated Scientific Medical Paper Critical Appraisal & Report Engine
              </p>
            </div>
          </div>

          {/* Right: Actions, Author Profile & LLM Settings */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Header New Appraisal Reset Button */}
            {(currentManuscript || currentAppraisal) && (
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 text-xs font-semibold text-white transition shadow-xs"
                title="Start New Appraisal"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Appraisal</span>
              </button>
            )}

            <LlmSettingsModal />

            {/* Dr. Raouf Roshdy Signature Avatar Block */}
            <div className="flex items-center gap-2 bg-black/15 border border-white/20 px-1.5 md:px-2.5 py-1 rounded-full shadow-inner shrink-0">
              <div className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-white/60 shrink-0 bg-teal-900">
                <Image
                  src="/dr-raouf.jpg"
                  alt="Dr Raouf Roshdy"
                  fill
                  className="object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="hidden md:inline truncate max-w-[10rem] text-xs font-medium text-white italic tracking-wide pr-1">
                Dr Raouf Roshdy
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body Container */}
      <main id="main" className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Error Notification if Appraisal Fails */}
        {appraisalError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-red-900">Critical Appraisal Engine Error</p>
              <p className="leading-relaxed">{appraisalError}</p>
              <p className="text-[11px] text-red-800 pt-1">
                Tip: Click <strong>LLM Provider</strong> in the header to set your free Gemini or Groq key, or continue with the deterministic engine.
              </p>
            </div>
          </div>
        )}

        {/* Hero Section if no manuscript ingested yet */}
        {!currentManuscript && (
          <div className="text-center space-y-4 max-w-2xl mx-auto pt-2">
            <div className="flex justify-center">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-xl border border-slate-200/80 bg-slate-900 hover:scale-105 transition-all duration-300">
                <Image
                  src="/appraisai-icon.png"
                  alt="AppraisAI App Identity"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e3f2f2] text-[#0f6b6b] border border-[#99f6e4] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Evidence-Based Methodological Synthesis & Publication-Grade Reports
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
              Automated Critical Appraisal & Publication-Ready Reports
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Ingest clinical trials, systematic reviews, or observational studies via DOI, PMID, PMC,
              or PDF. Evaluate internal validity, statistical precision, EQUATOR reporting compliance,
              and compile downloadable academic <code>.docx</code> reports.
            </p>
          </div>
        )}

        {/* 4 Workflow Pillars (Matching AIMed / Sysrevai Style) */}
        {!currentManuscript && (
          <section aria-labelledby="pillars-heading" className="space-y-2">
            <h2 id="pillars-heading" className="sr-only">Appraisal Methodology Pillars</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2 text-xs">
              <div className="p-3.5 bg-white border border-[#d8dee6] rounded-xl shadow-xs flex items-start gap-2.5 hover:border-[#0f6b6b] transition-colors">
                <BookOpenCheck className="w-4 h-4 text-[#0f6b6b] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800">Pass 1: PICO/PECO</h3>
                  <p className="text-slate-500 text-[11px]">Design & demographic deconstruction</p>
                </div>
              </div>
              <div className="p-3.5 bg-white border border-[#d8dee6] rounded-xl shadow-xs flex items-start gap-2.5 hover:border-[#0f6b6b] transition-colors">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800">Pass 2: RoB & EQUATOR</h3>
                  <p className="text-slate-500 text-[11px]">CONSORT, PRISMA, RoB 2.0 & NOS</p>
                </div>
              </div>
              <div className="p-3.5 bg-white border border-[#d8dee6] rounded-xl shadow-xs flex items-start gap-2.5 hover:border-[#0f6b6b] transition-colors">
                <BarChart3 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800">Pass 3: Statistical Audit</h3>
                  <p className="text-slate-500 text-[11px]">Power, ITT vs PP, spin & effect sizes</p>
                </div>
              </div>
              <div className="p-3.5 bg-white border border-[#d8dee6] rounded-xl shadow-xs flex items-start gap-2.5 hover:border-[#0f6b6b] transition-colors">
                <Award className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800">Pass 4: GRADE Synthesis</h3>
                  <p className="text-slate-500 text-[11px]">Oxford Levels & clinical bottom line</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Ingestion Tabs */}
        {!currentManuscript && (
          <div className="bg-white border border-[#d8dee6] rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
            <div
              role="tablist"
              aria-label="Input type"
              className="flex border-b border-slate-200"
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setActiveTab((prev) => (prev === 'identifier' ? 'upload' : 'identifier'));
                }
              }}
            >
              <button
                type="button"
                role="tab"
                id="tab-identifier"
                aria-selected={activeTab === 'identifier'}
                aria-controls="panel-identifier"
                tabIndex={activeTab === 'identifier' ? 0 : -1}
                onClick={() => setActiveTab('identifier')}
                className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium border-b-2 transition-all ${
                  activeTab === 'identifier'
                    ? 'border-[#0f6b6b] text-[#0f6b6b] font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Link2 className="w-4 h-4" />
                DOI / PMID / PMCID / URL
              </button>
              <button
                type="button"
                role="tab"
                id="tab-upload"
                aria-selected={activeTab === 'upload'}
                aria-controls="panel-upload"
                tabIndex={activeTab === 'upload' ? 0 : -1}
                onClick={() => setActiveTab('upload')}
                className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium border-b-2 transition-all ${
                  activeTab === 'upload'
                    ? 'border-[#0f6b6b] text-[#0f6b6b] font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                Upload PDF Manuscript
              </button>
            </div>

            <div
              id={activeTab === 'identifier' ? 'panel-identifier' : 'panel-upload'}
              role="tabpanel"
              aria-labelledby={activeTab === 'identifier' ? 'tab-identifier' : 'tab-upload'}
            >
              {activeTab === 'identifier' ? <IdentifierInput /> : <DropzoneUpload />}
            </div>
          </div>
        )}

        {/* Ingested Manuscript Summary Card */}
        {currentManuscript && !currentAppraisal && <ManuscriptPreviewCard />}

        {/* Live Stepper if Appraising */}
        {isAppraising && <AppraisalProgressStepper />}

        {/* Active Appraisal Workspace */}
        {currentAppraisal && (
          <div className="space-y-6">
            {/* P0-3: Disclose Engine & Fallback Reason */}
            {currentAppraisal.engineUsed === 'deterministic-fallback' && (
              <div
                role="alert"
                className="w-full p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 shadow-xs text-amber-900"
              >
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-xs uppercase tracking-wide text-amber-800">
                    LLM Pipeline Fallback — Heuristic Screening Draft Active
                  </p>
                  <p className="text-xs leading-relaxed text-amber-900">
                    The multi-pass neural LLM appraisal encountered an issue: <strong>{currentAppraisal.fallbackReason || 'LLM provider call failed'}</strong>. 
                    The report has fallen back to the deterministic heuristic screening draft. This is a preliminary screening draft — not a validated critical appraisal.
                  </p>
                </div>
              </div>
            )}

            {currentAppraisal.engineUsed === 'deterministic' && (
              <div
                role="alert"
                className="w-full p-4 bg-slate-100 border border-slate-300 rounded-xl flex items-start gap-3 shadow-xs text-slate-800"
              >
                <AlertCircle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-xs uppercase tracking-wide text-slate-700">
                    Heuristic Screening Draft — Not a Critical Appraisal
                  </p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Generated via rule-based clinical heuristic extraction without neural LLM reasoning. Configure an LLM provider (Gemini / Groq / OpenAI) in the header for deep multi-pass critical appraisal.
                  </p>
                </div>
              </div>
            )}

            {/* P5-5: Abstract-Only Source Warning Banner */}
            {currentAppraisal.metadata.sourceDepth === 'ABSTRACT_ONLY_FALLBACK' && (
              <div
                role="alert"
                className="w-full p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 shadow-xs text-amber-900"
              >
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-xs uppercase tracking-wide text-amber-800">
                    Abstract-Only Appraisal Warning
                  </p>
                  <p className="text-xs leading-relaxed text-amber-900">
                    This appraisal was performed on the abstract alone because the full-text manuscript was behind a publisher paywall or unavailable. Detailed surgical/procedural methods, full table data, and undisclosed protocol deviations cannot be verified from abstract text alone. All risk of bias judgements reflect preliminary screening indicators.
                  </p>
                </div>
              </div>
            )}

            {/* Report Header Badges: Source, Engine, Review */}
            {status && (
              <div className="bg-white border border-[#d8dee6] rounded-xl p-4 sm:p-5 shadow-sm space-y-2">
                {!currentAppraisal.retraction?.isRetracted && (
                  <span className="text-xs font-bold text-[#0f6b6b]">
                    {status.headline}
                  </span>
                )}
                <h1 id="report-title" className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                  {currentAppraisal.metadata.title}
                </h1>
                {currentAppraisal.retraction?.isRetracted && (
                  <RetractionBanner citation={currentAppraisal.retraction?.retractionCitation} />
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1 font-sans">
                  <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                    Source: {status.source}
                  </span>
                  <span className="px-2.5 py-1 rounded text-xs font-semibold bg-[#e3f2f2] text-[#0f6b6b] border border-[#0f6b6b]/30">
                    Engine: {status.engine}
                  </span>
                  <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                    status.review === 'Unverified'
                      ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                      : 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                  }`}>
                    Review: {status.review}
                  </span>
                </div>
              </div>
            )}

            {/* Sticky Export Toolbar with Appraiser Stamp, Print-Preview & Word Download */}
            <ExportToolbar />

            {/* Stepper Status */}
            <AppraisalProgressStepper />

            {/* Report Root Scoped Article */}
            <article className="report space-y-6" aria-labelledby="report-title">
              {/* Pass 1: Classification & PICO */}
              <PicoSummaryCard />

              {/* Pass 2: RoB & EQUATOR */}
              <RiskOfBiasMatrix />

              {/* Pass 3: Statistical Rigor & Spin */}
              <StatisticalAuditViewer />

              {/* Pass 4: Validity Synthesis, GRADE & References */}
              <ValidityAndClinicalCard />

              {/* End-of-Report Navigation & Completion Card */}
              <div className="bg-white border border-[#d8dee6] rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-2">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                    Critical Appraisal Complete
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {status?.headline}. Return to the manuscript overview, appraise another paper, or scroll back up to export controls.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      clearAppraisal();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-[#e3f2f2] text-slate-700 hover:text-[#0f6b6b] hover:border-[#0f6b6b] transition shadow-xs"
                    title="Return to manuscript overview"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Manuscript</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetConfirmModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition shadow-xs"
                    title="Start a fresh appraisal"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Appraise Another Paper</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0f6b6b] hover:bg-[#0a4a4a] text-white transition shadow-xs"
                    title="Scroll back to top of report"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>Back to Top</span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        )}
      </main>

      {/* Signature Footer - Matching AIMed & Sysrevai */}
      <footer className="bg-[#0a4a4a] text-white/80 py-5 px-4 text-xs border-t border-[#0f6b6b]/40 mt-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="hidden sm:block" aria-hidden="true" />
          <div className="text-center space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <div className="relative w-5 h-5 rounded-md overflow-hidden bg-slate-900 border border-white/30 shrink-0">
                <Image src="/appraisai-icon.png" alt="AppraisAI Logo" fill className="object-contain" />
              </div>
              <span className="font-semibold text-white tracking-wide">AppraisAI v1.0</span>
            </div>
            <p className="font-medium text-white/95">
              Automated Scientific Critical Appraisal & Publication-Ready DOCX Generator
            </p>
            <p className="text-white/60 text-[11px]">
              EQUATOR Network (CONSORT, PRISMA, STROBE), CEBM Oxford Levels of Evidence, & GRADE Working Group Compliant
            </p>
            <p className="text-white/50 text-[10px] pt-1">
              Designed & Developed by Dr. Raouf Roshdy © 2024–2026 • All Rights Reserved
            </p>
          </div>
          <div className="flex flex-col items-center sm:items-end sm:justify-self-end gap-1.5">
            <div
              className="bg-white p-1.5 rounded-lg shadow-sm border border-white/20"
              aria-label={`QR code for ${appUrl}`}
            >
              <QRCodeSVG
                value={appUrl}
                size={64}
                level="M"
                bgColor="#ffffff"
                fgColor="#0a4a4a"
                title={`Open AppraisAI at ${appUrl}`}
              />
            </div>
            <span className="text-[10px] text-white/70 font-medium tracking-wide">
              Scan to open
            </span>
          </div>
        </div>
      </footer>

      {/* In-app Confirmation Modal (Task B4) */}
      <ConfirmationModal
        isOpen={showResetConfirmModal}
        title="Start a new appraisal?"
        message="Return to home? Your current manuscript appraisal session will be reset."
        confirmLabel="Reset & Start New"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => {
          resetAll();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onCancel={() => setShowResetConfirmModal(false)}
      />
    </div>
  );
}
