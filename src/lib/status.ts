import type { MasterAppraisalReport } from './schemas/appraisal.schema';

export interface ReportStatus {
  source: 'Full text (JATS/PDF)' | 'Abstract only' | 'Full text not machine-retrievable';
  engine: string;              // "Heuristic (rule-based)" | "LLM (<provider>/<model>)"
  review: string;              // "Unverified" | "Verified by <name>"
  isDraft: boolean;            // true unless an LLM report has been human-verified
  headline: string;            // one line used by UI, print and .docx
}

export function reportStatus(
  r: MasterAppraisalReport,
  opts: { humanVerified: boolean; appraiserName?: string; provider?: string; model?: string }
): ReportStatus {
  const depth = (r.metadata as any)?.sourceDepth as string | undefined;
  const source: ReportStatus['source'] =
    depth === 'ABSTRACT_ONLY_FALLBACK'
      ? ((r.metadata as any)?.pmcid ? 'Full text not machine-retrievable' : 'Abstract only')
      : 'Full text (JATS/PDF)';
  const heuristic = (r as any).engineUsed === 'deterministic' || (r as any).engineUsed === 'deterministic-fallback' || !(r as any).engineUsed;
  const engine = heuristic
    ? 'Heuristic (rule-based)'
    : `LLM (${opts.provider ?? (r as any).llmDetails?.provider ?? 'provider'}/${opts.model ?? (r as any).llmDetails?.model ?? 'model'})`;
  const verified = opts.humanVerified && !!opts.appraiserName?.trim();
  const review = verified ? `Verified by ${opts.appraiserName!.trim()}` : 'Unverified';
  const isDraft = heuristic || !verified;
  const headline = (r as any).retraction?.isRetracted
    ? 'RETRACTED ARTICLE — appraisal shown for teaching only'
    : isDraft
    ? `UNVERIFIED ${heuristic ? 'HEURISTIC ' : ''}DRAFT — 4 passes generated, not a validated critical appraisal`
    : `Critical appraisal — ${review}`;
  return { source, engine, review, isDraft, headline };
}
