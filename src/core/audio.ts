// Web Audio wrapper: music / SFX buses with ducking (brief §8). Every sound is
// synthesised here, so the game ships with no audio files until real VO arrives.
import { PlaybackSession } from './audioSession';

export type SfxName = 'pop' | 'boop' | 'chime' | 'whoosh' | 'bloom' | 'celebrate' | 'buzz';

const MUSIC_LEVEL = 0.35;
const MUSIC_DUCKED = 0.12;
const SFX_LEVEL = 0.7;
const BEAT = 60 / 100; // 100 bpm
// I–V–vi–IV in C: bass note + chord tones (Hz)
const CHORDS = [
  [130.81, 261.63, 329.63, 392.0],
  [98.0, 246.94, 293.66, 392.0],
  [110.0, 220.0, 261.63, 329.63],
  [87.31, 220.0, 261.63, 349.23],
];
const BELLS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer = 0;
  private nextBeatTime = 0;
  private beat = 0;
  private volume = 1;
  /** iOS silent-switch handling (see audioSession.ts). */
  readonly session = new PlaybackSession();

  /** Call from the first tap (iOS needs a user gesture to start audio). */
  unlock(): void {
    // Ask for the playback session before any audio starts, so the iOS silent switch doesn't mute the game.
    this.session.start();
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.bus(SFX_LEVEL);
      this.musicBus = this.bus(MUSIC_LEVEL);
      this.noise = this.makeNoise();
      // iOS can suspend the context again later; resume on the next touch.
      window.addEventListener('touchend', () => void this.resume(), { passive: true });
    }
    void this.resume();
  }

  async resume(): Promise<void> {
    this.session.resume();
    if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume().catch(() => undefined);
  }

  suspend(): void {
    this.session.pause();
    void this.ctx?.suspend().catch(() => undefined);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  duck(on: boolean): void {
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? MUSIC_DUCKED : MUSIC_LEVEL, this.ctx.currentTime, 0.15);
  }

  startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    this.nextBeatTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    const out = this.sfxBus;
    if (!ctx || !out || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'pop':
        this.tone(out, 'sine', 520, 1250, t, 0.12, 0.5);
        this.burst(out, t, 0.05, 2400, 0.25);
        break;
      case 'boop':
        this.tone(out, 'triangle', 320, 170, t, 0.22, 0.45);
        break;
      case 'chime':
        this.tone(out, 'sine', 1046.5, 1046.5, t, 0.9, 0.35);
        this.tone(out, 'sine', 1568, 1568, t + 0.06, 0.8, 0.25);
        break;
      case 'whoosh':
        this.burst(out, t, 0.45, 900, 0.35, 3200);
        break;
      case 'bloom':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(out, 'triangle', f, f, t + i * 0.09, 0.5, 0.3));
        break;
      case 'celebrate':
        [659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => this.tone(out, 'sine', f, f, t + i * 0.07, 0.45, 0.28));
        this.burst(out, t + 0.3, 0.3, 5000, 0.12);
        break;
      case 'buzz':
        this.tone(out, 'sawtooth', 170, 210, t, 0.35, 0.08, 900);
        break;
    }
  }

  private bus(level: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = level;
    g.connect(this.master!);
    return g;
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private tone(out: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, lowpass?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      osc.connect(f);
      node = f;
    }
    node.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private burst(out: AudioNode, t: number, dur: number, freq: number, peak: number, sweepTo?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + dur * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Gentle generative ukulele + glockenspiel loop, scheduled a little ahead of time. */
  private scheduleMusic(): void {
    const ctx = this.ctx;
    const out = this.musicBus;
    if (!ctx || !out || ctx.state !== 'running') return;
    while (this.nextBeatTime < ctx.currentTime + 0.3) {
      const t = this.nextBeatTime;
      const chord = CHORDS[Math.floor(this.beat / 4) % CHORDS.length];
      const inBar = this.beat % 4;
      if (inBar === 0) this.tone(out, 'triangle', chord[0], chord[0], t, 1.1, 0.35, 900);
      this.tone(out, 'triangle', chord[1 + (inBar % 3)], chord[1 + (inBar % 3)], t, 0.5, 0.16, 2200);
      this.tone(out, 'triangle', chord[1 + ((inBar + 1) % 3)], chord[1 + ((inBar + 1) % 3)], t + BEAT / 2, 0.45, 0.12, 2200);
      if (inBar % 2 === 1 && Math.random() < 0.45) {
        const bell = BELLS[Math.floor(Math.random() * BELLS.length)];
        this.tone(out, 'sine', bell, bell, t, 0.7, 0.07);
      }
      this.beat++;
      this.nextBeatTime += BEAT;
    }
  }
}
