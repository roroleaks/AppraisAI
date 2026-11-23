'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Sparkles, AlertCircle, X, StopCircle } from 'lucide-react';
import { useAppraisalStore } from '@/store/useAppraisalStore';

export function isValidIdentifierInput(input: string): boolean {
  const val = input.trim();
  if (!val) return false;
  // 1. DOI pattern (optional doi: or https://doi.org/ prefix)
  if (/^(?:https?:\/\/doi\.org\/|doi:\s*)?10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(val)) return true;
  // 2. PMID pattern (digits 1-9 or PMID: digits)
  if (/^(?:PMID[:\s]*)?\d{1,9}$/i.test(val)) return true;
  // 3. PMCID pattern (PMC followed by digits)
  if (/^(?:https?:\/\/www\.ncbi\.nlm\.nih\.gov\/pmc\/articles\/)?PMC\d+\/?$/i.test(val)) return true;
  // 4. URL pattern
  if (/^https?:\/\/.+/i.test(val)) return true;
  return false;
}

export const IdentifierInput: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [streamStage, setStreamStage] = useState('Resolving identifier...');
  const abortControllerRef = useRef<AbortController | null>(null);

  const { setManuscript, isIngesting, setIngesting, ingestionError, setIngestionError } =
    useAppraisalStore();

  const isInputValid = isValidIdentifierInput(inputValue);
  const showFreeTextHelper = inputValue.trim().length > 0 && !isInputValid;

  // Timer for elapsed seconds and simulated progress status line
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isIngesting) {
      setElapsedSeconds(0);
      setStreamStage('Identifier parsed ✓ · Connecting Europe PMC & Crossref...');
      timer = setInterval(() => {
        setElapsedSeconds((sec) => {
          const next = sec + 1;
          if (next === 2) setStreamStage('Crossref ✓ · Querying Europe PMC open metadata...');
          else if (next === 4) setStreamStage('Crossref ✓ · Europe PMC ✓ · Fetching full text & XML...');
          else if (next > 6) setStreamStage('Crossref ✓ · Europe PMC ✓ · Extracting methods, PICO & statistics...');
          return next;
        });
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isIngesting]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIngesting(false);
    setIngestionError('Ingestion cancelled by user.');
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInputValid || isIngesting) return;

    setIngesting(true);
    setIngestionError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/ingest/identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: inputValue.trim() }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resolve scientific article');
      }

      setManuscript(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIngestionError('Ingestion cancelled.');
      } else {
        setIngestionError(err.message || 'Error resolving manuscript identifier.');
      }
    } finally {
      setIngesting(false);
      abortControllerRef.current = null;
    }
  };

  const sampleIdentifiers = [
    {
      label: 'Opast PDF (Vaginal Restoration)',
      val: 'https://www.opastpublishers.com/open-access-articles/vaginal-restoration-after-vaginal-delivery-commentary-review-regarding-pathophysiology-assessment-evidencebased-manageme.pdf',
    },
    { label: 'NEJM (Aspirin Prevention)', val: '10.1056/NEJMoa1800722' },
    { label: 'Lancet HCQ (Retraction demo)', val: '10.1016/S0140-6736(20)31180-6' },
    { label: 'PubMed ID (SGLT2i in HF)', val: '31535829' },
    { label: 'Europe PMC JATS', val: 'PMC7118652' },
  ];

  return (
    <div className="w-full">
      <form onSubmit={handleResolve} className="space-y-3">
        <label htmlFor="ingestInput" className="sr-only">
          Identifier input
        </label>
        <div className="relative flex items-center">
          <input
            id="ingestInput"
            name="ingestInput"
            aria-label="Identifier input"
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (ingestionError) setIngestionError(null);
            }}
            placeholder="Paste DOI (10.xxxx/...), PMID, PMCID (PMC...), or article URL..."
            className="w-full pl-11 pr-32 py-3.5 text-base bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f6b6b] focus:border-[#0f6b6b] transition-all font-mono"
            disabled={isIngesting}
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
          <button
            type="submit"
            disabled={isIngesting || !isInputValid}
            aria-busy={isIngesting}
            className="absolute right-2 px-4 py-2 bg-[#0f6b6b] hover:bg-[#0a4a4a] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md shadow transition flex items-center gap-1.5"
          >
            {isIngesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Resolving...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> Ingest
              </>
            )}
          </button>
        </div>

        {/* Free text helper (Task B5) */}
        {showFreeTextHelper && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Paste a DOI, PMID, PMCID or article URL — research questions are not supported.</span>
          </div>
        )}

        {/* Streamed status line & Cancel button during ingestion (Task B5) */}
        {isIngesting && (
          <div className="flex items-center justify-between gap-3 p-3 bg-teal-50 border border-teal-200 text-[#0f6b6b] text-xs rounded-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-2 truncate">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span className="font-medium truncate">{streamStage}</span>
              <span className="text-slate-500 font-mono text-[11px] shrink-0">({elapsedSeconds}s)</span>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition shrink-0"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        )}

        {/* Quick sample chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Try sample:</span>
          {sampleIdentifiers.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => {
                setInputValue(sample.val);
                if (ingestionError) setIngestionError(null);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 text-[13px] transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </form>

      {ingestionError && (
        <div
          role="alert"
          className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start justify-between gap-2 animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Ingestion Error</p>
              <p className="mt-0.5">{ingestionError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIngestionError(null)}
            className="text-red-400 hover:text-red-600 p-0.5 rounded transition"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
