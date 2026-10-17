#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { FORMATS, formatTranscript } from './formats.js';

const { version } = createRequire(import.meta.url)('../package.json');

const HELP = `Easier Transcribe ${version}
Free, private transcription on your own machine. Nothing is uploaded.

Usage
  easier-transcribe <file or link> [options]   Print a transcript
  easier-transcribe mcp                        Run as an MCP server (for Claude and other AI tools)
  easier-transcribe serve [--port 17748]       Run the local HTTP API (used by the website)
  easier-transcribe setup                      Download the Whisper model now

Options
  -f, --format <name>     text, timestamped, srt, vtt or json (default: text)
  -o, --out <file>        Save to a file instead of printing
      --max-chars <n>     For srt and vtt, split subtitles longer than n characters
  -l, --language <code>   Language of the speech (default: en)
  -m, --model <name>      tiny, base, small, medium or turbo (default: small)
      --whisper           Use Whisper even if a YouTube video has captions
      --captions-only     YouTube captions or nothing
      --allow-origin <url>  (serve) Also allow this website to call the API
  -h, --help

Examples
  easier-transcribe meeting.mp4 -f srt -o meeting.srt
  easier-transcribe https://www.youtube.com/watch?v=arj7oStGLkU
  claude mcp add easier-transcribe -- npx -y easier-transcribe mcp
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    format: { type: 'string', short: 'f', default: 'text' },
    out: { type: 'string', short: 'o' },
    'max-chars': { type: 'string' },
    language: { type: 'string', short: 'l', default: 'en' },
    model: { type: 'string', short: 'm' },
    whisper: { type: 'boolean', default: false },
    'captions-only': { type: 'boolean', default: false },
    port: { type: 'string' },
    'allow-origin': { type: 'string', multiple: true },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
});

const [command] = positionals;

if (values.version) {
  console.log(version);
} else if (values.help || !command) {
  console.log(HELP);
} else if (command === 'mcp') {
  await import('./mcp.js');
} else if (command === 'serve') {
  const { startServer, DEFAULT_PORT } = await import('./server.js');
  const port = Number(values.port) || DEFAULT_PORT;
  try {
    await startServer({ port, origins: values['allow-origin'] || [] });
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    console.error(`Port ${port} is already in use (maybe the helper is already running?). Try --port ${port + 1}.`);
    process.exit(1);
  }
  console.error(`Easier Transcribe helper is running on http://127.0.0.1:${port}. Leave this window open; press Ctrl+C to stop.`);
} else if (command === 'setup') {
  const { prepareModel, DEFAULT_MODEL } = await import('./whisper.js');
  const model = values.model || DEFAULT_MODEL;
  await prepareModel(model, values.language, (s) => progressLine(s));
  clearLine();
  console.error(`Whisper ${model} is ready.`);
} else {
  if (!FORMATS.includes(values.format)) {
    console.error(`Unknown format "${values.format}". Use one of: ${FORMATS.join(', ')}.`);
    process.exit(2);
  }
  const { transcribe } = await import('./transcribe.js');
  try {
    const result = await transcribe(command, {
      language: values.language,
      model: values.model,
      captions: values.whisper ? 'skip' : values['captions-only'] ? 'only' : 'prefer',
      onStatus: progressLine,
    });
    clearLine();
    result.notes?.forEach((note) => console.error(note));
    const output = formatTranscript(result, values.format, { maxChars: Number(values['max-chars']) || undefined });
    if (values.out) {
      fs.writeFileSync(path.resolve(values.out), output + '\n');
      console.error(`Saved to ${path.resolve(values.out)}`);
    } else {
      process.stdout.write(output + '\n');
    }
  } catch (error) {
    clearLine();
    console.error(`Couldn't transcribe that: ${error.message}`);
    process.exit(1);
  }
}

function progressLine({ progress, message }) {
  if (!process.stderr.isTTY) return;
  const percent = progress ? ` ${Math.round(progress * 100)}%` : '';
  process.stderr.write(`\r\x1b[2K${message}${percent}`);
}

function clearLine() {
  if (process.stderr.isTTY) process.stderr.write('\r\x1b[2K');
}
