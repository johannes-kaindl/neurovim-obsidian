/** English texts for the vendored (German) endpoint diagnostics: vim-dojo is an
 *  English store plugin, so we map by status kind / warning rule — never by the
 *  vendor's German strings. Keep in sync with EndpointStatusKind. */
import type { EndpointStatusKind } from '../vendor/kit/endpoint_diagnostics';

export function endpointStatusEn(kind: EndpointStatusKind, raw?: string): string {
  switch (kind) {
    case 'ok': return 'Connected.';
    case 'refused': return 'Connection refused — server not running or wrong port.';
    case 'unknown-host': return 'Unknown host — typo in the address?';
    case 'timeout': return 'Timed out — network unreachable (wrong network / VPN off?).';
    case 'not-an-llm-api': return 'Responds, but not an OpenAI-compatible endpoint — wrong path or service?';
    case 'unknown': return `Unreachable — ${raw ?? 'unknown error'}`;
  }
}

export function endpointWarningEn(rule: string): string {
  switch (rule) {
    case 'scheme': return 'Address needs http:// or https://';
    case 'malformed': return 'Not a valid URL';
    case 'port': return 'Local LLM servers almost always need a port (e.g. :1234)';
    case 'placeholder-ip': return 'Looks like an example/placeholder address';
    default: return rule;
  }
}
