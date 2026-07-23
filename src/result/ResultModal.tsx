import { App, Modal } from 'obsidian';
import { h, render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import type { ResultView, MetricRow } from './resultView';
import type { ColorScheme } from '../settings';
import type { StreamOutcome } from '../llm/CipherClient';

/** Streams a CIPHER debrief for the just-completed run. Resolves to the final outcome;
 *  tokens arrive via onToken. Provided by main.ts (null when unconfigured/off). */
export type DebriefRunner = (
  onToken: (t: string) => void,
  signal: AbortSignal,
) => Promise<StreamOutcome>;

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

function DebriefSection({ runDebrief }: { runDebrief: DebriefRunner }) {
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');
  const [text, setText] = useState('');
  const [detail, setDetail] = useState('');
  const ctrl = useRef<AbortController | null>(null);

  // Abort a live stream if the modal closes mid-debrief.
  useEffect(() => () => ctrl.current?.abort(), []);

  const start = async () => {
    setStatus('streaming');
    setText('');
    setDetail('');
    const c = new AbortController();
    ctrl.current = c;
    let acc = '';
    const outcome = await runDebrief((t) => {
      if (c.signal.aborted) return;   // modal closed mid-stream — don't setState after unmount
      acc += t;
      setText(acc);
    }, c.signal);
    if (c.signal.aborted) return;
    if (outcome.ok) {
      setStatus('done');
    } else if (outcome.kind === 'aborted') {
      setStatus('idle');
    } else {
      setDetail(outcome.detail);
      // A partial answer is still useful — show it as done, else surface the error.
      setStatus(outcome.partial ? 'done' : 'error');
    }
  };

  return (
    <div class="nv-result-debrief">
      {status === 'idle' && (
        <button class="nv-btn nv-btn-debrief" onClick={start}>&gt; DEBRIEF ANFORDERN</button>
      )}
      {status === 'streaming' && (
        <div class="nv-debrief-stream">{text || '> CIPHER analysiert…'}</div>
      )}
      {status === 'done' && <div class="nv-debrief-stream">{text}</div>}
      {status === 'error' && (
        <div class="nv-debrief-error">
          Signal lost. Check your uplink.
          {detail && <span class="nv-debrief-detail">{detail}</span>}
          <button class="nv-btn nv-btn-debrief" onClick={start}>&gt; RETRY</button>
        </div>
      )}
    </div>
  );
}

function ResultApp({ view, runDebrief, onClose }: { view: ResultView; runDebrief: DebriefRunner | null; onClose: () => void }) {
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
      {runDebrief && <DebriefSection runDebrief={runDebrief} />}
      <div class="nv-result-actions">
        <button class="nv-btn nv-btn-nexus" onClick={onClose}>← ZURÜCK ZUM NEXUS</button>
      </div>
    </div>
  );
}

/** Informational modal shown after a successful submit. All state already persisted upstream. */
export class ResultModal extends Modal {
  constructor(
    app: App,
    private view: ResultView,
    private scheme: ColorScheme,
    private runDebrief: DebriefRunner | null = null,
  ) {
    super(app);
  }

  onOpen(): void {
    // Scheme class on the modal frame (modalEl) so --nv-* vars are in scope for the
    // whole modal — including its background — not just the inner content.
    this.modalEl.addClass('nv-result-modal', `nv-${this.scheme}`);
    this.contentEl.addClass('nv-result');
    render(
      h(ResultApp, { view: this.view, runDebrief: this.runDebrief, onClose: () => this.close() }),
      this.contentEl,
    );
  }

  onClose(): void {
    render(null, this.contentEl);
    this.contentEl.empty();
  }
}
