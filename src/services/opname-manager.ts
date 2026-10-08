import { OpnameItem, OpnameSession, Product } from '../types';
import { generateUUID } from '../utils/uuid';
import { getToday } from '../utils/format';
import {
  getStoreOpnameItems,
  getStoreOpnameSessions,
  getStoreProducts,
  saveStoreOpnameItems,
  saveStoreOpnameSessions,
  saveStoreProducts,
} from './storage-manager';
import { recordStockTransaction } from './transaction-manager';

export function generateOpnameNumber(existingSessions: OpnameSession[]): string {
  const year = new Date().getFullYear();
  const count = existingSessions.length + 1;
  return `OP-${year}-${String(count).padStart(4, '0')}`;
}

export function startOpnameSession(
  storeId: string,
  params: {
    date?: string;
    notes?: string;
    target_location?: 'TOKO' | 'GUDANG';
    products: Product[];
  }
): { session: OpnameSession; items: OpnameItem[] } {
  const existingSessions = getStoreOpnameSessions(storeId);
  const now = new Date().toISOString();
  const opnameId = generateUUID();
  const opnameNumber = generateOpnameNumber(existingSessions);
  const location = params.target_location || 'TOKO';

  const newSession: OpnameSession = {
    opname_id: opnameId,
    store_id: storeId,
    opname_number: opnameNumber,
    date: params.date || getToday(),
    status: 'IN PROGRESS',
    notes: params.notes || '',
    target_location: location,
    adjusted: false,
    createdAt: now,
    updatedAt: now,
  };

  // Generate initial opname items for all products in active store
  const opnameItems: OpnameItem[] = params.products.map((p) => {
    const sysStock = location === 'TOKO' ? (p.TOKO ?? 0) : (p.GUDANG ?? 0);
    return {
      opname_item_id: generateUUID(),
      opname_id: opnameId,
      store_id: storeId,
      product_id: p.product_id,
      product_name: p.NAMA,
      product_code: p.KODE_BARANG,
      product_barcode: p.KODE_BARCODE,
      system_stock: sysStock,
      physical_stock: sysStock,
      difference: 0,
      unit: p.SATUAN_1 || 'PCS',
      counted: false,
      notes: '',
    };
  });

  // Save session & items
  const allSessions = [newSession, ...existingSessions];
  saveStoreOpnameSessions(storeId, allSessions);

  const existingItems = getStoreOpnameItems(storeId);
  const allItems = [...opnameItems, ...existingItems];
  saveStoreOpnameItems(storeId, allItems);

  return { session: newSession, items: opnameItems };
}

export function updateOpnameItemCount(
  storeId: string,
  opnameId: string,
  productId: string,
  physicalStock: number,
  notes?: string
): OpnameItem | null {
  const allItems = getStoreOpnameItems(storeId);
  const index = allItems.findIndex(
    (item) => item.opname_id === opnameId && item.product_id === productId
  );

  if (index === -1) return null;

  const current = allItems[index];
  const diff = physicalStock - current.system_stock;

  const updated: OpnameItem = {
    ...current,
    physical_stock: physicalStock,
    difference: diff,
    counted: true,
    notes: notes !== undefined ? notes : current.notes,
  };

  allItems[index] = updated;
  saveStoreOpnameItems(storeId, allItems);

  // Also touch session's updatedAt
  const sessions = getStoreOpnameSessions(storeId);
  const sIndex = sessions.findIndex((s) => s.opname_id === opnameId);
  if (sIndex !== -1) {
    sessions[sIndex].updatedAt = new Date().toISOString();
    saveStoreOpnameSessions(storeId, sessions);
  }

  return updated;
}

export function completeOpnameSession(
  storeId: string,
  opnameId: string
): OpnameSession | null {
  const sessions = getStoreOpnameSessions(storeId);
  const index = sessions.findIndex((s) => s.opname_id === opnameId);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const updated: OpnameSession = {
    ...sessions[index],
    status: 'COMPLETED',
    completedAt: now,
    updatedAt: now,
  };

  sessions[index] = updated;
  saveStoreOpnameSessions(storeId, sessions);
  return updated;
}

export function cancelOpnameSession(
  storeId: string,
  opnameId: string
): OpnameSession | null {
  const sessions = getStoreOpnameSessions(storeId);
  const index = sessions.findIndex((s) => s.opname_id === opnameId);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const updated: OpnameSession = {
    ...sessions[index],
    status: 'CANCELLED',
    updatedAt: now,
  };

  sessions[index] = updated;
  saveStoreOpnameSessions(storeId, sessions);
  return updated;
}

/**
 * Explicit action: "Terapkan Selisih ke Stok".
 * Updates products' physical stock according to counted differences.
 * Logs StockTransaction entries for audit.
 */
export function applyOpnameStockAdjustment(
  storeId: string,
  opnameId: string
): {
  success: boolean;
  adjustedCount: number;
  increasedCount: number;
  decreasedCount: number;
  updatedProducts: Product[];
  error?: string;
} {
  const sessions = getStoreOpnameSessions(storeId);
  const sIndex = sessions.findIndex((s) => s.opname_id === opnameId);
  if (sIndex === -1) {
    return { success: false, adjustedCount: 0, increasedCount: 0, decreasedCount: 0, updatedProducts: [], error: 'Sesi opname tidak ditemukan.' };
  }

  const session = sessions[sIndex];
  if (session.adjusted) {
    return { success: false, adjustedCount: 0, increasedCount: 0, decreasedCount: 0, updatedProducts: [], error: 'Hasil opname ini sudah pernah diterapkan sebelumnya.' };
  }

  const opnameItems = getStoreOpnameItems(storeId, opnameId);
  const countedItemsWithDiff = opnameItems.filter(
    (item) => item.counted && item.difference !== 0
  );

  const products = getStoreProducts(storeId);
  const productMap = new Map<string, Product>();
  for (const p of products) {
    productMap.set(p.product_id, { ...p });
  }

  const location = session.target_location || 'TOKO';
  let increasedCount = 0;
  let decreasedCount = 0;

  for (const item of countedItemsWithDiff) {
    const prod = productMap.get(item.product_id);
    if (!prod) continue;

    const prevStock = location === 'TOKO' ? prod.TOKO : prod.GUDANG;
    const finalStock = item.physical_stock;

    if (location === 'TOKO') {
      prod.TOKO = finalStock;
    } else {
      prod.GUDANG = finalStock;
    }

    if (item.difference > 0) {
      increasedCount++;
    } else {
      decreasedCount++;
    }

    // Record audit transaction
    recordStockTransaction(storeId, {
      product_id: prod.product_id,
      product_name: prod.NAMA,
      product_code: prod.KODE_BARANG,
      location,
      type: 'OPNAME',
      quantity: item.difference,
      previous_stock: prevStock,
      final_stock: finalStock,
      reference_id: session.opname_id,
      reference_number: session.opname_number,
      notes: item.notes || `Stock Opname ${session.opname_number}`,
    });
  }

  const updatedProducts = Array.from(productMap.values());
  saveStoreProducts(storeId, updatedProducts);

  // Mark session as adjusted
  sessions[sIndex] = {
    ...session,
    adjusted: true,
    adjustedAt: new Date().toISOString(),
    status: 'COMPLETED',
    updatedAt: new Date().toISOString(),
  };
  saveStoreOpnameSessions(storeId, sessions);

  return {
    success: true,
    adjustedCount: countedItemsWithDiff.length,
    increasedCount,
    decreasedCount,
    updatedProducts,
  };
}
