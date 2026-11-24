/**
 * pico-arms.ts — intervention / comparator / follow-up from the METHODS sentence, never from the title prefix.
 * Returns null when not found; the UI shows "Not extracted".
 */

const ARM_END = String.raw`(?=,\s+in addition|,\s+(?:with|and|stratified|according)|\s+\((?:ratio|1:1)|;|\.\s|\.$|$)`;

export function extractArms(text: string): { intervention: string | null; comparator: string | null; source: string | null } {
  const sentences = text.replace(/\bvs\./gi, 'vs').split(/(?<=[.?!])\s+(?=[A-Z])/);
  const re = new RegExp(
    String.raw`\b(?:randomly\s+)?(?:assigned|allocated|randomi[sz]ed)\b[^.]{0,220}?\bto\s+(?:receive\s+|undergo\s+|be\s+treated\s+with\s+)?(?:either\s+)?(?<a>[^;]{3,140}?)\s+or\s+(?:to\s+(?:receive|undergo)\s+)?(?<b>[^;]{2,140}?)${ARM_END}`,
    'i'
  );
  for (const s of sentences) {
    const m = s.match(re);
    if (m?.groups) {
      const tidy = (x: string) => x.trim().replace(/^(?:the|a|an)\s+/i, '').replace(/[,\s]+$/, '').replace(/\s+/g, ' ');
      let a = tidy(m.groups.a), b = tidy(m.groups.b);
      const bad = (x: string) => x.length > 110 || /\b(?:who|had|were|was|underwent)\b/i.test(x);
      if (bad(a) || bad(b)) continue;
      const isControl = (x: string) => /\b(?:control|placebo|usual care|standard (?:care|morpholog)|no (?:such )?treatment|sham)\b/i.test(x);
      if (isControl(a) && !isControl(b)) [a, b] = [b, a];          // intervention first
      return { intervention: a, comparator: b, source: s.trim() };
    }
  }
  return { intervention: null, comparator: null, source: null };
}

/** "X versus Y" in the title — acceptable fallback because both arms are named explicitly. */
export function armsFromTitle(title: string): { intervention: string | null; comparator: string | null } {
  const m = title.match(/^(?:(?:efficacy|safety|effect)\s+of\s+)?(?<a>[^:]{3,80}?)\s+(?:versus|vs\.?|compared with)\s+(?<b>[^:,;]{3,80}?)(?:\s+(?:in|for|among)\b|[:.]|$)/i);
  return m?.groups ? { intervention: m.groups.a.trim(), comparator: m.groups.b.trim() } : { intervention: null, comparator: null };
}

/** Median/mean follow-up. Ignores durations that describe embryo culture, stimulation, treatment courses, etc. */
export function extractFollowUp(text: string): string | null {
  const re = /\b(?:median|mean)\s+(?:duration\s+of\s+)?(?:follow-?up\s+)?(?:of|was|period of)?\s*(?<v>\d+(?:\.\d+)?\s*(?:years?|months?|weeks?|days?))|\b(?:during|over|after)\s+a\s+(?:median|mean)\s+(?:follow-?up\s+)?(?:of\s+)?(?<v2>\d+(?:\.\d+)?\s*(?:years?|months?|weeks?|days?))|\bfollow-?up\s+(?:of|was)\s+(?<v3>\d+(?:\.\d+)?\s*(?:years?|months?|weeks?|days?))/gi;
  for (const m of text.matchAll(re)) {
    const v = m.groups?.v || m.groups?.v2 || m.groups?.v3;
    const ctx = text.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + m[0].length + 30).toLowerCase();
    if (/embryo|culture|development|stimulation|gestation|age\b|aged|duration of (?:infertility|diabetes|disease)|half-life/.test(ctx)) continue;
    if (!/median|mean|follow/.test(m[0].toLowerCase())) continue;
    return `${/median/i.test(m[0]) ? 'Median' : /mean/i.test(m[0]) ? 'Mean' : ''} follow-up ${v!.trim()}`.trim();
  }
  return null;
}
