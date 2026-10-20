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
      const allBc = [
        it.KODE_BARCODE,
        it.BARCODE_2,
        it.BARCODE_3,
        it.BARCODE_4,
        it.BARCODE_5,
        it.BARCODE_6,
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

  // Exact code matches get top priority (matches primary or any secondary barcode)
  const exactMatches = products.filter((it) => {
    if (selectedCat && it.KATEGORI !== selectedCat) return false;
    const bcs = [
      S(it.KODE_BARCODE),
      S(it.BARCODE_2),
      S(it.BARCODE_3),
      S(it.BARCODE_4),
      S(it.BARCODE_5),
      S(it.BARCODE_6),
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
