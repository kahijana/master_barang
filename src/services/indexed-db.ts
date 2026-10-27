/**
 * Lightweight Promise-based IndexedDB Key-Value Store
 * Handles large datasets (products, purchases, opname items, images)
 * without hitting the strict 5MB browser localStorage quota.
 */

const DB_NAME = 'master_barang_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryFallback = new Map<string, unknown>();

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function getDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          db.onversionchange = () => {
            db.close();
            dbPromise = null;
          };
          resolve(db);
        };

        request.onerror = (event) => {
          console.warn('[IndexedDB] Failed to open database:', (event.target as IDBOpenDBRequest).error);
          dbPromise = null;
          reject((event.target as IDBOpenDBRequest).error);
        };

        request.onblocked = () => {
          console.warn('[IndexedDB] Database open blocked');
        };
      } catch (err) {
        dbPromise = null;
        reject(err);
      }
    });
  }

  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  if (!isIndexedDBAvailable()) {
    return (memoryFallback.get(key) as T) ?? null;
  }

  try {
    const db = await getDatabase();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result !== undefined ? (req.result as T) : null);
      };

      req.onerror = () => {
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Get failed for key "${key}", falling back:`, err);
    return (memoryFallback.get(key) as T) ?? null;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  memoryFallback.set(key, value);

  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await getDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Set failed for key "${key}":`, err);
  }
}

export async function idbDel(key: string): Promise<void> {
  memoryFallback.delete(key);

  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await getDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Delete failed for key "${key}":`, err);
  }
}

export async function idbKeys(): Promise<string[]> {
  if (!isIndexedDBAvailable()) {
    return Array.from(memoryFallback.keys());
  }

  try {
    const db = await getDatabase();
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();

      req.onsuccess = () => {
        const result = req.result as (string | number)[];
        resolve(result.map(String));
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Get keys failed:', err);
    return Array.from(memoryFallback.keys());
  }
}

export async function idbClear(): Promise<void> {
  memoryFallback.clear();

  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await getDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Clear failed:', err);
  }
}
