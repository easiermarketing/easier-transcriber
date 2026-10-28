/**
 * Runs transcription jobs one at a time, inside the results tab.
 *
 *   YouTube: captions first, read through the page you are on (a second).
 *   Everything else, and YouTube without captions: Whisper on this device.
 *
 * Every change is saved to IndexedDB as it happens, so a refresh loses at
 * most the job that was running, and its text so far is kept.
 */

import { extractAudio } from '@app/lib/audio.js';
import { getAccurate } from '@app/lib/modelChoice.js';
import { getAudioStream, getYouTubeTranscript } from '@local/youtube.js';
import { saveRecord } from './db.js';
import { NeedsAccess, getMediaBlob, getRangedBlob } from './media.js';

const ORT = chrome.runtime.getURL('ort/');
const WASM_PATHS = { mjs: `${ORT}ort-wasm-simd-threaded.asyncify.mjs`, wasm: `${ORT}ort-wasm-simd-threaded.asyncify.wasm` };

class Cancelled extends Error {}

export function createRunner({ onChange }) {
  const queue = [];
  let current = null;
  let worker = null;
  let workerAccurate = null;
  let workerBackend = '';
  let cancelled = false;
  let rejectWork = null;

  const update = (record, patch, save = true) => {
    Object.assign(record, patch);
    onChange(record);
    return save ? saveRecord(record) : undefined;
  };

  function killWorker() {
    worker?.terminate();
    worker = null;
  }

  function getWorker(forceWasm) {
    // The "More accurate" switch can change between jobs.
    const accurate = !forceWasm;
    if (worker && workerAccurate !== accurate) killWorker();
    if (!worker) workerBackend = '';
    if (!worker) {
      worker = new Worker(new URL('./../whisper.worker.js', import.meta.url), { type: 'module' });
      workerAccurate = accurate;
      worker.postMessage({ type: 'init', forceWasm, wasmPaths: WASM_PATHS });
    }
    return worker;
  }

  function whisper(record, audio) {
    return new Promise((resolve, reject) => {
      rejectWork = reject;
      let forceWasm = !getAccurate();
      let started = Date.now();
      let lastSave = 0;
      const segments = [];

      const attach = () => {
        const w = getWorker(forceWasm);
        w.onmessage = ({ data }) => {
          switch (data.type) {
            case 'model-progress':
              update(record, { stage: 'Getting Whisper ready. First time only, about 80 MB.', modelProgress: data.progress }, false);
              break;
            case 'model-ready':
              workerBackend = data.backend;
              started = Date.now();
              update(record, { stage: `Transcribing on ${data.backend}`, backend: data.backend, modelProgress: 1 });
              break;
            case 'gpu-slow':
              killWorker();
              forceWasm = true;
              segments.length = 0;
              update(record, { stage: 'Your graphics chip is slow here. Switching to your processor.', segments: [] });
              attach();
              break;
            case 'partial':
              segments.push(...data.segments);
              if (Date.now() - lastSave > 2500) {
                lastSave = Date.now();
                update(record, { segments: [...segments] });
              } else update(record, { segments: [...segments] }, false);
              break;
            case 'progress': {
              const elapsed = (Date.now() - started) / 1000;
              update(record, { progress: data.progress, eta: data.progress > 0 ? Math.max(0, elapsed / data.progress - elapsed) : 0 }, false);
              break;
            }
            case 'complete':
              resolve(data.result);
              break;
            case 'error':
              reject(new Error(data.error));
              break;
            default:
              break;
          }
        };
        w.onerror = (event) => reject(new Error(event.message || 'Something went wrong in the transcriber.'));
        // A worker that is already set up from an earlier job says nothing more about its model.
        if (workerBackend) {
          started = Date.now();
          update(record, { stage: `Transcribing on ${workerBackend}`, backend: workerBackend, modelProgress: 1 });
        }
        w.postMessage({ type: 'transcribe', audio, forceWasm, wasmPaths: WASM_PATHS });
      };
      attach();
    });
  }

  async function captions(record) {
    const { item } = record;
    update(record, { stage: 'Looking for YouTube captions' });
    let reply = null;
    if (item.tabId != null) {
      try {
        reply = await chrome.tabs.sendMessage(item.tabId, { type: 'easier:yt-captions', videoId: item.ytId }, { frameId: item.frameId || 0 });
      } catch {
        reply = null; // the page is gone or it is not a YouTube frame
      }
    }
    if (reply?.ok) return reply.transcript;
    if (reply?.code === 'no_captions') return null;
    try {
      return await getYouTubeTranscript(item.ytId, { fetchImpl: (u, o) => fetch(u, o) });
    } catch (error) {
      if (error.code === 'no_captions') return null;
      record.captionNote = error.message;
      return null;
    }
  }

  async function youtubeAudio(record) {
    const { item } = record;
    update(record, { stage: 'No captions. Looking for the audio.' });
    let stream = null;
    if (item.tabId != null) {
      try {
        const reply = await chrome.tabs.sendMessage(item.tabId, { type: 'easier:yt-audio', videoId: item.ytId }, { frameId: item.frameId || 0 });
        stream = reply?.stream || null;
      } catch {
        stream = null;
      }
    }
    stream ||= await getAudioStream(item.ytId, { fetchImpl: (u, o) => fetch(u, o) }).catch(() => null);
    if (!stream) {
      throw new Error("This video has no captions, and YouTube doesn't hand its audio to extensions. Open the video on its own page and try again, or upload the file on the website.");
    }
    const pattern = 'https://*.googlevideo.com/*';
    if (!(await chrome.permissions.contains({ origins: [pattern] }))) throw new NeedsAccess('https://googlevideo.com', pattern);
    update(record, { stage: 'Downloading the audio', progress: 0 });
    return getRangedBlob(stream.url, stream.size, (loaded, total) => update(record, { progress: total ? loaded / total : 0 }, false));
  }

  async function run(record) {
    const { item } = record;
    cancelled = false;
    await update(record, { status: 'working', stage: 'Starting', progress: 0, eta: 0, error: null, errorKind: null, segments: [] });

    // ?skipcaptions on the results page is for testing the audio path.
    if (item.ytId && !new URLSearchParams(location.search).has('skipcaptions')) {
      const found = await captions(record);
      if (found?.segments?.length) {
        await update(record, {
          status: 'done',
          stage: '',
          progress: 1,
          method: found.method || 'youtube-captions',
          language: found.language,
          duration: found.duration || found.segments.at(-1)?.end || 0,
          segments: found.segments,
          finishedAt: Date.now(),
        });
        return;
      }
    }

    let blob;
    if (item.ytId) {
      blob = await youtubeAudio(record);
    } else {
      update(record, { stage: 'Downloading the file', progress: 0 });
      blob = await getMediaBlob(item.src, {
        tabId: item.tabId,
        frameId: item.frameId,
        onProgress: (loaded, total) => update(record, { progress: total ? loaded / total : 0 }, false),
      });
    }
    if (cancelled) throw new Cancelled();

    update(record, { stage: 'Reading the audio', progress: 0 });
    const name = `media.${(blob.type.split('/')[1] || 'mp4').split(';')[0].replace('mpeg', 'mp3')}`;
    const audio = await extractAudio(new File([blob], name, { type: blob.type }), {
      isVideo: item.kind === 'video',
      onProgress: (progress) => update(record, { progress }, false),
    });
    if (cancelled) throw new Cancelled();

    update(record, { stage: 'Getting Whisper ready', progress: 0, modelProgress: 0 });
    const result = await whisper(record, audio);
    await update(record, {
      status: 'done',
      stage: '',
      progress: 1,
      method: 'whisper',
      duration: result.duration,
      segments: result.segments,
      finishedAt: Date.now(),
    });
  }

  async function next() {
    if (current || !queue.length) return;
    const record = queue.shift();
    current = record;
    try {
      await run(record);
    } catch (error) {
      if (error instanceof Cancelled || cancelled) {
        await update(record, { status: 'interrupted', stage: '', error: 'Stopped.' });
      } else if (error instanceof NeedsAccess) {
        await update(record, { status: 'error', stage: '', errorKind: 'access', accessPattern: error.pattern, error: error.message });
      } else {
        await update(record, { status: 'error', stage: '', errorKind: 'failed', error: error.message || String(error) });
      }
    } finally {
      current = null;
      rejectWork = null;
      next();
    }
  }

  return {
    enqueue(record) {
      update(record, { status: 'queued', stage: 'Waiting for the earlier job' });
      queue.push(record);
      next();
    },
    isActive: (id) => current?.id === id || queue.some((r) => r.id === id),
    cancel(id) {
      const waiting = queue.findIndex((r) => r.id === id);
      if (waiting >= 0) {
        const [record] = queue.splice(waiting, 1);
        update(record, { status: 'interrupted', stage: '', error: 'Stopped.' });
      } else if (current?.id === id) {
        cancelled = true;
        killWorker();
        rejectWork?.(new Cancelled());
      }
    },
    forgetWorker: killWorker,
  };
}
