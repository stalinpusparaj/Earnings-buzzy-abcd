import type { AudioEngine } from './audio';
import { voFile, voText } from './i18n';
import type { Lang } from './types';

/**
 * Voice-over. Recorded files from the manifest win; otherwise speechSynthesis
 * (en-IN preferred, ta-IN for Tamil). With no usable voice it plays a chime, and
 * callers always pair VO with a visual hint, so gameplay never waits on VO.
 */
export class Voice {
  lang: Lang = 'en';
  volume = 1;
  private voices: SpeechSynthesisVoice[] = [];
  private current: HTMLAudioElement | null = null;
  private token = 0;

  constructor(private audio: AudioEngine) {
    if ('speechSynthesis' in window) {
      const load = () => (this.voices = window.speechSynthesis.getVoices());
      load();
      window.speechSynthesis.addEventListener?.('voiceschanged', load);
    }
  }

  canSpeak(lang: Lang): boolean {
    return this.pickVoice(lang) !== null;
  }

  say(id: string, vars: Record<string, string> = {}): Promise<void> {
    const file = voFile(id, this.lang);
    if (file) return this.playFile(file);
    return this.sayText(voText(id, this.lang, vars));
  }

  sayText(text: string): Promise<void> {
    this.stop();
    const my = ++this.token;
    if (!text || this.volume === 0) return Promise.resolve();
    const voice = this.pickVoice(this.lang);
    if (!voice) {
      this.audio.play('chime');
      return new Promise((r) => window.setTimeout(r, 600));
    }
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = voice;
      utter.lang = voice.lang;
      utter.rate = 0.85; // ~20% slower than adult speech
      utter.pitch = 1.2;
      utter.volume = this.volume;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (my === this.token) this.audio.duck(false);
        resolve();
      };
      utter.onend = finish;
      utter.onerror = finish;
      // Some browsers never fire onend; don't let a flow hang on it.
      window.setTimeout(finish, 1500 + text.length * 110);
      this.audio.duck(true);
      window.speechSynthesis.speak(utter);
    });
  }

  stop(): void {
    this.token++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.current?.pause();
    this.current = null;
    this.audio.duck(false);
  }

  private playFile(url: string): Promise<void> {
    this.stop();
    const el = new Audio(`${import.meta.env.BASE_URL}${url}`);
    el.volume = this.volume;
    this.current = el;
    this.audio.duck(true);
    return new Promise((resolve) => {
      const finish = () => {
        this.audio.duck(false);
        resolve();
      };
      el.onended = finish;
      el.onerror = finish;
      el.play().catch(finish);
    });
  }

  private pickVoice(lang: Lang): SpeechSynthesisVoice | null {
    if (!('speechSynthesis' in window)) return null;
    if (this.voices.length === 0) this.voices = window.speechSynthesis.getVoices();
    const prefix = lang === 'ta' ? 'ta' : 'en';
    const exact = this.voices.find((v) => v.lang.replace('_', '-') === `${prefix}-IN`);
    return exact ?? this.voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? null;
  }
}
