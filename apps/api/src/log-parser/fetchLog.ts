import { isIP } from 'node:net';
import { config } from '../config.js';
import { ApiError } from '../errors/ApiError.js';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_URL_LENGTH = 2_048;

export interface FetchLogResult {
  text: string;
  finalUrl: string;
}

export function validateLogUrl(rawUrl: string): URL {
  if (rawUrl.length > MAX_URL_LENGTH) throw ApiError.invalidUrl(`URL exceeds ${MAX_URL_LENGTH} characters`);

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw ApiError.invalidUrl('URL is not valid');
  }

  const allowedProtocols = config.isProduction ? new Set(['https:']) : new Set(['http:', 'https:']);
  if (!allowedProtocols.has(parsed.protocol)) {
    throw ApiError.invalidUrl(config.isProduction ? 'only HTTPS URLs are allowed' : 'only HTTP(S) URLs are allowed');
  }
  if (parsed.username || parsed.password) throw ApiError.invalidUrl('URL credentials are not allowed');
  if (isIP(parsed.hostname)) throw ApiError.invalidUrl('IP-literal hosts are not allowed');
  if (config.isProduction && parsed.port && parsed.port !== '443') {
    throw ApiError.invalidUrl('non-standard HTTPS ports are not allowed');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!config.allowedLogHosts.has(hostname)) {
    throw ApiError.invalidUrl(`host "${hostname}" is not in LOG_FETCH_HOSTS`);
  }
  return parsed;
}

export async function fetchLog(rawUrl: string): Promise<FetchLogResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  timeout.unref?.();

  let current = validateLogUrl(rawUrl);
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      let response: Response;
      try {
        response = await fetch(current, { signal: controller.signal, redirect: 'manual' });
      } catch (error) {
        if (controller.signal.aborted) {
          throw ApiError.fetchFailed(`request to ${current.hostname} timed out after ${FETCH_TIMEOUT_MS}ms`);
        }
        const message = error instanceof Error ? error.message : String(error);
        throw ApiError.fetchFailed(`could not reach ${current.hostname}: ${message}`);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel().catch(() => undefined);
        if (!location) throw ApiError.fetchFailed('upstream redirect omitted a Location header');
        if (redirects === MAX_REDIRECTS) throw ApiError.fetchFailed(`upstream exceeded ${MAX_REDIRECTS} redirects`);
        current = validateLogUrl(new URL(location, current).href);
        continue;
      }

      if (!response.ok) {
        throw ApiError.fetchFailed(`upstream returned HTTP ${response.status} ${response.statusText}`, {
          upstreamStatus: response.status,
        });
      }

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader && Number(contentLengthHeader) > MAX_RESPONSE_BYTES) {
        throw ApiError.responseTooLarge(
          `upstream reported ${contentLengthHeader} bytes; limit is ${MAX_RESPONSE_BYTES} bytes`,
        );
      }

      if (!response.body) {
        const text = await response.text();
        if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
          throw ApiError.responseTooLarge(`downloaded body exceeds ${MAX_RESPONSE_BYTES} bytes`);
        }
        return { text, finalUrl: current.href };
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          await reader.cancel().catch(() => undefined);
          throw ApiError.responseTooLarge(`downloaded body exceeds ${MAX_RESPONSE_BYTES} bytes`);
        }
        chunks.push(value);
      }
      return {
        text: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8'),
        finalUrl: current.href,
      };
    }
    throw ApiError.fetchFailed('redirect handling failed');
  } finally {
    clearTimeout(timeout);
  }
}
