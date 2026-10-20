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

const STORES_KEY = 'master_barang:stores';
const ACTIVE_STORE_ID_KEY = 'master_barang:active_store_id';

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
    localStorage.setItem(STORES_KEY, JSON.stringify(stores));
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
  } catch (e) {
    console.error('Failed to save active store ID', e);
  }
}

/* ================== PRODUCTS (NAMESPACED PER STORE) ================== */
export function getStoreProducts(storeId: string): Product[] {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(`master_barang:${storeId}:products`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p) => p.store_id === storeId);
      }
    }
  } catch (e) {
    console.error(`Failed to load products for store ${storeId}`, e);
  }
  return [];
}

export function saveStoreProducts(storeId: string, products: Product[]): void {
  if (!storeId) return;
  try {
    localStorage.setItem(`master_barang:${storeId}:products`, JSON.stringify(products));
  } catch (e) {
    console.error(`Failed to save products for store ${storeId}`, e);
  }
}

/* ================== OPNAME SESSIONS & ITEMS (NAMESPACED PER STORE) ================== */
export function getStoreOpnameSessions(storeId: string): OpnameSession[] {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(`master_barang:${storeId}:opname`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s) => s.store_id === storeId);
      }
    }
  } catch (e) {
    console.error(`Failed to load opname sessions for store ${storeId}`, e);
  }
  return [];
}

export function saveStoreOpnameSessions(storeId: string, sessions: OpnameSession[]): void {
  if (!storeId) return;
  try {
    localStorage.setItem(`master_barang:${storeId}:opname`, JSON.stringify(sessions));
  } catch (e) {
    console.error(`Failed to save opname sessions for store ${storeId}`, e);
  }
}

export function getStoreOpnameItems(storeId: string, opnameId?: string): OpnameItem[] {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(`master_barang:${storeId}:opname_items`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item) => item.store_id === storeId);
        return opnameId ? filtered.filter((item) => item.opname_id === opnameId) : filtered;
      }
    }
  } catch (e) {
    console.error(`Failed to load opname items for store ${storeId}`, e);
  }
  return [];
}

export function saveStoreOpnameItems(storeId: string, items: OpnameItem[]): void {
  if (!storeId) return;
  try {
    localStorage.setItem(`master_barang:${storeId}:opname_items`, JSON.stringify(items));
  } catch (e) {
    console.error(`Failed to save opname items for store ${storeId}`, e);
  }
}

/* ================== PURCHASES & PURCHASE ITEMS (NAMESPACED PER STORE) ================== */
export function getStorePurchases(storeId: string): PurchaseDocument[] {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(`master_barang:${storeId}:purchases`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p) => p.store_id === storeId);
      }
    }
  } catch (e) {
    console.error(`Failed to load purchases for store ${storeId}`, e);
  }
  return [];
}

export function saveStorePurchases(storeId: string, purchases: PurchaseDocument[]): void {
  if (!storeId) return;
  try {
    localStorage.setItem(`master_barang:${storeId}:purchases`, JSON.stringify(purchases));
  } catch (e) {
    console.error(`Failed to save purchases for store ${storeId}`, e);
  }
}

export function getStorePurchaseItems(storeId: string, purchaseId?: string): PurchaseItem[] {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(`master_barang:${storeId}:purchase_items`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item) => item.store_id === storeId);
        return purchaseId ? filtered.filter((item) => item.purchase_id === purchaseId) : filtered;
      }
    }
  } catch (e) {
    console.error(`Failed to load purchase items for store ${storeId}`, e);
  }
  return [];
}

export function saveStorePurchaseItems(storeId: string, items: PurchaseItem[]): void {
  if (!storeId) return;
  try {
    localStorage.setItem(`master_barang:${storeId}:purchase_items`, JSON.stringify(items));
  } catch (e) {
    console.error(`Failed to save purchase items for store ${storeId}`, e);
  }
}

/* ================== STOCK TRANSACTIONS / AUDIT (NAMESPACED PER STORE) ================== */
export function getStoreStockTransactions(storeId: string): StockTransaction[] {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(`master_barang:${storeId}:stock_transactions`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((t) => t.store_id === storeId);
      }
    }
  } catch (e) {
    console.error(`Failed to load stock transactions for store ${storeId}`, e);
  }
  return [];
}

export function saveStoreStockTransactions(storeId: string, transactions: StockTransaction[]): void {
  if (!storeId) return;
  try {
    localStorage.setItem(`master_barang:${storeId}:stock_transactions`, JSON.stringify(transactions));
  } catch (e) {
    console.error(`Failed to save stock transactions for store ${storeId}`, e);
  }
}

/* ================== SYNC METADATA (NAMESPACED PER STORE) ================== */
export interface StoreSyncMeta {
  loaded: boolean;
  dirty: boolean;
  lastPull: string;
  lastPush: string;
  msg: string;
  state: SyncState;
}

export function getStoreSyncMeta(storeId: string): StoreSyncMeta {
  if (!storeId) {
    return { loaded: false, dirty: false, lastPull: '', lastPush: '', msg: '', state: 'off' };
  }
  try {
    const raw = localStorage.getItem(`master_barang:${storeId}:sync`);
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
    console.error(`Failed to load sync meta for store ${storeId}`, e);
  }
  return { loaded: false, dirty: false, lastPull: '', lastPush: '', msg: '', state: 'off' };
}

export function saveStoreSyncMeta(storeId: string, meta: StoreSyncMeta): void {
  if (!storeId) return;
  try {
    localStorage.setItem(`master_barang:${storeId}:sync`, JSON.stringify(meta));
  } catch (e) {
    console.error(`Failed to save sync meta for store ${storeId}`, e);
  }
}

/* ================== LAPORAN TRANSAKSI (NAMESPACED PER STORE) ================== */
export function getStoreLaporanRows(storeId: string): LaporanRow[] {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(`master_barang:${storeId}:laporan`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Failed to load laporan rows for store ${storeId}`, e);
  }
  return [];
}

export function saveStoreLaporanRows(storeId: string, rows: LaporanRow[]): void {
  if (!storeId) return;
  try {
    localStorage.setItem(`master_barang:${storeId}:laporan`, JSON.stringify(rows));
  } catch (e) {
    console.error(`Failed to save laporan rows for store ${storeId}`, e);
  }
}

// Delete all storage data for a specific store
export function deleteStoreStorage(storeId: string): void {
  if (!storeId) return;
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
    console.error(`Failed to delete storage for store ${storeId}`, e);
  }
}
