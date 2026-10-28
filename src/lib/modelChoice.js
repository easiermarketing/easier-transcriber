// Phones and slow links get the small Whisper (about 80 MB) on the processor.
// The larger one (about 500 MB, graphics chip) is a switch they can turn on.
const KEY = 'transcribe-accurate';

export function isLightDevice() {
  const c = navigator.connection;
  const phone = window.matchMedia?.('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const slow = Boolean(c && (c.saveData || /^(slow-2g|2g|3g)$/.test(c.effectiveType || '') || (c.downlink && c.downlink < 5)));
  return phone || slow;
}

export function getAccurate() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setAccurate(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
}

export function startOnProcessor() {
  return isLightDevice() && !getAccurate();
}
