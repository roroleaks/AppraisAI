/**
 * Validates an ORCID iD string against format (\d{4}-\d{4}-\d{4}-\d{3}[\dX])
 * and ISO 7064 MOD 11-2 check digit algorithm (P0-6).
 */
export function isValidOrcid(orcid: string | undefined | null): boolean {
  if (!orcid) return false;
  const trimmed = orcid.trim();
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(trimmed)) {
    return false;
  }

  const clean = trimmed.replace(/-/g, '');
  let total = 0;
  for (let i = 0; i < 15; i++) {
    total = (total + parseInt(clean[i], 10)) * 2;
  }
  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const expectedCheckDigit = result === 10 ? 'X' : String(result);

  return clean[15] === expectedCheckDigit;
}
