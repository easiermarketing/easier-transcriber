/**
 * YouTube captions in the browser.
 *
 * Browsers can't ask YouTube for a video's caption list directly (YouTube
 * blocks cross-site requests to that endpoint), so /api/youtube does that one
 * lookup for us. The caption file itself is fetched straight from YouTube by
 * the browser, and only falls back to /api/youtube if that fails.
 */

import { YouTubeError, fetchCaptionTrack, parseYouTubeId, pickTrack } from '@local/youtube.js';

export { parseYouTubeId };

// YouTube turns away a share of lookups from cloud servers ("confirm you're
// not a bot"), but each new request goes out from a different address, so a
// few quick retries nearly always get through.
const RETRYABLE = new Set(['blocked', 'rate_limited', 'unavailable', 'http_error']);
const MAX_TRIES = 8;

async function api(params) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`/api/youtube?${new URLSearchParams({ ...params, try: attempt })}`);
    let body = {};
    try {
      body = await response.json();
    } catch {
      // not JSON: the lookup service itself is down
    }
    if (response.ok) return body;

    const code = body.code || 'unavailable';
    if (!RETRYABLE.has(code) || attempt >= MAX_TRIES) {
      throw new YouTubeError(body.error || "Couldn't reach YouTube just now. Try again in a minute.", code);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

export async function getYouTubeCaptions(link, { language = 'en' } = {}) {
  const videoId = parseYouTubeId(link);
  if (!videoId) throw new YouTubeError("That doesn't look like a YouTube link.", 'bad_link');

  const info = await api({ v: videoId });
  const track = pickTrack(info.tracks, language);
  if (!track) throw Object.assign(new YouTubeError('This video has no captions.', 'no_captions'), { info });

  let captions;
  try {
    captions = await fetchCaptionTrack(track.baseUrl);
  } catch {
    captions = await api({ v: videoId, lang: language, captions: '1' });
  }
  if (!captions.segments?.length) throw Object.assign(new YouTubeError('The captions for this video are empty.', 'no_captions'), { info });

  return {
    source: `https://www.youtube.com/watch?v=${videoId}`,
    title: info.title,
    author: info.author,
    duration: info.durationSeconds,
    language: track.languageCode,
    method: track.kind === 'auto' ? 'youtube-auto-captions' : 'youtube-captions',
    segments: captions.segments,
    words: captions.words,
  };
}
