/**
 * Turn a dropped file into 16 kHz mono samples for Whisper.
 * Audio files go through the browser's own decoder; video (and anything the
 * browser can't decode) goes through ffmpeg.wasm.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { SAMPLE_RATE } from '@local/blocks.js';

let ffmpeg = null;

async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;
  const instance = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
  await instance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpeg = instance;
  return ffmpeg;
}

async function decodeInBrowser(arrayBuffer) {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    // decodeAudioData resamples to the context's rate for us.
    const buffer = await context.decodeAudioData(arrayBuffer);
    if (buffer.numberOfChannels === 1) return new Float32Array(buffer.getChannelData(0));
    const mixed = new Float32Array(buffer.length);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const channel = buffer.getChannelData(c);
      for (let i = 0; i < channel.length; i++) mixed[i] += channel[i] / buffer.numberOfChannels;
    }
    return mixed;
  } finally {
    context.close();
  }
}

async function decodeWithFFmpeg(file, onProgress) {
  const instance = await getFFmpeg();
  const extension = file.name.split('.').pop().toLowerCase();
  const input = `input_${Date.now()}.${extension}`;
  const output = `output_${Date.now()}.f32`;
  const handleProgress = ({ progress }) => onProgress?.(Math.min(Math.max(progress, 0), 1));

  instance.on('progress', handleProgress);
  try {
    await instance.writeFile(input, await fetchFile(file));
    await instance.exec(['-i', input, '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', output]);
    const data = await instance.readFile(output);
    if (!data.byteLength) throw new Error('This file has no audio track.');
    return new Float32Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 4)).slice();
  } finally {
    instance.off('progress', handleProgress);
    await instance.deleteFile(input).catch(() => {});
    await instance.deleteFile(output).catch(() => {});
  }
}

// The browser's own decoder is much faster than ffmpeg.wasm and reads the
// audio in most MP4, MOV and WebM videos too, but it needs the whole file in
// memory, so very large videos go straight to ffmpeg.
const BROWSER_DECODE_LIMIT = 1024 * 1024 * 1024;

export async function extractAudio(file, { isVideo, onProgress } = {}) {
  if (!isVideo || file.size < BROWSER_DECODE_LIMIT) {
    try {
      return await decodeInBrowser(await file.arrayBuffer());
    } catch {
      // Some formats (MKV, some codecs, some browsers) need ffmpeg.
    }
  }
  try {
    return await decodeWithFFmpeg(file, onProgress);
  } catch (error) {
    throw new Error(`Couldn't read the audio in this file. ${error.message}`);
  }
}
