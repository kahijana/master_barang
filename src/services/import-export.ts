import Papa from 'papaparse';
import { COLUMNS, Product, Store } from '../types';
import { normalizeProduct, S } from '../utils/format';
import { generateUUID } from '../utils/uuid';

export function exportStoreProductsAsJSON(store: Store, products: Product[]): void {
  const storeProducts = products.filter((p) => p.store_id === store.id);
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(storeProducts, null, 2));
  const downloadAnchor = document.createElement('a');
  const filename = `master_barang_${store.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportStoreProductsAsCSV(store: Store, products: Product[]): void {
  const storeProducts = products.filter((p) => p.store_id === store.id);
  const csvData = storeProducts.map((item) => {
    const row: Record<string, unknown> = {};
    for (const col of COLUMNS) {
      row[col] = item[col];
    }
    return row;
  });

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  const filename = `master_barang_${store.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
}

export async function parseImportedFile(
  file: File,
  storeId: string
): Promise<{ success: boolean; products: Product[]; error?: string }> {
  try {
    const text = await file.text();

    // Check if JSON
    if (file.name.endsWith('.json') || text.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          return { success: false, products: [], error: 'Format JSON harus berupa daftar array produk.' };
        }

        const validProducts = parsed
          .filter((item) => item && (S(item.KODE_BARANG) || S(item.NAMA)))
          .map((raw) => {
            const p = normalizeProduct(raw, storeId);
            p.store_id = storeId;
            p.product_id = raw.product_id || generateUUID();
            return p;
          });

        return { success: true, products: validProducts };
      } catch (jsonErr) {
        return { success: false, products: [], error: 'Gagal memproses file JSON: ' + String(jsonErr) };
      }
    }

    // Otherwise, parse as CSV
    const parsedCsv = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => S(h).toUpperCase().replace(/\s+/g, '_'),
    });

    const fields = parsedCsv.meta.fields || [];
    if (!fields.includes('NAMA') || !fields.includes('KODE_BARANG')) {
      return {
        success: false,
        products: [],
        error: 'Kolom CSV harus mencakup KODE_BARANG dan NAMA pada baris header.',
      };
    }

    const validCsvProducts = parsedCsv.data
      .filter((row) => S(row.KODE_BARANG) || S(row.NAMA))
      .map((raw) => {
        const p = normalizeProduct(raw, storeId);
        p.store_id = storeId;
        p.product_id = generateUUID();
        return p;
      });

    return { success: true, products: validCsvProducts };
  } catch (err: unknown) {
    return {
      success: false,
      products: [],
      error: err instanceof Error ? err.message : 'Gagal membaca file import.',
    };
  }
}
