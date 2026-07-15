/**
 * @neurovim/core — platform-neutral core (Phase 3 step 2a).
 *
 * Re-exports: state schema (types), ports, game logic (engine), data (data),
 * utils, web audio (audio) and Preact UI (views). NEVER depends on `obsidian` —
 * platform specifics come through the ports that adapter-obsidian / adapter-web
 * implement. ADR-001 §Decisions.
 *
 * Note: The ports (StoragePort/ContentPort/VimModeSource/UiHost) are implemented by
 * the adapters, not consumed by the game logic (engines are pure
 * functions — D17). AudioPort was removed (D19e): AudioEngine is already
 * platform-neutral + injectable, the port wrapper was redundant.
 */

// ── State schema + ports ─────────────────────────────────────
export * from './types';
export * from './ports/StoragePort';
export * from './ports/ContentPort';
export * from './ports/VimModeSource';
export * from './ports/UiHost';

// ── Engine (game logic) ──────────────────────────────────────
export * from './engine/MetricsTracker';
export * from './engine/MissionEngine';
export * from './engine/ProgressionEngine';
export * from './engine/GlitchEngine';
export * from './engine/ParTier';
export * from './engine/GuidanceEngine';

// ── Data ─────────────────────────────────────────────────────
export * from './data/chapters';
export * from './data/levels';
export * from './data/cheatsheet';
export * from './data/cipher-quotes';

// ── Utils ────────────────────────────────────────────────────
export * from './utils/diff';
export * from './utils/time';
export * from './utils/hints';
export * from './utils/chapterNav';
export * from './utils/clock';

// ── Web audio (platform-neutral) ─────────────────────────────
export * from './audio/AudioEngine';
export * from './audio/SoundCues';
export * from './audio/AmbientLayer';
export * from './audio/CommandListener';

// ── Preact UI ────────────────────────────────────────────────
export * from './views/FloatHUD';
export * from './views/SandboxHUD';
export * from './views/components/AsciiArt';
export * from './views/modules/MissionHudModule';
export * from './views/modules/NavHubModule';
export * from './views/modules/CheatSheetModule';
export * from './views/modules/ProgressModule';
