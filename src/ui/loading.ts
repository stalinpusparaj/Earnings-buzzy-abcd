import brand from '../data/brand.config.json';
import { icons } from './icons';

/** Loading + "tap to start" screen. The tap unlocks audio on iOS. */
export class StartScreen {
  private root = document.createElement('div');
  private bar = document.createElement('div');
  private play = document.createElement('button');

  constructor(container: HTMLElement) {
    this.root.className = 'start';
    const bee = document.createElement('div');
    bee.className = 'start-bee';
    bee.innerHTML = '<span class="wing w1"></span><span class="wing w2"></span><span class="eye e1"></span><span class="eye e2"></span>';
    const track = document.createElement('div');
    track.className = 'start-track';
    this.bar.className = 'start-bar';
    track.appendChild(this.bar);
    this.play.className = 'start-play';
    this.play.innerHTML = icons.play;
    this.play.setAttribute('aria-label', 'Play');
    this.play.hidden = true;
    this.root.append(bee, track, this.play);
    if (brand.partnerName) {
      const by = document.createElement('p');
      by.className = 'start-partner';
      by.textContent = `presented by ${brand.partnerName}`;
      this.root.appendChild(by);
    }
    container.appendChild(this.root);
  }

  progress(fraction: number): void {
    this.bar.style.width = `${Math.round(Math.min(1, fraction) * 100)}%`;
  }

  /** Shows the big play button and resolves on the first tap. */
  waitForTap(): Promise<void> {
    this.progress(1);
    this.play.hidden = false;
    this.root.classList.add('ready');
    return new Promise((resolve) => {
      const go = () => {
        this.root.classList.add('gone');
        window.setTimeout(() => this.root.remove(), 500);
        resolve();
      };
      this.play.addEventListener('click', go, { once: true });
    });
  }

  fail(): void {
    this.root.classList.add('failed');
  }
}
