import { Product, Store } from '../types';
import { extractSheetId, normalizeProduct, S } from '../utils/format';
import { generateUUID } from '../utils/uuid';
import {
  getStoredStores,
  saveStoredActiveStoreId,
  saveStoredStores,
  saveStoreProducts,
  saveStoreSyncMeta,
} from './storage-manager';

const MIGRATION_FLAG_KEY = 'master_barang:migrated_v2';

export function runMigrationIfNeeded(): { migrated: boolean; activeStore: Store } {
  const existingStores = getStoredStores();

  // If stores already exist, ensure autoSync is migrated to false if not set
  if (existingStores.length > 0) {
    let changed = false;
    const migratedStores = existingStores.map((s) => {
      if (typeof s.autoSync !== 'boolean') {
        changed = true;
        return {
          ...s,
          autoSync: false,
          autoSyncIntervalMinutes: s.autoSyncIntervalMinutes || 10,
        };
      }
      return s;
    });

    if (changed) {
      saveStoredStores(migratedStores);
    }

    const activeStore = migratedStores.find((s) => s.active) || migratedStores[0];
    saveStoredActiveStoreId(activeStore.id);
    return { migrated: false, activeStore };
  }

  // Check for legacy single-store data
  const legacyCfgRaw = localStorage.getItem('mb_cfg');
  const legacyItemsRaw = localStorage.getItem('mb_items');
  const legacyLoaded = localStorage.getItem('mb_loaded') === '1';
  const legacyDirty = localStorage.getItem('mb_dirty') === '1';
  const legacyLast = localStorage.getItem('mb_last') || '';

  let sheetUrl = '';
  let webhookUrl = '';

  if (legacyCfgRaw) {
    try {
      const parsedCfg = JSON.parse(legacyCfgRaw);
      sheetUrl = S(parsedCfg.sheetUrl);
      webhookUrl = S(parsedCfg.webhook);
    } catch (e) {
      console.warn('Failed to parse legacy config', e);
    }
  }

  const storeId = generateUUID();
  const now = new Date().toISOString();
  const newStore: Store = {
    id: storeId,
    name: 'Toko Utama',
    spreadsheetUrl: sheetUrl,
    spreadsheetId: extractSheetId(sheetUrl),
    webhookUrl: webhookUrl,
    active: true,
    autoSync: false, // STRICT DEFAULT: false
    autoSyncIntervalMinutes: 10,
    createdAt: now,
    updatedAt: now,
  };

  saveStoredStores([newStore]);
  saveStoredActiveStoreId(storeId);

  // Migrate legacy items if present
  let migratedProducts: Product[] = [];
  if (legacyItemsRaw) {
    try {
      const parsedItems = JSON.parse(legacyItemsRaw);
      if (Array.isArray(parsedItems)) {
        migratedProducts = parsedItems.map((item) =>
          normalizeProduct(item, storeId)
        );
      }
    } catch (e) {
      console.warn('Failed to parse legacy items for migration', e);
    }
  }

  saveStoreProducts(storeId, migratedProducts);
  saveStoreSyncMeta(storeId, {
    loaded: legacyLoaded,
    dirty: legacyDirty,
    lastPull: legacyLast,
    lastPush: legacyLast,
    msg: '',
    state: legacyDirty ? 'pending' : (legacyLoaded ? 'ok' : 'off'),
  });

  localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  return { migrated: true, activeStore: newStore };
}
