/**
 * GET /api/youtube?v=VIDEO_ID                 caption tracks and video details
 * GET /api/youtube?v=VIDEO_ID&captions=1&lang=en   the captions themselves
 *
 * Cloudflare Pages Function. It exists only because browsers can't make
 * this one request to YouTube themselves. It stores nothing and logs nothing.
 * The Vite dev server runs the same handler locally (see vite.config.js).
 */

import { YouTubeError, fetchCaptionTrack, getCaptionTracks, pickTrack } from '../../local/src/youtube.js';

const json = (body, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const videoId = url.searchParams.get('v') || '';
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return json({ error: "That doesn't look like a YouTube video ID.", code: 'bad_link' }, 400);

  try {
    const info = await getCaptionTracks(videoId);
    if (url.searchParams.get('captions') !== '1') {
      // Caption links stay valid for several hours.
      return json(info, 200, 'public, max-age=1800');
    }
    const track = pickTrack(info.tracks, url.searchParams.get('lang') || 'en');
    if (!track) return json({ error: 'This video has no captions.', code: 'no_captions' }, 404);
    return json(await fetchCaptionTrack(track.baseUrl), 200, 'public, max-age=1800');
  } catch (error) {
    const known = error instanceof YouTubeError;
    const status = !known ? 502 : error.code === 'rate_limited' || error.code === 'blocked' ? 503 : 422;
    return json({ error: known ? error.message : "Couldn't reach YouTube just now.", code: known ? error.code : 'unavailable' }, status);
  }
}
