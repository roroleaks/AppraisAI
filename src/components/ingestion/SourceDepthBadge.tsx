import React from 'react';
import { IngestionSourceDepth } from '@/lib/schemas/ingestion.schema';
import { CheckCircle2, AlertTriangle, FileText, Database } from 'lucide-react';

interface SourceDepthBadgeProps {
  sourceDepth: IngestionSourceDepth;
}

export const SourceDepthBadge: React.FC<SourceDepthBadgeProps> = ({ sourceDepth }) => {
  switch (sourceDepth) {
    case 'FULL_TEXT_JATS_XML':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          Full Text (Europe PMC JATS XML)
        </span>
      );
    case 'FULL_TEXT_PDF':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          <FileText className="w-3.5 h-3.5 text-sky-600" />
          Full Text (Biomedical PDF)
        </span>
      );
    case 'FULL_TEXT_HTML':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
          Full Text (HTML)
        </span>
      );
    case 'ABSTRACT_ONLY_FALLBACK':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Abstract Only (Paywall Fallback)
        </span>
      );
  }
};
