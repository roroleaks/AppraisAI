'use client';

import React, { useState } from 'react';
import { Search, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useAppraisalStore } from '@/store/useAppraisalStore';

export const IdentifierInput: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const { setManuscript, isIngesting, setIngesting, ingestionError, setIngestionError } =
    useAppraisalStore();

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isIngesting) return;

    setIngesting(true);
    setIngestionError(null);

    try {
      const res = await fetch('/api/ingest/identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: inputValue.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resolve scientific article');
      }

      setManuscript(data);
    } catch (err: any) {
      setIngestionError(err.message || 'Error resolving manuscript identifier.');
    } finally {
      setIngesting(false);
    }
  };

  const sampleIdentifiers = [
    { label: 'NEJM (Aspirin Primary Prevention)', val: '10.1056/NEJMoa1800722' },
    { label: 'Lancet (COVID-19 Hydroxychloroquine)', val: '10.1016/S0140-6736(20)31180-6' },
    { label: 'PubMed ID (SGLT2i in HF)', val: '31535829' },
    { label: 'Europe PMC Open Access JATS', val: 'PMC7118652' },
  ];

  return (
    <div className="w-full">
      <form onSubmit={handleResolve} className="space-y-3">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Paste DOI (10.xxxx/...), PMID, PMCID (PMC...), or article URL..."
            className="w-full pl-11 pr-32 py-3.5 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-mono"
            disabled={isIngesting}
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
          <button
            type="submit"
            disabled={isIngesting || !inputValue.trim()}
            className="absolute right-2 px-4 py-2 bg-brand-700 hover:bg-brand-900 disabled:bg-slate-300 text-white text-xs font-semibold rounded-md shadow transition flex items-center gap-1.5"
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

        {/* Quick sample chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Try sample:</span>
          {sampleIdentifiers.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => setInputValue(sample.val)}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 text-[11px] transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </form>

      {ingestionError && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Ingestion Error</p>
            <p className="mt-0.5">{ingestionError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
