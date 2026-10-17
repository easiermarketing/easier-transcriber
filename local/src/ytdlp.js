import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, log, which } from './paths.js';

/**
 * yt-dlp fetches audio from YouTube (when a video has no captions) and from
 * the thousand-plus other sites it supports. We use the copy on PATH if there
 * is one; otherwise we download the official standalone build from the
 * yt-dlp GitHub releases once, check it against the published SHA-256 sums,
 * and keep it in the cache folder. Set EASIER_TRANSCRIBE_NO_DOWNLOADS=1 to
 * turn that off.
 */

const RELEASES = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';

function releaseAsset() {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  if (process.platform === 'linux') return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  return null;
}

let located = null;

export async function findYtDlp({ allowDownload = !process.env.EASIER_TRANSCRIBE_NO_DOWNLOADS } = {}) {
  if (located) return located;
  const fromEnv = process.env.EASIER_TRANSCRIBE_YTDLP;
  const onPath = which('yt-dlp');
  const asset = releaseAsset();
  const cached = asset ? path.join(cacheDir('bin'), asset) : null;

  if (fromEnv) located = fromEnv;
  else if (onPath) located = onPath;
  else if (cached && fs.existsSync(cached)) located = cached;
  else if (asset && allowDownload) located = await downloadYtDlp(asset, cached);
  else throw new Error('yt-dlp is needed for this link. Install it (https://github.com/yt-dlp/yt-dlp) and try again.');
  return located;
}

async function downloadYtDlp(asset, target) {
  log(`downloading yt-dlp (${asset}) from the official GitHub releases, one time only`);
  const [binary, sums] = await Promise.all([
    fetch(`${RELEASES}/${asset}`).then((r) => {
      if (!r.ok) throw new Error(`Couldn't download yt-dlp (GitHub returned ${r.status}).`);
      return r.arrayBuffer();
    }),
    fetch(`${RELEASES}/SHA2-256SUMS`).then((r) => {
      if (!r.ok) throw new Error(`Couldn't download the yt-dlp checksums (GitHub returned ${r.status}).`);
      return r.text();
    }),
  ]);

  const expected = sums
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .find(([, name]) => name === asset)?.[0];
  const actual = crypto.createHash('sha256').update(Buffer.from(binary)).digest('hex');
  if (!expected || expected.toLowerCase() !== actual) {
    throw new Error('The downloaded yt-dlp did not match its published checksum, so it was not used.');
  }

  const temp = `${target}.download`;
  fs.writeFileSync(temp, Buffer.from(binary), { mode: 0o755 });
  fs.renameSync(temp, target);
  log(`yt-dlp saved to ${target}`);
  return target;
}

function run(binary, args, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], signal, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => {
      if (stderr.length < 20000) stderr += d;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Errors from yt-dlp, made readable. */
function explain(stderr) {
  const line = stderr.split('\n').reverse().find((l) => /ERROR:/.test(l)) || stderr.trim().split('\n').pop() || '';
  const message = line.replace(/^.*?ERROR:\s*/, '').replace(/^\[[^\]]+\]\s*[\w-]+:\s*/, '');
  if (/confirm you.re not a bot|sign in to confirm/i.test(message)) {
    return 'YouTube asked for a sign-in to prove this is not a bot. Try again later, or download the video yourself and transcribe the file.';
  }
  if (/private video|members-only|video unavailable/i.test(message)) return `This video can't be downloaded: ${message}`;
  return message || 'yt-dlp could not fetch this link.';
}

/**
 * Download just the audio of a link into `dir`. Returns { file, title, duration }.
 */
export async function downloadAudio(url, dir, { signal } = {}) {
  const binary = await findYtDlp();
  const args = [
    '--no-playlist',
    '--no-progress',
    '--no-warnings',
    '-f', 'bestaudio/best',
    '-o', path.join(dir, 'audio.%(ext)s'),
    '--print', 'after_move:%(filepath)j',
    '--print', '%(title)j',
    '--print', '%(duration)j',
    '--no-simulate',
  ];

  // YouTube now needs a JavaScript runtime to unlock its streams. yt-dlp
  // looks for Deno by default; Node 22+ works too, and we are already in it.
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const jsRuntime = nodeMajor >= 22 ? ['--js-runtimes', `node:${process.execPath}`] : [];

  let result = await run(binary, [...jsRuntime, ...args, url], { signal });
  if (result.code !== 0 && jsRuntime.length && /no such option|js-runtimes/i.test(result.stderr)) {
    result = await run(binary, [...args, url], { signal });
  }
  if (result.code !== 0) throw new Error(explain(result.stderr));

  const [title, duration, file] = result.stdout
    .trim()
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return line;
      }
    });
  if (!file || !fs.existsSync(file)) throw new Error('yt-dlp finished but no audio file appeared.');
  return { file, title: title || '', duration: Number(duration) || 0 };
}
