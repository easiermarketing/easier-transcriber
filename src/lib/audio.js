/**
 * Audio extraction and processing using ffmpeg.wasm
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpeg = null;
let ffmpegReady = false;

async function initFFmpeg() {
  if (ffmpegReady) return;

  ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegReady = true;
}

export async function extractAudio(file, onProgress) {
  try {
    if (!ffmpegReady) {
      await initFFmpeg();
    }

    const inputName = `input_${Date.now()}.${file.name.split('.').pop()}`;
    const outputName = 'output.wav';

    // Write file to FFmpeg
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Set progress callback
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        onProgress(Math.min(progress, 0.95)); // Cap at 95% for extraction
      });
    }

    // Extract/convert audio to 16kHz mono WAV
    await ffmpeg.exec([
      '-i', inputName,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      outputName
    ]);

    // Read output file
    const data = await ffmpeg.readFile(outputName);

    // Convert to Float32Array using AudioContext
    const audioData = await decodeAudioData(new Uint8Array(data));

    // Clean up
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (e) {
      // Ignore cleanup errors
    }

    return audioData;
  } catch (error) {
    console.error('Audio extraction failed:', error);
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

async function decodeAudioData(wavBuffer) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(wavBuffer.buffer);

    // Get the first channel
    const rawData = audioBuffer.getChannelData(0);

    // Return a copy as Float32Array
    return new Float32Array(rawData);
  } catch (error) {
    console.error('Audio decode failed:', error);
    throw new Error(`Failed to decode audio: ${error.message}`);
  }
}

export async function getAudioDuration(file) {
  try {
    if (!ffmpegReady) {
      await initFFmpeg();
    }

    const inputName = `duration_${Date.now()}.${file.name.split('.').pop()}`;

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Get duration using ffprobe-like approach
    const output = [];
    ffmpeg.on('log', (log) => {
      output.push(log.message);
    });

    try {
      await ffmpeg.exec(['-i', inputName]);
    } catch (e) {
      // ffmpeg returns error on -i, but output is in stderr - that's expected
    }

    try {
      await ffmpeg.deleteFile(inputName);
    } catch (e) {
      // Ignore
    }

    // Parse duration from output
    const durationMatch = output.join(' ').match(/Duration: (\\d+):(\\d+):(\\d+\\.?\\d*)/);
    if (durationMatch) {
      const [, hours, minutes, seconds] = durationMatch;
      return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
    }

    return 0;
  } catch (error) {
    console.error('Duration detection failed:', error);
    return 0;
  }
}
