import dns from 'node:dns/promises';
import net from 'node:net';

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

/**
 * Validates whether an IP address belongs to private, loopback, link-local,
 * cloud metadata, or reserved ranges (P5-1).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // Check IPv4
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    const [a, b, c, d] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (a === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link-local & cloud metadata, e.g. AWS/GCP 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private network)
    if (a === 192 && b === 168) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (a >= 224) return true;

    return false;
  }

  // Check IPv6
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();

    // Check for IPv4-mapped IPv6 (::ffff:192.168.1.1 or ::ffff:127.0.0.1)
    if (lower.startsWith('::ffff:')) {
      const rest = lower.slice(7);
      if (net.isIPv4(rest)) {
        return isPrivateOrReservedIp(rest);
      }
    }

    // Loopback (::1) & Unspecified (::)
    if (lower === '::1' || lower === '::') return true;
    // Unique local (fc00::/7 -> fc.. or fd..)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local (fe80::/10 -> fe8.., fe9.., fea.., feb..)
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      return true;
    }

    return false;
  }

  // If not a valid IP string, treat as unsafe
  return true;
}

/**
 * Resolves hostname and verifies that all resolved IP addresses are safe.
 */
export async function validateSafeHostname(hostname: string): Promise<void> {
  // If hostname is directly an IP address
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new SsrfError(`Access to IP address "${hostname}" is forbidden by SSRF security policy.`);
    }
    return;
  }

  // Resolve hostname via DNS
  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (dnsErr: any) {
    throw new SsrfError(`DNS resolution failed for hostname "${hostname}": ${dnsErr?.message}`);
  }

  if (!records || records.length === 0) {
    throw new SsrfError(`No DNS records found for hostname "${hostname}".`);
  }

  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new SsrfError(
        `Hostname "${hostname}" resolved to prohibited private/internal address ${record.address}. Request blocked.`
      );
    }
  }
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  maxRedirects?: number;
  timeoutMs?: number;
  maxSizeBytes?: number;
}

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  headers: Headers;
  buffer: Buffer;
  contentType: string;
}

/**
 * SSRF-hardened fetch client:
 * 1. Strict https: scheme only
 * 2. DNS resolution check before connecting (rejects private, loopback, link-local, cloud metadata)
 * 3. Max 3 redirects with DNS re-check on every redirect
 * 4. 15s timeout
 * 5. 25MB response size cap
 */
export async function safeFetchUrl(
  inputUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxSizeBytes = options.maxSizeBytes ?? 25 * 1024 * 1024; // 25 MB

  let currentUrl = inputUrl;
  let redirectCount = 0;

  while (true) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new SsrfError(`Invalid URL string: "${currentUrl}"`);
    }

    // 1. Strict HTTPS scheme only
    if (parsed.protocol !== 'https:') {
      throw new SsrfError(`Forbidden protocol "${parsed.protocol}". Only secure "https:" URLs are permitted.`);
    }

    // 2. DNS Resolution and IP checking
    await validateSafeHostname(parsed.hostname);

    // 3. Perform fetch with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Fetch timed out after ${timeoutMs}ms`)), timeoutMs);

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: 'GET',
        headers: options.headers,
        redirect: 'manual', // Manual redirect control to inspect every hop
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // 4. Handle redirects
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new SsrfError(`Exceeded maximum redirect limit of ${maxRedirects}.`);
      }
      const location = res.headers.get('location');
      if (!location) {
        throw new SsrfError(`Redirect status ${res.status} received without Location header.`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`Fetch failed with HTTP status ${res.status}: ${res.statusText}`);
    }

    // 5. Size check
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      throw new Error(`Response size (${contentLength} bytes) exceeds maximum permitted limit of ${maxSizeBytes} bytes.`);
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > maxSizeBytes) {
      throw new Error(`Downloaded response size (${arrayBuffer.byteLength} bytes) exceeds maximum permitted limit of ${maxSizeBytes} bytes.`);
    }

    return {
      finalUrl: currentUrl,
      status: res.status,
      headers: res.headers,
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get('content-type') || '',
    };
  }
}
