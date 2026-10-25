import { useEffect, useRef } from 'preact/hooks';
import type { ChatEntry } from '@neurovim/core';
import { mountModelBarHost, type ModelBarHost, type ModelBarHostOptions } from './llm/modelBarHost';

export interface CipherChatProps {
  entries: readonly ChatEntry[];
  /** Live assistant answer while a stream runs, else null. */
  streaming: string | null;
  busy: boolean;
  /** Active mission title, shown as the channel's context tag. */
  missionTitle: string | null;
  onAsk: (q: string) => void;
  onAbort: () => void;
  onReset: () => void;
  /** What the model row needs; null leaves the row out. */
  modelBar: ModelBarHostOptions | null;
}

/** The kit's model row inside the Preact pane. `buildModelBar` builds imperative DOM and holds state (an open
 *  dropdown, the loading spinner, the announcement), and the pane repaints every 500 ms, so the row is built ONCE
 *  into a host element that has no vdom children (Preact leaves a foreign child of such an element alone) and torn
 *  down when the tab goes away. The effect has an EMPTY dependency list on purpose: the options are new objects on
 *  every repaint and must not rebuild the row; the host reads the latest ones through the ref. */
function ModelRow(p: { options: ModelBarHostOptions }) {
  const el = useRef<HTMLDivElement>(null);
  const latest = useRef(p.options);
  latest.current = p.options;
  const host = useRef<ModelBarHost | null>(null);
  useEffect(() => {
    if (!el.current) return;
    host.current = mountModelBarHost(el.current, () => latest.current);
    return () => { host.current?.destroy(); host.current = null; };
  }, []);
  // After every repaint: the host redraws only if what the row shows has changed (model, thinking level, busy).
  useEffect(() => { host.current?.update(); });
  return <div class="nv-uplink-model" ref={el} />;
}

/** UPLINK // CIPHER — chat area inside the hub pane. Stateless: history and the
 *  streaming answer live in the plugin's ChatSession; the input is uncontrolled
 *  so the draft survives the pane's periodic repaints. */
export function CipherChat(p: CipherChatProps) {
  const send = (input: HTMLInputElement): void => {
    const q = input.value.trim();
    if (!q || p.busy) return;
    input.value = '';
    p.onAsk(q);
  };
  return (
    <div class="nv-uplink">
      <h2 class="nv-title">UPLINK // CIPHER</h2>
      {p.missionTitle && <div class="nv-uplink-context">channel: {p.missionTitle}</div>}
      {p.modelBar && <ModelRow options={p.modelBar} />}
      <div class="nv-uplink-log">
        {p.entries.map((e) => (
          <div class={`nv-uplink-line nv-uplink-${e.role}`}>
            <span class="nv-uplink-prefix">{e.role === 'user' ? 'YOU >' : 'CIPHER >'}</span>
            <span class="nv-uplink-text">{e.text}</span>
            {e.detail && <div class="nv-uplink-detail">{e.detail}</div>}
          </div>
        ))}
        {p.streaming !== null && (
          <div class="nv-uplink-line nv-uplink-assistant">
            <span class="nv-uplink-prefix">CIPHER &gt;</span>
            <span class="nv-uplink-text">{p.streaming}<span class="nv-uplink-cursor">▮</span></span>
          </div>
        )}
      </div>
      <div class="nv-uplink-input-row">
        <input
          class="nv-uplink-input"
          type="text"
          placeholder="ask CIPHER…"
          disabled={p.busy}
          onKeyDown={(e) => { if (e.key === 'Enter') send(e.currentTarget); }}
        />
        {p.busy
          ? <button class="nv-btn nv-btn-abort" onClick={p.onAbort}>CUT</button>
          : <button class="nv-btn nv-btn-submit" onClick={(e) => {
              const input = (e.currentTarget as HTMLElement).parentElement?.querySelector('input');
              if (input) send(input);
            }}>SEND</button>}
        <button class="nv-btn nv-btn-reset" title="Reset channel (clear history)" onClick={p.onReset}>RST</button>
      </div>
    </div>
  );
}
