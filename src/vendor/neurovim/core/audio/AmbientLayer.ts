import { AudioEngine } from './AudioEngine';

export type AmbientContext = 'idle' | 'arc1' | 'arc2';

export class AmbientLayer {
  private engine: AudioEngine;
  private currentCtx: AmbientContext = 'idle';
  private enabled = false;
  private nodes: AudioNode[] = [];
  private fadeGain: GainNode | null = null;
  private glitchTimer: ReturnType<typeof setTimeout> | null = null;
  private distantPulseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  get isEnabled(): boolean { return this.enabled; }
  get context(): AmbientContext { return this.currentCtx; }

  setEnabled(val: boolean): void {
    if (this.enabled === val) return;
    this.enabled = val;
    if (!val) this.stopNodes();
    else this.startPreset(this.currentCtx);
  }

  setContext(ctx: AmbientContext): void {
    if (this.currentCtx === ctx) return;
    this.currentCtx = ctx;
    if (this.enabled) this.startPreset(ctx);
  }

  private stopNodes(): void {
    if (this.glitchTimer !== null) {
      globalThis.clearTimeout(this.glitchTimer);
      this.glitchTimer = null;
    }
    if (this.distantPulseTimer !== null) {
      globalThis.clearTimeout(this.distantPulseTimer);
      this.distantPulseTimer = null;
    }
    const ac = this.engine.context;
    if (ac && this.fadeGain) {
      this.fadeGain.gain.linearRampToValueAtTime(0, ac.currentTime + 2);
    }
    const nodesToStop = this.nodes.slice();
    globalThis.setTimeout(() => {
      nodesToStop.forEach(n => {
        try {
          if ('stop' in n && typeof (n as AudioScheduledSourceNode).stop === 'function') (n as AudioScheduledSourceNode).stop();
          n.disconnect();
        } catch { /* already stopped/disconnected */ }
      });
    }, 2100);
    this.nodes = [];
    this.fadeGain = null;
  }

  private startPreset(ctx: AmbientContext): void {
    if (!this.engine.isReady) return;
    const ac = this.engine.context!;

    this.stopNodes();

    this.fadeGain = ac.createGain();
    this.fadeGain.gain.setValueAtTime(0, ac.currentTime);
    this.fadeGain.gain.linearRampToValueAtTime(1, ac.currentTime + 2);
    this.fadeGain.connect(this.engine.master!);
    this.nodes.push(this.fadeGain);

    if (ctx === 'idle') this.buildIdle(ac);
    else if (ctx === 'arc1') this.buildArc1(ac);
    else this.buildArc2(ac);
  }

  // Idle: the operative's terminal in standby — monitoring CORP infrastructure for incoming signals.
  // Physical room: monitor hum (50Hz fundamental + 100Hz harmonic), barely-perceptible breathing LFO.
  // Schlucht-Layer: stochastic low-frequency drone pulses from the logistics route below (03:30 route).
  private buildIdle(ac: AudioContext): void {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 50;

    // Second harmonic — warm, physical monitor character
    const osc2 = ac.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 100;
    const gain2 = ac.createGain();
    gain2.gain.value = 0.07;
    osc2.connect(gain2);
    gain2.connect(this.fadeGain!);

    // Very slow breathing LFO (0.03Hz ≈ 33s cycle) — barely perceptible ±3Hz drift
    const lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.03;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = ac.createGain();
    gain.gain.value = 0.32;
    osc.connect(gain);
    gain.connect(this.fadeGain!);

    osc.start();
    osc2.start();
    lfo.start();
    this.nodes.push(osc, gain, osc2, gain2, lfo, lfoGain);

    this.scheduleDistantPulse();
  }

  // Schlucht-Layer: distant logistics drones, 03:30 route — pure low-frequency pulse, 10-28s apart
  private scheduleDistantPulse(): void {
    if (!this.enabled || !this.engine.isReady || this.currentCtx !== 'idle') return;
    const delay = 10000 + Math.random() * 18000;
    this.distantPulseTimer = globalThis.setTimeout(() => {
      this.distantPulseTimer = null;
      if (!this.enabled || !this.engine.isReady || this.currentCtx !== 'idle' || !this.fadeGain) return;
      const a = this.engine.context!;
      const bufSize = Math.max(Math.ceil(a.sampleRate * 0.9), 1);
      const buf = a.createBuffer(1, bufSize, a.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource();
      src.buffer = buf;
      const f = a.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 75;
      const g = a.createGain();
      const t = a.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.35);
      g.gain.linearRampToValueAtTime(0, t + 0.9);
      src.connect(f);
      f.connect(g);
      g.connect(this.fadeGain);
      src.start(t);
      src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch { /* */ } };
      this.scheduleDistantPulse();
    }, delay);
  }

  // Arc1: operative receives a CORP transmission — warm Resistance terminal + cold institutional CORP carrier.
  // Two layers audible simultaneously: the room (warm, slight drift) and the received signal (clean, no drift).
  private buildArc1(ac: AudioContext): void {
    // Resistance terminal hum — foundation, quieter than idle (CORP signal competes)
    const termOsc = ac.createOscillator();
    termOsc.type = 'sine';
    termOsc.frequency.value = 50;
    const termLfo = ac.createOscillator();
    termLfo.type = 'sine';
    termLfo.frequency.value = 0.03;
    const termLfoGain = ac.createGain();
    termLfoGain.gain.value = 3;
    termLfo.connect(termLfoGain);
    termLfoGain.connect(termOsc.frequency);
    const termGain = ac.createGain();
    termGain.gain.value = 0.18;
    termOsc.connect(termGain);
    termGain.connect(this.fadeGain!);
    termOsc.start();
    termLfo.start();
    this.nodes.push(termOsc, termLfo, termLfoGain, termGain);

    // CORP carrier: pure sine, no LFO, no drift — institutional, clinical, not warm
    const corpCarrier = ac.createOscillator();
    corpCarrier.type = 'sine';
    corpCarrier.frequency.value = 800;
    const corpGain = ac.createGain();
    corpGain.gain.value = 0.05;
    corpCarrier.connect(corpGain);
    corpGain.connect(this.fadeGain!);
    corpCarrier.start();
    this.nodes.push(corpCarrier, corpGain);

    // Institutional static: narrow bandpass noise — CORP infrastructure hiss, very faint
    const bufSize = Math.min(ac.sampleRate * 2, 88200);
    const buffer = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noiseSrc = ac.createBufferSource();
    noiseSrc.buffer = buffer;
    noiseSrc.loop = true;
    const noiseFilter = ac.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 4;
    const noiseGain = ac.createGain();
    noiseGain.gain.value = 0.04;
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.fadeGain!);
    noiseSrc.start();
    this.nodes.push(noiseSrc, noiseFilter, noiseGain);
  }

  // Arc2: deep inside CORP infrastructure, NEVERMORE Protocol running.
  // CORP carrier dominates. NEVERMORE texture: structured distortion. Resistance hum suppressed.
  // Intrusion pulses: brief CORP-sine bursts — NEVERMORE pattern artifacts, stepped frequency (not random).
  private buildArc2(ac: AudioContext): void {
    // NEVERMORE texture: structured distortion
    const bufSize = Math.min(ac.sampleRate * 2, 88200);
    const buffer = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const shaper = ac.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
    }
    shaper.curve = curve;
    const noiseGain = ac.createGain();
    noiseGain.gain.value = 0.10;
    src.connect(shaper);
    shaper.connect(noiseGain);
    noiseGain.connect(this.fadeGain!);
    src.start();
    this.nodes.push(src, shaper, noiseGain);

    // CORP carrier — more prominent than arc1, CORP owns this space
    const corpCarrier = ac.createOscillator();
    corpCarrier.type = 'sine';
    corpCarrier.frequency.value = 600;
    const corpGain = ac.createGain();
    corpGain.gain.value = 0.12;
    corpCarrier.connect(corpGain);
    corpGain.connect(this.fadeGain!);
    corpCarrier.start();
    this.nodes.push(corpCarrier, corpGain);

    // Resistance terminal hum — barely audible, suppressed under CORP's weight
    const termOsc = ac.createOscillator();
    termOsc.type = 'sine';
    termOsc.frequency.value = 50;
    const termGain = ac.createGain();
    termGain.gain.value = 0.08;
    termOsc.connect(termGain);
    termGain.connect(this.fadeGain!);
    termOsc.start();
    this.nodes.push(termOsc, termGain);

    // NEVERMORE intrusion pulses: brief CORP-sine bursts at stepped frequencies (not random noise)
    const scheduleGlitch = () => {
      if (!this.enabled || !this.engine.isReady) return;
      const a = this.engine.context!;
      const delay = 3000 + Math.random() * 5000;
      this.glitchTimer = globalThis.setTimeout(() => {
        this.glitchTimer = null;
        if (this.enabled && this.engine.isReady && this.currentCtx === 'arc2' && this.fadeGain) {
          const t = a.currentTime;
          const intrOsc = a.createOscillator();
          intrOsc.type = 'sine';
          intrOsc.frequency.value = 800 + Math.floor(Math.random() * 5) * 80; // stepped: 800/880/960/1040/1120
          const intrGain = a.createGain();
          intrGain.gain.setValueAtTime(0, t);
          intrGain.gain.linearRampToValueAtTime(0.07, t + 0.008); // hard attack — CORP precision
          intrGain.gain.linearRampToValueAtTime(0, t + 0.07);     // linear decay — CORP character
          intrOsc.connect(intrGain);
          intrGain.connect(this.fadeGain);
          intrOsc.start(t);
          intrOsc.stop(t + 0.08);
          intrOsc.onended = () => { try { intrOsc.disconnect(); intrGain.disconnect(); } catch { /* */ } };
        }
        if (this.enabled && this.currentCtx === 'arc2') scheduleGlitch();
      }, delay);
    };
    scheduleGlitch();
  }

  dispose(): void {
    if (this.glitchTimer !== null) {
      globalThis.clearTimeout(this.glitchTimer);
      this.glitchTimer = null;
    }
    if (this.distantPulseTimer !== null) {
      globalThis.clearTimeout(this.distantPulseTimer);
      this.distantPulseTimer = null;
    }
    this.enabled = false;
    this.nodes.forEach(n => { try { n.disconnect(); } catch { /* ignore */ } });
    this.nodes = [];
    this.fadeGain = null;
  }
}
