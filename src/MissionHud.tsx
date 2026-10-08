import type { HudRenderProps } from './HudMount';
import type { MissionObjective } from './missionObjective';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The mission's target, open by default and collapsible. Exact strings render as `<code>`
 * so the part to match character for character stands apart from the prose. The panel
 * scrolls inside a max-height, so a long list never buries the note under the floating box.
 */
function ObjectivePanel({ objective, open, onToggle, panelId }: {
  objective: MissionObjective; open: boolean; onToggle: () => void; panelId: string;
}) {
  return (
    <section class={`nv-hud-objective${open ? ' is-open' : ''}`} aria-labelledby={`${panelId}-label`}>
      <button
        type="button"
        class="nv-hud-objective-toggle"
        id={`${panelId}-label`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span class="nv-hud-objective-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
        Objective
      </button>
      {open && (
        <div class="nv-hud-objective-body" id={panelId}>
          {objective.kind === 'steps'
            ? (
              <ol class="nv-hud-objective-list">
                {objective.steps.map((segs, i) => (
                  <li key={i}>
                    {segs.map((s, j) => (s.code
                      ? <code key={j} class="nv-hud-objective-code">{s.text}</code>
                      : <span key={j}>{s.text}</span>))}
                  </li>
                ))}
              </ol>
            )
            : <p class="nv-hud-objective-summary">{objective.text}</p>}
        </div>
      )}
    </section>
  );
}

/**
 * Mission-control UI — shared by the floating box (over the editor) and the
 * sidebar pane. Context-neutral: the box vs. pane look comes from the wrapper's
 * CSS. Renders a dismiss (×) button only when `onDismiss` is provided (the box).
 */
export function MissionHud(p: HudRenderProps) {
  return (
    <div class={`nv-hud nv-${p.scheme}${p.paused ? ' is-paused' : ''}`}>
      <div class="nv-hud-row">
        <span class="nv-hud-mission">{p.id}</span>
        <span class="nv-hud-timer">{p.paused ? `${fmt(p.elapsedMs)} ⏸` : fmt(p.elapsedMs)}</span>
        <span class="nv-hud-keystrokes">{p.keystrokes} keys</span>
        {p.progress && (
          <span class="nv-hud-progress" title="Lines matching the solution">
            {p.progress.matched}/{p.progress.total} lines
          </span>
        )}
        <div class="nv-hud-actions">
          <button class="nv-btn nv-btn-submit" onClick={p.onSubmit}>SUBMIT</button>
          <button class="nv-btn nv-btn-reset" onClick={p.onReset}>RESET</button>
          <button class="nv-btn nv-btn-abort" onClick={p.onAbandon}>ABORT</button>
          {p.hint && (
            <button class="nv-btn nv-btn-hint" title="Show what the first error should be" onClick={p.onHint}>HINT</button>
          )}
          {p.onCipher && (
            <button class="nv-btn nv-btn-cipher" title="Ask CIPHER for Vim advice" onClick={p.onCipher}>CIPHER</button>
          )}
        </div>
        {p.onDismiss && (
          <button class="nv-hud-close" aria-label="Hide HUD (this mission)" onClick={p.onDismiss}>×</button>
        )}
      </div>
      {p.objective && (
        <ObjectivePanel
          objective={p.objective}
          open={p.objectiveOpen}
          onToggle={p.onToggleObjective}
          panelId={`nv-objective-${p.id}-${p.onDismiss ? 'box' : 'pane'}`}
        />
      )}
      {!p.vimActive && (
        <div class="nv-hud-vimhint">⚠ Vim mode off — Settings → Editor</div>
      )}
    </div>
  );
}
