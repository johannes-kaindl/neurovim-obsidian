/**
 * SSE streaming via XMLHttpRequest + onprogress (ecosystem pattern, PROF-OBS-12):
 * Obsidian's requestUrl can't stream. responseText accumulates; only the new tail
 * is forwarded as a raw delta — SSE parsing happens in CipherClient via parseSSE.
 * Resolves with the HTTP status even for non-2xx (the client wants the error body).
 * AbortSignal → xhr.abort() → rejection with Error name="AbortError".
 */
import type { SseTransport } from './CipherClient';

export class XhrSseTransport implements SseTransport {
  postStream(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    onChunk: (raw: string) => void,
    signal: AbortSignal,
  ): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const abortError = (): Error => {
        const e = new Error('Aborted');
        e.name = 'AbortError';
        return e;
      };
      if (signal.aborted) { reject(abortError()); return; }
      const xhr = new XMLHttpRequest();
      let lastIndex = 0;
      const pump = (): void => {
        const text = xhr.responseText;
        if (text.length > lastIndex) {
          const delta = text.slice(lastIndex);
          lastIndex = text.length;
          onChunk(delta);
        }
      };
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.onprogress = (): void => pump();
      xhr.onerror = (): void => {
        const e = new Error(`CIPHER uplink: network error POST ${url}`);
        e.name = 'StreamNetworkError';
        reject(e);
      };
      xhr.onabort = (): void => reject(abortError());
      xhr.onload = (): void => { pump(); resolve(xhr.status); };
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
      xhr.send(JSON.stringify(body));
    });
  }
}
