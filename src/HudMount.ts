import type { ColorScheme } from './settings';
import type { LineProgress } from './missionProgress';

/** Data the HUD renders — the contract HudMount passes through to the view. */
export interface HudRenderProps {
  id: string;
  title: string;
  elapsedMs: number;
  keystrokes: number;
  vimActive: boolean;
  /** Mission is suspended because the player left the note. */
  paused: boolean;
  /** Live line progress, or null when the mission note is not open. */
  progress: LineProgress | null;
  scheme: ColorScheme;
  onSubmit: () => void;
  onReset: () => void;
  onAbandon: () => void;
  /** Present only when the CIPHER uplink is configured — renders the CIPHER button. */
  onCipher?: () => void;
  /** Present only for the floating box — renders a dismiss (×) button. */
  onDismiss?: () => void;
  /** Hint text (set after a failed submit). When present, renders the HINT button. */
  hint: string | null;
  /** Show the hint in a Notice. */
  onHint: () => void;
}

/** A live, mounted HUD instance. */
export interface HudHandle {
  render(props: HudRenderProps): void;
  destroy(): void;
}

/** Port: the DOM/Preact surface HudMount drives. Real impl mounts on the CM editor; fake in tests. */
export interface HudDom {
  /** Editor element for the note if it's in a visible leaf, else null. */
  editorElFor(notePath: string): unknown;
  /** Mount a fresh HUD container into the editor element and return its handle. */
  create(editorEl: unknown): HudHandle;
}

/** Descriptor of the currently active mission, or null when none is running. */
export interface HudActive {
  notePath: string;
  props: HudRenderProps;
}

/**
 * Owns the HUD lifecycle: reconciles "mission active + note visible ⇒ HUD shown"
 * against the current state. `sync` is the single entry point (called from the tick
 * and from layout-change); it mounts, re-renders, or tears down as needed.
 */
export class HudMount {
  private handle: HudHandle | null = null;
  private path: string | null = null;

  constructor(private readonly dom: HudDom) {}

  get isAttached(): boolean { return this.handle !== null; }

  /** Reconcile the HUD against the active mission (or null to hide it). */
  sync(active: HudActive | null): void {
    if (!active) { this.detach(); return; }
    const el = this.dom.editorElFor(active.notePath);
    if (!el) { this.detach(); return; } // note not in a visible leaf → hide
    if (this.handle && this.path === active.notePath) {
      this.handle.render(active.props); // already mounted here → just refresh
      return;
    }
    if (this.handle) this.detach(); // different note → replace
    this.handle = this.dom.create(el);
    this.path = active.notePath;
    this.handle.render(active.props);
  }

  detach(): void {
    this.handle?.destroy();
    this.handle = null;
    this.path = null;
  }
}
