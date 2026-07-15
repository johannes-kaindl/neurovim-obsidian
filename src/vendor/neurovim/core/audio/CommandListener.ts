import { AudioEngine } from './AudioEngine';
import { SoundCues } from './SoundCues';
import { realClock, type ClockPort } from '../utils/clock';

type VimModeWatcherLike = { mode: string };

export class CommandListener {
  private engine: AudioEngine;
  private modeWatcher: VimModeWatcherLike;
  private clock: ClockPort;
  private el: HTMLElement | null = null;
  private pendingOp: string | null = null;
  private resetTimer: number | null = null;
  private comboTimers: number[] = [];
  private readonly keyRef: (e: KeyboardEvent) => void;

  constructor(engine: AudioEngine, modeWatcher: VimModeWatcherLike, clock: ClockPort = realClock) {
    this.engine = engine;
    this.modeWatcher = modeWatcher;
    this.clock = clock;
    this.keyRef = this.onKeyDown.bind(this);
  }

  get isAttached(): boolean { return this.el !== null; }

  attach(el: HTMLElement): void {
    this.detach();
    this.el = el;
    el.addEventListener('keydown', this.keyRef, true);
  }

  detach(): void {
    this.comboTimers.forEach(id => this.clock.clearTimeout(id));
    this.comboTimers = [];
    if (this.el) this.el.removeEventListener('keydown', this.keyRef, true);
    this.el = null;
    this.pendingOp = null;
    if (this.resetTimer) { this.clock.clearTimeout(this.resetTimer); this.resetTimer = null; }
  }

  private scheduleReset(): void {
    if (this.resetTimer) this.clock.clearTimeout(this.resetTimer);
    this.resetTimer = this.clock.setTimeout(() => { this.pendingOp = null; this.resetTimer = null; }, 300);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.engine.isReady) return;

    const mode = this.modeWatcher.mode;
    const inNormal = mode === 'normal';

    if (e.key === ':' && inNormal) {
      SoundCues.vimModeCommand(this.engine);
      return;
    }

    if (!inNormal) return;

    if (this.pendingOp) {
      const op = this.pendingOp;
      this.pendingOp = null;
      if (this.resetTimer) { this.clock.clearTimeout(this.resetTimer); this.resetTimer = null; }
      this.playCombo(op, e.key);
      return;
    }

    if (e.key === 'd' || e.key === 'y' || e.key === 'c') {
      this.pendingOp = e.key;
      this.scheduleReset();
      return;
    }

    switch (e.key) {
      case 'w': case 'e': SoundCues.commandMotionForward(this.engine); break;
      case 'b': SoundCues.commandMotionBack(this.engine); break;
      case 'p': case 'P': SoundCues.commandPaste(this.engine); break;
      case 'u': SoundCues.commandUndo(this.engine); break;
      case 'G': SoundCues.commandGotoEnd(this.engine); break;
      case 'g':
        this.pendingOp = 'g';
        this.scheduleReset();
        break;
    }

    if (e.key === 'r' && e.ctrlKey) SoundCues.commandRedo(this.engine);
  }

  private playCombo(op: string, motion: string): void {
    const KNOWN_MOTIONS = new Set(['w', 'e', 'b', 'd', 'y', 'c', 'W', 'E', 'B', 'g']);
    if (!KNOWN_MOTIONS.has(motion)) {
      // Not a valid combo target — cancel the combo silently
      return;
    }

    if (op === 'g' && motion === 'g') {
      SoundCues.commandGotoStart(this.engine);
      return;
    }

    if (op === motion) {
      if (op === 'd') { SoundCues.commandDelete(this.engine); this.comboTimers.push(this.clock.setTimeout(() => SoundCues.commandDelete(this.engine), 60)); }
      else if (op === 'y') { SoundCues.commandYank(this.engine); this.comboTimers.push(this.clock.setTimeout(() => SoundCues.commandYank(this.engine), 60)); }
      else if (op === 'c') { SoundCues.commandChange(this.engine); this.comboTimers.push(this.clock.setTimeout(() => SoundCues.vimModeInsert(this.engine), 80)); }
      return;
    }
    const motionSound = ['b'].includes(motion)
      ? () => SoundCues.commandMotionBack(this.engine)
      : () => SoundCues.commandMotionForward(this.engine);

    if (op === 'd') { SoundCues.commandDelete(this.engine); this.comboTimers.push(this.clock.setTimeout(motionSound, 80)); }
    else if (op === 'y') { SoundCues.commandYank(this.engine); this.comboTimers.push(this.clock.setTimeout(motionSound, 80)); }
    else if (op === 'c') { SoundCues.commandChange(this.engine); this.comboTimers.push(this.clock.setTimeout(() => SoundCues.vimModeInsert(this.engine), 80)); }
  }

  dispose(): void {
    this.detach();
  }
}
