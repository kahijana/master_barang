import { Store } from '../types';
import { extractSheetId, S } from '../utils/format';
import { generateUUID } from '../utils/uuid';
import {
  deleteStoreStorage,
  getStoredActiveStoreId,
  getStoredStores,
  saveStoredActiveStoreId,
  saveStoredStores,
} from './storage-manager';

export function getAllStores(): Store[] {
  return getStoredStores();
}

export function getActiveStore(): Store | null {
  const stores = getStoredStores();
  if (stores.length === 0) return null;

  const activeId = getStoredActiveStoreId();
  if (activeId) {
    const found = stores.find((s) => s.id === activeId);
    if (found) return found;
  }

  // Fallback to first store marked active, or first store
  const activeMarked = stores.find((s) => s.active) || stores[0];
  if (activeMarked) {
    saveStoredActiveStoreId(activeMarked.id);
    return activeMarked;
  }

  return null;
}

export function setActiveStore(storeId: string): Store | null {
  const stores = getStoredStores();
  const target = stores.find((s) => s.id === storeId);
  if (!target) return null;

  const updated = stores.map((s) => ({
    ...s,
    active: s.id === storeId,
    updatedAt: s.id === storeId ? new Date().toISOString() : s.updatedAt,
  }));

  saveStoredStores(updated);
  saveStoredActiveStoreId(storeId);
  return target;
}

export interface CreateStoreInput {
  name: string;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  webhookUrl?: string;
  autoSync?: boolean;
  autoSyncIntervalMinutes?: number;
}

export function createStore(input: CreateStoreInput): Store {
  const stores = getStoredStores();
  const now = new Date().toISOString();
  const newId = generateUUID();

  const url = S(input.spreadsheetUrl);
  const idFromUrl = extractSheetId(url);
  const finalSheetId = S(input.spreadsheetId) || idFromUrl;

  const isFirst = stores.length === 0;

  const newStore: Store = {
    id: newId,
    name: S(input.name) || 'Toko Baru',
    spreadsheetUrl: url,
    spreadsheetId: finalSheetId,
    webhookUrl: S(input.webhookUrl),
    active: isFirst, // If first store, mark active automatically
    autoSync: false, // STRICT REQUIREMENT: Default MUST be false!
    autoSyncIntervalMinutes: input.autoSyncIntervalMinutes || 10,
    createdAt: now,
    updatedAt: now,
  };

  const updatedStores = [...stores, newStore];
  saveStoredStores(updatedStores);

  if (isFirst) {
    saveStoredActiveStoreId(newId);
  }

  return newStore;
}

export interface UpdateStoreInput {
  id: string;
  name: string;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  webhookUrl?: string;
  autoSync?: boolean;
  autoSyncIntervalMinutes?: number;
}

export function updateStore(input: UpdateStoreInput): Store | null {
  const stores = getStoredStores();
  const index = stores.findIndex((s) => s.id === input.id);
  if (index === -1) return null;

  const current = stores[index];
  const url = input.spreadsheetUrl !== undefined ? S(input.spreadsheetUrl) : current.spreadsheetUrl;
  const idFromUrl = extractSheetId(url);
  const finalSheetId = input.spreadsheetId !== undefined && S(input.spreadsheetId)
    ? S(input.spreadsheetId)
    : (idFromUrl || current.spreadsheetId);

  const updatedStore: Store = {
    ...current,
    name: S(input.name) || current.name,
    spreadsheetUrl: url,
    spreadsheetId: finalSheetId,
    webhookUrl: input.webhookUrl !== undefined ? S(input.webhookUrl) : current.webhookUrl,
    autoSync: input.autoSync !== undefined ? input.autoSync : (current.autoSync ?? false),
    autoSyncIntervalMinutes: input.autoSyncIntervalMinutes !== undefined
      ? input.autoSyncIntervalMinutes
      : (current.autoSyncIntervalMinutes || 10),
    updatedAt: new Date().toISOString(),
  };

  stores[index] = updatedStore;
  saveStoredStores(stores);
  return updatedStore;
}

export function deleteStore(storeId: string): { remainingStores: Store[]; nextActiveStore: Store | null } {
  const stores = getStoredStores();
  const remaining = stores.filter((s) => s.id !== storeId);
  saveStoredStores(remaining);

  // Clean up store namespaced local storage
  deleteStoreStorage(storeId);

  const currentActiveId = getStoredActiveStoreId();
  let nextActiveStore: Store | null = null;

  if (currentActiveId === storeId) {
    if (remaining.length > 0) {
      nextActiveStore = remaining[0];
      remaining[0].active = true;
      saveStoredStores(remaining);
      saveStoredActiveStoreId(nextActiveStore.id);
    } else {
      localStorage.removeItem('master_barang:active_store_id');
    }
  } else {
    nextActiveStore = remaining.find((s) => s.id === currentActiveId) || null;
  }

  return { remainingStores: remaining, nextActiveStore };
}
