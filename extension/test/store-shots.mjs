// Makes the Web Store screenshots (1280x800) and the 440x280 tile from the real extension UI.
//   EXT_TEST=1 npm run build:extension, then:  FIXTURES=<folder with demo/garden-tour.webm demo/podcast.mp3 demo/meeting.wav> OUT=<folder> node extension/test/store-shots.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../dist-test');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fixtures = join(process.env.FIXTURES, 'demo');
const out = process.env.OUT;
mkdirSync(out, { recursive: true });

const PAGE = `<!doctype html><meta charset="utf-8"><title>Greenhouse Club</title>
<body style="font-family:system-ui;max-width:760px;margin:24px auto">
<h1>Greenhouse Club</h1>
<article><h2>Garden tour: spring planting</h2><video src="/garden-tour.webm" preload="auto" muted controls width="360"></video></article>
<article><h2>Podcast, episode 12: the quick brown fox</h2><audio src="/podcast.mp3" preload="auto" controls></audio></article>
<p><a href="/meeting.wav">Club meeting recording (wav)</a></p></body>`;
const types = { '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = createServer((req, res) => {
  if (req.url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
  const f = join(fixtures, req.url.slice(1));
  if (!existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[f.slice(f.lastIndexOf('.'))] });
  createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, enableExtensions: [dist], args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FRAME_CSS = `*{box-sizing:border-box;margin:0}body{width:1280px;height:800px;font-family:Poppins,system-ui,sans-serif;color:#121417;
background:radial-gradient(55% 70% at 18% 0%,rgba(110,70,255,.2),transparent 62%),radial-gradient(60% 75% at 90% 100%,rgba(250,45,127,.14),transparent 66%),#f7f5ff;display:flex;align-items:center;gap:56px;padding:0 80px}
h1{font-size:48px;line-height:1.1;font-weight:600}p{font-size:22px;color:#5d616b;margin-top:18px;line-height:1.5}
.card{border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(110,70,255,.25);border:1px solid rgba(18,20,23,.1);background:#fff}img{display:block}`;

try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 20000 });
  const ext = swTarget.url().split('/').slice(0, 3).join('/');
  const sw = await swTarget.worker();
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2 && document.querySelector('audio').readyState >= 2);
  const tabId = await sw.evaluate(async (o) => (await chrome.tabs.query({ url: `${o}/*` }))[0].id, origin);

  const compose = async (name, headline, sub, imgBuf) => {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 800 });
    await p.setContent(`<style>${FRAME_CSS}</style><div style="flex:1"><h1>${headline}</h1><p>${sub}</p></div><div class="card"><img src="data:image/png;base64,${imgBuf.toString('base64')}"></div>`);
    await p.screenshot({ path: join(out, name) });
    await p.close();
  };

  // 1. Popup.
  const popup = await browser.newPage();
  await popup.setViewport({ width: 400, height: 520, deviceScaleFactor: 1.5 });
  await popup.goto(`${ext}/popup.html?tab=${tabId}`);
  await popup.waitForSelector('.item');
  await sleep(1500);
  const popupBox = await popup.$eval('body', (b) => ({ h: Math.ceil(b.scrollHeight) }));
  await popup.setViewport({ width: 400, height: popupBox.h, deviceScaleFactor: 1.5 });
  await compose('1-pick-a-video.png', 'See every video on the page. Pick one.', 'Press the button. Get the transcript.', await popup.screenshot());
  await popup.close();

  // Jobs: video, long podcast (progress shot), meeting wav.
  const results = await browser.newPage();
  await results.setViewport({ width: 1280, height: 800 });
  await results.goto(`${ext}/results.html`);
  const pick = async (title) => {
    const p = await browser.newPage();
    await p.goto(`${ext}/popup.html?tab=${tabId}`);
    await p.waitForSelector('.item');
    await p.evaluate((t) => [...document.querySelectorAll('.item')].find((e) => e.querySelector('b').textContent.includes(t)).querySelector('[data-pick]').click(), title);
    await results.bringToFront();
  };
  const finished = (t) => results.waitForFunction((x) => [...globalThis.__easier.records.values()].some((r) => r.title.includes(x) && r.status === 'done'), { timeout: 600000, polling: 500 }, t);

  await pick('Garden tour');
  await finished('Garden tour');
  await pick('Podcast');
  await results.waitForFunction(() => [...globalThis.__easier.records.values()].some((r) => r.title.includes('Podcast') && r.status === 'working' && r.progress > 0.25 && (r.segments || []).length > 2), { timeout: 600000, polling: 300 });
  await results.screenshot({ path: join(out, '4-working.png') });
  await finished('Podcast');
  await pick('Club meeting');
  await finished('Club meeting');

  const select = (t) => results.evaluate((x) => { [...document.querySelectorAll('.row')].find((r) => r.textContent.includes(x)).click(); }, t);
  await select('Garden tour');
  await sleep(500);
  await results.screenshot({ path: join(out, '2-transcript.png') });
  await results.click('[data-format="srt"]');
  await sleep(400);
  await results.screenshot({ path: join(out, '3-export-srt.png') });
  await results.click('[data-format="text"]');
  await select('Podcast');
  await sleep(400);
  await results.screenshot({ path: join(out, '5-saved-history.png') });

  // Tile 440x280.
  const tile = await browser.newPage();
  await tile.setViewport({ width: 440, height: 280 });
  const icon = readFileSync(join(here, '../icons/icon128.png')).toString('base64');
  await tile.setContent(`<style>*{margin:0;box-sizing:border-box}body{width:440px;height:280px;font-family:Poppins,system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#a68eff 0%,#6e46ff 45%,#c208ff 100%);display:flex;flex-direction:column;justify-content:center;padding:0 36px}
img{width:64px;height:64px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.25);margin-bottom:20px}h1{font-size:34px;line-height:1.1;font-weight:600}p{font-size:18px;margin-top:10px;opacity:.95}</style>
<img src="data:image/png;base64,${icon}"><h1>Easier Transcribe</h1><p>Free transcripts. On your device.</p>`);
  await tile.screenshot({ path: join(out, 'promo-tile-440x280.png') });
  console.log('done', out);
} finally {
  await browser.close();
  server.close();
}
