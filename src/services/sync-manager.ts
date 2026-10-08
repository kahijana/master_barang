import Papa from 'papaparse';
import { COLUMNS, Product, Store } from '../types';
import { extractSheetId, normalizeProduct, S } from '../utils/format';
import { generateUUID } from '../utils/uuid';

export async function validateStoreForPull(store: Store | null): Promise<string> {
  if (!store || !store.id) {
    throw new Error('Sync tidak dapat dilakukan. Pilih toko aktif terlebih dahulu.');
  }

  const sheetId = store.spreadsheetId || extractSheetId(store.spreadsheetUrl);
  if (!sheetId) {
    throw new Error(
      `Sync tidak dapat dilakukan. Konfigurasi Spreadsheet untuk toko "${store.name}" belum diisi.`
    );
  }

  return sheetId;
}

export async function validateStoreForPush(store: Store | null): Promise<string> {
  if (!store || !store.id) {
    throw new Error('Sync tidak dapat dilakukan. Pilih toko aktif terlebih dahulu.');
  }

  const webhook = S(store.webhookUrl);
  if (!webhook) {
    throw new Error(
      `Sync tidak dapat dilakukan. Webhook URL untuk toko "${store.name}" belum diisi di Pengaturan Toko.`
    );
  }

  return webhook;
}

export async function rawPullStoreProducts(store: Store): Promise<Product[]> {
  const sheetId = await validateStoreForPull(store);

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=1&_=${Date.now()}`;
  const response = await fetch(url, { cache: 'no-store' });
  const text = await response.text();

  if (!response.ok || /^\s*</.test(text)) {
    throw new Error(
      `Spreadsheet toko "${store.name}" tidak dapat dibaca. Pastikan akses spreadsheet diatur ke "Siapa saja yang memiliki link – Pelihat" (Anyone with the link can view).`
    );
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => S(h).toUpperCase().replace(/\s+/g, '_'),
  });

  const fields = parsed.meta.fields || [];
  if (!fields.includes('NAMA') || !fields.includes('KODE_BARANG')) {
    throw new Error(
      `Format kolom tidak cocok. Header baris pertama harus memiliki kolom KODE_BARANG dan NAMA.`
    );
  }

  const validRows = parsed.data.filter(
    (row) => S(row.KODE_BARANG) || S(row.NAMA)
  );

  return validRows.map((raw) => {
    const p = normalizeProduct(raw, store.id);
    if (!p.product_id) {
      p.product_id = generateUUID();
    }
    p.store_id = store.id;
    return p;
  });
}

export async function rawPushStoreProducts(
  store: Store,
  products: Product[]
): Promise<{ ok: boolean; msg: string; confirmed: boolean }> {
  const webhookUrl = await validateStoreForPush(store);

  // Guarantee that every item belongs strictly to this store
  const filteredProducts = products.filter((p) => p.store_id === store.id);

  const payload = {
    store_id: store.id,
    store_name: store.name,
    data: filteredProducts.map((item) => {
      const row: Record<string, unknown> = {};
      for (const col of COLUMNS) {
        row[col] = item[col];
      }
      return row;
    }),
  };

  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  };

  try {
    const res = await fetch(webhookUrl, options);
    const json = await res.json();
    return {
      ok: json.status === 'success',
      msg: json.message || '',
      confirmed: true,
    };
  } catch {
    // Google Apps Script redirect might be opaque under browser CORS, try fallback
    try {
      await fetch(webhookUrl, { ...options, mode: 'no-cors' });
      return { ok: true, msg: '', confirmed: false };
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Koneksi gagal';
      throw new Error(`Gagal menghubungi webhook toko "${store.name}": ${errMessage}`);
    }
  }
}

export async function testSpreadsheetConnection(store: Store): Promise<{ ok: boolean; msg: string }> {
  try {
    const sheetId = await validateStoreForPull(store);
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=1&_=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    const text = await response.text();

    if (!response.ok || /^\s*</.test(text)) {
      return {
        ok: false,
        msg: 'Spreadsheet tidak dapat diakses. Pastikan izin berbagi adalah "Siapa saja dengan link: Pelihat".',
      };
    }

    return { ok: true, msg: 'Koneksi Spreadsheet berhasil. Data CSV terbaca dengan baik.' };
  } catch (err: unknown) {
    return { ok: false, msg: err instanceof Error ? err.message : 'Gagal terhubung ke spreadsheet.' };
  }
}

export async function testStoreWebhookConnection(store: Store): Promise<{ ok: boolean; msg: string }> {
  try {
    const webhookUrl = await validateStoreForPush(store);
    const res = await fetch(webhookUrl, { cache: 'no-store' });
    const json = await res.json();
    if (json.status === 'ready' || json.status === 'success') {
      return { ok: true, msg: 'Webhook aktif dan siap menerima data.' };
    }
    return { ok: false, msg: 'Webhook merespons tetapi status tidak dikenali.' };
  } catch {
    return {
      ok: false,
      msg: 'Webhook tidak dapat dihubungi. Periksa URL dan izin deploy Apps Script ("Anyone").',
    };
  }
}

/**
 * Dedicated Centralized Sync Controller (SyncManager)
 * Enforces strict manual mode when autoSync === false,
 * and prevents duplicate concurrent sync requests.
 */
class SyncController {
  private _isSyncing = false;

  public isSyncing(): boolean {
    return this._isSyncing;
  }

  public isAutoSyncEnabled(store: Store | null): boolean {
    return Boolean(store && store.autoSync === true);
  }

  public async manualPull(store: Store): Promise<{ products: Product[]; timestamp: string }> {
    if (this._isSyncing) {
      throw new Error('Proses sinkronisasi sedang berjalan. Harap tunggu.');
    }

    this._isSyncing = true;
    try {
      const products = await rawPullStoreProducts(store);
      const timestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return { products, timestamp };
    } finally {
      this._isSyncing = false;
    }
  }

  public async manualPush(
    store: Store,
    products: Product[]
  ): Promise<{ confirmed: boolean; timestamp: string; msg: string }> {
    if (this._isSyncing) {
      throw new Error('Proses sinkronisasi sedang berjalan. Harap tunggu.');
    }

    this._isSyncing = true;
    try {
      const res = await rawPushStoreProducts(store, products);
      const timestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return { confirmed: res.confirmed, timestamp, msg: res.msg };
    } finally {
      this._isSyncing = false;
    }
  }

  public async autoSync(
    store: Store,
    products: Product[],
    isDirty: boolean
  ): Promise<{ type: 'push' | 'pull'; timestamp: string; products?: Product[]; confirmed?: boolean } | null> {
    // STRICT CHECK: Auto sync is prohibited when store.autoSync === false
    if (!this.isAutoSyncEnabled(store)) {
      return null;
    }

    if (this._isSyncing) {
      return null; // Don't interrupt or duplicate in-flight requests
    }

    // If local changes are dirty and webhook is configured, push them
    if (isDirty && store.webhookUrl) {
      const pushRes = await this.manualPush(store, products);
      return { type: 'push', timestamp: pushRes.timestamp, confirmed: pushRes.confirmed };
    }

    // Otherwise, if spreadsheet is configured and not dirty, pull updates
    if (!isDirty && (store.spreadsheetId || store.spreadsheetUrl)) {
      const pullRes = await this.manualPull(store);
      return { type: 'pull', timestamp: pullRes.timestamp, products: pullRes.products };
    }

    return null;
  }
}

export const SyncManager = new SyncController();
