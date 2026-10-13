const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 10–99 in words, e.g. 47 → "forty-seven". */
export function numberWords(n: number): string {
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

const MAX_ATTEMPTS = 3;

/**
 * Grown-up check: "Tap forty-seven" on a 4×3 keypad. Three wrong answers close it.
 * Resolves true only when passed.
 */
export function openParentGate(container: HTMLElement): Promise<boolean> {
  return new Promise((resolve) => {
    const answer = 10 + Math.floor(Math.random() * 90);
    let entry = '';
    let attempts = 0;
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `
      <div class="modal gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <button class="modal-close" aria-label="Close">×</button>
        <h2 id="gate-title">Grown-ups only</h2>
        <p class="gate-ask">Tap <strong>${numberWords(answer)}</strong></p>
        <output class="gate-entry" aria-live="polite"></output>
        <div class="keypad"></div>
        <p class="gate-msg" aria-live="polite"></p>
      </div>`;
    const pad = overlay.querySelector('.keypad')!;
    const out = overlay.querySelector('.gate-entry')!;
    const msg = overlay.querySelector('.gate-msg')!;
    const close = (ok: boolean) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(ok);
    };
    const press = (key: string) => {
      if (key === '⌫') entry = entry.slice(0, -1);
      else if (key === '✓') {
        if (Number(entry) === answer) return close(true);
        attempts++;
        entry = '';
        if (attempts >= MAX_ATTEMPTS) return close(false);
        msg.textContent = `Not quite. ${MAX_ATTEMPTS - attempts} tries left.`;
      } else if (entry.length < 2) entry += key;
      out.textContent = entry;
    };
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']) {
      const b = document.createElement('button');
      b.textContent = key;
      b.className = key === '✓' ? 'key ok' : 'key';
      b.setAttribute('aria-label', key === '⌫' ? 'Delete' : key === '✓' ? 'Check' : key);
      b.addEventListener('click', () => press(key));
      pad.appendChild(b);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      else if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Enter') press('✓');
    };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.modal-close')!.addEventListener('click', () => close(false));
    container.appendChild(overlay);
    (pad.firstElementChild as HTMLButtonElement).focus();
  });
}
