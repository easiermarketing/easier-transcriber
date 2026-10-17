#!/usr/bin/env node
/**
 * Easier Transcribe MCP server (stdio).
 *
 *   claude mcp add easier-transcribe -- npx -y easier-transcribe mcp
 *
 * Everything runs on this machine: YouTube captions come straight from
 * YouTube, and Whisper runs locally. No account, no key, no upload.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FORMATS, FORMAT_EXTENSIONS, clock, formatTranscript } from './formats.js';
import { getJob, startJob, waitForJob } from './jobs.js';
import { DEFAULT_MODEL, MODEL_NAMES } from './whisper.js';
import { cacheDir } from './paths.js';

const { version } = createRequire(import.meta.url)('../package.json');

// Longer transcripts are saved to a file instead of flooding the chat.
const MAX_INLINE = Number(process.env.EASIER_TRANSCRIBE_MAX_INLINE) || 60000;
const DEFAULT_WAIT = 50;

const outputs = new Map();

const METHOD_LABELS = {
  'youtube-captions': "the video's own captions",
  'youtube-auto-captions': "YouTube's automatic captions",
  whisper: 'Whisper, on this machine',
};

function describe(result) {
  const parts = [];
  if (result.duration) parts.push(clock(result.duration).replace(/^00:/, ''));
  parts.push(`from ${METHOD_LABELS[result.method] || result.method}`);
  const name = result.title ? `"${result.title}"` : result.source;
  return `Transcript of ${name} (${parts.join(', ')})`;
}

function slug(text) {
  return (text || 'transcript').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'transcript';
}

function finished(job) {
  const { format, saveTo, maxChars } = outputs.get(job.id) || { format: 'text' };
  if (job.status !== 'done') {
    return { content: [{ type: 'text', text: `Transcription ${job.status}: ${job.error}` }], isError: true };
  }

  const result = job.result;
  const body = formatTranscript(result, format, { maxChars });
  const header = describe(result);
  const notes = result.notes?.length ? `\n${result.notes.join('\n')}` : '';

  let file = saveTo ? path.resolve(saveTo) : null;
  if (!file && body.length > MAX_INLINE) {
    file = path.join(cacheDir('transcripts'), `${slug(result.title)}-${job.id}${FORMAT_EXTENSIONS[format]}`);
  }
  if (file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }

  if (file && body.length > MAX_INLINE) {
    const preview = body.slice(0, 3000);
    return {
      content: [
        {
          type: 'text',
          text: `${header}${notes}\n\nThe full transcript is ${body.length.toLocaleString()} characters, so it was saved to:\n${file}\n\nFirst part:\n\n${preview}…`,
        },
      ],
    };
  }

  const saved = file ? `\nSaved to ${file}` : '';
  return { content: [{ type: 'text', text: `${header}${notes}${saved}\n\n${body}` }] };
}

function stillWorking(job) {
  const percent = Math.round((job.progress || 0) * 100);
  return {
    content: [
      {
        type: 'text',
        text:
          `Still working on it (${percent}%). ${job.message || ''}\n` +
          `Job ID: ${job.id}\n` +
          'Call check_transcription with this job_id to wait for the result.',
      },
    ],
  };
}

/** Wait for the job, sending MCP progress notifications if the client asked for them. */
async function respond(job, waitSeconds, extra) {
  const token = extra?._meta?.progressToken;
  let last = 0;
  const stop =
    token === undefined
      ? () => {}
      : job.onUpdate((current) => {
          const now = Date.now();
          if (now - last < 1000 && current.status === 'running') return;
          last = now;
          extra
            .sendNotification({
              method: 'notifications/progress',
              params: { progressToken: token, progress: Math.round((current.progress || 0) * 100), total: 100, message: current.message },
            })
            .catch(() => {});
        });

  try {
    await waitForJob(job, waitSeconds);
  } finally {
    stop();
  }
  return job.finishedAt ? finished(job) : stillWorking(job);
}

const server = new McpServer(
  { name: 'easier-transcribe', title: 'Easier Transcribe', version },
  {
    instructions:
      'Turns audio, video and links into text, on this machine. Use transcribe for local files, direct media links, ' +
      "YouTube links (its captions first, Whisper if there are none) and pages yt-dlp supports. Whisper takes roughly a third of the recording's length on a laptop CPU, so long jobs return a job_id: call check_transcription to wait for them.",
  }
);

server.registerTool(
  'transcribe',
  {
    title: 'Transcribe audio, video or a link',
    description:
      'Transcribe a local audio or video file, a direct media link, a YouTube link, or a page from any site yt-dlp supports ' +
      '(Vimeo, Loom, X, TikTok, podcast pages and more). For YouTube it reads the video\'s own captions first (instant) ' +
      'and falls back to Whisper running on this machine. Nothing is uploaded anywhere. Returns the transcript, or a job_id ' +
      'to pass to check_transcription if Whisper needs longer than wait_seconds.',
    inputSchema: {
      source: z.string().describe('Local file path, direct media URL, YouTube link, or page URL.'),
      format: z.enum(FORMATS).default('text').describe('text (paragraphs), timestamped ([00:01:23] lines), srt, vtt, or json (segments with times; YouTube auto-captions include word timings).'),
      language: z.string().default('en').describe('Language code of the speech, e.g. en, es, fr, de. Used to pick captions and the Whisper model.'),
      captions: z.enum(['prefer', 'only', 'skip']).default('prefer').describe('YouTube only. prefer: captions, then Whisper. only: captions or fail. skip: always use Whisper.'),
      model: z.enum(MODEL_NAMES).default(DEFAULT_MODEL).describe('Whisper model. small is the best balance; turbo is most accurate and slowest; tiny is fastest.'),
      save_to: z.string().optional().describe('Optional file path to also save the transcript to.'),
      max_chars: z.number().int().min(20).max(500).optional().describe('srt and vtt only: split subtitles longer than this many characters (84 suits most players).'),
      wait_seconds: z.number().min(0).max(3600).default(DEFAULT_WAIT).describe('How long to wait before handing back a job_id.'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ source, format, language, captions, model, save_to, max_chars, wait_seconds }, extra) => {
    const job = startJob(source, { language, captions, model });
    outputs.set(job.id, { format, saveTo: save_to, maxChars: max_chars });
    return respond(job, wait_seconds, extra);
  }
);

server.registerTool(
  'check_transcription',
  {
    title: 'Check on a transcription',
    description: 'Wait for a transcription started by transcribe, and return it when it is ready. Set cancel to stop it.',
    inputSchema: {
      job_id: z.string().describe('The job_id that transcribe returned.'),
      wait_seconds: z.number().min(0).max(3600).default(DEFAULT_WAIT).describe('How long to wait before reporting progress again.'),
      cancel: z.boolean().default(false).describe('Stop this transcription.'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ job_id, wait_seconds, cancel }, extra) => {
    const job = getJob(job_id.trim());
    if (!job) {
      return { content: [{ type: 'text', text: `No transcription with job ID ${job_id}. Jobs are kept for an hour after they finish.` }], isError: true };
    }
    if (cancel) {
      job.cancel();
      await waitForJob(job, 5);
      return { content: [{ type: 'text', text: `Cancelled job ${job.id}.` }] };
    }
    return respond(job, wait_seconds, extra);
  }
);

await server.connect(new StdioServerTransport());
