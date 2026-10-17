import fs from 'node:fs';
import path from 'node:path';
import { SAMPLE_RATE, dropRepeats, formatMinutes, isSilent, round, splitAtQuietPoints, toSegments } from './blocks.js';
import { cacheDir, log } from './paths.js';

/**
 * Whisper, running on this machine through transformers.js (ONNX Runtime).
 * Models download once from Hugging Face into the cache folder, then work offline.
 */

const MODELS = {
  tiny: 'onnx-community/whisper-tiny',
  base: 'onnx-community/whisper-base',
  small: 'onnx-community/whisper-small',
  medium: 'onnx-community/whisper-medium',
  turbo: 'onnx-community/whisper-large-v3-turbo',
};

export const MODEL_NAMES = Object.keys(MODELS);
export const DEFAULT_MODEL = process.env.EASIER_TRANSCRIBE_MODEL || 'small';

const loaded = new Map();

function modelId(model, language) {
  const base = MODELS[model] || (model.includes('/') ? model : null);
  if (!base) throw new Error(`Unknown model "${model}". Use one of: ${MODEL_NAMES.join(', ')}.`);
  // English-only checkpoints are a little more accurate for English.
  const englishOnly = language === 'en' && model !== 'turbo' && !model.includes('/');
  return englishOnly ? `${base}.en` : base;
}

async function getPipeline(model, language, onStatus) {
  const id = modelId(model, language);
  if (loaded.has(id)) return loaded.get(id);

  const promise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = cacheDir('models');
    env.allowLocalModels = false;

    const cached = fs.existsSync(path.join(env.cacheDir, ...id.split('/'), 'onnx'));
    onStatus?.({ stage: 'load', progress: 0, message: cached ? `Loading the Whisper ${model} model` : `Downloading the Whisper ${model} model (first run only)` });

    const files = new Map();
    let lastReport = 0;
    const progress_callback = (event) => {
      if (cached || event.status !== 'progress' || !event.total) return;
      files.set(event.file, event);
      const now = Date.now();
      if (now - lastReport < 1000) return;
      lastReport = now;
      const all = [...files.values()];
      const done = all.reduce((sum, f) => sum + (f.loaded || 0), 0);
      const total = all.reduce((sum, f) => sum + (f.total || 0), 0);
      const percent = total ? Math.round((done / total) * 100) : 0;
      onStatus?.({ stage: 'download', progress: 0, message: `Downloading the Whisper ${model} model (first run only), ${percent}%` });
    };

    const device = process.env.EASIER_TRANSCRIBE_DEVICE || 'cpu';
    log(`loading ${id} on ${device}`);
    return pipeline('automatic-speech-recognition', id, {
      device,
      // The encoder loses accuracy when quantised; the decoder barely notices.
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
      progress_callback,
    });
  })();

  loaded.set(id, promise);
  promise.catch(() => loaded.delete(id));
  return promise;
}

/** Load (and download if needed) a model ahead of time. */
export async function prepareModel(model = DEFAULT_MODEL, language = 'en', onStatus) {
  await getPipeline(model, language, onStatus);
}

/**
 * Turn 16 kHz mono samples into timed segments.
 * onStatus receives { stage, progress (0-1), message }.
 */
export async function transcribeSamples(samples, { model = DEFAULT_MODEL, language = 'en', onStatus, signal } = {}) {
  const asr = await getPipeline(model, language, onStatus);
  const id = modelId(model, language);
  const duration = samples.length / SAMPLE_RATE;
  const segments = [];
  const started = Date.now();

  const options = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true };
  if (!id.endsWith('.en')) Object.assign(options, { language, task: 'transcribe' });

  for (const { start, end } of splitAtQuietPoints(samples)) {
    signal?.throwIfAborted();
    const offset = start / SAMPLE_RATE;
    const blockEnd = end / SAMPLE_RATE;
    const audio = samples.subarray(start, end);

    if (!isSilent(audio)) {
      segments.push(...toSegments(await asr(audio, options), offset, blockEnd));
    }

    const done = blockEnd / duration;
    const elapsed = (Date.now() - started) / 1000;
    const remaining = done > 0 ? Math.round(elapsed / done - elapsed) : null;
    onStatus?.({
      stage: 'transcribe',
      progress: done,
      message: `Transcribed ${formatMinutes(blockEnd)} of ${formatMinutes(duration)}${remaining ? `, about ${formatMinutes(remaining)} to go` : ''}`,
    });
  }

  return { segments: dropRepeats(segments), duration: round(duration), model: id };
}
