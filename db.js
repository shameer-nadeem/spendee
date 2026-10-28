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
