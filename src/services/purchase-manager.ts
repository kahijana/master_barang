import { Product, PurchaseDocument, PurchaseItem } from '../types';
import { generateUUID } from '../utils/uuid';
import { getToday } from '../utils/format';
import {
  getStorePurchaseItems,
  getStorePurchases,
  getStoreProducts,
  saveStorePurchaseItems,
  saveStorePurchases,
  saveStoreProducts,
} from './storage-manager';
import { recordStockTransaction } from './transaction-manager';

export function generatePurchaseNumber(existing: PurchaseDocument[]): string {
  const year = new Date().getFullYear();
  const count = existing.length + 1;
  return `PB-${year}-${String(count).padStart(4, '0')}`;
}

export function createPurchaseDocument(
  storeId: string,
  params: {
    supplier: string;
    purchase_date?: string;
    notes?: string;
    target_location?: 'TOKO' | 'GUDANG';
    discount?: number;
    additional_cost?: number;
    allocate_cost?: boolean;
    items: Omit<PurchaseItem, 'purchase_item_id' | 'purchase_id' | 'store_id'>[];
  }
): { purchase: PurchaseDocument; items: PurchaseItem[] } {
  const existingPurchases = getStorePurchases(storeId);
  const now = new Date().toISOString();
  const purchaseId = generateUUID();
  const purchaseNumber = generatePurchaseNumber(existingPurchases);

  let subtotal = 0;
  const purchaseItems: PurchaseItem[] = params.items.map((it) => {
    const qty = it.received_quantity > 0 ? it.received_quantity : it.order_quantity;
    const itemSubtotal = qty * it.purchase_price - (it.discount || 0);
    subtotal += itemSubtotal;

    return {
      purchase_item_id: generateUUID(),
      purchase_id: purchaseId,
      store_id: storeId,
      product_id: it.product_id,
      product_name: it.product_name,
      product_code: it.product_code,
      product_barcode: it.product_barcode,
      order_quantity: it.order_quantity,
      received_quantity: it.received_quantity,
      unit: it.unit || 'PCS',
      purchase_price: it.purchase_price,
      discount: it.discount || 0,
      subtotal: Math.max(0, itemSubtotal),
    };
  });

  const discount = params.discount || 0;
  const additionalCost = params.additional_cost || 0;
  const grandTotal = Math.max(0, subtotal - discount + additionalCost);

  const newDoc: PurchaseDocument = {
    purchase_id: purchaseId,
    store_id: storeId,
    purchase_number: purchaseNumber,
    supplier: params.supplier.trim() || 'Umum',
    purchase_date: params.purchase_date || getToday(),
    status: 'DRAFT', // Starts as DRAFT: Stock does NOT change!
    notes: params.notes || '',
    target_location: params.target_location || 'TOKO',
    subtotal,
    discount,
    additional_cost: additionalCost,
    allocate_cost: Boolean(params.allocate_cost),
    grand_total: grandTotal,
    createdAt: now,
    updatedAt: now,
  };

  const allPurchases = [newDoc, ...existingPurchases];
  saveStorePurchases(storeId, allPurchases);

  const existingItems = getStorePurchaseItems(storeId);
  const allItems = [...purchaseItems, ...existingItems];
  saveStorePurchaseItems(storeId, allItems);

  return { purchase: newDoc, items: purchaseItems };
}

export function updatePurchaseDocument(
  storeId: string,
  purchaseId: string,
  params: {
    supplier: string;
    purchase_date?: string;
    notes?: string;
    target_location?: 'TOKO' | 'GUDANG';
    discount?: number;
    additional_cost?: number;
    allocate_cost?: boolean;
    items: Omit<PurchaseItem, 'purchase_item_id' | 'purchase_id' | 'store_id'>[];
  }
): { purchase: PurchaseDocument; items: PurchaseItem[] } | null {
  const purchases = getStorePurchases(storeId);
  const pIndex = purchases.findIndex((p) => p.purchase_id === purchaseId);
  if (pIndex === -1) return null;

  const current = purchases[pIndex];
  if (current.status !== 'DRAFT') {
    throw new Error('Hanya pembelian berstatus DRAFT yang dapat diedit.');
  }

  let subtotal = 0;
  const purchaseItems: PurchaseItem[] = params.items.map((it) => {
    const qty = it.received_quantity > 0 ? it.received_quantity : it.order_quantity;
    const itemSubtotal = qty * it.purchase_price - (it.discount || 0);
    subtotal += itemSubtotal;

    return {
      purchase_item_id: generateUUID(),
      purchase_id: purchaseId,
      store_id: storeId,
      product_id: it.product_id,
      product_name: it.product_name,
      product_code: it.product_code,
      product_barcode: it.product_barcode,
      order_quantity: it.order_quantity,
      received_quantity: it.received_quantity,
      unit: it.unit || 'PCS',
      purchase_price: it.purchase_price,
      discount: it.discount || 0,
      subtotal: Math.max(0, itemSubtotal),
    };
  });

  const discount = params.discount !== undefined ? params.discount : current.discount;
  const additionalCost = params.additional_cost !== undefined ? params.additional_cost : current.additional_cost;
  const grandTotal = Math.max(0, subtotal - discount + additionalCost);

  const updatedDoc: PurchaseDocument = {
    ...current,
    supplier: params.supplier.trim() || current.supplier,
    purchase_date: params.purchase_date || current.purchase_date,
    notes: params.notes !== undefined ? params.notes : current.notes,
    target_location: params.target_location || current.target_location,
    subtotal,
    discount,
    additional_cost: additionalCost,
    allocate_cost: params.allocate_cost !== undefined ? params.allocate_cost : current.allocate_cost,
    grand_total: grandTotal,
    updatedAt: new Date().toISOString(),
  };

  purchases[pIndex] = updatedDoc;
  saveStorePurchases(storeId, purchases);

  // Replace purchase items for this document
  const existingAllItems = getStorePurchaseItems(storeId);
  const filteredOtherItems = existingAllItems.filter((i) => i.purchase_id !== purchaseId);
  saveStorePurchaseItems(storeId, [...purchaseItems, ...filteredOtherItems]);

  return { purchase: updatedDoc, items: purchaseItems };
}

/**
 * Explicit action: "Terima Pembelian"
 * Increases stock by received_quantity and records StockTransaction entries.
 */
export function receivePurchaseDocument(
  storeId: string,
  purchaseId: string
): { success: boolean; purchase: PurchaseDocument; updatedProducts: Product[]; error?: string } {
  const purchases = getStorePurchases(storeId);
  const pIndex = purchases.findIndex((p) => p.purchase_id === purchaseId);
  if (pIndex === -1) {
    return { success: false, purchase: null as unknown as PurchaseDocument, updatedProducts: [], error: 'Dokumen pembelian tidak ditemukan.' };
  }

  const purchase = purchases[pIndex];
  if (purchase.status === 'RECEIVED') {
    return { success: false, purchase, updatedProducts: [], error: 'Pembelian ini sudah berstatus Diterima.' };
  }

  const purchaseItems = getStorePurchaseItems(storeId, purchaseId);
  if (purchaseItems.length === 0) {
    return { success: false, purchase, updatedProducts: [], error: 'Pembelian tidak memiliki barang.' };
  }

  const products = getStoreProducts(storeId);
  const productMap = new Map<string, Product>();
  for (const p of products) {
    productMap.set(p.product_id, { ...p });
  }

  const location = purchase.target_location || 'TOKO';
  const now = new Date().toISOString();

  // Increase stock for each item in active store
  for (const item of purchaseItems) {
    const prod = productMap.get(item.product_id);
    if (!prod) continue;

    const qtyToAdd = item.received_quantity > 0 ? item.received_quantity : item.order_quantity;
    if (qtyToAdd <= 0) continue;

    const prevStock = location === 'TOKO' ? (prod.TOKO ?? 0) : (prod.GUDANG ?? 0);
    const finalStock = prevStock + qtyToAdd;

    if (location === 'TOKO') {
      prod.TOKO = finalStock;
    } else {
      prod.GUDANG = finalStock;
    }

    // Record stock transaction audit
    recordStockTransaction(storeId, {
      product_id: prod.product_id,
      product_name: prod.NAMA,
      product_code: prod.KODE_BARANG,
      location,
      type: 'PEMBELIAN',
      quantity: qtyToAdd, // Positive delta
      previous_stock: prevStock,
      final_stock: finalStock,
      reference_id: purchase.purchase_id,
      reference_number: purchase.purchase_number,
      notes: `Penerimaan Pembelian ${purchase.purchase_number} dari ${purchase.supplier}`,
    });
  }

  const updatedProducts = Array.from(productMap.values());
  saveStoreProducts(storeId, updatedProducts);

  const updatedPurchase: PurchaseDocument = {
    ...purchase,
    status: 'RECEIVED',
    receivedAt: now,
    updatedAt: now,
  };

  purchases[pIndex] = updatedPurchase;
  saveStorePurchases(storeId, purchases);

  return { success: true, purchase: updatedPurchase, updatedProducts };
}

/**
 * Cancel a purchase document.
 * If purchase was already RECEIVED, reverses the stock increase and logs a reversal transaction.
 */
export function cancelPurchaseDocument(
  storeId: string,
  purchaseId: string
): { success: boolean; purchase: PurchaseDocument; updatedProducts: Product[]; error?: string } {
  const purchases = getStorePurchases(storeId);
  const pIndex = purchases.findIndex((p) => p.purchase_id === purchaseId);
  if (pIndex === -1) {
    return { success: false, purchase: null as unknown as PurchaseDocument, updatedProducts: [], error: 'Dokumen pembelian tidak ditemukan.' };
  }

  const purchase = purchases[pIndex];
  if (purchase.status === 'CANCELLED') {
    return { success: false, purchase, updatedProducts: [], error: 'Dokumen sudah dibatalkan sebelumnya.' };
  }

  const products = getStoreProducts(storeId);
  const productMap = new Map<string, Product>();
  for (const p of products) {
    productMap.set(p.product_id, { ...p });
  }

  const location = purchase.target_location || 'TOKO';
  const now = new Date().toISOString();

  // If already received, reverse stock changes
  if (purchase.status === 'RECEIVED') {
    const purchaseItems = getStorePurchaseItems(storeId, purchaseId);
    for (const item of purchaseItems) {
      const prod = productMap.get(item.product_id);
      if (!prod) continue;

      const qtyToRevert = item.received_quantity > 0 ? item.received_quantity : item.order_quantity;
      if (qtyToRevert <= 0) continue;

      const prevStock = location === 'TOKO' ? (prod.TOKO ?? 0) : (prod.GUDANG ?? 0);
      const finalStock = Math.max(0, prevStock - qtyToRevert);

      if (location === 'TOKO') {
        prod.TOKO = finalStock;
      } else {
        prod.GUDANG = finalStock;
      }

      // Record reversal transaction
      recordStockTransaction(storeId, {
        product_id: prod.product_id,
        product_name: prod.NAMA,
        product_code: prod.KODE_BARANG,
        location,
        type: 'ADJUSTMENT',
        quantity: -qtyToRevert,
        previous_stock: prevStock,
        final_stock: finalStock,
        reference_id: purchase.purchase_id,
        reference_number: purchase.purchase_number,
        notes: `Pembatalan Penerimaan Pembelian ${purchase.purchase_number}`,
      });
    }

    saveStoreProducts(storeId, Array.from(productMap.values()));
  }

  const updatedPurchase: PurchaseDocument = {
    ...purchase,
    status: 'CANCELLED',
    cancelledAt: now,
    updatedAt: now,
  };

  purchases[pIndex] = updatedPurchase;
  saveStorePurchases(storeId, purchases);

  return { success: true, purchase: updatedPurchase, updatedProducts: Array.from(productMap.values()) };
}

export function deletePurchaseDocument(
  storeId: string,
  purchaseId: string
): { success: boolean; error?: string } {
  const purchases = getStorePurchases(storeId);
  const target = purchases.find((p) => p.purchase_id === purchaseId);
  if (!target) return { success: false, error: 'Dokumen tidak ditemukan.' };
  if (target.status === 'RECEIVED') {
    return { success: false, error: 'Dokumen yang telah diterima tidak dapat dihapus (batalkan terlebih dahulu).' };
  }

  const remainingPurchases = purchases.filter((p) => p.purchase_id !== purchaseId);
  saveStorePurchases(storeId, remainingPurchases);

  const existingItems = getStorePurchaseItems(storeId);
  const remainingItems = existingItems.filter((i) => i.purchase_id !== purchaseId);
  saveStorePurchaseItems(storeId, remainingItems);

  return { success: true };
}
