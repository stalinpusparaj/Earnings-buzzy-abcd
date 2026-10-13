import brand from '../data/brand.config.json';
import { lettersFor } from '../core/content';
import type { Lang, Tolerance } from '../core/types';

export type ParentState = { lang: Lang; tolerance: Tolerance; volume: number; bloomed: ReadonlySet<string> };
export type ParentActions = {
  setLang: (l: Lang) => void;
  setTolerance: (t: Tolerance) => void;
  setVolume: (v: number) => void;
  resetProgress: () => void;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function radio(name: string, value: string, label: string, checked: boolean): string {
  return `<label class="pill"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}/> <span>${label}</span></label>`;
}

function links(): string {
  const items = [
    [brand.parentSiteUrl, 'Our website'],
    [brand.appStoreUrl, 'Buzzy on the App Store'],
    [brand.playStoreUrl, 'Buzzy on Google Play'],
  ].filter(([url]) => url);
  if (items.length === 0) return '';
  // The only outbound links in the game live here, behind the gate.
  return `<section><h3>More from Buzzy</h3><ul class="links">${items
    .map(([url, text]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a></li>`)
    .join('')}</ul></section>`;
}

/**
 * Parent zone: plain DOM, keyboard-usable. TODO(content): Tamil translations of
 * these grown-up labels (to be reviewed by a native speaker).
 */
export function openParentZone(container: HTMLElement, state: ParentState, actions: ParentActions): Promise<void> {
  return new Promise((resolve) => {
    const letters = (['en', 'ta'] as const).flatMap((lang) => lettersFor(lang));
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `
      <div class="modal zone" role="dialog" aria-modal="true" aria-labelledby="zone-title">
        <button class="modal-close" aria-label="Close">×</button>
        <h2 id="zone-title">For grown-ups</h2>
        <section><h3>Language</h3><div class="row">${radio('lang', 'en', 'English', state.lang === 'en')}${radio('lang', 'ta', 'தமிழ்', state.lang === 'ta')}</div></section>
        <section><h3>Tracing difficulty</h3><div class="row">${radio('tol', 'little', 'Little (3–4)', state.tolerance === 'little')}${radio('tol', 'big', 'Big (5–6)', state.tolerance === 'big')}</div></section>
        <section><h3>Volume</h3><input class="volume" type="range" min="0" max="1" step="0.05" value="${state.volume}" aria-label="Volume"/></section>
        <section><h3>What your child is learning</h3><ul class="letters">${letters
          .map((l) => `<li class="${state.bloomed.has(l.id) ? 'done' : ''}"><span class="g">${esc(l.glyph)}</span> ${esc(l.word)} <span class="s">${state.bloomed.has(l.id) ? '🌸 bloomed' : 'not yet'}</span></li>`)
          .join('')}</ul></section>
        <section><h3>Progress</h3><button class="danger reset">Reset progress</button><span class="confirm" hidden><button class="danger yes">Yes, reset</button><button class="no">Cancel</button></span></section>
        <section class="privacy"><h3>Privacy</h3><p>This game collects no personal data. There are no accounts, ads, analytics or tracking. Progress (which flowers have bloomed and your settings) is saved only in this browser on this device, and you can reset it here. <a href="./privacy.html" target="_blank" rel="noopener">Read more</a></p></section>
        ${links()}
      </div>`;
    const q = <T extends Element>(sel: string) => overlay.querySelector(sel) as T;
    overlay.querySelectorAll<HTMLInputElement>('input[name="lang"]').forEach((r) => r.addEventListener('change', () => actions.setLang(r.value as Lang)));
    overlay.querySelectorAll<HTMLInputElement>('input[name="tol"]').forEach((r) => r.addEventListener('change', () => actions.setTolerance(r.value as Tolerance)));
    q<HTMLInputElement>('.volume').addEventListener('input', (e) => actions.setVolume(Number((e.target as HTMLInputElement).value)));
    const confirm = q<HTMLElement>('.confirm');
    q<HTMLButtonElement>('.reset').addEventListener('click', () => (confirm.hidden = false));
    q<HTMLButtonElement>('.no').addEventListener('click', () => (confirm.hidden = true));
    q<HTMLButtonElement>('.yes').addEventListener('click', () => {
      actions.resetProgress();
      confirm.hidden = true;
      overlay.querySelectorAll('.letters li').forEach((li) => {
        li.classList.remove('done');
        li.querySelector('.s')!.textContent = 'not yet';
      });
    });
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    q<HTMLButtonElement>('.modal-close').addEventListener('click', close);
    container.appendChild(overlay);
    q<HTMLButtonElement>('.modal-close').focus();
  });
}
