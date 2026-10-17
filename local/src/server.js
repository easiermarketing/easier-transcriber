import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createRequire } from 'node:module';
import { FORMATS, formatTranscript } from './formats.js';
import { getJob, startJob, waitForJob } from './jobs.js';
import { log } from './paths.js';

/**
 * Local HTTP API, for the Easier Transcribe website and any tool on this
 * machine that can make an HTTP request.
 *
 *   POST /transcribe        JSON { source, format?, language?, captions?, model?, wait_seconds? }
 *                           or the raw bytes of a media file (?filename=talk.mp4&format=srt)
 *   GET  /jobs/:id          ?wait=30&format=srt
 *   DELETE /jobs/:id        cancel
 *   GET  /health
 *
 * It only listens on 127.0.0.1. Web pages can call it only from the origins
 * listed below (browsers enforce that via CORS), and only command-line tools
 * (requests with no Origin header) may name a file on disk.
 */

const { version } = createRequire(import.meta.url)('../package.json');

export const DEFAULT_PORT = Number(process.env.EASIER_TRANSCRIBE_PORT) || 17748;

const DEFAULT_ORIGINS = [
  'https://transcribe.easiernow.co',
  'https://easiernow.co',
  'https://www.easiernow.co',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

// The Cloudflare Pages address and its preview deployments (abc123.easier-transcribe.pages.dev).
const PAGES_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?easier-transcribe\.pages\.dev$/;

const uploads = new Map();

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function jobBody(job, format, maxChars) {
  const body = { job_id: job.id, status: job.status, progress: job.progress, message: job.message };
  if (job.status === 'done') {
    body.transcript = job.result;
    body.format = format;
    body.text = formatTranscript(job.result, format, { maxChars });
  }
  if (job.error) body.error = job.error;
  return body;
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1e6) throw new Error('Request too large.');
  }
  return raw ? JSON.parse(raw) : {};
}

export function startServer({ port = DEFAULT_PORT, origins = [] } = {}) {
  const allowed = new Set([...DEFAULT_ORIGINS, ...origins, ...(process.env.EASIER_TRANSCRIBE_ORIGINS || '').split(',').filter(Boolean)]);
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const cors = {};

    // Refuse requests whose Host isn't us (stops DNS-rebinding tricks).
    if (!hosts.has(req.headers.host)) return send(res, 403, { error: 'Unexpected Host header.' });

    if (origin) {
      if (!allowed.has(origin) && !PAGES_ORIGIN.test(origin)) return send(res, 403, { error: `Origin ${origin} is not allowed. Start the helper with --allow-origin ${origin} to allow it.` });
      Object.assign(cors, {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Private-Network': 'true',
      });
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
      });
      return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const format = FORMATS.includes(url.searchParams.get('format')) ? url.searchParams.get('format') : 'text';
    let maxChars = Number(url.searchParams.get('max_chars')) || undefined;

    try {
      if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
        return send(res, 200, { ok: true, name: 'easier-transcribe', version }, cors);
      }

      if (req.method === 'POST' && url.pathname === '/transcribe') {
        const type = req.headers['content-type'] || '';
        let source;
        let options;
        let wait;
        let bodyFormat = format;

        if (type.startsWith('application/json')) {
          const body = await readJson(req);
          source = body.source || body.url || body.path;
          if (!source) return send(res, 400, { error: 'Send { "source": "<link or file path>" }.' }, cors);
          const isLink = /^https?:\/\//i.test(source);
          if (!isLink && origin) return send(res, 403, { error: 'Web pages can send links or file bytes, not file paths.' }, cors);
          options = { language: body.language, captions: body.captions, model: body.model };
          wait = Number(body.wait_seconds ?? 25);
          if (FORMATS.includes(body.format)) bodyFormat = body.format;
          if (Number(body.max_chars)) maxChars = Number(body.max_chars);
        } else {
          // Raw file bytes: stream them to a temporary file.
          const name = path.basename(url.searchParams.get('filename') || 'upload.bin').replace(/[^\w.-]/g, '_');
          const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'easier-transcribe-upload-'));
          source = path.join(dir, name);
          await pipeline(req, fs.createWriteStream(source));
          options = { language: url.searchParams.get('language') || undefined, model: url.searchParams.get('model') || undefined };
          wait = Number(url.searchParams.get('wait') ?? 25);
          uploads.set(source, dir);
        }

        const clean = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined && v !== null && v !== ''));
        const job = startJob(source, clean);
        if (uploads.has(source)) {
          job.done.finally(() => {
            fs.rmSync(uploads.get(source), { recursive: true, force: true });
            uploads.delete(source);
          });
        }
        await waitForJob(job, Math.min(Math.max(wait, 0), 600));
        return send(res, job.finishedAt ? (job.status === 'done' ? 200 : 422) : 202, jobBody(job, bodyFormat, maxChars), cors);
      }

      const match = url.pathname.match(/^\/jobs\/([a-f0-9]+)$/);
      if (match) {
        const job = getJob(match[1]);
        if (!job) return send(res, 404, { error: 'No such job. Jobs are kept for an hour after they finish.' }, cors);
        if (req.method === 'DELETE') {
          job.cancel();
          return send(res, 200, { job_id: job.id, status: 'cancelling' }, cors);
        }
        if (req.method === 'GET') {
          await waitForJob(job, Math.min(Math.max(Number(url.searchParams.get('wait') ?? 0), 0), 600));
          return send(res, job.finishedAt ? (job.status === 'done' ? 200 : 422) : 202, jobBody(job, format, maxChars), cors);
        }
      }

      return send(res, 404, { error: 'Not found. Try POST /transcribe.' }, cors);
    } catch (error) {
      return send(res, 400, { error: error.message }, cors);
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      log(`listening on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}
