// Offline support (brief §7.1): registers the generated service worker.
// On a first visit we give it a moment to take control before any models load,
// so they go through its cache once instead of being downloaded twice.

const FIRST_VISIT_WAIT_MS = 4000;

export async function enableOffline(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
    if (navigator.serviceWorker.controller) return;
    await Promise.race([
      new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })),
      new Promise((resolve) => window.setTimeout(resolve, FIRST_VISIT_WAIT_MS)),
    ]);
  } catch {
    // No service worker (private mode, file://, old browser): the game still plays online.
  }
}
