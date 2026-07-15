import type { HudRenderProps } from './HudMount';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Mission-control UI — shared by the floating box (over the editor) and the
 * sidebar pane. Context-neutral: the box vs. pane look comes from the wrapper's
 * CSS. Renders a dismiss (×) button only when `onDismiss` is provided (the box).
 */
export function MissionHud(p: HudRenderProps) {
  return (
    <div class={`nv-hud nv-${p.scheme}`}>
      <div class="nv-hud-row">
        <span class="nv-hud-mission">{p.id}</span>
        <span class="nv-hud-timer">{fmt(p.elapsedMs)}</span>
        <span class="nv-hud-keystrokes">{p.keystrokes} keys</span>
        <div class="nv-hud-actions">
          <button class="nv-btn nv-btn-submit" onClick={p.onSubmit}>SUBMIT</button>
          <button class="nv-btn nv-btn-reset" onClick={p.onReset}>RESET</button>
          <button class="nv-btn nv-btn-abort" onClick={p.onAbandon}>ABORT</button>
          {p.onCipher && (
            <button class="nv-btn nv-btn-cipher" title="Ask CIPHER for Vim advice" onClick={p.onCipher}>CIPHER</button>
          )}
        </div>
        {p.onDismiss && (
          <button class="nv-hud-close" aria-label="Hide HUD (this mission)" onClick={p.onDismiss}>×</button>
        )}
      </div>
      {!p.vimActive && (
        <div class="nv-hud-vimhint">⚠ Vim mode off — Settings → Editor</div>
      )}
    </div>
  );
}
