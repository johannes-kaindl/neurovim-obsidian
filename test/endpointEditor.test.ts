import { describe, it, expect } from 'vitest';
import { applyEndpointEdit, activeIndexFromStatuses } from '../src/llm/endpointEditor';

describe('applyEndpointEdit', () => {
  it('appends a non-empty value from the adder row', () => {
    expect(applyEndpointEdit(['http://a:1'], 1, 'http://b:2', true)).toEqual(['http://a:1', 'http://b:2']);
  });

  it('ignores an empty adder row', () => {
    expect(applyEndpointEdit(['http://a:1'], 1, '   ', true)).toEqual(['http://a:1']);
  });

  it('replaces an existing row in place', () => {
    expect(applyEndpointEdit(['http://a:1', 'http://b:2'], 0, 'http://c:3', false))
      .toEqual(['http://c:3', 'http://b:2']);
  });

  it('removes a row that is cleared out', () => {
    expect(applyEndpointEdit(['http://a:1', 'http://b:2'], 0, '', false)).toEqual(['http://b:2']);
  });

  it('trims values and never persists blank entries', () => {
    expect(applyEndpointEdit([], 0, '  http://a:1  ', true)).toEqual(['http://a:1']);
    expect(applyEndpointEdit(['  ', 'http://b:2'], 1, 'http://b:2', false)).toEqual(['http://b:2']);
  });
});

describe('activeIndexFromStatuses', () => {
  it('picks the first reachable row (resolveActiveEndpoint semantics)', () => {
    expect(activeIndexFromStatuses(['refused', 'ok', 'ok'])).toBe(1);
  });

  it('returns -1 when nothing is reachable or nothing was probed yet', () => {
    expect(activeIndexFromStatuses(['refused', 'timeout'])).toBe(-1);
    expect(activeIndexFromStatuses([null, null])).toBe(-1);
  });
});
