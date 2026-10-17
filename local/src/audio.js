import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { SAMPLE_RATE } from './blocks.js';
import { which } from './paths.js';

const require = createRequire(import.meta.url);

/** ffmpeg from EASIER_TRANSCRIBE_FFMPEG, then the bundled ffmpeg-static, then PATH. */
export function ffmpegPath() {
  if (process.env.EASIER_TRANSCRIBE_FFMPEG) return process.env.EASIER_TRANSCRIBE_FFMPEG;
  try {
    const bundled = require('ffmpeg-static');
    if (bundled) return bundled;
  } catch {
    // not installed for this platform
  }
  const onPath = which('ffmpeg');
  if (onPath) return onPath;
  throw new Error('ffmpeg is missing. Reinstall easier-transcribe, or install ffmpeg and put it on your PATH.');
}

/**
 * Decode any audio or video file (or a direct media URL) to 16 kHz mono
 * float samples, which is what Whisper expects.
 */
export function decodeAudio(input, { onDuration, signal } = {}) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      ffmpegPath(),
      ['-nostdin', '-hide_banner', '-i', input, '-vn', '-sn', '-dn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', 'pipe:1'],
      { stdio: ['ignore', 'pipe', 'pipe'], signal }
    );

    let buffer = new Uint8Array(1 << 22);
    let length = 0;
    ffmpeg.stdout.on('data', (chunk) => {
      if (length + chunk.length > buffer.length) {
        const grown = new Uint8Array(Math.max(buffer.length * 2, length + chunk.length));
        grown.set(buffer.subarray(0, length));
        buffer = grown;
      }
      buffer.set(chunk, length);
      length += chunk.length;
    });

    let stderr = '';
    let durationSent = false;
    ffmpeg.stderr.on('data', (chunk) => {
      if (stderr.length < 20000) stderr += chunk.toString();
      if (!durationSent && onDuration) {
        const match = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (match) {
          durationSent = true;
          onDuration(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]));
        }
      }
    });

    ffmpeg.on('error', (error) => reject(error.name === 'AbortError' ? error : new Error(`Couldn't start ffmpeg: ${error.message}`)));
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        const reason = stderr.trim().split('\n').filter((line) => !/^\s/.test(line)).slice(-2).join(' ');
        reject(new Error(`ffmpeg couldn't read this file. ${reason}`.trim()));
        return;
      }
      if (length < SAMPLE_RATE * 4 * 0.1) {
        reject(new Error('This file has no audio track (or it is shorter than a tenth of a second).'));
        return;
      }
      // Copy into a fresh, aligned buffer and drop the oversized one.
      const samples = new Float32Array(Math.floor(length / 4));
      new Uint8Array(samples.buffer).set(buffer.subarray(0, samples.length * 4));
      resolve(samples);
    });
  });
}
