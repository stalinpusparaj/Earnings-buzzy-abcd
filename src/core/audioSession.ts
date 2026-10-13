// iOS/iPadOS silent switch. Web audio on iOS defaults to the "ambient" audio session,
// which the ringer switch mutes, so on a device left on silent the game was soundless.
// Asking for the "playback" session makes it behave like a video app: sound plays,
// and the HUD mute button and the grown-ups volume slider still silence it.
//
//  1. iOS 16.4+ / Safari: the Audio Session API, navigator.audioSession.type = 'playback'.
//  2. Older iOS (common on school iPads): loop an in-memory clip of silence through an
//     <audio> element, which switches the page to the playback session. Paused whenever
//     the game is in the background, so it never keeps the audio session busy.

export type SessionMode = 'audio-session' | 'keep-alive' | 'none';

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export function isAppleTouchDevice(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports a desktop Mac user agent; touch support gives it away.
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** A valid 8-bit mono PCM WAV file of silence (8-bit PCM silence is the value 128). */
export function silentWav(seconds = 0.5, sampleRate = 8000): Uint8Array {
  const samples = Math.max(1, Math.round(seconds * sampleRate));
  const buf = new Uint8Array(44 + samples);
  const view = new DataView(buf.buffer);
  const ascii = (offset: number, s: string) => [...s].forEach((c, i) => (buf[offset + i] = c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples, true);
  buf.fill(128, 44);
  return buf;
}

export class PlaybackSession {
  readonly mode: SessionMode;
  private keepAlive: HTMLAudioElement | null = null;

  constructor() {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session) {
      this.mode = 'audio-session';
    } else if (isAppleTouchDevice()) {
      this.mode = 'keep-alive';
    } else {
      this.mode = 'none';
    }
  }

  /** Call inside the first user gesture, before audio starts. */
  start(): void {
    if (this.mode === 'audio-session') {
      try {
        (navigator as AudioSessionNavigator).audioSession!.type = 'playback';
      } catch {
        // Unsupported value on this WebKit version: keep the default session.
      }
    } else if (this.mode === 'keep-alive' && !this.keepAlive) {
      const url = URL.createObjectURL(new Blob([silentWav() as BlobPart], { type: 'audio/wav' }));
      const el = new Audio(url);
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.setAttribute('x-webkit-airplay', 'deny');
      this.keepAlive = el;
      this.resume();
    }
  }

  /** Re-assert after the game comes back to the foreground (or on any tap). */
  resume(): void {
    if (this.keepAlive?.paused) void this.keepAlive.play().catch(() => undefined);
  }

  /** In the background: release the session so the device's other audio behaves normally. */
  pause(): void {
    this.keepAlive?.pause();
  }

  get keepAlivePlaying(): boolean {
    return !!this.keepAlive && !this.keepAlive.paused;
  }
}
