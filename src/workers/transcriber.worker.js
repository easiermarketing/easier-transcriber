/**
 * Web Worker for Whisper transcription.
 * Loads the model and runs inference off the main thread, in ~1 minute
 * blocks so the page can show real progress and text as it arrives.
 *
 * With a working GPU (WebGPU) it uses Whisper small. Without one it uses
 * Whisper base on the CPU (WASM), which is about twice as fast as small there.
 */

import { pipeline, env } from '@huggingface/transformers';
import { SAMPLE_RATE, dropRepeats, isSilent, round, splitAtQuietPoints, toSegments } from '@local/blocks.js';

env.allowLocalModels = false;
env.allowRemoteModels = true;
// ONNX Runtime uses 4 threads by default; more helps a lot on bigger machines.
env.backends.onnx.wasm.numThreads = Math.min(8, Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) * 0.75)));

const GPU_MODEL = 'onnx-community/whisper-small.en';
const CPU_MODEL = 'onnx-community/whisper-base.en';
const BLOCK_SECONDS = 60;
// Some GPUs (and some browser setups) accept WebGPU work but crawl through
// it. A one-second test run must finish within this time or we use the CPU.
const GPU_TEST_MS = 30000;
// Setting the model up on the GPU (after any download) must finish within this.
const GPU_SETUP_MS = 60000;

let transcriber = null;
let loading = null;

async function hasWebGPU() {
  try {
    return Boolean(await navigator.gpu?.requestAdapter());
  } catch {
    return false;
  }
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);
}

/** Rejects if `poke` isn't called for `ms`. Downloads poke it; GPU setup gets `ms` once they finish. */
function stallGuard(ms) {
  let timer;
  let fail;
  const promise = new Promise((_, reject) => {
    fail = reject;
  });
  const poke = () => {
    clearTimeout(timer);
    timer = setTimeout(() => fail(new Error('stalled')), ms);
  };
  poke();
  return { promise, poke, stop: () => clearTimeout(timer) };
}

function load({ forceWasm = false } = {}) {
  if (loading) return loading;
  loading = (async () => {
    const files = new Map();
    const progress_callback = (event) => {
      if (event.status !== 'progress' || !event.total) return;
      files.set(event.file, event);
      const all = [...files.values()];
      const done = all.reduce((sum, f) => sum + (f.loaded || 0), 0);
      const total = all.reduce((sum, f) => sum + (f.total || 0), 0);
      self.postMessage({ type: 'model-progress', progress: total ? done / total : 0 });
    };

    if (!forceWasm && (await hasWebGPU())) {
      const guard = stallGuard(GPU_SETUP_MS);
      try {
        transcriber = await Promise.race([
          pipeline('automatic-speech-recognition', GPU_MODEL, {
            device: 'webgpu',
            // The encoder loses accuracy when quantised; the decoder barely notices.
            dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
            progress_callback: (event) => {
              guard.poke();
              progress_callback(event);
            },
          }),
          guard.promise,
        ]);
        guard.stop();
        // Also compiles the GPU shaders, so the first real block starts quickly.
        const test = new Float32Array(SAMPLE_RATE).map(() => (Math.random() - 0.5) * 0.02);
        await withTimeout(transcriber(test), GPU_TEST_MS);
        self.postMessage({ type: 'model-ready', backend: 'your graphics chip (WebGPU)', model: 'small' });
        return;
      } catch (error) {
        guard.stop();
        console.warn('WebGPU is unavailable or too slow here, using the CPU instead:', error);
        // A stuck GPU job can't be cancelled, so ask for a fresh worker.
        self.postMessage({ type: 'gpu-slow' });
        throw new Error('gpu-slow');
      }
    }

    transcriber = await pipeline('automatic-speech-recognition', CPU_MODEL, {
      device: 'wasm',
      dtype: 'q8',
      progress_callback,
    });
    self.postMessage({ type: 'model-ready', backend: 'your processor', model: 'base' });
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      await load(data);
    } catch (error) {
      if (error.message !== 'gpu-slow') self.postMessage({ type: 'error', error: `Couldn't load Whisper: ${error.message}` });
    }
    return;
  }

  if (data.type === 'transcribe') {
    try {
      await load(data);
      const samples = data.audio;
      const duration = samples.length / SAMPLE_RATE;
      const segments = [];

      for (const { start, end } of splitAtQuietPoints(samples, BLOCK_SECONDS)) {
        const offset = start / SAMPLE_RATE;
        const blockEnd = end / SAMPLE_RATE;
        const audio = samples.subarray(start, end);

        if (!isSilent(audio)) {
          const result = await transcriber(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
          const fresh = toSegments(result, offset, blockEnd);
          segments.push(...fresh);
          self.postMessage({ type: 'partial', segments: fresh });
        }
        self.postMessage({ type: 'progress', progress: blockEnd / duration });
      }

      self.postMessage({ type: 'complete', result: { segments: dropRepeats(segments), duration: round(duration), method: 'whisper' } });
    } catch (error) {
      if (error.message === 'gpu-slow') return;
      self.postMessage({ type: 'error', error: `Transcription failed: ${error.message}` });
    }
  }
};
