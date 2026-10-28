/**
 * Service worker. Its only jobs:
 *   - take a "transcribe this" request from the popup,
 *   - put it in a queue that survives restarts,
 *   - open (or bring forward) the one results tab, which does the real work.
 * Whisper cannot run here: a service worker is stopped after seconds. The
 * results tab is a normal page, so it keeps running until it is closed.
 */

const RESULTS = 'results.html';

async function findResultsTab() {
  const tabs = await chrome.tabs.query({ url: `${chrome.runtime.getURL(RESULTS)}*` });
  return tabs[0] || null;
}

async function openResults(hash = '') {
  const existing = await findResultsTab();
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return existing.id;
  }
  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL(RESULTS) + hash });
  return tab.id;
}

// One writer at a time, so two quick presses never lose a job.
let chain = Promise.resolve();
function enqueue(job) {
  chain = chain.then(async () => {
    const { queue = [] } = await chrome.storage.local.get('queue');
    queue.push(job);
    await chrome.storage.local.set({ queue });
  });
  return chain;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'easier:transcribe') {
    enqueue(message.job)
      .then(() => openResults(`#${message.job.id}`))
      .then(() => respond({ ok: true }))
      .catch((error) => respond({ ok: false, message: error.message }));
    return true;
  }
  if (message?.type === 'easier:open-results') {
    openResults(message.id ? `#${message.id}` : '')
      .then(() => respond({ ok: true }))
      .catch((error) => respond({ ok: false, message: error.message }));
    return true;
  }
  return false;
});
