'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import { ManuscriptPreviewModal } from './ManuscriptPreviewModal';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { getCleanDownloadFilename } from '@/lib/parsers/title-sanitizer';
import { reportStatus } from '@/lib/status';
import { isValidOrcid } from '@/lib/parsers/orcid-validator';
import {
  Download,
  Eye,
  FileCode,
  Copy,
  Check,
  UserCheck,
  Loader2,
  Sparkles,
  Edit3,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';

const PRESET_PROFILE = {
  name: 'Dr. Raouf Roshdy, MD',
  affiliation: 'Department of Clinical Epidemiology & Evidence-Based Medicine',
  orcid: '0009-0001-4841-1656',
};

export const ExportToolbar: React.FC = () => {
  const {
    currentAppraisal,
    isEditMode,
    setEditMode,
    clearAppraisal,
    resetAll,
    humanVerified,
    setHumanVerified,
    appraiserName,
    setAppraiserName,
  } = useAppraisalStore();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopiedCitation, setIsCopiedCitation] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Appraiser attribution persisted locally / in store
  const [appraiserAffiliation, setAppraiserAffiliation] = useState('');
  const [appraiserOrcid, setAppraiserOrcid] = useState('');
  const [showAttributionPopover, setShowAttributionPopover] = useState(false);
  const [attributionError, setAttributionError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('appraisai_author_name');
    const savedAffil = localStorage.getItem('appraisai_author_affiliation');
    const savedOrcid = localStorage.getItem('appraisai_author_orcid');
    if (savedName && !appraiserName) {
      setAppraiserName(savedName);
    }
    if (savedAffil) {
      setAppraiserAffiliation(savedAffil);
    }
    if (savedOrcid) {
      setAppraiserOrcid(savedOrcid);
    }
  }, []);

  const handleSaveAttribution = () => {
    localStorage.setItem('appraisai_author_name', appraiserName.trim());
    localStorage.setItem('appraisai_author_affiliation', appraiserAffiliation.trim());
    localStorage.setItem('appraisai_author_orcid', appraiserOrcid.trim());
    setShowAttributionPopover(false);
  };

  const handleLoadPreset = () => {
    setAppraiserName(PRESET_PROFILE.name);
    setAppraiserAffiliation(PRESET_PROFILE.affiliation);
    setAppraiserOrcid(PRESET_PROFILE.orcid);
    localStorage.setItem('appraisai_author_name', PRESET_PROFILE.name);
    localStorage.setItem('appraisai_author_affiliation', PRESET_PROFILE.affiliation);
    localStorage.setItem('appraisai_author_orcid', PRESET_PROFILE.orcid);
  };

  const isOrcidValid = !appraiserOrcid.trim() || isValidOrcid(appraiserOrcid.trim());

  const handleDownloadDocx = async () => {
    if (!currentAppraisal || isDownloading) return;
    setExportError(null);
    setAttributionError(null);

    if (!appraiserName.trim()) {
      setShowAttributionPopover(true);
      setAttributionError('Appraiser name is required before exporting the publication manuscript.');
      setTimeout(() => nameInputRef.current?.focus(), 50);
      return;
    }

    if (!isOrcidValid) {
      setShowAttributionPopover(true);
      setAttributionError('The entered ORCID iD is invalid. Please correct the checksum or leave it blank.');
      return;
    }

    setIsDownloading(true);

    try {
      const res = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: currentAppraisal,
          appraiserMeta: {
            name: appraiserName.trim(),
            affiliation: appraiserAffiliation.trim() || undefined,
            orcid: appraiserOrcid.trim() || undefined,
            verified: humanVerified,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate .docx manuscript');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const status = reportStatus(currentAppraisal, {
        humanVerified,
        appraiserName,
      });
      a.download = getCleanDownloadFilename(
        currentAppraisal.metadata.authors,
        currentAppraisal.metadata.publicationYear,
        status.isDraft
      );
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(`Export error: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyCitation = () => {
    if (!currentAppraisal) return;
    navigator.clipboard.writeText(currentAppraisal.metadata.vancouverCitation);
    setIsCopiedCitation(true);
    setTimeout(() => setIsCopiedCitation(false), 1500);
  };

  const handleExportJson = () => {
    if (!currentAppraisal) return;
    const jsonStr = JSON.stringify(currentAppraisal, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Appraisal_Data_${currentAppraisal.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!currentAppraisal) return null;

  return (
    <>
      {/* Task P07: Single row <= 56px, solid bg-white, sticky only on desktop lg: */}
      <div className="lg:sticky lg:top-[52px] z-20 bg-white border border-[#d8dee6] rounded-xl lg:rounded-none lg:border-x-0 lg:border-t-0 border-b border-slate-200 py-1.5 px-3 sm:px-4 shadow-xs flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 h-12">
        {/* Left: Appraiser & Verification */}
        <div className="flex items-center gap-2">
          {/* Attribution Popover Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowAttributionPopover(!showAttributionPopover)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-[#e3f2f2] text-slate-700 transition"
              title="Set Lead Appraiser Name and ORCID"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#0f6b6b]" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {appraiserName.trim() ? appraiserName.trim() : 'Appraiser'}
              </span>
            </button>

            {showAttributionPopover && (
              <div className="absolute left-0 mt-2 w-84 bg-white rounded-xl shadow-xl border border-slate-200 p-4 space-y-3 z-30 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800">Appraiser Attribution (DOCX Cover)</h4>
                  <button
                    type="button"
                    onClick={handleLoadPreset}
                    className="text-[10px] text-[#0f6b6b] hover:text-[#0a4a4a] font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Load Preset
                  </button>
                </div>
                {attributionError && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-[11px] rounded flex items-center gap-1.5 animate-in fade-in duration-150">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                    <span>{attributionError}</span>
                  </div>
                )}
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Your Full Name & Degree *</label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={appraiserName}
                      onChange={(e) => {
                        setAppraiserName(e.target.value);
                        if (attributionError) setAttributionError(null);
                      }}
                      placeholder="e.g. Dr. Raouf Roshdy, MD"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#0f6b6b]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Institution / Department</label>
                    <input
                      type="text"
                      value={appraiserAffiliation}
                      onChange={(e) => setAppraiserAffiliation(e.target.value)}
                      placeholder="e.g. Department of Clinical Epidemiology"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#0f6b6b]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">ORCID iD (ISO 7064 MOD 11-2)</label>
                    <input
                      type="text"
                      value={appraiserOrcid}
                      onChange={(e) => setAppraiserOrcid(e.target.value)}
                      placeholder="0009-0001-4841-1656"
                      className={`w-full px-2.5 py-1.5 border rounded text-xs font-mono ${
                        isOrcidValid ? 'border-slate-300' : 'border-red-400 bg-red-50 text-red-900'
                      }`}
                    />
                    {!isOrcidValid && (
                      <p className="text-[10px] text-red-600 mt-1">
                        Invalid ORCID format or check digit. Expected format: 0000-0000-0000-0000.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowAttributionPopover(false)}
                    className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSaveAttribution}
                    className="px-3 py-1 bg-[#0f6b6b] hover:bg-[#0a4a4a] text-white text-xs font-semibold rounded"
                  >
                    Save Profile
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Verification Checkbox */}
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition shrink-0">
            <input
              type="checkbox"
              checked={humanVerified}
              onChange={(e) => setHumanVerified(e.target.checked)}
              className="rounded border-slate-300 text-[#0f6b6b] focus:ring-[#0f6b6b]"
            />
            <span className="font-medium text-xs">Verified</span>
          </label>
        </div>

        {/* Right: Preview, Download & More menu */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Print Preview Button */}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-800 transition"
          >
            <Eye className="w-3.5 h-3.5 text-[#0f6b6b]" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Primary Download Button */}
          <button
            onClick={handleDownloadDocx}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0f6b6b] hover:bg-[#0a4a4a] disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-xs transition"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Compiling...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download .docx</span>
              </>
            )}
          </button>

          {/* More Menu Dropdown for Edit, Copy, JSON, New Paper */}
          <details
            className="relative"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                (e.currentTarget as HTMLDetailsElement).open = false;
              }
            }}
          >
            <summary className="cursor-pointer list-none flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition select-none">
              <span>More ▾</span>
            </summary>
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 space-y-1 z-30 animate-in fade-in duration-100">
              <button
                onClick={(e) => {
                  setEditMode(!isEditMode);
                  (e.currentTarget.closest('details') as HTMLDetailsElement).open = false;
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded-lg hover:bg-slate-50 text-slate-700"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#0f6b6b]" />
                <span>{isEditMode ? 'Finish Editing' : 'Edit Mode'}</span>
              </button>
              <button
                onClick={(e) => {
                  handleCopyCitation();
                  (e.currentTarget.closest('details') as HTMLDetailsElement).open = false;
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded-lg hover:bg-slate-50 text-slate-700"
              >
                {isCopiedCitation ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Citation</span>
                  </>
                )}
              </button>
              <button
                onClick={(e) => {
                  handleExportJson();
                  (e.currentTarget.closest('details') as HTMLDetailsElement).open = false;
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded-lg hover:bg-slate-50 text-slate-700"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                <span>Export JSON</span>
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={(e) => {
                  (e.currentTarget.closest('details') as HTMLDetailsElement).open = false;
                  clearAppraisal();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded-lg hover:bg-slate-50 text-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Back to Manuscript</span>
              </button>
              <button
                onClick={(e) => {
                  (e.currentTarget.closest('details') as HTMLDetailsElement).open = false;
                  setShowResetConfirmModal(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded-lg hover:bg-rose-50 text-rose-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Paper</span>
              </button>
            </div>
          </details>
        </div>
      </div>

      {/* Live Academic Print Preview Modal */}
      <ManuscriptPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        report={currentAppraisal}
        onDownloadDocx={handleDownloadDocx}
      />

      {/* Confirmation Modal for Resetting Session (Task B4) */}
      <ConfirmationModal
        isOpen={showResetConfirmModal}
        title="Start a new appraisal?"
        message="Your current critical appraisal session will be reset. Any unsaved edits will be cleared."
        confirmLabel="Reset & Start New"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => {
          resetAll();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onCancel={() => setShowResetConfirmModal(false)}
      />

      {/* Export Error Alert (Task B4) */}
      {exportError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in duration-200"
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{exportError}</span>
          <button
            onClick={() => setExportError(null)}
            className="text-red-400 hover:text-red-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};
