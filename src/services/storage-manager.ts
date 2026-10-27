import {
  LaporanRow,
  OpnameItem,
  OpnameSession,
  Product,
  PurchaseDocument,
  PurchaseItem,
  StockTransaction,
  Store,
  SyncState,
} from '../types';
import { idbClear, idbDel, idbGet, idbKeys, idbSet } from './indexed-db';

const STORES_KEY = 'master_barang:stores';
const ACTIVE_STORE_ID_KEY = 'master_barang:active_store_id';

// In-memory caches for instant synchronous access across the application
const productsCache = new Map<string, Product[]>();
const opnameSessionsCache = new Map<string, OpnameSession[]>();
const opnameItemsCache = new Map<string, OpnameItem[]>();
const purchasesCache = new Map<string, PurchaseDocument[]>();
const purchaseItemsCache = new Map<string, PurchaseItem[]>();
const stockTransactionsCache = new Map<string, StockTransaction[]>();
const laporanCache = new Map<string, LaporanRow[]>();

/**
 * Helper to safely set items in localStorage without throwing QuotaExceededError.
 * If data is large (> 200KB) or localStorage is near quota, avoids storing in localStorage
 * and evicts large keys to keep localStorage clean for critical configs.
 */
function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    // If payload is larger than 200KB, avoid localStorage to preserve the 5MB browser quota
    if (value.length > 200_000) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
      return false;
    }
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[Storage] localStorage quota reached on "${key}". Storing in IndexedDB only.`);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    evictLargeLocalStorageItems();
    return false;
  }
}

/**
 * Clears large collections from localStorage when quota is tight.
 * Data remains completely safe in IndexedDB and in-memory caches.
 */
export function evictLargeLocalStorageItems(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.endsWith(':products') ||
          k.endsWith(':purchases') ||
          k.endsWith(':purchase_items') ||
          k.endsWith(':opname_items') ||
          k.endsWith(':laporan'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
  } catch (e) {
    console.warn('[Storage] Error during cache eviction:', e);
  }
}

/* ================== STORES & ACTIVE STORE ================== */
export function getStoredStores(): Store[] {
  try {
    const raw = localStorage.getItem(STORES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => ({
          ...s,
          autoSync: typeof s.autoSync === 'boolean' ? s.autoSync : false,
          autoSyncIntervalMinutes: s.autoSyncIntervalMinutes || 10,
        }));
      }
    }
  } catch (e) {
    console.error('Failed to load stores from storage', e);
  }
  return [];
}

export function saveStoredStores(stores: Store[]): void {
  try {
    safeLocalStorageSet(STORES_KEY, JSON.stringify(stores));
    idbSet(STORES_KEY, stores);
  } catch (e) {
    console.error('Failed to save stores to storage', e);
  }
}

export function getStoredActiveStoreId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_STORE_ID_KEY);
  } catch (e) {
    console.error('Failed to get active store ID', e);
    return null;
  }
}

export function saveStoredActiveStoreId(storeId: string): void {
  try {
    localStorage.setItem(ACTIVE_STORE_ID_KEY, storeId);
    idbSet(ACTIVE_STORE_ID_KEY, storeId);
  } catch (e) {
    console.error('Failed to save active store ID', e);
  }
}

/* ================== PRODUCTS (NAMESPACED PER STORE) ================== */
const productsKey = (storeId: string) => `master_barang:${storeId}:products`;

export function getStoreProducts(storeId: string): Product[] {
  if (!storeId) return [];

  // 1. Fast in-memory hit
  if (productsCache.has(storeId)) {
    return productsCache.get(storeId)!;
  }

  // 2. Fallback to localStorage for cold boot
  try {
    const raw = localStorage.getItem(productsKey(storeId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((p) => p.store_id === storeId);
        productsCache.set(storeId, filtered);
        // Sync to IndexedDB in background
        idbSet(productsKey(storeId), filtered);
        return filtered;
      }
    }
  } catch (e) {
    console.warn(`Failed to read products from localStorage for store ${storeId}`, e);
  }

  // Trigger background load from IndexedDB
  loadStoreProductsAsync(storeId).catch(() => {});
  return [];
}

export async function loadStoreProductsAsync(storeId: string): Promise<Product[]> {
  if (!storeId) return [];

  // Check IDB first
  const fromDb = await idbGet<Product[]>(productsKey(storeId));
  if (fromDb && Array.isArray(fromDb)) {
    const filtered = fromDb.filter((p) => p.store_id === storeId);
    productsCache.set(storeId, filtered);
    return filtered;
  }

  // Fallback to memory or localStorage
  return getStoreProducts(storeId);
}

export function saveStoreProducts(storeId: string, products: Product[]): void {
  if (!storeId) return;

  // 1. Update in-memory cache immediately (instant sync access)
  productsCache.set(storeId, products);

  // 2. Persist to IndexedDB (virtually unlimited quota)
  idbSet(productsKey(storeId), products).catch((err) => {
    console.warn(`[Storage] Failed to save products to IndexedDB for store ${storeId}:`, err);
  });

  // 3. Conditionally mirror small data to localStorage, or safely evict without quota error
  try {
    const json = JSON.stringify(products);
    safeLocalStorageSet(productsKey(storeId), json);
  } catch (e) {
    console.warn(`[Storage] Skipping localStorage product cache for store ${storeId}:`, e);
  }
}

export async function saveStoreProductsAsync(storeId: string, products: Product[]): Promise<void> {
  saveStoreProducts(storeId, products);
  await idbSet(productsKey(storeId), products);
}

/* ================== OPNAME SESSIONS & ITEMS ================== */
const opnameKey = (storeId: string) => `master_barang:${storeId}:opname`;
const opnameItemsKey = (storeId: string) => `master_barang:${storeId}:opname_items`;

export function getStoreOpnameSessions(storeId: string): OpnameSession[] {
  if (!storeId) return [];
  if (opnameSessionsCache.has(storeId)) {
    return opnameSessionsCache.get(storeId)!;
  }

  try {
    const raw = localStorage.getItem(opnameKey(storeId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((s) => s.store_id === storeId);
        opnameSessionsCache.set(storeId, filtered);
        idbSet(opnameKey(storeId), filtered);
        return filtered;
      }
    }
  } catch (e) {
    console.warn(`Failed to read opname sessions for store ${storeId}`, e);
  }

  loadStoreOpnameSessionsAsync(storeId).catch(() => {});
  return [];
}

export async function loadStoreOpnameSessionsAsync(storeId: string): Promise<OpnameSession[]> {
  if (!storeId) return [];
  const fromDb = await idbGet<OpnameSession[]>(opnameKey(storeId));
  if (fromDb && Array.isArray(fromDb)) {
    const filtered = fromDb.filter((s) => s.store_id === storeId);
    opnameSessionsCache.set(storeId, filtered);
    return filtered;
  }
  return getStoreOpnameSessions(storeId);
}

export function saveStoreOpnameSessions(storeId: string, sessions: OpnameSession[]): void {
  if (!storeId) return;
  opnameSessionsCache.set(storeId, sessions);
  idbSet(opnameKey(storeId), sessions);
  safeLocalStorageSet(opnameKey(storeId), JSON.stringify(sessions));
}

export function getStoreOpnameItems(storeId: string, opnameId?: string): OpnameItem[] {
  if (!storeId) return [];
  let list = opnameItemsCache.get(storeId);

  if (!list) {
    try {
      const raw = localStorage.getItem(opnameItemsKey(storeId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter((item) => item.store_id === storeId);
          opnameItemsCache.set(storeId, list);
          idbSet(opnameItemsKey(storeId), list);
        }
      }
    } catch (e) {
      console.warn(`Failed to read opname items for store ${storeId}`, e);
    }
  }

  if (!list) {
    loadStoreOpnameItemsAsync(storeId).catch(() => {});
    return [];
  }

  return opnameId ? list.filter((item) => item.opname_id === opnameId) : list;
}

export async function loadStoreOpnameItemsAsync(storeId: string): Promise<OpnameItem[]> {
  if (!storeId) return [];
  const fromDb = await idbGet<OpnameItem[]>(opnameItemsKey(storeId));
  if (fromDb && Array.isArray(fromDb)) {
    const filtered = fromDb.filter((it) => it.store_id === storeId);
    opnameItemsCache.set(storeId, filtered);
    return filtered;
  }
  return getStoreOpnameItems(storeId);
}

export function saveStoreOpnameItems(storeId: string, items: OpnameItem[]): void {
  if (!storeId) return;
  opnameItemsCache.set(storeId, items);
  idbSet(opnameItemsKey(storeId), items);
  safeLocalStorageSet(opnameItemsKey(storeId), JSON.stringify(items));
}

/* ================== PURCHASES & PURCHASE ITEMS ================== */
const purchasesKey = (storeId: string) => `master_barang:${storeId}:purchases`;
const purchaseItemsKey = (storeId: string) => `master_barang:${storeId}:purchase_items`;

export function getStorePurchases(storeId: string): PurchaseDocument[] {
  if (!storeId) return [];
  if (purchasesCache.has(storeId)) {
    return purchasesCache.get(storeId)!;
  }

  try {
    const raw = localStorage.getItem(purchasesKey(storeId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((p) => p.store_id === storeId);
        purchasesCache.set(storeId, filtered);
        idbSet(purchasesKey(storeId), filtered);
        return filtered;
      }
    }
  } catch (e) {
    console.warn(`Failed to read purchases for store ${storeId}`, e);
  }

  loadStorePurchasesAsync(storeId).catch(() => {});
  return [];
}

export async function loadStorePurchasesAsync(storeId: string): Promise<PurchaseDocument[]> {
  if (!storeId) return [];
  const fromDb = await idbGet<PurchaseDocument[]>(purchasesKey(storeId));
  if (fromDb && Array.isArray(fromDb)) {
    const filtered = fromDb.filter((p) => p.store_id === storeId);
    purchasesCache.set(storeId, filtered);
    return filtered;
  }
  return getStorePurchases(storeId);
}

export function saveStorePurchases(storeId: string, purchases: PurchaseDocument[]): void {
  if (!storeId) return;
  purchasesCache.set(storeId, purchases);
  idbSet(purchasesKey(storeId), purchases);
  // Purchases often include base64 invoice photos, so safely handle localStorage
  safeLocalStorageSet(purchasesKey(storeId), JSON.stringify(purchases));
}

export function getStorePurchaseItems(storeId: string, purchaseId?: string): PurchaseItem[] {
  if (!storeId) return [];
  let list = purchaseItemsCache.get(storeId);

  if (!list) {
    try {
      const raw = localStorage.getItem(purchaseItemsKey(storeId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter((item) => item.store_id === storeId);
          purchaseItemsCache.set(storeId, list);
          idbSet(purchaseItemsKey(storeId), list);
        }
      }
    } catch (e) {
      console.warn(`Failed to read purchase items for store ${storeId}`, e);
    }
  }

  if (!list) {
    loadStorePurchaseItemsAsync(storeId).catch(() => {});
    return [];
  }

  return purchaseId ? list.filter((item) => item.purchase_id === purchaseId) : list;
}

export async function loadStorePurchaseItemsAsync(storeId: string): Promise<PurchaseItem[]> {
  if (!storeId) return [];
  const fromDb = await idbGet<PurchaseItem[]>(purchaseItemsKey(storeId));
  if (fromDb && Array.isArray(fromDb)) {
    const filtered = fromDb.filter((it) => it.store_id === storeId);
    purchaseItemsCache.set(storeId, filtered);
    return filtered;
  }
  return getStorePurchaseItems(storeId);
}

export function saveStorePurchaseItems(storeId: string, items: PurchaseItem[]): void {
  if (!storeId) return;
  purchaseItemsCache.set(storeId, items);
  idbSet(purchaseItemsKey(storeId), items);
  safeLocalStorageSet(purchaseItemsKey(storeId), JSON.stringify(items));
}

/* ================== STOCK TRANSACTIONS / AUDIT ================== */
const stockTransKey = (storeId: string) => `master_barang:${storeId}:stock_transactions`;

export function getStoreStockTransactions(storeId: string): StockTransaction[] {
  if (!storeId) return [];
  if (stockTransactionsCache.has(storeId)) {
    return stockTransactionsCache.get(storeId)!;
  }

  try {
    const raw = localStorage.getItem(stockTransKey(storeId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((t) => t.store_id === storeId);
        stockTransactionsCache.set(storeId, filtered);
        idbSet(stockTransKey(storeId), filtered);
        return filtered;
      }
    }
  } catch (e) {
    console.warn(`Failed to read stock transactions for store ${storeId}`, e);
  }

  loadStoreStockTransactionsAsync(storeId).catch(() => {});
  return [];
}

export async function loadStoreStockTransactionsAsync(storeId: string): Promise<StockTransaction[]> {
  if (!storeId) return [];
  const fromDb = await idbGet<StockTransaction[]>(stockTransKey(storeId));
  if (fromDb && Array.isArray(fromDb)) {
    const filtered = fromDb.filter((t) => t.store_id === storeId);
    stockTransactionsCache.set(storeId, filtered);
    return filtered;
  }
  return getStoreStockTransactions(storeId);
}

export function saveStoreStockTransactions(storeId: string, transactions: StockTransaction[]): void {
  if (!storeId) return;
  stockTransactionsCache.set(storeId, transactions);
  idbSet(stockTransKey(storeId), transactions);
  safeLocalStorageSet(stockTransKey(storeId), JSON.stringify(transactions));
}

/* ================== SYNC METADATA ================== */
export interface StoreSyncMeta {
  loaded: boolean;
  dirty: boolean;
  lastPull: string;
  lastPush: string;
  msg: string;
  state: SyncState;
}

const syncKey = (storeId: string) => `master_barang:${storeId}:sync`;

export function getStoreSyncMeta(storeId: string): StoreSyncMeta {
  if (!storeId) {
    return { loaded: false, dirty: false, lastPull: '', lastPush: '', msg: '', state: 'off' };
  }
  try {
    const raw = localStorage.getItem(syncKey(storeId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        loaded: Boolean(parsed.loaded),
        dirty: Boolean(parsed.dirty),
        lastPull: parsed.lastPull || (parsed.last ? parsed.last : ''),
        lastPush: parsed.lastPush || (parsed.last ? parsed.last : ''),
        msg: parsed.msg || '',
        state: parsed.state || 'off',
      };
    }
  } catch (e) {
    console.warn(`Failed to load sync meta for store ${storeId}`, e);
  }
  return { loaded: false, dirty: false, lastPull: '', lastPush: '', msg: '', state: 'off' };
}

export function saveStoreSyncMeta(storeId: string, meta: StoreSyncMeta): void {
  if (!storeId) return;
  try {
    safeLocalStorageSet(syncKey(storeId), JSON.stringify(meta));
    idbSet(syncKey(storeId), meta);
  } catch (e) {
    console.warn(`Failed to save sync meta for store ${storeId}`, e);
  }
}

/* ================== LAPORAN TRANSAKSI ================== */
const laporanKey = (storeId: string) => `master_barang:${storeId}:laporan`;

export function getStoreLaporanRows(storeId: string): LaporanRow[] {
  if (!storeId) return [];
  if (laporanCache.has(storeId)) {
    return laporanCache.get(storeId)!;
  }

  try {
    const raw = localStorage.getItem(laporanKey(storeId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        laporanCache.set(storeId, parsed);
        idbSet(laporanKey(storeId), parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`Failed to load laporan rows for store ${storeId}`, e);
  }

  loadStoreLaporanRowsAsync(storeId).catch(() => {});
  return [];
}

export async function loadStoreLaporanRowsAsync(storeId: string): Promise<LaporanRow[]> {
  if (!storeId) return [];
  const fromDb = await idbGet<LaporanRow[]>(laporanKey(storeId));
  if (fromDb && Array.isArray(fromDb)) {
    laporanCache.set(storeId, fromDb);
    return fromDb;
  }
  return getStoreLaporanRows(storeId);
}

export function saveStoreLaporanRows(storeId: string, rows: LaporanRow[]): void {
  if (!storeId) return;
  laporanCache.set(storeId, rows);
  idbSet(laporanKey(storeId), rows);
  safeLocalStorageSet(laporanKey(storeId), JSON.stringify(rows));
}

/**
 * Hydrates all data for a store from IndexedDB into memory.
 * Useful during initial mount or store switching.
 */
export async function hydrateStoreDataFromIDB(storeId: string): Promise<{
  products: Product[];
  purchases: PurchaseDocument[];
  laporan: LaporanRow[];
}> {
  if (!storeId) {
    return { products: [], purchases: [], laporan: [] };
  }

  const [products, purchases, laporan] = await Promise.all([
    loadStoreProductsAsync(storeId),
    loadStorePurchasesAsync(storeId),
    loadStoreLaporanRowsAsync(storeId),
  ]);

  return { products, purchases, laporan };
}

// Delete all storage data for a specific store (both localStorage and IndexedDB)
export function deleteStoreStorage(storeId: string): void {
  if (!storeId) return;

  // 1. Clear in-memory caches
  productsCache.delete(storeId);
  opnameSessionsCache.delete(storeId);
  opnameItemsCache.delete(storeId);
  purchasesCache.delete(storeId);
  purchaseItemsCache.delete(storeId);
  stockTransactionsCache.delete(storeId);
  laporanCache.delete(storeId);

  // 2. Clear localStorage keys
  try {
    localStorage.removeItem(`master_barang:${storeId}:products`);
    localStorage.removeItem(`master_barang:${storeId}:opname`);
    localStorage.removeItem(`master_barang:${storeId}:opname_items`);
    localStorage.removeItem(`master_barang:${storeId}:purchases`);
    localStorage.removeItem(`master_barang:${storeId}:purchase_items`);
    localStorage.removeItem(`master_barang:${storeId}:stock_transactions`);
    localStorage.removeItem(`master_barang:${storeId}:laporan`);
    localStorage.removeItem(`master_barang:${storeId}:settings`);
    localStorage.removeItem(`master_barang:${storeId}:sync`);
  } catch (e) {
    console.warn(`Failed to delete localStorage for store ${storeId}`, e);
  }

  // 3. Clear IndexedDB keys
  idbDel(productsKey(storeId));
  idbDel(opnameKey(storeId));
  idbDel(opnameItemsKey(storeId));
  idbDel(purchasesKey(storeId));
  idbDel(purchaseItemsKey(storeId));
  idbDel(stockTransKey(storeId));
  idbDel(laporanKey(storeId));
  idbDel(syncKey(storeId));
}

// Initial cleanup of bloated localStorage entries to immediately prevent QuotaExceededError
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      // Proactively ensure data is mirrored in IndexedDB and evict huge localStorage items if needed
      const stores = getStoredStores();
      stores.forEach((store) => {
        const prodRaw = localStorage.getItem(productsKey(store.id));
        if (prodRaw && prodRaw.length > 200_000) {
          try {
            const parsed = JSON.parse(prodRaw);
            idbSet(productsKey(store.id), parsed).then(() => {
              try {
                localStorage.removeItem(productsKey(store.id));
              } catch {
                // ignore
              }
            });
          } catch {
            // ignore
          }
        }
      });
    } catch {
      // ignore
    }
  }, 100);
}
