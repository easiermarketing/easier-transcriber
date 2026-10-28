// Extra checks, one per run:  node extension/test/extras.mjs <iframe|iframe-granted|big|gpu|ytaudio>
// Build first with EXT_TEST=1 (and EXT_TEST_HOSTS=... where noted). FIXTURES as in e2e.mjs, plus big.mkv for "big".
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist-test');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fixtures = process.env.FIXTURES;
const mode = process.argv[2];

const types = { '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const files = (req, res) => {
  const f = join(fixtures, req.url.slice(1));
  if (!existsSync(f) || req.url === '/') return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[f.slice(f.lastIndexOf('.'))] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
};
const start = (handler) => new Promise((r) => { const s = createServer(handler); s.listen(0, '127.0.0.1', () => r(s)); });

// "localhost" and "127.0.0.1" are different origins, so the inner page is cross-site to the outer one.
const inner = await start((req, res) => (req.url === '/player.html'
  ? res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Player</title><h2>Hidden player clip</h2><video src="/clip.webm" preload="auto" muted controls width="240"></video>')
  : files(req, res)));
const innerUrl = `http://localhost:${inner.address().port}`;
const outer = await start((req, res) => {
  if (req.url === '/') {
    const body = mode.startsWith('iframe')
      ? `<!doctype html><title>Outer</title><h1>Outer page</h1><iframe src="${innerUrl}/player.html" width="300" height="200"></iframe>`
      : `<!doctype html><title>Big recording</title><h1>Recording</h1><video src="/big.mkv" preload="metadata" controls width="320"></video>`;
    return res.writeHead(200, { 'content-type': 'text/html' }).end(body);
  }
  files(req, res);
});
const origin = `http://127.0.0.1:${outer.address().port}`;

const args = ['--no-sandbox'];
if (mode === 'gpu') args.push('--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist');
const browser = await puppeteer.launch({ executablePath: chrome, headless: mode === 'gpu' ? false : true, pipe: true, enableExtensions: [dist], args });
let code = 0;
try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 20000 });
  const ext = swTarget.url().split('/').slice(0, 3).join('/');
  const sw = await swTarget.worker();
  let page;
  let tabId;
  if (mode === 'ytaudio') {
    page = await browser.newPage();
    await page.goto(`https://www.youtube.com/watch?v=${process.argv[3] || 'dQw4w9WgXcQ'}`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 5000));
    tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'https://www.youtube.com/*' }))[0].id);
  } else if (mode === 'gpu') {
    page = await browser.newPage();
    await page.goto(`${origin.replace('127.0.0.1', '127.0.0.1')}/clip.webm`.replace('/clip.webm', '/'), { waitUntil: 'domcontentloaded' }).catch(() => {});
    tabId = null;
  } else {
    page = await browser.newPage();
    await page.goto(`${origin}/`);
    await new Promise((r) => setTimeout(r, 3000));
    tabId = await sw.evaluate(async (o) => (await chrome.tabs.query({ url: `${o}/*` }))[0].id, origin);
  }

  // Results page opened first, so the service worker reuses it and test flags in its URL stay.
  const results = await browser.newPage();
  await results.goto(`${ext}/results.html${mode === 'ytaudio' ? '?skipcaptions=1' : ''}`);
  if (mode === 'gpu') {
    await results.evaluate(() => localStorage.setItem('transcribe-accurate', '1'));
    // Hand the job over without a page: a plain file URL on the local server.
    await sw.evaluate(async (job) => {
      const { queue = [] } = await chrome.storage.local.get('queue');
      queue.push(job);
      await chrome.storage.local.set({ queue });
    }, { id: 'gpu-test', item: { id: `src:${origin}/speech.wav`, kind: 'audio', src: `${origin}/speech.wav`, title: 'GPU speech test', duration: 10 }, createdAt: Date.now() });
  } else {
    const popup = await browser.newPage();
    await popup.goto(`${ext}/popup.html?tab=${tabId}`);
    await popup.waitForSelector('.note');
    await new Promise((r) => setTimeout(r, 2500));
    console.log('note:', await popup.$eval('#note', (e) => e.textContent));
    console.log('items:', await popup.$$eval('.item', (els) => els.map((e) => `${e.querySelector('b').textContent} | ${e.querySelector('small').textContent}`)));
    console.log('look-inside button:', (await popup.$('#look')) ? 'shown' : 'not shown');
    if (mode === 'iframe') throw Object.assign(new Error('done'), { quiet: true });
    await popup.evaluate(() => document.querySelector('[data-pick]')?.click());
  }

  const t0 = Date.now();
  await results.bringToFront();
  await results.waitForFunction(() => [...(globalThis.__easier?.records.values() || [])].some((r) => r.status === 'done' || r.status === 'error'), { timeout: 900000, polling: 1000 });
  console.log(await results.evaluate(() => {
    const r = [...globalThis.__easier.records.values()][0];
    return { status: r.status, method: r.method, backend: r.backend, error: r.error, errorKind: r.errorKind, segments: r.segments.length, text: r.segments.map((s) => s.text).join(' ').slice(0, 140) };
  }), `${Math.round((Date.now() - t0) / 1000)}s`);
} catch (error) {
  if (!error.quiet) { console.error(error); code = 1; }
} finally {
  await browser.close();
  inner.close();
  outer.close();
}
process.exit(code);
