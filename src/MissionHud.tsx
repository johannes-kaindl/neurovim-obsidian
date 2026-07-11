import { h } from 'preact';
import type { HudRenderProps } from './HudMount';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Floating CRT mission-control that lives over the editor of the active mission note. */
export function MissionHud(p: HudRenderProps) {
  return (
    <div class="nv-float-hud">
      <div class="nv-hud-row">
        <span class="nv-hud-mission">{p.id}</span>
        <span class="nv-hud-timer">{fmt(p.elapsedMs)}</span>
        <span class="nv-hud-keystrokes">{p.keystrokes} keys</span>
        <div class="nv-hud-actions">
          <button class="nv-btn nv-btn-submit" onClick={p.onSubmit}>SUBMIT</button>
          <button class="nv-btn nv-btn-reset" onClick={p.onReset}>RESET</button>
          <button class="nv-btn nv-btn-abort" onClick={p.onAbandon}>ABORT</button>
        </div>
      </div>
      {!p.vimActive && (
        <div class="nv-hud-vimhint">
          Vim mode off — enable it in Settings → Editor for the real experience.
        </div>
      )}
    </div>
  );
}
