import { h } from 'preact';
import type { ChatEntry } from './llm/chatSession';

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
          onKeyDown={(e) => { if (e.key === 'Enter') send(e.currentTarget as HTMLInputElement); }}
        />
        {p.busy
          ? <button class="nv-btn nv-btn-abort" onClick={p.onAbort}>CUT</button>
          : <button class="nv-btn nv-btn-submit" onClick={(e) => {
              const input = (e.currentTarget as HTMLElement).parentElement?.querySelector('input');
              if (input) send(input as HTMLInputElement);
            }}>SEND</button>}
        <button class="nv-btn nv-btn-reset" title="Reset channel (clear history)" onClick={p.onReset}>RST</button>
      </div>
    </div>
  );
}
