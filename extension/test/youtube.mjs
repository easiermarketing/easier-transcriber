// Live check against youtube.com: a watch page, the popup, and captions read through the page.
//   EXT_TEST=1 npm run build:extension && node extension/test/youtube.mjs [videoId]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist-test');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const id = process.argv[2] || 'dQw4w9WgXcQ';

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, enableExtensions: [dist], args: ['--no-sandbox', '--lang=en-US'] });
try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'));
  const ext = swTarget.url().split('/').slice(0, 3).join('/');
  const page = await browser.newPage();
  await page.goto(`https://www.youtube.com/watch?v=${id}`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 6000));
  console.log('page title:', await page.title());
  const sw = await swTarget.worker();
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'https://www.youtube.com/*' }))[0].id);
  const popup = await browser.newPage();
  await popup.goto(`${ext}/popup.html?tab=${tabId}`);
  await popup.waitForSelector('.item', { timeout: 15000 });
  console.log(await popup.$$eval('.item', (els) => els.slice(0, 5).map((e) => `${e.querySelector('b').textContent} | ${e.querySelector('small').textContent}`)));
  const resultsPromise = browser.waitForTarget((t) => t.url().startsWith(`${ext}/results.html`), { timeout: 20000 });
  await popup.evaluate(() => document.querySelector('[data-pick]').click());
  const results = await (await resultsPromise).asPage();
  await results.waitForFunction(() => {
    const r = [...globalThis.__easier.records.values()][0];
    return r && (r.status === 'done' || r.status === 'error');
  }, { timeout: 120000, polling: 500 });
  console.log(await results.evaluate(() => {
    const r = [...globalThis.__easier.records.values()][0];
    return { status: r.status, method: r.method, error: r.error, note: r.captionNote, segments: r.segments.length, first: r.segments.slice(0, 3).map((s) => s.text) };
  }));
} finally {
  await browser.close();
}
