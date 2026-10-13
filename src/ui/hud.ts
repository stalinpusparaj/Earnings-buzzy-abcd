import type { Lang } from '../core/types';
import { icons } from './icons';

export type HudMode = 'hidden' | 'garden' | 'letter' | 'sing';
export type HudActions = {
  home: () => void;
  toggleLang: () => void;
  toggleMute: () => void;
  parentTap: () => void;
  parentHold: () => void;
};

const HOLD_MS = 3000;

function button(cls: string, html: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `hud-btn ${cls}`;
  b.innerHTML = html;
  b.setAttribute('aria-label', label); // for screen readers and tests; children never need to read it
  return b;
}

/** Icon-only overlay buttons (≥ 64 px). The parent button needs a 3 s hold. */
export class Hud {
  readonly root = document.createElement('div');
  private home = button('hud-home', icons.home, 'Home');
  private lang = button('hud-lang', '<span class="l-en">A</span><span class="l-sep">/</span><span class="l-ta">அ</span>', 'Language');
  private mute = button('hud-mute', icons.sound, 'Sound');
  private parent = button('hud-parent', `${icons.parent}<svg class="hold-ring" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21"/></svg>`, 'Grown-ups');

  constructor(container: HTMLElement, actions: HudActions) {
    this.root.className = 'hud';
    this.root.append(this.home, this.lang, this.mute, this.parent);
    container.appendChild(this.root);
    this.home.addEventListener('click', actions.home);
    this.lang.addEventListener('click', actions.toggleLang);
    this.mute.addEventListener('click', actions.toggleMute);
    for (const b of [this.home, this.lang, this.mute]) b.addEventListener('pointerdown', () => b.animate([{ transform: 'scale(0.85)' }, { transform: 'scale(1)' }], { duration: 250, easing: 'cubic-bezier(.34,1.56,.64,1)' }));
    this.wireHold(actions);
    this.setMode('hidden');
  }

  /** Long-press is only allowed here (brief P2): random taps can't open the gate. */
  private wireHold(actions: HudActions): void {
    let timer = 0;
    let started = 0;
    const cancel = () => {
      window.clearTimeout(timer);
      timer = 0;
      this.parent.classList.remove('holding');
    };
    this.parent.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      started = performance.now();
      this.parent.classList.add('holding');
      timer = window.setTimeout(() => {
        cancel();
        actions.parentHold();
      }, HOLD_MS);
    });
    const release = () => {
      if (!timer) return;
      const short = performance.now() - started < HOLD_MS;
      cancel();
      if (short) actions.parentTap();
    };
    this.parent.addEventListener('pointerup', release);
    this.parent.addEventListener('pointerleave', cancel);
    this.parent.addEventListener('pointercancel', cancel);
    this.parent.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setMode(mode: HudMode): void {
    this.root.dataset.mode = mode;
    this.root.hidden = mode === 'hidden';
    this.home.hidden = mode === 'garden';
    this.lang.hidden = mode !== 'garden';
  }

  setLang(lang: Lang): void {
    this.lang.dataset.lang = lang;
  }

  setMuted(muted: boolean): void {
    this.mute.innerHTML = muted ? icons.mute : icons.sound;
    this.mute.classList.toggle('off', muted);
  }
}
