// Uses the REAL production build (extension/dist, no test host access) in a headed Chrome with a
// fresh profile, and opens the popup the way the toolbar button does (chrome.action.openPopup).
//   node extension/test/real-button.mjs <local|youtube> [videoId]   (local needs FIXTURES like e2e.mjs)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mode = process.argv[2] || 'local';
const fixtures = process.env.FIXTURES;
let server;
let url;
if (mode === 'local') {
  const PAGE = `<!doctype html><title>Local test page</title><h1>Clips</h1>
<article><h2>The quick brown fox clip</h2><video src="/clip.webm" preload="auto" muted controls width="320"></video></article>
<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Embedded YouTube test" width="320" height="180"></iframe>`;
  server = createServer((req, res) => {
    if (req.url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
    const f = join(fixtures, req.url.slice(1));
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'video/webm' });
    createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}/`;
} else {
  url = `https://www.youtube.com/watch?v=${process.argv[3] || 'dQw4w9WgXcQ'}`;
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: process.env.HEADED === '1' ? false : true,
  pipe: true,
  userDataDir: mkdtempSync(join(tmpdir(), 'easier-profile-')),
  enableExtensions: [dist],
  defaultViewport: null,
  args: ['--window-position=0,0', '--window-size=1280,800', '--no-sandbox', '--lang=en-US', '--no-first-run', '--no-default-browser-check'],
});
try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 20000 });
  const ext = swTarget.url().split('/').slice(0, 3).join('/');
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 5000));
  await page.bringToFront();
  const sw = await swTarget.worker();
  const popupTarget = browser.waitForTarget((t) => t.url().startsWith(`${ext}/popup.html`), { timeout: 600000 });
  if (process.env.OPEN_POPUP === '1') {
    const err = await sw.evaluate(() => chrome.action.openPopup().then(() => null, (e) => String(e)));
    if (err) console.log('openPopup error:', err);
  } else console.log('READY: click the toolbar button now');
  const popup = await (await popupTarget).asPage();
  await popup.waitForSelector('.item, .note', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));
  console.log('note:', await popup.$eval('#note', (e) => `${e.textContent} [${e.title}]`));
  console.log(await popup.$$eval('.item', (els) => els.slice(0, 6).map((e) => `${e.querySelector('b').textContent} | ${e.querySelector('small').textContent}`)));
  const shots = process.env.SHOTS;
  if (shots) await popup.screenshot({ path: `${shots}/real-${mode}-1-popup.png` });
  const resultsPromise = browser.waitForTarget((t) => t.url().startsWith(`${ext}/results.html`), { timeout: 20000 });
  await popup.evaluate(() => document.querySelector('[data-pick]')?.click());
  const results = await (await resultsPromise).asPage();
  await results.waitForFunction(() => {
    const r = [...globalThis.__easier.records.values()][0];
    return r && (r.status === 'done' || r.status === 'error');
  }, { timeout: 300000, polling: 1000 });
  console.log(await results.evaluate(() => {
    const r = [...globalThis.__easier.records.values()][0];
    return { status: r.status, method: r.method, error: r.error, segments: r.segments.length, first: r.segments.slice(0, 2).map((s) => s.text) };
  }));
  if (shots) await results.screenshot({ path: `${shots}/real-${mode}-2-result.png` });
  // Refresh and reopen: the transcript must still be there.
  await results.reload({ waitUntil: 'domcontentloaded' });
  await results.waitForFunction(() => [...(globalThis.__easier?.records?.values() ?? [])].some((r) => r.status === 'done'), { timeout: 15000 });
  console.log('after refresh: transcript still saved');
  console.log('ask buttons:', await results.$$eval('[data-act^=ask-]', (b) => b.map((x) => x.textContent)));
  if (shots) await results.screenshot({ path: `${shots}/real-${mode}-3-after-refresh.png` });
} finally {
  await browser.close();
  server?.close();
}
