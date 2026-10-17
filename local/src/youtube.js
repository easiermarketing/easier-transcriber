/**
 * YouTube captions, read straight from YouTube.
 *
 * No dependencies and only `fetch`, so the same file runs in Node (the local
 * helper and MCP server), in a Cloudflare Pages Function (the website's
 * caption lookup) and in the browser (reading the caption file itself).
 *
 * How it works: ask YouTube's player endpoint for the video's caption tracks
 * the way the Android app does, then fetch the chosen track as json3. This is
 * the same approach as youtube-transcript-plus. The older InnerTube
 * `get_transcript` endpoint needs bot attestation since late 2025, so it is
 * not used.
 */

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const ANDROID_CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '20.10.38',
  androidSdkVersion: 34,
  osName: 'Android',
  osVersion: '14',
  hl: 'en',
  gl: 'US',
};

export class YouTubeError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'YouTubeError';
    this.code = code;
  }
}

/**
 * Pull the 11-character video ID out of any common YouTube link, or accept a
 * bare ID. Returns null when the input is not a YouTube video.
 */
export function parseYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  let url;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const match = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      if (match) id = match[1];
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export function isYouTubeUrl(input) {
  return parseYouTubeId(input) !== null && /youtu/.test(String(input));
}

/**
 * Ask YouTube for the video's details and caption tracks.
 */
export async function getCaptionTracks(videoId, { fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(PLAYER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `com.google.android.youtube/${ANDROID_CLIENT.clientVersion} (Linux; U; Android 14) gzip`,
      'X-Youtube-Client-Name': '3',
      'X-Youtube-Client-Version': ANDROID_CLIENT.clientVersion,
    },
    body: JSON.stringify({
      context: { client: ANDROID_CLIENT },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });

  if (response.status === 429) {
    throw new YouTubeError('YouTube is rate limiting requests right now. Try again in a few minutes.', 'rate_limited');
  }
  if (!response.ok) {
    throw new YouTubeError(`YouTube returned ${response.status} for this video.`, 'http_error');
  }

  const data = await response.json();
  const status = data?.playabilityStatus?.status;
  if (status && status !== 'OK') {
    const reason = data.playabilityStatus.reason || status;
    const code = /bot/i.test(reason) ? 'blocked' : status === 'LOGIN_REQUIRED' ? 'login_required' : 'unplayable';
    throw new YouTubeError(`YouTube won't share this video: ${reason}`, code);
  }

  const details = data?.videoDetails || {};
  const rawTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  return {
    videoId,
    title: details.title || '',
    author: details.author || '',
    durationSeconds: Number(details.lengthSeconds) || 0,
    tracks: rawTracks.map((track) => ({
      languageCode: track.languageCode,
      name: track.name?.simpleText || track.name?.runs?.map((r) => r.text).join('') || track.languageCode,
      kind: track.kind === 'asr' ? 'auto' : 'manual',
      baseUrl: track.baseUrl,
    })),
  };
}

/**
 * Choose the best track: the asked-for language written by a person, then
 * the asked-for language auto-generated, then any English, then anything.
 */
export function pickTrack(tracks, language = 'en') {
  if (!tracks?.length) return null;
  const lang = (language || 'en').toLowerCase();
  const matches = (track, code) => track.languageCode?.toLowerCase().split('-')[0] === code;
  return (
    tracks.find((t) => matches(t, lang) && t.kind === 'manual') ||
    tracks.find((t) => matches(t, lang)) ||
    tracks.find((t) => matches(t, 'en') && t.kind === 'manual') ||
    tracks.find((t) => matches(t, 'en')) ||
    tracks.find((t) => t.kind === 'manual') ||
    tracks[0]
  );
}

/**
 * Download one caption track and turn it into timed segments.
 * Auto-generated tracks also carry per-word timings, returned as `words`.
 */
export async function fetchCaptionTrack(baseUrl, { fetchImpl = globalThis.fetch } = {}) {
  const url = new URL(baseUrl);
  url.searchParams.set('fmt', 'json3');
  const response = await fetchImpl(url.toString());
  if (!response.ok) {
    throw new YouTubeError(`Couldn't download the captions (YouTube returned ${response.status}).`, 'http_error');
  }
  const body = await response.text();
  if (!body.trim()) {
    throw new YouTubeError('YouTube sent back an empty caption file.', 'empty');
  }
  return body.trimStart().startsWith('{') ? parseJson3(JSON.parse(body)) : parseTimedTextXml(body);
}

export function parseJson3(data) {
  const events = (data?.events || []).filter(
    (event) => Array.isArray(event.segs) && event.segs.some((seg) => seg.utf8 && seg.utf8.trim())
  );

  const segments = [];
  const words = [];

  const seconds = (ms) => Math.round(ms) / 1000;

  events.forEach((event, index) => {
    const start = seconds(event.tStartMs || 0);
    let end = seconds((event.tStartMs || 0) + (event.dDurationMs || 0));
    const next = events[index + 1];
    if (next && seconds(next.tStartMs) < end) end = seconds(next.tStartMs);

    const text = event.segs.map((seg) => seg.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (!text) return;
    segments.push({ start, end, text });

    event.segs.forEach((seg) => {
      const word = (seg.utf8 || '').trim();
      if (!word) return;
      words.push({ start: seconds((event.tStartMs || 0) + (seg.tOffsetMs || 0)), text: word, lineEnd: end });
    });
  });

  // A word ends where the next one starts, or at the end of its line.
  const hasWordTimings = data?.events?.some((e) => e.segs?.some((s) => s.tOffsetMs));
  if (!hasWordTimings) return { segments };

  return {
    segments,
    words: words.map(({ lineEnd, ...word }, i) => {
      const next = words[i + 1];
      let end = Math.min(next ? next.start : Infinity, lineEnd);
      if (!(end > word.start)) end = Math.round((word.start + 0.2) * 1000) / 1000;
      return { ...word, end };
    }),
  };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

function decodeEntities(text) {
  return text
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, name) => ENTITIES[name])
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

/** Older XML caption formats: <text start="1.2" dur="3.4"> and <p t="1200" d="3400">. */
export function parseTimedTextXml(xml) {
  const segments = [];
  const pattern = /<(text|p)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = pattern.exec(xml))) {
    const [, tag, attrs, inner] = match;
    const attr = (name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const start = tag === 'text' ? Number(attr('start')) : Number(attr('t')) / 1000;
    const duration = tag === 'text' ? Number(attr('dur')) : Number(attr('d')) / 1000;
    const text = decodeEntities(inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (text && Number.isFinite(start)) {
      segments.push({ start, end: start + (Number.isFinite(duration) ? duration : 0), text });
    }
  }
  return { segments };
}

/**
 * Link in, transcript out. Throws YouTubeError with code `no_captions` when
 * the video has no captions, so the caller can fall back to Whisper.
 */
export async function getYouTubeTranscript(input, { language = 'en', fetchImpl } = {}) {
  const videoId = parseYouTubeId(input);
  if (!videoId) throw new YouTubeError("That doesn't look like a YouTube link.", 'bad_link');

  const info = await getCaptionTracks(videoId, { fetchImpl });
  const track = pickTrack(info.tracks, language);
  if (!track) {
    throw Object.assign(new YouTubeError('This video has no captions.', 'no_captions'), { info });
  }

  const { segments, words } = await fetchCaptionTrack(track.baseUrl, { fetchImpl });
  if (!segments.length) {
    throw Object.assign(new YouTubeError('The captions for this video are empty.', 'no_captions'), { info });
  }

  return {
    source: `https://www.youtube.com/watch?v=${videoId}`,
    title: info.title,
    author: info.author,
    duration: info.durationSeconds,
    language: track.languageCode,
    method: track.kind === 'auto' ? 'youtube-auto-captions' : 'youtube-captions',
    segments,
    words,
  };
}
