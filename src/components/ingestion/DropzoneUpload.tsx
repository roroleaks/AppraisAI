'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useAppraisalStore } from '@/store/useAppraisalStore';

export const DropzoneUpload: React.FC = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setManuscript, isIngesting, setIngesting, ingestionError, setIngestionError } =
    useAppraisalStore();

  const handleFileProcess = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setIngestionError('Please select a valid biomedical PDF manuscript.');
      return;
    }

    setIngesting(true);
    setIngestionError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ingest/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract PDF manuscript.');
      }

      setManuscript(data);
    } catch (err: any) {
      setIngestionError(err.message || 'Error processing PDF document.');
    } finally {
      setIngesting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[190px] ${
          isDragOver
            ? 'border-brand-500 bg-brand-50'
            : 'border-slate-300 hover:border-brand-400 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileProcess(e.target.files[0]);
            }
          }}
          disabled={isIngesting}
        />

        {isIngesting ? (
          <div className="flex flex-col items-center gap-2.5">
            <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-800">
              Parsing biomedical multi-column layout...
            </p>
            <p className="text-xs text-slate-500">
              Reconstructing bounding coordinates and extracting section structures.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-white rounded-full shadow-sm border border-slate-200 text-brand-600">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                <span className="text-brand-700 font-semibold underline">Click to upload</span> or drag and drop manuscript PDF
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Multi-column medical papers (NEJM, Lancet, JAMA, BMJ) supported up to 25MB
              </p>
            </div>
          </div>
        )}
      </div>

      {ingestionError && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Upload Parsing Error</p>
            <p className="mt-0.5">{ingestionError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
