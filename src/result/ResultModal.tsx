import { App, Modal } from 'obsidian';
import { h, render } from 'preact';
import type { ResultView, MetricRow } from './resultView';
import type { ColorScheme } from '../settings';

function Row({ row }: { row: MetricRow }) {
  return (
    <div class="nv-result-row">
      <span class="nv-result-label">{row.label}</span>
      <span class="nv-result-value">{row.value}</span>
      {row.delta ? (
        <span class={`nv-result-delta ${row.delta.good ? 'is-good' : 'is-bad'}`}>
          {row.delta.arrow} {row.delta.magnitude}
        </span>
      ) : (
        <span class="nv-result-delta is-neutral">—</span>
      )}
      {row.newBest && <span class="nv-result-newbest">NEW BEST</span>}
    </div>
  );
}

function ResultApp({ view, onClose }: { view: ResultView; onClose: () => void }) {
  return (
    <div class="nv-result-body">
      <div class="nv-result-title">✓ MISSION COMPLETE</div>
      <div class="nv-result-mission">{view.title}</div>
      <div class="nv-result-xp">+{view.xp} XP</div>
      <div class="nv-result-metrics">
        {view.rows.map((row) => (
          <Row row={row} />
        ))}
      </div>
      <div class="nv-result-actions">
        <button class="nv-btn nv-btn-nexus" onClick={onClose}>← ZURÜCK ZUM NEXUS</button>
      </div>
    </div>
  );
}

/** Informational modal shown after a successful submit. All state already persisted upstream. */
export class ResultModal extends Modal {
  constructor(app: App, private view: ResultView, private scheme: ColorScheme) {
    super(app);
  }

  onOpen(): void {
    // Scheme class on the modal frame (modalEl) so --nv-* vars are in scope for the
    // whole modal — including its background — not just the inner content.
    this.modalEl.addClass('nv-result-modal', `nv-${this.scheme}`);
    this.contentEl.addClass('nv-result');
    render(h(ResultApp, { view: this.view, onClose: () => this.close() }), this.contentEl);
  }

  onClose(): void {
    render(null, this.contentEl);
    this.contentEl.empty();
  }
}
