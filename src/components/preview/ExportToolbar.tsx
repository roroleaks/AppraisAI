'use client';

import React, { useState, useEffect } from 'react';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import { ManuscriptPreviewModal } from './ManuscriptPreviewModal';
import { getCleanDownloadFilename } from '@/lib/parsers/title-sanitizer';
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
  const { currentAppraisal, isEditMode, setEditMode, clearAppraisal, resetAll } =
    useAppraisalStore();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopiedCitation, setIsCopiedCitation] = useState(false);

  // Appraiser attribution persisted locally (P0-6: empty by default)
  const [appraiserName, setAppraiserName] = useState('');
  const [appraiserAffiliation, setAppraiserAffiliation] = useState('');
  const [appraiserOrcid, setAppraiserOrcid] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [showAttributionPopover, setShowAttributionPopover] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('appraisai_author_name');
    const savedAffil = localStorage.getItem('appraisai_author_affiliation');
    const savedOrcid = localStorage.getItem('appraisai_author_orcid');
    if (savedName) {
      setAppraiserName(savedName);
      setAppraiserAffiliation(savedAffil || '');
      setAppraiserOrcid(savedOrcid || '');
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

    if (!appraiserName.trim()) {
      setShowAttributionPopover(true);
      alert('Appraiser name is required before exporting the publication manuscript. Please enter your name.');
      return;
    }

    if (!isOrcidValid) {
      setShowAttributionPopover(true);
      alert('The entered ORCID iD is invalid. Please correct the checksum or leave it blank.');
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
            verified: isVerified,
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
      a.download = getCleanDownloadFilename(
        currentAppraisal.metadata.authors,
        currentAppraisal.metadata.publicationYear
      );
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
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
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-xs border border-[#d8dee6] rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left: Navigation, Engine Provenance Badge & Attribution Stamp */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Back to Manuscript Button */}
          <button
            onClick={() => {
              clearAppraisal();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-[#e3f2f2] text-slate-700 hover:text-[#0f6b6b] border border-slate-300 hover:border-[#0f6b6b] transition shadow-xs"
            title="Return to manuscript abstract and metadata overview"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Manuscript</span>
          </button>

          {/* New Appraisal Reset Button */}
          <button
            onClick={() => {
              if (window.confirm('Start a new appraisal? Current report will be cleared.')) {
                resetAll();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition shadow-xs"
            title="Clear and start new appraisal"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Paper</span>
          </button>

          {/* P0-3: Persistent Engine Badge */}
          {currentAppraisal.engineUsed === 'llm' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>LLM Appraisal — {currentAppraisal.llmDetails?.provider || 'neural'} ({currentAppraisal.llmDetails?.model || 'standard'})</span>
            </span>
          ) : currentAppraisal.engineUsed === 'deterministic-fallback' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-300">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Heuristic Screening Draft (LLM Fallback)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-800 border border-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
              <span>Heuristic screening draft — not a critical appraisal</span>
            </span>
          )}

          {/* Attribution Popover Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowAttributionPopover(!showAttributionPopover)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-[#e3f2f2] text-slate-700 transition"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#0f6b6b]" />
              <span>Appraiser: {appraiserName.trim() || 'Set Appraiser Name'}</span>
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
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Your Full Name & Degree *</label>
                    <input
                      type="text"
                      value={appraiserName}
                      onChange={(e) => setAppraiserName(e.target.value)}
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
        </div>

        {/* Right Action Buttons & Verification Checkbox */}
        <div className="flex flex-wrap items-center gap-2">
          {/* P0-6: Verification Checkbox */}
          <label className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-700 cursor-pointer bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(e) => setIsVerified(e.target.checked)}
              className="rounded border-slate-300 text-[#0f6b6b] focus:ring-[#0f6b6b]"
            />
            <span className="font-medium text-[11px]">I have reviewed & verified this appraisal</span>
          </label>

          {/* Edit Mode Toggle */}
          <button
            onClick={() => setEditMode(!isEditMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              isEditMode
                ? 'border-[#0f6b6b] bg-[#e3f2f2] text-[#0f6b6b] shadow-xs'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditMode ? 'Finish Editing' : 'Edit Mode'}</span>
          </button>

          {/* Copy Citation */}
          <button
            onClick={handleCopyCitation}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
          >
            {isCopiedCitation ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" /> Copy Citation
              </>
            )}
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
          >
            <FileCode className="w-3.5 h-3.5 text-slate-500" /> Export JSON
          </button>

          {/* Print Preview Modal */}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-800 transition"
          >
            <Eye className="w-3.5 h-3.5 text-[#0f6b6b]" /> Preview Manuscript
          </button>

          {/* Primary Download Button */}
          <button
            onClick={handleDownloadDocx}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0f6b6b] hover:bg-[#0a4a4a] disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Compiling .docx...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" /> Download Publication .docx
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Academic Print Preview Modal */}
      <ManuscriptPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        report={currentAppraisal}
        onDownloadDocx={handleDownloadDocx}
      />
    </>
  );
};
