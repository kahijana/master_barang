import Fuse from 'fuse.js';
import { Product } from '../types';
import { stripLeadingZeros, S } from '../utils/format';

interface SearchIndexItem {
  product_id: string;
  n: string;
  kb: string;
  bc: string;
  k: string;
  s: string;
}

let activeStoreSearchIndex: Fuse<SearchIndexItem> | null = null;
let currentIndexedStoreId: string | null = null;
let currentProductsSnapshot: Product[] | null = null;

export function resetSearchIndex(): void {
  activeStoreSearchIndex = null;
  currentIndexedStoreId = null;
  currentProductsSnapshot = null;
}

export function getStoreSearchIndex(storeId: string, products: Product[]): Fuse<SearchIndexItem> {
  // If store changed or products reference changed, destroy old search index
  if (
    !activeStoreSearchIndex ||
    currentIndexedStoreId !== storeId ||
    currentProductsSnapshot !== products
  ) {
    const searchData: SearchIndexItem[] = products.map((it) => {
      const extraBarcodes = (it.alternate_barcodes || []).map((ab) => ab.barcode);
      const commaExtra = it.BARCODE_EXTRA ? it.BARCODE_EXTRA.split(',') : [];
      const allBc = [
        it.KODE_BARCODE,
        it.BARCODE_2,
        it.BARCODE_3,
        it.BARCODE_4,
        it.BARCODE_5,
        it.BARCODE_6,
        ...extraBarcodes,
        ...commaExtra,
      ].filter(Boolean).join(' ');

      return {
        product_id: it.product_id,
        n: it.NAMA,
        kb: it.KODE_BARANG,
        bc: allBc,
        k: it.KATEGORI,
        s: it.SUPPLIER,
      };
    });

    activeStoreSearchIndex = new Fuse(searchData, {
      keys: [
        { name: 'n', weight: 3 },
        { name: 'kb', weight: 2 },
        { name: 'bc', weight: 2.5 },
        { name: 'k', weight: 0.8 },
        { name: 's', weight: 0.5 },
      ],
      threshold: 0.32,
      ignoreLocation: true,
      minMatchCharLength: 1,
    });

    currentIndexedStoreId = storeId;
    currentProductsSnapshot = products;
  }

  return activeStoreSearchIndex;
}

export function searchStoreProducts(
  storeId: string,
  products: Product[],
  query: string,
  category: string = ''
): Product[] {
  const q = S(query);
  const selectedCat = S(category);

  // If no search query, filter only by category and sort alphabetically by name
  if (!q) {
    const list = selectedCat
      ? products.filter((it) => it.KATEGORI === selectedCat)
      : [...products];
    return list.sort((a, b) => a.NAMA.localeCompare(b.NAMA, 'id'));
  }

  const zQuery = stripLeadingZeros(q);

  // Exact code matches get top priority (matches primary or any alternate barcode)
  const exactMatches = products.filter((it) => {
    if (selectedCat && it.KATEGORI !== selectedCat) return false;
    const extraBarcodes = (it.alternate_barcodes || []).map((ab) => S(ab.barcode));
    const commaExtra = it.BARCODE_EXTRA ? it.BARCODE_EXTRA.split(',').map((b) => S(b)) : [];
    const bcs = [
      S(it.KODE_BARCODE),
      S(it.BARCODE_2),
      S(it.BARCODE_3),
      S(it.BARCODE_4),
      S(it.BARCODE_5),
      S(it.BARCODE_6),
      ...extraBarcodes,
      ...commaExtra,
    ].filter(Boolean);
    const itKb = S(it.KODE_BARANG);

    if (bcs.includes(q) || itKb.toLowerCase() === q.toLowerCase()) return true;
    if (zQuery && (bcs.some((b) => stripLeadingZeros(b) === zQuery) || stripLeadingZeros(itKb) === zQuery)) {
      return true;
    }
    return false;
  });

  // Fuzzy matches using store-isolated Fuse.js
  const fuse = getStoreSearchIndex(storeId, products);
  const results = fuse.search(q, { limit: 300 });

  const productMap = new Map<string, Product>();
  for (const p of products) {
    productMap.set(p.product_id, p);
  }

  const fuzzyMatches: Product[] = [];
  for (const res of results) {
    const item = productMap.get(res.item.product_id);
    if (item) {
      if (selectedCat && item.KATEGORI !== selectedCat) continue;
      fuzzyMatches.push(item);
    }
  }

  // Combine exact matches first, then fuzzy matches, deduplicated by product_id
  const combined: Product[] = [];
  const seenIds = new Set<string>();

  for (const item of exactMatches) {
    if (!seenIds.has(item.product_id)) {
      seenIds.add(item.product_id);
      combined.push(item);
    }
  }

  for (const item of fuzzyMatches) {
    if (!seenIds.has(item.product_id)) {
      seenIds.add(item.product_id);
      combined.push(item);
    }
  }

  return combined;
}

/**
 * Finds a product that matches any primary or alternate barcode or product code.
 */
export function findProductByBarcode(products: Product[], rawBarcode: string): Product | null {
  const code = S(rawBarcode);
  if (!code) return null;
  const zCode = stripLeadingZeros(code);

  for (const p of products) {
    const extraBarcodes = (p.alternate_barcodes || []).map((ab) => S(ab.barcode));
    const commaExtra = p.BARCODE_EXTRA ? p.BARCODE_EXTRA.split(',').map((b) => S(b)) : [];
    const allCodes = [
      S(p.KODE_BARCODE),
      S(p.KODE_BARANG),
      S(p.BARCODE_2),
      S(p.BARCODE_3),
      S(p.BARCODE_4),
      S(p.BARCODE_5),
      S(p.BARCODE_6),
      ...extraBarcodes,
      ...commaExtra,
    ].filter(Boolean);

    if (allCodes.includes(code)) return p;
    if (zCode && allCodes.some((c) => stripLeadingZeros(c) === zCode)) return p;
  }
  return null;
}
