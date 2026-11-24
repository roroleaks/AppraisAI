import React from 'react';

export function RetractionBanner({ citation }: { citation?: string }) {
  const cleanCitation = citation ? citation.replace(/\.+$/, '').trim() : '';
  return (
    <div
      role="alert"
      className="w-full rounded-lg border-2 border-[#B91C1C] bg-[#FEF2F2] px-4 py-3 text-[#7F1D1D]"
    >
      <p className="text-base font-bold">⚠ This article has been RETRACTED</p>
      <p className="text-sm mt-1">
        {cleanCitation ? `${cleanCitation}. ` : ''}Its findings must not be used for clinical decisions. Any
        appraisal below is for teaching only.
      </p>
    </div>
  );
}
