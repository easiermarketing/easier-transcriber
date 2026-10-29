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
const origin = process.env.ORIGIN || `http://127.0.0.1:${server.address().port}`; // ORIGIN: a public demo page, so no localhost shows in the pictures

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, enableExtensions: [dist], args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const asset = (f) => readFileSync(join(here, '../store/brand', f)).toString('base64');
const INK = `data:image/jpeg;base64,${asset('easier-bg-b.jpg')}`; // Easier bg B (2000) .jpg from Media Assets/Easier Logo: Anthony's background for static images
const CLOUD = `data:image/png;base64,${asset('easier-cloud.png')}`; // Easier cloud logomark
const INK_BG = (w, h) => `background:linear-gradient(90deg,rgba(40,10,90,.45) 0%,rgba(40,10,90,.2) 55%,rgba(40,10,90,0) 100%),url(${INK}) center/cover;width:${w}px;height:${h}px`;
const FRAME_CSS = `*{box-sizing:border-box;margin:0}body{${INK_BG(1280, 800)};font-family:Poppins,system-ui,sans-serif;color:#fff;display:flex;align-items:center;gap:56px;padding:0 80px;position:relative}
.logo{position:absolute;left:80px;top:56px;display:flex;align-items:center;gap:14px;font-size:22px;font-weight:600}.logo img{width:52px;height:52px}
h1{font-size:48px;line-height:1.1;font-weight:600}p{font-size:22px;color:rgba(255,255,255,.85);margin-top:18px;line-height:1.5}
.card{border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);background:#fff}.card img{display:block;width:660px;height:auto}
body.wide{flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:28px;padding:130px 80px 0}.wide h1{font-size:42px}.wide p{font-size:20px;margin-top:10px}.wide .card img{width:1000px;height:490px;object-fit:cover;object-position:top left}`;

try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 20000 });
  const ext = swTarget.url().split('/').slice(0, 3).join('/');
  const sw = await swTarget.worker();
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2 && document.querySelector('audio').readyState >= 2);
  const tabId = await sw.evaluate(async (o) => (await chrome.tabs.query({ url: `${o}/*` }))[0].id, origin);

  const compose = async (name, headline, sub, imgBuf, wide = false) => {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 800 });
    await p.setContent(`<style>${FRAME_CSS}</style><body class="${wide ? 'wide' : ''}"><div class="logo"><img src="${CLOUD}">Easier Transcribe</div><div style="flex:1"><h1>${headline}</h1><p>${sub}</p></div><div class="card"><img src="data:image/png;base64,${imgBuf.toString('base64')}"></div></body>`);
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
  const workingShot = await results.screenshot();
  await finished('Podcast');
  await pick('Club meeting');
  await finished('Club meeting');

  const select = (t) => results.evaluate((x) => { [...document.querySelectorAll('.row')].find((r) => r.textContent.includes(x)).click(); }, t);
  await select('Garden tour');
  await sleep(500);
  const transcriptShot = await results.screenshot();
  await results.click('[data-format="srt"]');
  await sleep(400);
  const srtShot = await results.screenshot();
  await results.click('[data-format="text"]');
  await select('Podcast');
  await sleep(400);
  const historyShot = await results.screenshot();
  await compose('2-transcript.png', 'Your transcript, in its own tab.', 'YouTube captions arrive in 1 to 2 seconds. Other files are transcribed on your device.', transcriptShot, true);
  await compose('3-export-srt.png', 'Copy it. Or save it as SRT, VTT or text.', 'Subtitles with times, ready for any video editor.', srtShot, true);
  await compose('4-working.png', 'Long files? Watch it work.', 'The text fills in as it goes. Nothing is uploaded.', workingShot, true);
  await compose('5-saved-history.png', 'Saved on this computer.', 'Close the tab. Refresh. Your transcripts are still there.', historyShot, true);

  // Tiles: small 440x280 and marquee 1400x560.
  const makeTile = async (name, w, h, big) => {
    const t = await browser.newPage();
    await t.setViewport({ width: w, height: h });
    await t.setContent(`<style>*{margin:0;box-sizing:border-box}body{${INK_BG(w, h)};font-family:Poppins,system-ui,sans-serif;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 ${big ? 110 : 36}px}
img{width:${big ? 120 : 64}px;height:${big ? 120 : 64}px;margin-bottom:${big ? 28 : 16}px}h1{font-size:${big ? 76 : 34}px;line-height:1.1;font-weight:600}p{font-size:${big ? 32 : 18}px;margin-top:${big ? 16 : 10}px;opacity:.92}</style>
<img src="${CLOUD}"><h1>Easier Transcribe</h1><p>Free transcripts. On your device.</p>`);
    await t.screenshot({ path: join(out, name) });
    await t.close();
  };
  await makeTile('promo-tile-440x280.png', 440, 280, false);
  await makeTile('marquee-1400x560.png', 1400, 560, true);
  console.log('done', out);
} finally {
  await browser.close();
  server.close();
}
