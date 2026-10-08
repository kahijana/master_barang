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
    const searchData: SearchIndexItem[] = products.map((it) => ({
      product_id: it.product_id,
      n: it.NAMA,
      kb: it.KODE_BARANG,
      bc: it.KODE_BARCODE,
      k: it.KATEGORI,
      s: it.SUPPLIER,
    }));

    activeStoreSearchIndex = new Fuse(searchData, {
      keys: [
        { name: 'n', weight: 3 },
        { name: 'kb', weight: 2 },
        { name: 'bc', weight: 2 },
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

  // Exact code matches get top priority (strictly inside current store's products)
  const exactMatches = products.filter((it) => {
    if (selectedCat && it.KATEGORI !== selectedCat) return false;
    const itBc = S(it.KODE_BARCODE);
    const itKb = S(it.KODE_BARANG);
    if (itBc === q || itKb === q) return true;
    if (zQuery && (stripLeadingZeros(itBc) === zQuery || stripLeadingZeros(itKb) === zQuery)) {
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
