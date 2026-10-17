import crypto from 'node:crypto';
import { transcribe } from './transcribe.js';
import { log } from './paths.js';

/**
 * Transcription jobs. Whisper on a long recording takes minutes, which is
 * longer than many MCP clients and HTTP callers will wait for one reply, so
 * each request becomes a job that callers can wait on, then check back on.
 *
 * Jobs run one at a time (Whisper already uses every CPU core) and are kept
 * for an hour after they finish.
 */

const jobs = new Map();
const KEEP_MS = 60 * 60 * 1000;
let queue = Promise.resolve();

export function startJob(source, options = {}) {
  const id = crypto.randomBytes(4).toString('hex');
  const controller = new AbortController();
  const listeners = new Set();
  const job = {
    id,
    source,
    status: 'queued',
    progress: 0,
    message: 'Waiting for the previous transcription to finish',
    result: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
    cancel: () => controller.abort(),
    onUpdate: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const notify = () => listeners.forEach((fn) => fn(job));

  job.done = (queue = queue.then(async () => {
    if (controller.signal.aborted) {
      Object.assign(job, { status: 'cancelled', error: 'Cancelled.', message: 'Cancelled.', finishedAt: Date.now() });
      notify();
      return job;
    }
    job.status = 'running';
    job.message = 'Starting';
    notify();
    try {
      job.result = await transcribe(source, {
        ...options,
        signal: controller.signal,
        onStatus: ({ stage, progress, message }) => {
          job.stage = stage;
          job.progress = progress;
          job.message = message;
          notify();
        },
      });
      job.status = 'done';
      job.progress = 1;
      job.message = 'Done';
    } catch (error) {
      job.status = controller.signal.aborted ? 'cancelled' : 'failed';
      job.error = controller.signal.aborted ? 'Cancelled.' : error.message;
      job.message = job.error;
    }
    job.finishedAt = Date.now();
    log(`job ${id} ${job.status} after ${Math.round((job.finishedAt - job.startedAt) / 1000)}s${job.error ? `: ${job.error}` : ''}`);
    notify();
    setTimeout(() => jobs.delete(id), KEEP_MS).unref();
    return job;
  }));

  jobs.set(id, job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

/** Wait up to `seconds` for a job to finish. Resolves with the job either way. */
export function waitForJob(job, seconds) {
  if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') return Promise.resolve(job);
  return Promise.race([job.done, new Promise((resolve) => setTimeout(() => resolve(job), seconds * 1000).unref())]);
}
