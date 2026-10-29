/**
 * Runs inside the page (every frame the popup can reach), only after the
 * person presses the toolbar button. It does three jobs:
 *   1. find the videos and audio on the page,
 *   2. read YouTube captions from the page itself (their own signed-in session),
 *   3. hand over media bytes for pages that only the page itself can fetch.
 * Nothing here talks to any server of ours.
 */

import { fetchCaptionTrack, getAudioStream, getYouTubeTranscript, parseYouTubeId, pickTrack } from '@local/youtube.js';

if (!globalThis.__easierLoaded) {
  globalThis.__easierLoaded = true;

  const MEDIA_EXT = /\.(mp4|m4v|mov|webm|mkv|mp3|m4a|wav|ogg|oga|opus|flac|aac)(\?|#|$)/i;
  const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|oga|opus|flac|aac)(\?|#|$)/i;
  const MAX_LINKED = 40;

  const clean = (text) => (text || '').replace(/\s+/g, ' ').trim();
  const host = (url) => {
    try {
      return new URL(url, location.href).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };
  const abs = (url) => {
    try {
      return new URL(url, location.href).href;
    } catch {
      return '';
    }
  };
  const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  const onYouTube = /(^|\.)youtube\.com$/.test(location.hostname);

  function fileName(url) {
    try {
      const name = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || '');
      return name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
    } catch {
      return '';
    }
  }

  function nearestHeading(el) {
    const scope = el.closest('article, figure, section, li, [class*="card"], [class*="item"]');
    const heading = scope?.querySelector('h1, h2, h3, h4, figcaption');
    return clean(heading?.textContent);
  }

  // "download 1 file", "MP4" and the like say nothing; the page's own heading or title does.
  function betterTitle(title, el) {
    const vague = (t) => /^(download|mp[34]|m4a|wav|ogg|webm|video|audio|listen|play|file|link|\d+ files?|download \d+ files?)[\s\w.]*$/i.test(t);
    if (!vague(title)) return title;
    return [nearestHeading(el), clean(document.title)].find((t) => t && !vague(t)) || title;
  }

  function frameOf(el) {
    // A small still from the video itself, when the site lets us read it.
    try {
      if (el.tagName !== 'VIDEO' || el.readyState < 2 || !el.videoWidth) return '';
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = Math.max(1, Math.round((160 * el.videoHeight) / el.videoWidth));
      canvas.getContext('2d').drawImage(el, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return '';
    }
  }

  function currentYouTubeId() {
    if (!onYouTube) return null;
    const { pathname, searchParams } = new URL(location.href);
    if (pathname === '/watch') return parseYouTubeId(searchParams.get('v'));
    const m = pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function youTubeIdFromLink(href) {
    const url = abs(href);
    if (!url || !/(youtube\.com|youtube-nocookie\.com|youtu\.be)\//.test(url)) return null;
    const { pathname } = new URL(url);
    if (/^\/(watch|shorts|embed|live)/.test(pathname) || /youtu\.be$/.test(new URL(url).hostname)) return parseYouTubeId(url);
    return null;
  }

  function scan() {
    const items = [];
    const seen = new Set();
    const add = (item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      items.push(item);
    };

    const pageId = currentYouTubeId();
    const pageVideo = document.querySelector('video');
    if (pageId) {
      const title =
        clean(document.querySelector('ytd-watch-metadata h1, h1.ytd-watch-metadata, .ytp-title-link')?.textContent) ||
        clean(document.title.replace(/\s*-\s*YouTube\s*$/i, ''));
      add({
        id: `yt:${pageId}`,
        kind: 'youtube',
        ytId: pageId,
        title: title || 'YouTube video',
        author: clean(document.querySelector('ytd-channel-name a, #owner #channel-name a')?.textContent),
        thumb: ytThumb(pageId),
        duration: Number.isFinite(pageVideo?.duration) ? pageVideo.duration : 0,
        host: 'youtube.com',
        playing: Boolean(pageVideo && !pageVideo.paused && !pageVideo.ended),
        current: true,
      });
    }

    const media = [...document.querySelectorAll('video, audio')];
    for (const el of media) {
      let src = el.currentSrc || el.src || el.querySelector('source[src]')?.src || '';
      if (pageId && /^blob:/.test(src)) continue; // YouTube's own player, listed above
      if (!src || /^data:/i.test(src)) continue; // inline blobs of data are not a page's video to list
      src = abs(src);
      const kind = el.tagName === 'AUDIO' ? 'audio' : 'video';
      const single = media.length === 1;
      const title =
        clean(el.getAttribute('aria-label')) ||
        clean(el.getAttribute('title')) ||
        nearestHeading(el) ||
        (single ? clean(document.title) : '') ||
        fileName(src) ||
        clean(document.title);
      const rect = el.getBoundingClientRect();
      add({
        id: `src:${src}`,
        kind,
        src,
        title: title ? betterTitle(title, el) : 'Untitled',
        thumb: el.getAttribute('poster') ? abs(el.getAttribute('poster')) : frameOf(el),
        duration: Number.isFinite(el.duration) ? el.duration : 0,
        host: host(src) || location.hostname,
        playing: !el.paused && !el.ended,
        visible: rect.width * rect.height > 0,
        current: window === window.top,
        stream: /^blob:/.test(src),
      });
    }

    // YouTube videos linked or embedded on the page (lists, search results, embeds).
    let linked = 0;
    for (const frame of document.querySelectorAll('iframe[src]')) {
      const id = youTubeIdFromLink(frame.src);
      if (!id || seen.has(`yt:${id}`) || linked >= MAX_LINKED) continue;
      linked++;
      add({ id: `yt:${id}`, kind: 'youtube', ytId: id, title: clean(frame.title) || 'Embedded YouTube video', thumb: ytThumb(id), host: 'youtube.com', embed: true });
    }
    for (const a of document.querySelectorAll('a[href]')) {
      if (linked >= MAX_LINKED) break;
      const id = youTubeIdFromLink(a.href);
      if (!id || seen.has(`yt:${id}`) || a.closest('.ytp-chrome-bottom, .ytp-ce-element, .ytp-endscreen-content, ytd-miniplayer')) continue;
      const spoken = /\s+\d+ (?:hours?|minutes?|seconds?)(?:,? (?:and )?\d+ (?:hours?|minutes?|seconds?))*$/i; // aria-label ends with the spoken length
      const title =
        clean(a.getAttribute('title')) ||
        clean(a.getAttribute('aria-label')).replace(spoken, '') ||
        clean(a.querySelector('#video-title, yt-formatted-string')?.textContent) ||
        clean(a.textContent);
      if (!title && onYouTube) continue; // thumbnail-only link, its text link comes next
      if (/^(next|previous) ?\(/i.test(title) || /^[\d:]+$/.test(title)) continue; // player buttons, duration overlays
      linked++;
      add({ id: `yt:${id}`, kind: 'youtube', ytId: id, title: title || 'YouTube video', thumb: ytThumb(id), host: 'youtube.com', linked: true });
    }

    // Plain links to audio and video files (podcasts, downloads).
    for (const a of document.querySelectorAll('a[href]')) {
      if (linked >= MAX_LINKED) break;
      if (!MEDIA_EXT.test(a.href) || !/^https?:/.test(a.href)) continue;
      const src = abs(a.href);
      if (seen.has(`src:${src}`)) continue;
      linked++;
      add({
        id: `src:${src}`,
        kind: AUDIO_EXT.test(src) ? 'audio' : 'video',
        src,
        title: betterTitle(clean(a.textContent) || clean(a.getAttribute('title')) || fileName(src) || 'Linked file', a),
        host: host(src),
        linked: true,
      });
    }

    // Embedded players from other sites we can't look inside without more access.
    const foreign = [...document.querySelectorAll('iframe[src]')].filter((f) => {
      try {
        const u = new URL(f.src, location.href);
        return /^https?:/.test(u.protocol) && u.origin !== location.origin && !youTubeIdFromLink(f.src);
      } catch {
        return false;
      }
    }).length;

    return { items, foreign, url: location.href, title: document.title, top: window === window.top };
  }

  globalThis.__easierScan = scan;

  // ---- YouTube captions, read through the page's own session ----

  async function pageTracks(videoId) {
    // The watch page itself lists its caption tracks; used when the app-style lookup is refused.
    const html = await (await fetch(`/watch?v=${videoId}`, { credentials: 'include' })).text();
    const start = html.indexOf('ytInitialPlayerResponse');
    if (start < 0) return null;
    const open = html.indexOf('{', start);
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = open; i < html.length; i++) {
      const c = html[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        const data = JSON.parse(html.slice(open, i + 1));
        const raw = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        return {
          title: data?.videoDetails?.title || '',
          author: data?.videoDetails?.author || '',
          durationSeconds: Number(data?.videoDetails?.lengthSeconds) || 0,
          tracks: raw.map((t) => ({ languageCode: t.languageCode, kind: t.kind === 'asr' ? 'auto' : 'manual', baseUrl: t.baseUrl })),
        };
      }
    }
    return null;
  }

  async function captions(videoId, language) {
    if (!onYouTube) return { ok: false, code: 'wrong_frame' };
    const same = (u, o) => fetch(u, { ...o, credentials: 'include' });
    try {
      const t = await getYouTubeTranscript(videoId, { language, fetchImpl: same });
      return { ok: true, transcript: t };
    } catch (error) {
      if (error.code === 'no_captions') return { ok: false, code: 'no_captions' };
      try {
        const info = await pageTracks(videoId);
        const track = pickTrack(info?.tracks, language);
        if (!track) return { ok: false, code: 'no_captions' };
        const parsed = await fetchCaptionTrack(track.baseUrl, { fetchImpl: same });
        if (!parsed.segments?.length) return { ok: false, code: 'no_captions' };
        return {
          ok: true,
          transcript: {
            source: `https://www.youtube.com/watch?v=${videoId}`,
            title: info.title,
            author: info.author,
            duration: info.durationSeconds,
            language: track.languageCode,
            method: track.kind === 'auto' ? 'youtube-auto-captions' : 'youtube-captions',
            segments: parsed.segments,
          },
        };
      } catch (second) {
        return { ok: false, code: second.code || error.code || 'failed', message: second.message || error.message };
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === 'easier:ping') {
      respond({ ok: true });
    } else if (message?.type === 'easier:yt-captions') {
      captions(message.videoId, message.language || 'en').then(respond);
      return true;
    } else if (message?.type === 'easier:yt-audio') {
      getAudioStream(message.videoId, { fetchImpl: (u, o) => fetch(u, { ...o, credentials: 'include' }) })
        .then((stream) => respond({ ok: Boolean(stream), stream }))
        .catch((error) => respond({ ok: false, message: error.message }));
      return true;
    }
    return false;
  });

  // ---- Bytes for media only the page can reach (same-site files behind a login, blob: files) ----

  const toBase64 = (bytes) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'easier:bytes') return;
    let stopped = false;
    port.onDisconnect.addListener(() => {
      stopped = true;
    });
    port.onMessage.addListener(async ({ src }) => {
      try {
        const response = await fetch(src, { credentials: 'include' });
        if (!response.ok) throw new Error(`The page answered ${response.status}.`);
        port.postMessage({ type: 'meta', size: Number(response.headers.get('content-length')) || 0, mime: response.headers.get('content-type') || '' });
        const reader = response.body.getReader();
        let pending = [];
        let pendingSize = 0;
        const flush = () => {
          if (!pendingSize) return;
          const joined = new Uint8Array(pendingSize);
          let at = 0;
          for (const part of pending) {
            joined.set(part, at);
            at += part.length;
          }
          port.postMessage({ type: 'chunk', b64: toBase64(joined) });
          pending = [];
          pendingSize = 0;
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (stopped) return reader.cancel();
          if (done) break;
          pending.push(value);
          pendingSize += value.length;
          if (pendingSize >= 512 * 1024) flush();
        }
        flush();
        port.postMessage({ type: 'end' });
      } catch (error) {
        port.postMessage({ type: 'error', message: error.message });
      }
    });
  });
}
