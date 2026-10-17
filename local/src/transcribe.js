import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decodeAudio } from './audio.js';
import { DEFAULT_MODEL, transcribeSamples } from './whisper.js';
import { downloadAudio } from './ytdlp.js';
import { YouTubeError, getYouTubeTranscript, isYouTubeUrl } from './youtube.js';
import { log } from './paths.js';

const MEDIA_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm|mp4|m4v|mov|mkv|avi|wmv|mpg|mpeg|3gp|amr|wma)$/i;

/**
 * Work out what kind of thing we were given.
 * Returns 'youtube' | 'media-url' | 'page-url' | 'file'.
 */
export async function classifySource(source) {
  if (isYouTubeUrl(source)) return 'youtube';
  if (/^https?:\/\//i.test(source)) {
    const url = new URL(source);
    if (MEDIA_EXTENSIONS.test(url.pathname)) return 'media-url';
    try {
      const response = await fetch(source, { method: 'HEAD', redirect: 'follow' });
      const type = response.headers.get('content-type') || '';
      if (/^(audio|video)\//.test(type) || type === 'application/octet-stream') return 'media-url';
    } catch {
      // fall through to yt-dlp, which knows many sites
    }
    return 'page-url';
  }
  const file = path.resolve(source.replace(/^file:\/\//, ''));
  if (!fs.existsSync(file)) throw new Error(`No file at ${file}`);
  if (!fs.statSync(file).isFile()) throw new Error(`${file} is a folder, not a file.`);
  return 'file';
}

/**
 * Transcribe a local file, a direct media link, a YouTube link or any page
 * yt-dlp can read.
 *
 * options:
 *   language   'en' by default; any Whisper language code works
 *   model      tiny | base | small | medium | turbo
 *   captions   'prefer' (default): YouTube captions, then Whisper
 *              'only': captions or fail
 *              'skip': always Whisper
 *   onStatus   ({ stage, progress, message }) => void
 *   signal     AbortSignal
 */
export async function transcribe(source, { language = 'en', model = DEFAULT_MODEL, captions = 'prefer', onStatus, signal } = {}) {
  if (!source || typeof source !== 'string') throw new Error('Give me a file path or a link.');
  source = source.trim();
  const kind = await classifySource(source);
  const notes = [];

  if (kind === 'youtube' && captions !== 'skip') {
    onStatus?.({ stage: 'captions', progress: 0, message: 'Reading YouTube captions' });
    try {
      return await getYouTubeTranscript(source, { language });
    } catch (error) {
      if (!(error instanceof YouTubeError) || captions === 'only') throw error;
      notes.push(`${error.message} Transcribed the audio with Whisper instead.`);
      log(`captions unavailable (${error.code}), falling back to Whisper`);
    }
  }

  let input = source;
  let title = '';
  let tempDir = null;

  try {
    if (kind === 'youtube' || kind === 'page-url') {
      onStatus?.({ stage: 'fetch', progress: 0, message: 'Downloading the audio' });
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easier-transcribe-'));
      const download = await downloadAudio(source, tempDir, { signal });
      input = download.file;
      title = download.title;
    } else if (kind === 'file') {
      input = path.resolve(source.replace(/^file:\/\//, ''));
      title = path.basename(input);
    } else {
      title = decodeURIComponent(path.basename(new URL(source).pathname));
    }

    onStatus?.({ stage: 'decode', progress: 0, message: 'Reading the audio' });
    const samples = await decodeAudio(input, { signal });
    const result = await transcribeSamples(samples, { model, language, onStatus, signal });

    return {
      source: kind === 'file' ? input : source,
      title,
      duration: result.duration,
      language,
      method: 'whisper',
      model: result.model,
      notes: notes.length ? notes : undefined,
      segments: result.segments,
    };
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
