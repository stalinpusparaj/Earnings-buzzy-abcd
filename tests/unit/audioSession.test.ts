import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaybackSession, isAppleTouchDevice, silentWav } from '../../src/core/audioSession';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1';
const IPADOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';

class FakeAudio {
  paused = true;
  loop = false;
  preload = '';
  constructor(public src: string) {}
  setAttribute(): void {}
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
}

function device(userAgent: string, maxTouchPoints: number, audioSession?: { type: string }) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints, ...(audioSession ? { audioSession } : {}) });
  vi.stubGlobal('Audio', FakeAudio);
}

afterEach(() => vi.unstubAllGlobals());

describe('silentWav', () => {
  it('is a valid 8-bit mono PCM WAV of silence', () => {
    const wav = silentWav(0.5, 8000);
    const text = (from: number, n: number) => String.fromCharCode(...wav.slice(from, from + n));
    const view = new DataView(wav.buffer);
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(text(12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint16(34, true)).toBe(8);
    expect(text(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(4000);
    expect(view.getUint32(4, true)).toBe(wav.length - 8);
    expect(wav.slice(44).every((b) => b === 128)).toBe(true);
  });
});

describe('PlaybackSession', () => {
  it('recognises iPhone and iPadOS (desktop user agent + touch), not a Mac', () => {
    device(IPHONE, 5);
    expect(isAppleTouchDevice()).toBe(true);
    device(IPADOS, 5);
    expect(isAppleTouchDevice()).toBe(true);
    device(IPADOS, 0);
    expect(isAppleTouchDevice()).toBe(false);
  });

  it('iOS 16.4+: sets the Audio Session API to playback', () => {
    const audioSession = { type: 'auto' };
    device(IPHONE, 5, audioSession);
    const s = new PlaybackSession();
    expect(s.mode).toBe('audio-session');
    s.start();
    expect(audioSession.type).toBe('playback');
    expect(s.keepAlivePlaying).toBe(false);
  });

  it('older iOS: loops silence, pauses in the background and resumes', () => {
    device(IPHONE, 5);
    const s = new PlaybackSession();
    expect(s.mode).toBe('keep-alive');
    s.start();
    expect(s.keepAlivePlaying).toBe(true);
    s.pause();
    expect(s.keepAlivePlaying).toBe(false);
    s.resume();
    expect(s.keepAlivePlaying).toBe(true);
  });

  it('desktop and Android: does nothing', () => {
    device(DESKTOP, 0);
    const s = new PlaybackSession();
    expect(s.mode).toBe('none');
    s.start();
    s.resume();
    expect(s.keepAlivePlaying).toBe(false);
  });
});
