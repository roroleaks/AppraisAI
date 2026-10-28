'use client';

import React from 'react';
import { MasterAppraisalReport } from '@/lib/schemas/appraisal.schema';
import { X, Printer, Download, BookOpen, ShieldCheck } from 'lucide-react';
import { cleanBiomedicalTitle, cleanBiomedicalAuthors } from '@/lib/parsers/title-sanitizer';

interface ManuscriptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: MasterAppraisalReport;
  onDownloadDocx: () => void;
}

export const ManuscriptPreviewModal: React.FC<ManuscriptPreviewModalProps> = ({
  isOpen,
  onClose,
  report,
  onDownloadDocx,
}) => {
  if (!isOpen) return null;

  const displayTitle = cleanBiomedicalTitle(report.metadata.title);
  const displayAuthors = cleanBiomedicalAuthors(report.metadata.authors).join(', ');

  const renderRevManBadge = (judgement: string) => {
    switch (judgement) {
      case 'LOW_RISK':
        return <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[10px]">(+) Low Risk</span>;
      case 'SOME_CONCERNS':
        return <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded text-[10px]">(?) Some Concerns</span>;
      case 'HIGH_RISK':
        return <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded text-[10px]">(-) High Risk</span>;
      default:
        return <span className="text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded text-[10px]">[!] Unclear</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header Toolbar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-300" />
            <h3 className="font-serif font-bold text-sm tracking-wide">
              Publication Manuscript Print-Preview (US Letter / Academic Layout)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              onClick={onDownloadDocx}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" /> Download .docx
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-md transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Simulation Body */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 bg-slate-100 font-serif text-slate-900 leading-relaxed text-xs space-y-6">
          <div className="max-w-[760px] mx-auto bg-white p-8 sm:p-12 shadow-sm border border-slate-200 space-y-6">
            {/* Running Header */}
            <div className="border-b border-slate-300 pb-2 flex justify-between text-[10px] text-slate-500 uppercase tracking-widest font-sans">
              <span className="italic truncate max-w-xs">{displayTitle}</span>
              <span className="font-bold text-slate-700">AppraisAI Critical Appraisal</span>
            </div>

            {/* Title Block */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold text-brand-700 uppercase tracking-widest font-sans block">
                Evidence-Based Critical Appraisal & Methodological Commentary
              </span>
              <h1 className="text-xl sm:text-2xl font-bold font-sans text-slate-900 leading-snug">
                Methodological and Statistical Critical Appraisal of: {displayTitle}
              </h1>
              <p className="text-slate-600 text-[11px] font-sans">
                Authors: {displayAuthors} | Appraisal Date: {new Date(report.completedAt).toLocaleDateString()} | EQUATOR & Cochrane RoB 2.0 Governed
              </p>
            </div>

            {/* Target Article Reference Box */}
            <div className="p-4 bg-slate-50 border-l-4 border-slate-900 text-xs font-serif leading-relaxed space-y-1">
              <span className="font-sans font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                Target Article Vancouver Citation:
              </span>
              <p className="font-bold text-slate-900">{report.metadata.vancouverCitation}</p>
              <p className="text-[10px] font-sans text-slate-500 pt-1">
                Ingestion Depth: {report.metadata.sourceDepth} | Journal: {report.metadata.journal} ({report.metadata.publicationYear})
              </p>
            </div>

            {/* 4-Strip Evidence Summary */}
            <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-200 text-center font-sans text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Design</span>
                <span className="font-bold text-slate-800">{report.classification.studyDesign}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Oxford Level</span>
                <span className="font-bold text-slate-800">{report.classification.oxfordEvidenceLevel}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Guideline</span>
                <span className="font-bold text-slate-800">{report.classification.equatorReportingGuideline}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">GRADE Certainty</span>
                <span className="font-bold text-brand-800">{report.validitySynthesis.gradeCertainty}</span>
              </div>
            </div>

            {/* Section 1: Abstract */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold font-serif text-slate-900 uppercase border-b border-slate-200 pb-1">
                1. Executive Structured Commentary Abstract
              </h2>
              <div className="p-4 bg-slate-50/60 border border-slate-200 rounded space-y-2 text-xs">
                <p><strong>Background:</strong> {report.executiveAbstract.background}</p>
                <p><strong>Methodological Summary:</strong> {report.executiveAbstract.methodologicalSummary}</p>
                <p><strong>Key Findings:</strong> {report.executiveAbstract.keyFindings}</p>
                <p className="text-brand-950 font-bold"><strong>Critical Verdict:</strong> {report.executiveAbstract.criticalVerdict}</p>
              </div>
            </div>

            {/* Section 2: PICO */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold font-serif text-slate-900 uppercase border-b border-slate-200 pb-1">
                2. PICO / PECO Deconstruction & Study Characteristics
              </h2>
              <div className="border border-slate-200 text-xs">
                <div className="grid grid-cols-3 p-2 border-b border-slate-100 bg-slate-50">
                  <span className="font-bold">Population</span>
                  <span className="col-span-2">{report.pico.population}</span>
                </div>
                <div className="grid grid-cols-3 p-2 border-b border-slate-100">
                  <span className="font-bold">Intervention / Exposure</span>
                  <span className="col-span-2">{report.pico.interventionOrExposure}</span>
                </div>
                <div className="grid grid-cols-3 p-2 border-b border-slate-100 bg-slate-50">
                  <span className="font-bold">Comparator</span>
                  <span className="col-span-2">{report.pico.comparator}</span>
                </div>
                <div className="grid grid-cols-3 p-2 border-b border-slate-100">
                  <span className="font-bold">Primary Outcomes</span>
                  <span className="col-span-2">{report.pico.primaryOutcomes.join('; ')}</span>
                </div>
                <div className="grid grid-cols-3 p-2 bg-slate-50">
                  <span className="font-bold">Timeframe & Setting</span>
                  <span className="col-span-2">Follow-up: {report.pico.timeframe} | Setting: {report.pico.setting}</span>
                </div>
              </div>
            </div>

            {/* Section 3: Risk of Bias */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold font-serif text-slate-900 uppercase border-b border-slate-200 pb-1">
                3. Risk of Bias Assessment Matrix ({report.riskOfBias.governingTool})
              </h2>
              <p className="text-[11px] text-slate-600">Overall Rationale: {report.riskOfBias.overallRationale}</p>

              {/* Horizontal RevMan Summary Strip */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded my-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 font-sans">
                  Figure 1: Risk of Bias Summary Strip (RevMan Format)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  {report.riskOfBias.domains.map((d, i) => (
                    <div key={i} className="p-1.5 border border-slate-200 rounded bg-white font-sans">
                      <div className="text-[10px] text-slate-600 truncate mb-1">{d.domainName}</div>
                      {renderRevManBadge(d.judgement)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed RoB Table */}
              <div className="border border-slate-200 text-[11px]">
                {report.riskOfBias.domains.map((d, i) => (
                  <div key={i} className="p-2 border-b border-slate-100 grid grid-cols-4 gap-2">
                    <span className="font-bold text-slate-800">{d.domainName}</span>
                    <span className="font-bold font-sans">{renderRevManBadge(d.judgement)}</span>
                    <span className="col-span-2 italic text-slate-600">&ldquo;{d.supportiveEvidence}&rdquo;</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: EQUATOR */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold font-serif text-slate-900 uppercase border-b border-slate-200 pb-1">
                4. EQUATOR Network Compliance ({report.equatorChecklist.guidelineName})
              </h2>
              <p className="text-xs font-sans font-bold text-slate-700">
                Score: {report.equatorChecklist.overallCompliancePercentage}% Compliant
              </p>
            </div>

            {/* Section 5: Stats & Spin */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold font-serif text-slate-900 uppercase border-b border-slate-200 pb-1">
                5. Statistical & Methodological Rigor Audit
              </h2>
              <p><strong>Power Calculation:</strong> {report.statisticalAudit.sampleSizePowerCalculation.adequacyAssessment}</p>
              <p><strong>Analysis Strategy:</strong> {report.statisticalAudit.analysisType.replace(/_/g, ' ')} ({report.statisticalAudit.missingDataHandling})</p>
              <div className={`p-3 border rounded ${report.statisticalAudit.spinAndDiscrepancyAudit.spinDetected ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <strong>Spin Audit:</strong> {report.statisticalAudit.spinAndDiscrepancyAudit.discrepancyDetails}
              </div>
            </div>

            {/* Section 6: Strengths & GRADE */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold font-serif text-slate-900 uppercase border-b border-slate-200 pb-1">
                6. Validity & GRADE Certainty Synthesis
              </h2>
              <p><strong>Internal Validity:</strong> {report.validitySynthesis.internalValidity}</p>
              <p><strong>External Generalizability:</strong> {report.validitySynthesis.externalValidityAndGeneralizability}</p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-950">
                <strong>GRADE Synthesis:</strong> {report.validitySynthesis.gradeCertainty} Certainty. {report.validitySynthesis.gradeRationale}
              </div>
            </div>

            {/* Section 7: Clinical Verdict */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold font-serif text-slate-900 uppercase border-b border-slate-200 pb-1">
                7. Clinical Practice Translation & Bottom Line
              </h2>
              <p className="font-bold">Takeaway: {report.clinicalPracticeBottomLine.keyTakeawayForClinicians}</p>
              <p>Applicability: {report.clinicalPracticeBottomLine.applicabilityToPractice}</p>
            </div>

            {/* Methodological Governance Disclaimer */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 italic">
              <span className="font-bold font-sans text-slate-700 not-italic block mb-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" /> Methodological Governance & Editorial Disclaimer
              </span>
              This critical appraisal was generated via AppraisAI in adherence to EQUATOR Network reporting frameworks ({report.classification.equatorReportingGuideline}), the Oxford Centre for Evidence-Based Medicine (CEBM) Levels of Evidence, and the GRADE Working Group certainty criteria. Prepared for academic peer commentary and clinical decision support.
            </div>

            {/* Section 8: References */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <h2 className="text-sm font-bold font-serif text-slate-900 uppercase">
                8. References (Vancouver Style)
              </h2>
              <ol className="list-decimal pl-5 space-y-1 text-slate-700 text-[11px]">
                {report.references.map((r) => (
                  <li key={r.number}>{r.vancouverCitation}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
