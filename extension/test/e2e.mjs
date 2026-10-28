// End to end check: loads the test build in Chrome, opens a local page with a video, an audio
// element, a file link and a YouTube embed, and drives the popup and the results page.
//
//   EXT_TEST=1 npm run build:extension
//   FIXTURES=<folder with clip.webm speech.mp3 speech.wav> CHROME=<chrome.exe> node extension/test/e2e.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../dist-test');
const fixtures = process.env.FIXTURES;
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!fixtures || !existsSync(join(fixtures, 'clip.webm'))) throw new Error('Set FIXTURES to a folder with clip.webm, speech.mp3, speech.wav');

const PAGE = `<!doctype html><title>Local test page</title>
<h1>Clips and episodes</h1>
<article><h2>The quick brown fox clip</h2><video src="/clip.webm" preload="auto" muted controls width="320"></video></article>
<article><h2>Audio episode one</h2><audio src="/speech.mp3" preload="auto" controls></audio></article>
<p><a href="/speech.wav">Full interview, wav download</a> <a href="/clip.mkv">Studio recording mkv</a></p>
<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Embedded YouTube test" width="320" height="180"></iframe>`;

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') return res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
  const file = join(fixtures, req.url.slice(1));
  if (!existsSync(file)) return res.writeHead(404).end();
  const types = { '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mkv': 'video/x-matroska' };
  res.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, enableExtensions: [dist], args: ['--no-sandbox'] });
try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 20000 });
  const ext = swTarget.url().split('/').slice(0, 3).join('/');
  check('extension loaded', true, ext);

  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2 && document.querySelector('audio').readyState >= 2);

  const sw = await swTarget.worker();
  const tabId = await sw.evaluate(async (o) => (await chrome.tabs.query({ url: `${o}/*` }))[0].id, origin);

  const popup = await browser.newPage();
  await popup.goto(`${ext}/popup.html?tab=${tabId}`);
  await popup.waitForSelector('.item');
  const listed = await popup.$$eval('.item', (els) => els.map((e) => ({ title: e.querySelector('b').textContent, meta: e.querySelector('small').textContent, thumb: e.querySelector('img')?.src?.slice(0, 40) || '' })));
  console.log(listed);
  check('popup lists the video', listed.some((i) => i.title === 'The quick brown fox clip' && /Video/.test(i.meta)));
  check('popup lists the audio', listed.some((i) => i.title === 'Audio episode one' && /Audio/.test(i.meta)));
  check('popup lists the linked file', listed.some((i) => /Full interview/.test(i.title)));
  check('popup lists the YouTube embed', listed.some((i) => /Embedded YouTube/.test(i.title) && /YouTube/.test(i.meta)));
  check('video has a thumbnail from its own frame', listed.find((i) => i.title === 'The quick brown fox clip')?.thumb.startsWith('data:image'));
  await popup.screenshot({ path: join(fixtures, 'popup.png') });

  // Pick the video.
  const resultsPromise = browser.waitForTarget((t) => t.url().startsWith(`${ext}/results.html`), { timeout: 20000 });
  await popup.evaluate(() => [...document.querySelectorAll('.item')].find((e) => e.querySelector('b').textContent === 'The quick brown fox clip').querySelector('[data-pick]').click());
  const resultsPage = await (await resultsPromise).asPage();
  await resultsPage.setViewport({ width: 1100, height: 800 });
  check('results tab opened', true);

  const started = Date.now();
  let last = '';
  await resultsPage.waitForFunction(
    () => {
      const r = [...globalThis.__easier.records.values()][0];
      return r && (r.status === 'done' || r.status === 'error');
    },
    { timeout: 600000, polling: 1000 }
  ).catch(() => {});
  const record = await resultsPage.evaluate(() => {
    const r = [...globalThis.__easier.records.values()][0];
    return { status: r.status, error: r.error, method: r.method, backend: r.backend, text: (r.segments || []).map((s) => s.text).join(' '), crossOriginIsolated: self.crossOriginIsolated };
  });
  console.log(record, `${Math.round((Date.now() - started) / 1000)}s`);
  check('transcription finished', record.status === 'done', record.error || '');
  check('transcript has the words', /fox/i.test(record.text) && /test/i.test(record.text), record.text.slice(0, 80));
  check('ran with Whisper on this device', record.method === 'whisper', record.backend);
  console.log('crossOriginIsolated:', record.crossOriginIsolated);
  await resultsPage.screenshot({ path: join(fixtures, 'results.png') });

  // Survives a refresh.
  await resultsPage.reload();
  await resultsPage.waitForSelector('.row');
  const afterReload = await resultsPage.$eval('#text', (el) => el.textContent);
  check('history survives a refresh', /fox/i.test(afterReload));

  // Formats.
  await resultsPage.click('[data-format="srt"]');
  await new Promise((r) => setTimeout(r, 300));
  const srt = await resultsPage.$eval('#text', (el) => el.textContent);
  check('SRT export looks right', /^1\n\d\d:\d\d:\d\d,\d{3} --> /.test(srt));

  // Delete.
  resultsPage.on('dialog', (d) => d.accept());
  await resultsPage.click('[data-act="delete"]');
  await new Promise((r) => setTimeout(r, 500));
  check('delete removes it', (await resultsPage.$$('.row')).length === 0);

  // More picks from the same popup: a YouTube embed (captions) and a linked wav file (Whisper).
  const pickAndWait = async (title, timeout) => {
    const again = await browser.newPage(); // the popup closes itself after a pick
    await again.goto(`${ext}/popup.html?tab=${tabId}`);
    await again.waitForSelector('.item');
    await again.evaluate((t) => [...document.querySelectorAll('.item')].find((e) => e.querySelector('b').textContent.includes(t)).querySelector('[data-pick]').click(), title);
    await resultsPage.bringToFront();
    await resultsPage.waitForFunction(
      (t) => [...globalThis.__easier.records.values()].some((r) => r.title.includes(t) && (r.status === 'done' || r.status === 'error')),
      { timeout, polling: 1000 },
      title
    ).catch(() => {});
    return resultsPage.evaluate((t) => {
      const r = [...globalThis.__easier.records.values()].find((x) => x.title.includes(t));
      return { status: r?.status, method: r?.method, error: r?.error, text: (r?.segments || []).map((s) => s.text).join(' ') };
    }, title);
  };
  const embed = await pickAndWait('Embedded YouTube', 90000);
  console.log(embed.method, embed.text.slice(0, 60));
  check('YouTube embed on another site gets captions', embed.status === 'done' && embed.method.startsWith('youtube'), embed.error || '');
  const wav = await pickAndWait('Full interview', 300000);
  check('linked wav file transcribes', wav.status === 'done' && /fox/i.test(wav.text), wav.error || wav.text.slice(0, 60));
  const mkv = await pickAndWait('Studio recording', 300000);
  check('mkv goes through bundled ffmpeg', mkv.status === 'done' && /fox/i.test(mkv.text), mkv.error || mkv.text.slice(0, 60));
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} check(s) failed` : 'All checks passed');
process.exit(failed ? 1 : 0);
