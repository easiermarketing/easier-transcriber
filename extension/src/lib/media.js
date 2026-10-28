/**
 * Getting the bytes of a video or audio file.
 * First straight from this extension page. If the site refuses, through the
 * page the media sits on, which can use that page's own sign-in.
 */

export class NeedsAccess extends Error {
  constructor(origin, pattern = `${origin}/*`) {
    super(`Allow access to ${new URL(origin).hostname} to read this file.`);
    this.name = 'NeedsAccess';
    this.origin = origin;
    this.pattern = pattern;
  }
}

async function streamToBlob(response, onProgress) {
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const parts = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  return new Blob(parts, { type: response.headers.get('content-type') || '' });
}

function viaPage(src, { tabId, frameId }, onProgress) {
  return new Promise((resolve, reject) => {
    if (tabId == null) return reject(new Error('The page is closed.'));
    let port;
    try {
      port = chrome.tabs.connect(tabId, { name: 'easier:bytes', frameId: frameId || 0 });
    } catch (error) {
      return reject(error);
    }
    const parts = [];
    let loaded = 0;
    let total = 0;
    let mime = '';
    let finished = false;
    port.onMessage.addListener((message) => {
      if (message.type === 'meta') {
        total = message.size;
        mime = message.mime;
      } else if (message.type === 'chunk') {
        const binary = atob(message.b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        parts.push(bytes);
        loaded += bytes.length;
        onProgress?.(loaded, total);
      } else if (message.type === 'end') {
        finished = true;
        resolve(new Blob(parts, { type: mime }));
        port.disconnect();
      } else if (message.type === 'error') {
        finished = true;
        reject(new Error(message.message));
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => {
      if (!finished) reject(new Error('The page was closed or reloaded.'));
    });
    port.postMessage({ src });
  });
}

export async function getMediaBlob(src, { tabId, frameId, onProgress } = {}) {
  const isBlob = /^blob:/.test(src);
  if (!isBlob) {
    try {
      const response = await fetch(src, { credentials: 'include' });
      if (response.ok) return await streamToBlob(response, onProgress);
      if (response.status === 401 || response.status === 403) throw new Error(`The site answered ${response.status}.`);
    } catch {
      // Not allowed from here (no access to that site yet) or a refused request. Try the page.
    }
  }
  try {
    return await viaPage(src, { tabId, frameId }, onProgress);
  } catch (pageError) {
    if (!isBlob && /^https?:/.test(src)) {
      const origin = new URL(src).origin;
      const have = await chrome.permissions.contains({ origins: [`${origin}/*`] });
      if (!have) throw new NeedsAccess(origin);
    }
    if (isBlob) {
      throw new Error("This player streams the video in pieces, so the browser won't hand the file over. Try the page that links the file directly.");
    }
    throw new Error(`Couldn't download this file. ${pageError.message}`);
  }
}

/** Download a YouTube audio stream in pieces (the server limits single requests). */
export async function getRangedBlob(url, size, onProgress) {
  const piece = 4 * 1024 * 1024;
  const parts = [];
  let at = 0;
  let mime = '';
  while (!size || at < size) {
    const end = size ? Math.min(size, at + piece) - 1 : at + piece - 1;
    const u = new URL(url);
    u.searchParams.set('range', `${at}-${end}`);
    const response = await fetch(u.toString());
    if (!response.ok) throw new Error(`YouTube answered ${response.status} for the audio.`);
    mime ||= response.headers.get('content-type') || '';
    const blob = await response.blob();
    parts.push(blob);
    at += blob.size;
    onProgress?.(at, size);
    if (!blob.size || (!size && blob.size < piece)) break;
  }
  return new Blob(parts, { type: mime });
}
