// Inline SVG icons: buttons are icons only (P1), nothing to download.
const svg = (body: string) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  home: svg('<path d="M8 23 24 9l16 14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 21v17h8v-9h6v9h8V21" fill="currentColor"/>'),
  sound: svg('<path d="M8 19h8l10-8v26l-10-8H8z" fill="currentColor"/><path d="M32 17c3 4 3 10 0 14M36 12c6 7 6 17 0 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'),
  mute: svg('<path d="M8 19h8l10-8v26l-10-8H8z" fill="currentColor"/><path d="m32 18 10 12m0-12L32 30" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'),
  play: svg('<path d="M17 11v26l21-13z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>'),
  parent: svg('<circle cx="17" cy="15" r="6" fill="currentColor"/><circle cx="33" cy="19" r="4.5" fill="currentColor"/><path d="M7 38c0-8 4-13 10-13s10 5 10 13zM26 38c0-6 3-10 7-10s7 4 7 10z" fill="currentColor"/>'),
  close: svg('<path d="m14 14 20 20m0-20L14 34" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>'),
  phone: svg('<rect x="15" y="5" width="18" height="38" rx="4" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="24" cy="37" r="2" fill="currentColor"/>'),
};
