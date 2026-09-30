// uebernommen aus lingotuner/src/i18n/strings.ts (request.*, en) und lingotuner/src/core/request-text.ts, 2026-09-30
/** Every user-visible text of the "Request" settings section and of the request deviation
 *  notices. NeuroVim is English-only and has no i18n engine, so these are constants instead of
 *  `src/i18n/strings.ts` keys (declared in AGENTS.md § UI-Abweichungen). Wording follows
 *  lingotuner/src/i18n/strings.ts (en) — same section, same texts. */
import type { RequestSectionStrings } from '../vendor/kit-obsidian/request-section';
import {
  BACKENDS, FAMILIES,
  type BackendId, type Deviation, type DeviationKind, type FamilyId, type FieldExplain, type FieldId, type ModeId,
} from '../vendor/kit/sampling-profiles';

const FAMILY_SOURCE: Record<string, string> = {
  manager: 'from the LLM Endpoint Manager',
  name: 'estimated from the name',
  none: 'unknown',
};
const BACKEND_SOURCE: Record<string, string> = {
  manager: 'from the LLM Endpoint Manager',
  probe: 'detected',
  none: 'unknown',
};

const MODE_NAME: Record<ModeId, string> = {
  transform: 'Transform',
  agent: 'Agent',
  structured: 'Structured',
  grounded: 'Grounded chat',
  companion: 'Companion',
  creative: 'Creative',
};

const FIELD_NAME: Record<FieldId, string> = {
  temperature: 'Temperature (temperature)',
  top_p: 'Nucleus sampling (top_p)',
  top_k: 'Top-k sampling (top_k)',
  min_p: 'Minimum probability (min_p)',
  presence_penalty: 'Presence penalty (presence_penalty)',
  reasoning_effort: 'Thinking effort (reasoning_effort)',
  max_tokens: 'Token budget (max_tokens)',
};

const FIELD_STATE: Record<FieldExplain['state'], string> = {
  'sent-effective': 'Sent — measured to work on this backend.',
  'sent-unproven': 'Sent — effect on this backend not proven yet.',
  'not-sent-ignored': 'Not sent — measured to have no effect on this backend.',
  'not-sent-unsupported': 'Not sent — this backend doesn\'t support it, or it\'s unmeasured.',
  'not-sent-unknown-family': 'Not sent — the model family is unknown.',
  'not-sent-no-value': 'Not sent — no value is set for this field.',
};

const FIELD_NOTE: Record<NonNullable<FieldExplain['note']>, string> = {
  'raised-to-reserve': 'Raised to the family\'s reserve so thinking can\'t eat the whole budget.',
  'raised-to-thinking-floor': 'Raised to the family\'s floor while thinking (the vendor warns against greedy decoding).',
  'below-thinking-floor': 'Below the family\'s thinking floor — your value wins anyway.',
  'off-not-possible': 'This family can\'t fully turn thinking off; the lowest available level is sent.',
};

const TOP_P_HINT = ' For near-deterministic answers use temperature 0 or top_k 1 instead of a very small top_p.';

const DEVIATION: Record<DeviationKind, (detail?: string) => string> = {
  'thinking-despite-off': () => 'The model thought even though thinking is off.',
  'empty-by-budget': () => 'Empty answer: thinking used up the token budget.',
  'family-mismatch': (d) => `The answer came from a different model family (${d ?? ''}).`,
  'family-detected': (d) => `Model family detected: ${d ?? ''}. Set it in the LLM Endpoint Manager.`,
  rejected: (d) => `The server rejected the request: ${d ?? ''}`,
};

export function deviationDetail(kind: DeviationKind, detail?: string): string {
  return DEVIATION[kind](detail);
}

/** Notice text — only called for deviations with `affectsResult` (contract of
 *  `createRequestSession`). */
export function deviationNotice(d: Deviation): string {
  return `${deviationDetail(d.kind, d.detail)} Details in the settings under “Request”.`;
}

export function requestDroppedNotice(n: number): string {
  return `${n} saved request setting(s) were invalid and were reset to the profile.`;
}

function fieldStateText(e: FieldExplain): string {
  let s = FIELD_STATE[e.state];
  if (e.note) s += ` ${FIELD_NOTE[e.note]}`;
  if (e.field === 'top_p') s += TOP_P_HINT;
  return s;
}

export function requestSectionStrings(): RequestSectionStrings {
  return {
    title: 'Request',
    head: (family, familySource, backend, backendSource) => {
      const famLabel = family === '—' ? '—' : (FAMILIES[family as FamilyId]?.label ?? family);
      const backLabel = backend === 'unknown' ? BACKEND_SOURCE.none : (BACKENDS[backend as BackendId]?.label ?? backend);
      return `Family: ${famLabel} (${FAMILY_SOURCE[familySource]}) · Backend: ${backLabel} (${BACKEND_SOURCE[backendSource]})`;
    },
    unknownFamily: 'Model family unknown — only the mode\'s temperature is sent, the rest comes from the server default.',
    jitWarning: (model, defaultModel) =>
      `This plugin sends model ${model}, the endpoint's default is ${defaultModel}. On LM Studio, every request unloads the other plugins' model.`,
    sentAs: (model) => `Sent as ${model}`,
    modeHeading: (mode) => MODE_NAME[mode],
    fieldName: (field) => FIELD_NAME[field],
    fieldDesc: fieldStateText,
    reset: 'Reset',
    thinkingLevel: 'Thinking level',
    level: (l) => l,
    levelPicker: 'Level picker in chat',
    levelPickerDesc: 'Shows a dropdown with all four levels in the panel instead of the two-state button.',
    dormant: (fam) => `Own values for ${fam === 'unknown' ? FAMILY_SOURCE.none : (FAMILIES[fam]?.label ?? fam)}, not active right now`,
    deleteDormant: 'Delete',
    lastRequest: 'Last request',
    lastRequestNone: 'No request sent yet this session.',
    copy: 'Copy',
    copied: 'Copied',
    deviationsOk: 'No deviations this session.',
    deviationsWarn: (n) => `${n} deviation(s) this session.`,
    deviation: (kind, count, detail) => `${deviationDetail(kind, detail)} (${count}×)`,
  };
}
