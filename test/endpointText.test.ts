import { describe, it, expect } from 'vitest';
import { endpointStatusEn, endpointWarningEn } from '../src/llm/endpointText';
import type { EndpointStatusKind } from '../src/vendor/kit/endpoint_diagnostics';

describe('endpointStatusEn', () => {
  it('maps every status kind to a non-empty English message', () => {
    const kinds: EndpointStatusKind[] = ['ok', 'refused', 'unknown-host', 'timeout', 'not-an-llm-api', 'unknown'];
    for (const k of kinds) {
      const msg = endpointStatusEn(k, 'boom');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toMatch(/[äöüß]|Verbindung|Zeitüberschreitung/); // no German leaking through
    }
  });

  it('includes the raw error for unknown', () => {
    expect(endpointStatusEn('unknown', 'ECONNRESET')).toContain('ECONNRESET');
  });
});

describe('endpointWarningEn', () => {
  it('maps all known rules and falls back to the rule name', () => {
    for (const rule of ['scheme', 'malformed', 'port', 'placeholder-ip']) {
      expect(endpointWarningEn(rule).length).toBeGreaterThan(0);
      expect(endpointWarningEn(rule)).not.toMatch(/[äöüß]/);
    }
    expect(endpointWarningEn('future-rule')).toBe('future-rule');
  });
});
