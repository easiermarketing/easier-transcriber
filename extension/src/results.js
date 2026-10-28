import { formatMinutes } from '@local/blocks.js';
import { FORMAT_EXTENSIONS, formatTranscript } from '@local/formats.js';
import { getAccurate, setAccurate } from '@app/lib/modelChoice.js';
import { clearRecords, deleteRecord, keepStorage, listRecords, saveRecord } from './lib/db.js';
import { createRunner } from './lib/runner.js';

globalThis.EASIER_FFMPEG_BASE = chrome.runtime.getURL('ffmpeg');

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const FORMATS = [
  ['text', 'Text'],
  ['timestamped', 'With times'],
  ['srt', 'SRT'],
  ['vtt', 'VTT'],
];
const METHODS = {
  'youtube-captions': 'YouTube captions',
  'youtube-auto-captions': 'YouTube auto captions',
  whisper: 'Whisper on this device',
};

const records = new Map();
let selectedId = null;
let format = 'text';
let query = '';

const runner = createRunner({
  onChange(record) {
    records.set(record.id, record);
    schedule();
  },
});

// ---- drawing ----

let frame = 0;
function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    renderList();
    renderMain();
  });
}

function clock(seconds) {
  const s = Math.round(seconds || 0);
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function statusBadge(r) {
  if (r.status === 'done') return '';
  const label = { queued: 'Waiting', working: 'Working', error: 'Needs you', interrupted: 'Stopped' }[r.status] || r.status;
  const tone = r.status === 'working' || r.status === 'queued' ? '' : r.status === 'error' ? 'bad' : 'warn';
  return `<span class="badge ${tone}">${label}</span>`;
}

function thumbHtml(r, cls = '') {
  return r.thumb ? `<img class="thumb ${cls}" src="${esc(r.thumb)}" alt="" referrerpolicy="no-referrer" />` : `<span class="thumb ${cls}">${r.kind === 'audio' ? 'Audio' : 'Video'}</span>`;
}

function renderList() {
  const q = query.trim().toLowerCase();
  const all = [...records.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const shown = q ? all.filter((r) => `${r.title} ${r.source}`.toLowerCase().includes(q)) : all;
  $('history').innerHTML = shown.length
    ? shown
        .map(
          (r) => `<li><button class="row" data-id="${esc(r.id)}" aria-current="${r.id === selectedId}">
            ${thumbHtml(r)}
            <span class="t"><b>${esc(r.title)}</b>
            <small>${statusBadge(r) || `${esc(METHODS[r.method] || '')}${r.duration ? ` · ${clock(r.duration)}` : ''}`}</small></span>
          </button></li>`
        )
        .join('')
    : `<li class="empty">${q ? 'No match.' : 'Nothing yet. Press the toolbar button on a page with a video.'}</li>`;
}

function renderMain() {
  const r = records.get(selectedId);
  const main = $('main');
  if (!r) {
    main.innerHTML = `<div class="empty-state"><h2>Your transcripts live here</h2>
      <p>Go to a page with a video or audio, press the Easier Transcribe button in the toolbar and pick one.<br />Everything you transcribe is saved on this device.</p></div>`;
    return;
  }

  // Keep the transcript box (and its scroll) when only progress changes.
  const busy = r.status === 'working' || r.status === 'queued';
  const existing = main.querySelector(`[data-detail="${CSS.escape(r.id)}"]`);
  const text = formatTranscript({ segments: r.segments || [] }, format, { maxChars: 42 });
  const mono = format !== 'text';

  const status = busy
    ? `<div class="card status"><div class="stage">${esc(r.stage || 'Working')}</div>
        <div class="bar"><i style="width:${Math.round(((r.stage || '').startsWith('Getting Whisper') ? r.modelProgress || 0 : r.progress || 0) * 100)}%"></i></div>
        <div class="sub">${r.progress > 0 && r.eta ? `About ${formatMinutes(r.eta)} left. ` : ''}Keep this tab open. You can switch to other tabs.</div>
        <div class="actions"><button class="btn" data-act="stop">Stop</button></div></div>`
    : r.status === 'error' || r.status === 'interrupted'
      ? `<div class="card status err"><div class="stage">${r.status === 'interrupted' ? 'This one was stopped.' : 'This one did not finish.'}</div>
          <div>${esc(r.error || '')}</div>
          <div class="actions">${r.errorKind === 'access' ? '<button class="btn primary" data-act="allow">Allow and try again</button>' : ''}
          <button class="btn ${r.errorKind === 'access' ? '' : 'primary'}" data-act="resume">Try again</button></div></div>`
      : '';

  const head = `${thumbHtml(r)}<div>
      <h2>${esc(r.title)}</h2>
      <div class="meta">${statusBadge(r)}${r.method ? `<span class="badge ${r.method === 'whisper' ? '' : 'ok'}">${esc(METHODS[r.method] || r.method)}</span>` : ''}
        ${r.duration ? `<span>${clock(r.duration)}</span>` : ''}<span>${new Date(r.createdAt).toLocaleString()}</span>
        ${/^https?:/.test(r.source || '') ? `<a href="${esc(r.source)}" target="_blank" rel="noreferrer">${esc(r.source.length > 70 ? r.source.slice(0, 70) + '...' : r.source)}</a>` : ''}</div>
    </div>`;

  if (!existing) {
    main.innerHTML = `<div data-detail="${esc(r.id)}"><div class="head" id="head"></div><div id="status"></div>
    <div class="card"><div class="tools">
      <div class="tabs" role="tablist">${FORMATS.map(([k, label]) => `<button role="tab" data-format="${k}">${label}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="btn" data-act="copy">Copy</button>
      <button class="btn primary" data-act="download">Download</button>
      <button class="btn" data-act="delete">Delete</button>
    </div><div id="text" class="transcript"></div></div></div>`;
  }
  main.querySelector('#head').innerHTML = head;
  main.querySelector('#status').innerHTML = status;
  main.querySelectorAll('[data-format]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.format === format)));
  const box = main.querySelector('#text');
  const stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
  box.className = `transcript ${mono ? 'mono' : ''}`;
  if (box.textContent !== text) box.textContent = text;
  if (busy && stick) box.scrollTop = box.scrollHeight;
}

function toast(message) {
  const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: message });
  document.body.append(el);
  setTimeout(() => el.remove(), 1800);
}

function select(id) {
  selectedId = id;
  history.replaceState(null, '', id ? `#${id}` : location.pathname);
  main().innerHTML = '';
  schedule();
}
const main = () => $('main');

// ---- actions ----

function safeName(title) {
  return (title || 'transcript').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'transcript';
}

async function resume(r) {
  r.segments = [];
  runner.enqueue(r);
}

document.addEventListener('click', async (event) => {
  const row = event.target.closest('.row');
  if (row) return select(row.dataset.id);
  const tab = event.target.closest('[data-format]');
  if (tab) {
    format = tab.dataset.format;
    return schedule();
  }
  const act = event.target.closest('[data-act]')?.dataset.act;
  const r = records.get(selectedId);
  if (!act || !r) return;

  const text = formatTranscript({ segments: r.segments || [] }, format, { maxChars: 42 });
  if (act === 'copy') {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } else if (act === 'download') {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: safeName(r.title) + FORMAT_EXTENSIONS[format] });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (act === 'delete') {
    if (!confirm('Delete this transcript from this device?')) return;
    runner.cancel(r.id);
    records.delete(r.id);
    await deleteRecord(r.id);
    select([...records.keys()][0] || null);
  } else if (act === 'stop') {
    runner.cancel(r.id);
  } else if (act === 'resume') {
    resume(r);
  } else if (act === 'allow') {
    const granted = await chrome.permissions.request({ origins: [r.accessPattern] });
    if (granted) resume(r);
  }
});

$('search').addEventListener('input', (e) => {
  query = e.target.value;
  renderList();
});

$('clear').addEventListener('click', async () => {
  if (!records.size || !confirm('Delete every saved transcript from this device?')) return;
  for (const id of records.keys()) runner.cancel(id);
  records.clear();
  await clearRecords();
  select(null);
});

$('accurate').checked = getAccurate();
$('accurate').addEventListener('change', (e) => {
  setAccurate(e.target.checked);
  toast(e.target.checked ? 'The next job uses the larger model' : 'The next job uses the small model');
});

// ---- starting jobs ----

function startJob(job) {
  if (records.has(job.id)) return;
  const item = { ...job.item, tabId: job.tabId, frameId: job.frameId };
  const record = {
    id: job.id,
    key: item.id,
    title: item.title || 'Untitled',
    thumb: item.thumb || '',
    kind: item.kind,
    source: item.ytId ? `https://www.youtube.com/watch?v=${item.ytId}` : item.src || job.pageUrl || '',
    item,
    createdAt: job.createdAt || Date.now(),
    status: 'queued',
    segments: [],
  };
  records.set(record.id, record);
  select(record.id);
  runner.enqueue(record);
}

async function takeQueue() {
  const { queue = [] } = await chrome.storage.local.get('queue');
  if (!queue.length) return;
  await chrome.storage.local.set({ queue: [] });
  queue.forEach(startJob);
  const last = queue.at(-1);
  if (last) select(last.id);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.queue?.newValue?.length) takeQueue();
});

// ---- boot ----

(async () => {
  keepStorage();
  for (const r of await listRecords()) {
    // Left "working" by a closed or refreshed tab: the text so far is kept.
    if (r.status === 'working' || r.status === 'queued') {
      r.status = 'interrupted';
      r.stage = '';
      r.error = 'This tab was closed or refreshed while it was working. The text so far is kept. Try again to start over.';
      await saveRecord(r);
    }
    records.set(r.id, r);
  }
  const wanted = decodeURIComponent(location.hash.slice(1));
  selectedId = records.has(wanted) ? wanted : [...records.values()].sort((a, b) => b.createdAt - a.createdAt)[0]?.id || null;
  schedule();
  await takeQueue();
})();

// Exposed for the automated check only.
globalThis.__easier = { records, runner };
