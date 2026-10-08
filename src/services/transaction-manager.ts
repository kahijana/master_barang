import { StockTransaction, StockTransactionType } from '../types';
import { generateUUID } from '../utils/uuid';
import {
  getStoreStockTransactions,
  saveStoreStockTransactions,
} from './storage-manager';

export function recordStockTransaction(
  storeId: string,
  params: {
    product_id: string;
    product_name: string;
    product_code: string;
    location: 'TOKO' | 'GUDANG';
    type: StockTransactionType;
    quantity: number; // delta (+95, -5)
    previous_stock: number;
    final_stock: number;
    reference_id: string;
    reference_number: string;
    notes?: string;
  }
): StockTransaction {
  const transactions = getStoreStockTransactions(storeId);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  const newTx: StockTransaction = {
    transaction_id: generateUUID(),
    store_id: storeId,
    product_id: params.product_id,
    product_name: params.product_name,
    product_code: params.product_code,
    location: params.location,
    type: params.type,
    quantity: params.quantity,
    previous_stock: params.previous_stock,
    final_stock: params.final_stock,
    reference_id: params.reference_id,
    reference_number: params.reference_number,
    date: dateStr,
    notes: params.notes || '',
    createdAt: now.toISOString(),
  };

  const updated = [newTx, ...transactions];
  saveStoreStockTransactions(storeId, updated);
  return newTx;
}

export function getTransactionsByProduct(
  storeId: string,
  productId: string
): StockTransaction[] {
  const all = getStoreStockTransactions(storeId);
  return all.filter((t) => t.product_id === productId);
}

export function getAllTransactions(storeId: string): StockTransaction[] {
  return getStoreStockTransactions(storeId);
}
