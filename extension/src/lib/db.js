/**
 * The saved history, in IndexedDB. It lives in the extension's own storage,
 * so it survives refresh, closing the tab and restarting the browser.
 * Nothing in it leaves the device.
 */

const NAME = 'easier-transcribe';
const STORE = 'transcripts';

let opened;

function open() {
  opened ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}

async function run(mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const saveRecord = (record) => run('readwrite', (s) => s.put({ ...record, updatedAt: Date.now() }));
export const getRecord = (id) => run('readonly', (s) => s.get(id));
export const deleteRecord = (id) => run('readwrite', (s) => s.delete(id));
export const clearRecords = () => run('readwrite', (s) => s.clear());

export async function listRecords() {
  const all = await run('readonly', (s) => s.getAll());
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** Ask the browser not to evict our storage under disk pressure. */
export function keepStorage() {
  try {
    return navigator.storage?.persist?.();
  } catch {
    return undefined;
  }
}
