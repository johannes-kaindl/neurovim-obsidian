/**
 * CipherUplink — the game-facing half of the CIPHER LLM uplink.
 *
 * Owns prompt assembly and chat choreography; knows nothing about endpoints,
 * models, retries or transport. Those live behind LlmPort in the consumer,
 * which is why a failure arrives here already classified as one of four
 * transport-neutral kinds.
 */
import type { LlmPort, LlmResult } from '../ports/LlmPort';
import type { CipherKnowledge, MissionContext } from './cipherPrompt';
import { buildChatMessages } from './cipherPrompt';
import { buildDebriefMessages } from './debriefPrompt';
import type { ChatSession } from './ChatSession';
import type { RunTrace } from '../engine/RunTrace';

export class CipherUplink {
  /** The in-flight turn's controller, or null. Identity — not a boolean — is
   *  what makes a late turn recognisable: a superseded turn compares its own
   *  controller against this and finds a different object. */
  private current: AbortController | null = null;

  constructor(
    private readonly llm: LlmPort,
    private readonly knowledge: CipherKnowledge,
    /** Called whenever observable state changed, so a consumer can repaint.
     *  Optional: a consumer that polls on its own tick needs nothing here. */
    private readonly onChange?: () => void,
  ) {}

  /** One-shot debrief for a completed run. Stateless — no session involved. */
  async debrief(
    trace: RunTrace,
    mission: MissionContext | null,
    onToken: (t: string) => void,
    signal: AbortSignal,
  ): Promise<LlmResult> {
    const messages = buildDebriefMessages({ knowledge: this.knowledge, mission, trace });
    return this.llm.complete(messages, { onToken, signal });
  }

  /** CUT — cancel the stream, but let the turn finish its bookkeeping. The
   *  controller stays current on purpose: the killed turn still passes the
   *  identity check, so it clears `busy` and lands whatever already streamed
   *  as "… — signal cut" instead of dropping it. */
  abort(): void {
    this.current?.abort();
  }

  /** RST — cancel the turn AND disown it, then wipe the channel. Here the
   *  killed turn must fail the identity check: the session it wanted to write
   *  into no longer exists. This is the difference to `abort()`, and getting
   *  it backwards either strands `busy` or resurrects a cleared chat. */
  reset(session: ChatSession): void {
    this.current?.abort();
    this.current = null;
    session.reset();
    this.onChange?.();
  }

  /** One chat turn: append the question, stream the answer into the session. */
  async ask(session: ChatSession, question: string): Promise<void> {
    if (session.busy) return;

    // History BEFORE the append, or the question arrives in the prompt twice.
    const history = session.historyForPrompt();
    session.append({ role: 'user', text: question });
    session.busy = true;
    session.streaming = '';

    // Hold this turn's controller locally: `this.current` may be replaced by a
    // newer turn or nulled by abort() before our await resolves.
    const mine = new AbortController();
    this.current = mine;
    this.onChange?.();

    const messages = buildChatMessages({
      knowledge: this.knowledge, mission: session.mission, history, question,
    });

    const outcome = await this.llm.complete(messages, {
      onToken: (t) => {
        if (this.current !== mine) return;   // superseded — do not touch newer state
        session.streaming = (session.streaming ?? '') + t;
      },
      signal: mine.signal,
    });

    // Only the current turn may write the outcome. A reset or a newer ask
    // already owns the session by now if this check fails.
    if (this.current !== mine) return;

    if (outcome.ok) {
      session.append({ role: 'assistant', text: outcome.content });
    } else if (outcome.kind === 'aborted') {
      // A cut stream that produced text still shows it; one that produced
      // nothing leaves no trace.
      if (outcome.partial) {
        session.append({ role: 'assistant', text: `${outcome.partial} — signal cut` });
      }
    } else {
      session.append({
        role: 'error', text: 'Signal lost. Check your uplink.', detail: outcome.detail,
      });
    }

    session.streaming = null;
    session.busy = false;
    this.current = null;
    this.onChange?.();
  }
}
