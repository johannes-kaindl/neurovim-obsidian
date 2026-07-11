import { AudioEngine } from './AudioEngine';

// CORP-character tone: pure sine, linear decay, no drift, no pre-attack noise — clinical, institutional.
function playTone(
  ac: AudioContext,
  dest: AudioNode,
  freq: number,
  type: OscillatorType,
  duration: number,
  gain: number,
  delay = 0,
  freqEndHz?: number,
): void {
  const osc = ac.createOscillator();
  const gainNode = ac.createGain();
  const t = ac.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEndHz !== undefined) osc.frequency.linearRampToValueAtTime(freqEndHz, t + duration);
  const attack = Math.min(0.01, duration * 0.1);
  const releaseStart = Math.max(t + attack, t + duration - 0.05);
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(gain, t + attack);
  gainNode.gain.setValueAtTime(gain, releaseStart);
  gainNode.gain.linearRampToValueAtTime(0, t + duration);
  osc.connect(gainNode);
  gainNode.connect(dest);
  osc.start(t);
  osc.stop(t + duration + 0.02);
  osc.onended = () => { try { osc.disconnect(); gainNode.disconnect(); } catch { /* ignore */ } };
}

// Resistance-character tone: warm pre-attack noise burst, frequency drift in decay, phosphor-decay envelope.
// The "handmade" quality — imprecise, inhabited, like a tool with a history.
function playResistanceTone(
  ac: AudioContext,
  dest: AudioNode,
  freq: number,
  type: OscillatorType,
  duration: number,
  gain: number,
  delay = 0,
  freqEndHz?: number,
): void {
  const t = ac.currentTime + delay;

  // Pre-attack noise burst: slight noise before the onset
  const preNoiseDur = 0.015;
  const noiseBufSize = Math.max(Math.ceil(ac.sampleRate * preNoiseDur), 1);
  const noiseBuf = ac.createBuffer(1, noiseBufSize, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = freq;
  noiseFilter.Q.value = 2;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(gain * 0.06, t);
  noiseGain.gain.linearRampToValueAtTime(0, t + preNoiseDur);
  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);
  noiseSrc.start(t);
  noiseSrc.onended = () => { try { noiseSrc.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect(); } catch { /* ignore */ } };

  // Main tone
  const osc = ac.createOscillator();
  const gainNode = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);

  if (freqEndHz !== undefined) {
    // Frequency sweep: intentional motion, no additional drift
    osc.frequency.linearRampToValueAtTime(freqEndHz, t + duration);
  } else {
    // Frequency drift in decay: minimal pitch drift in the decay — phosphor analog
    const drift = (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 7);
    const driftStart = t + duration * 0.4;
    osc.frequency.setValueAtTime(freq, driftStart);
    osc.frequency.linearRampToValueAtTime(freq + drift, t + duration);
  }

  // Phosphor-decay envelope: fast attack, logarithmic-ish release with afterglow
  const attack = Math.min(0.012, duration * 0.1);
  const releaseStart = Math.max(t + attack, t + duration * 0.3);
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(gain, t + attack);
  gainNode.gain.setValueAtTime(gain, releaseStart);
  gainNode.gain.linearRampToValueAtTime(gain * 0.25, t + duration * 0.8);
  gainNode.gain.linearRampToValueAtTime(0, t + duration);

  osc.connect(gainNode);
  gainNode.connect(dest);
  osc.start(t);
  osc.stop(t + duration + 0.02);
  osc.onended = () => { try { osc.disconnect(); gainNode.disconnect(); } catch { /* ignore */ } };
}

function playNoise(
  ac: AudioContext,
  dest: AudioNode,
  duration: number,
  gain: number,
  filterFreq = 1200,
  delay = 0,
): void {
  const bufSize = Math.ceil(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, Math.max(bufSize, 1), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const gainNode = ac.createGain();
  const t = ac.currentTime + delay;
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(gain, t + 0.005);
  gainNode.gain.linearRampToValueAtTime(0, t + duration);
  src.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(dest);
  src.start(t);
  src.onended = () => { try { src.disconnect(); filter.disconnect(); gainNode.disconnect(); } catch { /* ignore */ } };
}

export class SoundCues {
  private static guard(engine: AudioEngine): AudioContext | null {
    if (!engine.isReady || !engine.master) return null;
    return engine.context!;
  }

  // --- Narrative Event-Cues ---

  // Transmission restored: Resistance-Bell — warm, monophon, long decay with drift.
  // The operative saves the file. Nobody applauds. The bell is for the operative alone.
  static missionComplete(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    const dest = engine.master!;
    playResistanceTone(ac, dest, 523.25, 'triangle', 1.4, 0.32);
    playResistanceTone(ac, dest, 261.63, 'triangle', 0.8, 0.10, 0.06); // warm undertone
  }

  // NEXUS designation update: ascending pentatonic tones, warm triangle, no fanfare.
  static levelUp(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    const dest = engine.master!;
    const notes = [196.00, 233.08, 293.66, 392.00];
    notes.forEach((f, i) => playResistanceTone(ac, dest, f, 'triangle', 0.3, 0.26, i * 0.2));
  }

  // Subliminal XP confirmation: barely perceptible, high frequency, short decay.
  static xpGain(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 1760, 'sine', 0.08, 0.09);
  }

  // Transmission still corrupt: signal abort — descending sweep + brief noise (signal degradation).
  static wrongAttempt(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    const dest = engine.master!;
    playResistanceTone(ac, dest, 440, 'sine', 0.22, 0.14, 0, 220);
    playNoise(ac, dest, 0.12, 0.10, 500);
  }

  // File reset: descending warm sweep — opening the buffer fresh.
  static missionReset(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 660, 'triangle', 0.5, 0.16, 0, 165);
  }

  // NEVERMORE pattern active: brief CORP-sine intrusion signature — pure, clinical, no warmth.
  static glitchFeedback(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playTone(ac, engine.master!, 920, 'sine', 0.05, 0.16);
  }

  // Drill toggle: mechanical switch — low noise thud + warm subfrequency click.
  static drillToggle(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    const dest = engine.master!;
    playNoise(ac, dest, 0.06, 0.20, 200);
    playResistanceTone(ac, dest, 120, 'sine', 0.06, 0.10, 0.01);
  }

  // CORP system denial: pure sine, linear decay, no warmth — the system, not the operative.
  static lockMessage(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playTone(ac, engine.master!, 150, 'sine', 0.4, 0.18);
  }

  // --- Vim Mode Sounds ---

  // Normal mode: mechanical relay — the operative takes command. Warm, analog, with brief noise layer.
  static vimModeNormal(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    const dest = engine.master!;
    playResistanceTone(ac, dest, 220, 'triangle', 0.12, 0.20);
    playNoise(ac, dest, 0.04, 0.07, 400, 0.005);
  }

  // Insert mode: gate opening — receptive, the operative begins to write. Soft sine, slow fade-in.
  static vimModeInsert(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 660, 'sine', 0.22, 0.13);
  }

  // Visual mode: scanning signal — ascending frequency sweep, acquisition active.
  static vimModeVisual(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 330, 'sine', 0.18, 0.12, 0, 550);
  }

  // Command mode: terminal prompt — precise, the cursor blinks.
  static vimModeCommand(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 880, 'sine', 0.08, 0.15);
  }

  // --- Corruption Feedback ---

  // Signal acquired: one corruption cleared — ascending ping, warm with decay drift.
  static corruptionFixed(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 440, 'sine', 0.22, 0.18, 0, 660);
  }

  // Transmission fully restored: ascending warm chord resolution, soft noise fade-out.
  static transmissionRestored(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    const dest = engine.master!;
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((f, i) => playResistanceTone(ac, dest, f, 'triangle', 1.0 - i * 0.08, 0.18, i * 0.12));
    playNoise(ac, dest, 0.25, 0.04, 1500, 0.35);
  }

  // --- Command Melody Sounds (pentatonic minor: G3/Bb3/C4/D4/F4/G4) ---

  static commandDelete(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 196, 'triangle', 0.1, 0.18);
  }

  static commandYank(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 261, 'sine', 0.1, 0.14);
  }

  static commandChange(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 233, 'sine', 0.08, 0.14);
  }

  static commandMotionForward(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 293, 'sine', 0.06, 0.11);
  }

  static commandMotionBack(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 349, 'sine', 0.06, 0.11);
  }

  static commandPaste(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 392, 'sine', 0.14, 0.16);
  }

  // Undo: F4→G3 — backwards through time, with warmth
  static commandUndo(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 349, 'sine', 0.22, 0.14, 0, 196);
  }

  // Redo: G3→G4 — forwards, ascending
  static commandRedo(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 196, 'sine', 0.22, 0.14, 0, 392);
  }

  // gg: low anchor — start of document, heavy, long
  static commandGotoStart(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 196, 'triangle', 0.28, 0.18);
  }

  // G: high target — end of document, open
  static commandGotoEnd(engine: AudioEngine): void {
    const ac = this.guard(engine); if (!ac) return;
    playResistanceTone(ac, engine.master!, 392, 'triangle', 0.28, 0.18);
  }
}
