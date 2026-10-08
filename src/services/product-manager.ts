import { Product } from '../types';
import { normalizeProduct, stripLeadingZeros, S } from '../utils/format';
import { generateUUID } from '../utils/uuid';
import { getStoreProducts, saveStoreProducts } from './storage-manager';

export function getProductsByStore(storeId: string): Product[] {
  if (!storeId) return [];
  return getStoreProducts(storeId);
}

export function saveProductsByStore(storeId: string, products: Product[]): void {
  if (!storeId) return;
  saveStoreProducts(storeId, products);
}

export function addProduct(
  storeId: string,
  productData: Partial<Product>
): { success: boolean; product?: Product; error?: string } {
  if (!storeId) {
    return { success: false, error: 'Toko aktif tidak valid.' };
  }

  const normalized = normalizeProduct(productData, storeId);
  normalized.product_id = productData.product_id || generateUUID();
  normalized.store_id = storeId;

  if (!normalized.NAMA) {
    return { success: false, error: 'Nama barang wajib diisi.' };
  }
  if (!normalized.KODE_BARANG) {
    return { success: false, error: 'Kode barang wajib diisi.' };
  }

  const existingProducts = getStoreProducts(storeId);

  // Check duplicate KODE_BARANG strictly within the same store
  const dupKode = existingProducts.find(
    (p) => p.KODE_BARANG.toLowerCase() === normalized.KODE_BARANG.toLowerCase()
  );
  if (dupKode) {
    return {
      success: false,
      error: `Kode "${normalized.KODE_BARANG}" sudah dipakai oleh ${dupKode.NAMA} di toko ini.`,
    };
  }

  // Check duplicate KODE_BARCODE strictly within the same store (if barcode provided)
  if (normalized.KODE_BARCODE) {
    const dupBarcode = existingProducts.find(
      (p) => p.KODE_BARCODE === normalized.KODE_BARCODE && p.KODE_BARCODE !== ''
    );
    if (dupBarcode) {
      return {
        success: false,
        error: `Barcode "${normalized.KODE_BARCODE}" sudah dipakai oleh ${dupBarcode.NAMA} di toko ini.`,
      };
    }
  }

  const updatedProducts = [normalized, ...existingProducts];
  saveStoreProducts(storeId, updatedProducts);

  return { success: true, product: normalized };
}

export function updateProduct(
  storeId: string,
  product: Product
): { success: boolean; product?: Product; error?: string } {
  if (!storeId || !product.product_id) {
    return { success: false, error: 'Identitas barang tidak valid.' };
  }

  const existingProducts = getStoreProducts(storeId);
  const index = existingProducts.findIndex((p) => p.product_id === product.product_id);
  if (index === -1) {
    return { success: false, error: 'Barang tidak ditemukan di toko ini.' };
  }

  const normalized = normalizeProduct(product, storeId);
  // Ensure product_id and store_id remain immutable
  normalized.product_id = product.product_id;
  normalized.store_id = storeId;

  if (!normalized.NAMA) {
    return { success: false, error: 'Nama barang wajib diisi.' };
  }
  if (!normalized.KODE_BARANG) {
    return { success: false, error: 'Kode barang wajib diisi.' };
  }

  // Check duplicate KODE_BARANG within same store, excluding self
  const dupKode = existingProducts.find(
    (p) =>
      p.product_id !== product.product_id &&
      p.KODE_BARANG.toLowerCase() === normalized.KODE_BARANG.toLowerCase()
  );
  if (dupKode) {
    return {
      success: false,
      error: `Kode "${normalized.KODE_BARANG}" sudah dipakai oleh ${dupKode.NAMA} di toko ini.`,
    };
  }

  // Check duplicate barcode within same store, excluding self
  if (normalized.KODE_BARCODE) {
    const dupBarcode = existingProducts.find(
      (p) =>
        p.product_id !== product.product_id &&
        p.KODE_BARCODE === normalized.KODE_BARCODE &&
        p.KODE_BARCODE !== ''
    );
    if (dupBarcode) {
      return {
        success: false,
        error: `Barcode "${normalized.KODE_BARCODE}" sudah dipakai oleh ${dupBarcode.NAMA} di toko ini.`,
      };
    }
  }

  existingProducts[index] = normalized;
  saveStoreProducts(storeId, existingProducts);

  return { success: true, product: normalized };
}

export function deleteProduct(storeId: string, productId: string): Product[] {
  if (!storeId || !productId) return [];
  const existing = getStoreProducts(storeId);
  const filtered = existing.filter((p) => p.product_id !== productId);
  saveStoreProducts(storeId, filtered);
  return filtered;
}

export function findProductByCodeInStore(products: Product[], code: string): Product | null {
  const c = S(code);
  if (!c) return null;
  const z = stripLeadingZeros(c);

  // 1. Direct barcode match in current store products
  const bcMatch = products.find((i) => S(i.KODE_BARCODE) === c);
  if (bcMatch) return bcMatch;

  // 2. Direct product code match in current store products
  const kbMatch = products.find((i) => S(i.KODE_BARANG) === c);
  if (kbMatch) return kbMatch;

  // 3. Leading-zero stripped match
  if (z) {
    const strippedMatch = products.find(
      (i) => stripLeadingZeros(i.KODE_BARCODE) === z || stripLeadingZeros(i.KODE_BARANG) === z
    );
    if (strippedMatch) return strippedMatch;
  }

  return null;
}
