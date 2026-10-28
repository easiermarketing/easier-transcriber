import { listRecords } from './lib/db.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const params = new URLSearchParams(location.search);
const ALL_SITES = ['https://*/*', 'http://*/*'];
const KINDS = { youtube: 'YouTube', video: 'Video', audio: 'Audio' };

const clock = (s) => {
  s = Math.round(s || 0);
  if (!s) return '';
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

async function activeTab() {
  if (params.get('tab')) return chrome.tabs.get(Number(params.get('tab'))); // for automated checks
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function scan(tabId) {
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
  const frames = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: () => globalThis.__easierScan?.() ?? null });
  return frames.filter((f) => f.result).map((f) => ({ frameId: f.frameId, ...f.result }));
}

function merge(frames) {
  const byId = new Map();
  for (const frame of frames) {
    for (const item of frame.items) {
      const known = byId.get(item.id);
      // The frame that really plays it knows best; a link or embed is the weaker sighting.
      if (!known || ((known.linked || known.embed) && !(item.linked || item.embed))) {
        const generic = !item.title || /^(YouTube|YouTube video)$/i.test(item.title);
        byId.set(item.id, { ...item, title: generic && known?.title ? known.title : item.title, frameId: frame.frameId, pageUrl: frame.url });
      }
    }
  }
  const rank = (i) => (i.playing ? 0 : 1) * 10 + (i.current ? 0 : 1) * 5 + (i.linked ? 2 : 0) + (i.embed ? 1 : 0);
  return [...byId.values()].sort((a, b) => rank(a) - rank(b));
}

function row(item, done) {
  const meta = [KINDS[item.kind], item.author || item.host, clock(item.duration), item.playing ? 'Playing now' : ''].filter(Boolean).join(' · ');
  const thumb = item.thumb
    ? `<img class="thumb" src="${esc(item.thumb)}" alt="" referrerpolicy="no-referrer" />`
    : `<span class="thumb">${item.kind === 'audio' ? 'Audio' : 'Video'}</span>`;
  const button = done
    ? `<button class="btn primary" data-open="${esc(done.id)}">Open</button>`
    : `<button class="btn primary" data-pick="${esc(item.id)}">Transcribe</button>`;
  return `<li class="item ${item.playing ? 'now' : ''}">${thumb}<div class="info"><b>${esc(item.title)}</b><small>${esc(meta)}${done ? ' · Saved' : ''}</small></div>${button}</li>`;
}

let tab;
let items = [];
let frameCount = 0;

async function render() {
  const records = await listRecords().catch(() => []);
  const doneByKey = new Map(records.filter((r) => r.status === 'done').map((r) => [r.key, r]));
  $('list').innerHTML = items.map((i) => row(i, doneByKey.get(i.id))).join('');

  const recent = records.filter((r) => r.status === 'done').slice(0, items.length ? 2 : 4);
  if (recent.length) {
    $('list').insertAdjacentHTML(
      'beforeend',
      `<li class="recent-title">Saved transcripts</li>` +
        recent.map((r) => row({ id: r.key, kind: r.kind, title: r.title, thumb: r.thumb, duration: r.duration, host: '' }, r)).join('')
    );
  }
}

async function main() {
  $('history').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'easier:open-results' }).then(() => window.close()));

  try {
    tab = await activeTab();
    const frames = await scan(tab.id);
    items = merge(frames);
    frameCount = frames.length;
    const foreign = frames.find((f) => f.top)?.foreign || 0;
    if (foreign && !(await chrome.permissions.contains({ origins: ALL_SITES }))) {
      $('more').hidden = false;
      $('more').innerHTML = `This page has ${foreign} player${foreign > 1 ? 's' : ''} from other sites that may hide a video.<br />
        <button class="btn" id="look">Look inside them</button>`;
      $('look').addEventListener('click', async () => {
        if (await chrome.permissions.request({ origins: ALL_SITES })) location.reload();
      });
    }
    $('note').textContent = items.length
      ? `Found ${items.length} on this page. ${items.some((i) => i.playing) ? 'The one playing is first.' : ''}`
      : 'No video or audio found on this page.';
  } catch {
    $('note').textContent = "This page can't be scanned. Open a page with a video and press the button again.";
  }
  await render();

  document.addEventListener('click', async (event) => {
    const open = event.target.closest('[data-open]')?.dataset.open;
    if (open) {
      await chrome.runtime.sendMessage({ type: 'easier:open-results', id: open });
      return window.close();
    }
    const pick = event.target.closest('[data-pick]')?.dataset.pick;
    if (!pick) return;
    const item = items.find((i) => i.id === pick);
    event.target.disabled = true;
    event.target.textContent = 'Opening...';
    await chrome.runtime.sendMessage({
      type: 'easier:transcribe',
      job: { id: crypto.randomUUID(), item, tabId: tab.id, frameId: item.frameId, pageUrl: item.pageUrl, createdAt: Date.now() },
    });
    window.close();
  });
}

main();
