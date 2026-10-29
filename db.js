const NAME = 'spendee';
const VERSION = 1;
let conn;

function open() {
  if (conn) return conn;
  conn = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
      const splits = db.createObjectStore('splits', { keyPath: 'id', autoIncrement: true });
      splits.createIndex('txId', 'txId');
      db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return conn;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const add = (store, item) => run(store, 'readwrite', s => s.add(item));
export const update = (store, item) => run(store, 'readwrite', s => s.put(item));
export const remove = (store, id) => run(store, 'readwrite', s => s.delete(id));
export const list = store => run(store, 'readonly', s => s.getAll());
export const get = (store, id) => run(store, 'readonly', s => s.get(id));

export async function getSetting(key, fallback = null) {
  const row = await get('settings', key);
  return row ? row.value : fallback;
}

export const setSetting = (key, value) => update('settings', { key, value });

export async function readAll() {
  const [settings, transactions, splits] = await Promise.all([list('settings'), list('transactions'), list('splits')]);
  return { settings, transactions, splits };
}

export async function replaceAll(data) {
  const db = await open();
  const last = await get('settings', 'lastBackup');
  return new Promise((resolve, reject) => {
    const t = db.transaction(['transactions', 'splits', 'settings'], 'readwrite');
    ['transactions', 'splits', 'settings'].forEach(n => t.objectStore(n).clear());
    data.transactions.forEach(x => t.objectStore('transactions').put(x));
    data.splits.forEach(x => t.objectStore('splits').put(x));
    data.settings.forEach(x => t.objectStore('settings').put(x));
    if (last) t.objectStore('settings').put(last);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
