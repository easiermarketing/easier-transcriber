// Visits real pages with the test build (all-sites access stands in for the activeTab grant a real click gives),
// opens the popup bound to that tab, picks a video and waits for the transcript, then refreshes the results tab.
//   node extension/test/real-sites.mjs <url> [titleSubstring]   (needs EXT_TEST=1 EXT_TEST_HOSTS='https://*/*,http://*/*' build)
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist-test');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [url, want] = [process.argv[2], process.argv[3]];
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true, userDataDir: mkdtempSync(join(tmpdir(), 'easier-site-')), enableExtensions: [dist], args: ['--no-sandbox', '--lang=en-US', '--autoplay-policy=no-user-gesture-required'] });
try {
  const swT = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 20000 });
  const ext = swT.url().split('/').slice(0, 3).join('/');
  const sw = await swT.worker();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => console.log('goto:', e.message));
  await sleep(7000);
  const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url?.startsWith(u.slice(0, 25)))?.id, url);
  const popup = await browser.newPage();
  await popup.goto(`${ext}/popup.html?tab=${tabId}`);
  await popup.waitForSelector('.item, .note', { timeout: 20000 });
  await sleep(2500);
  console.log('note:', await popup.$eval('#note', (e) => e.textContent));
  const rows = await popup.$$eval('.item', (els) => els.map((e) => `${e.querySelector('b').textContent} | ${e.querySelector('small').textContent}`));
  console.log('rows:', rows.slice(0, 8));
  if (!rows.length) process.exit(0);
  const resultsP = browser.waitForTarget((t) => t.url().startsWith(`${ext}/results.html`), { timeout: 20000 });
  await popup.evaluate((w) => { const li = [...document.querySelectorAll('.item')].find((e) => !w || e.textContent.includes(w)) || document.querySelector('.item'); li.querySelector('[data-pick]').click(); }, want || '');
  const results = await (await resultsP).asPage();
  await results.waitForFunction(() => [...(globalThis.__easier?.records?.values() ?? [])].some((r) => r.status === 'done' || r.status === 'error'), { timeout: 240000, polling: 1000 }).catch(() => console.log('timeout waiting'));
  const rec = await results.evaluate(() => { const r = [...globalThis.__easier.records.values()][0]; return { title: r.title, status: r.status, method: r.method, error: r.error, errorKind: r.errorKind, segs: r.segments.length, text: r.segments.slice(0, 3).map((s) => s.text).join(' ').slice(0, 140) }; });
  console.log('result:', JSON.stringify(rec));
  await results.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.bringToFront(); await sleep(500); await results.bringToFront();
  console.log('after refresh and click away, saved:', await results.evaluate(() => [...globalThis.__easier.records.values()].map((r) => `${r.status}:${r.title.slice(0, 30)}`)));
} finally { await browser.close(); }
