import type { ColorScheme } from './settings';

export interface PausedBannerProps {
  missionId: string;
  scheme: ColorScheme;
  onReturn: () => void;
  onAbort: () => void;
}

/**
 * Floating reminder shown when a mission has been paused for a while. Deliberately not
 * mounted on the mission editor — that note is not visible, which is the whole point.
 * Thin adapter, no logic; the "when" is decided by shouldShowPausedBanner.
 */
export class PausedBanner {
  private el: HTMLElement | null = null;
  /** Mission the current element was built for — a repaint tick must not rebuild it
   *  under the user's cursor, so identical props are a no-op. */
  private shownFor: string | null = null;
  private shownScheme: ColorScheme | null = null;

  constructor(private readonly host: HTMLElement) {}

  get isShown(): boolean { return this.el !== null; }

  show(p: PausedBannerProps): void {
    if (this.el && this.shownFor === p.missionId && this.shownScheme === p.scheme) return;
    this.hide();
    const el = this.host.createDiv({ cls: `nv-paused-banner nv-${p.scheme}` });
    el.createSpan({ cls: 'nv-paused-label', text: `${p.missionId} PAUSED` });
    const actions = el.createDiv({ cls: 'nv-paused-actions' });
    // Plain addEventListener, not registerDomEvent: this element is transient and is
    // garbage-collected with its listeners once detached.
    const ret = actions.createEl('button', { cls: 'nv-btn nv-btn-return', text: 'RETURN' });
    ret.addEventListener('click', p.onReturn);
    const abort = actions.createEl('button', { cls: 'nv-btn nv-btn-abort', text: 'ABORT' });
    abort.addEventListener('click', p.onAbort);
    this.el = el;
    this.shownFor = p.missionId;
    this.shownScheme = p.scheme;
  }

  hide(): void {
    this.el?.remove();
    this.el = null;
    this.shownFor = null;
    this.shownScheme = null;
  }
}
