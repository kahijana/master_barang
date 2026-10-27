import Papa from 'papaparse';
import { COLUMNS, LaporanRow, Product, Store } from '../types';
import { extractSheetId, normalizeProduct, S, toNum } from '../utils/format';
import { generateUUID } from '../utils/uuid';
import {
  getStoreProducts,
  getStorePurchases,
  getStorePurchaseItems,
} from './storage-manager';

export const DEFAULT_GS_SPREADSHEET_ID = '1W9gjG_SBZXB-IwJvKiPBCa-xHCoa0pdr4swuNBYJuTQ';

export async function validateStoreForPull(store: Store | null): Promise<string> {
  if (!store || !store.id) {
    throw new Error('Sync tidak dapat dilakukan. Pilih toko aktif terlebih dahulu.');
  }

  const sheetId = store.spreadsheetId || extractSheetId(store.spreadsheetUrl) || DEFAULT_GS_SPREADSHEET_ID;
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
  if (!fields.includes('NAMA') && !fields.includes('KODE_BARANG')) {
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
    action: 'sync_barang',
    store_id: store.id,
    store_name: store.name,
    data: filteredProducts.map((item) => {
      const row: Record<string, unknown> = {};
      // Include all 55 columns in standard uppercase
      for (const col of COLUMNS) {
        row[col] = item[col] ?? '';
      }

      // Also map exact lowercase keys as expected by the Google Apps Script
      row.kode_barang = item.KODE_BARANG || '';
      row.kode_barcode = item.KODE_BARCODE || '';
      row.nama = item.NAMA || '';
      row.kategori = item.KATEGORI || '';
      row.supplier = item.SUPPLIER || '';
      row.tanggal_beli = item.TANGGAL_BELI || '';
      row.isi = Number(item.ISI) || 1;
      row.satuan_1 = item.SATUAN_1 || 'PCS';
      row.satuan_2 = item.SATUAN_2 || '';
      row.stok_toko = Number(item.TOKO) || 0;
      row.stok_gudang = Number(item.GUDANG) || 0;
      row.hpp = Number(item.HPP) || 0;
      row.harga_retail_1 = Number(item.HARGA_RETAIL_1) || 0;
      row.harga_retail_2 = Number(item.HARGA_RETAIL_2) || 0;
      row.harga_grosir_1 = Number(item.HARGA_GROSIR_1) || 0;
      row.harga_grosir_2 = Number(item.HARGA_GROSIR_2) || 0;
      row.harga_cabang_1 = Number(item.HARGA_CABANG_1) || 0;
      row.harga_cabang_2 = Number(item.HARGA_CABANG_2) || 0;

      // Multi-barcode & Alternate Barcodes
      row.barcode_2 = item.BARCODE_2 || '';
      row.satuan_barcode_2 = item.SATUAN_BARCODE_2 || '';
      row.barcode_3 = item.BARCODE_3 || '';
      row.satuan_barcode_3 = item.SATUAN_BARCODE_3 || '';
      row.barcode_4 = item.BARCODE_4 || '';
      row.satuan_barcode_4 = item.SATUAN_BARCODE_4 || '';
      row.barcode_5 = item.BARCODE_5 || '';
      row.satuan_barcode_5 = item.SATUAN_BARCODE_5 || '';
      row.barcode_6 = item.BARCODE_6 || '';
      row.satuan_barcode_6 = item.SATUAN_BARCODE_6 || '';
      row.alternate_barcodes = item.alternate_barcodes || [];

      // Bundle pricing
      row.bundle_qty_1 = item.BUNDLE_QTY_1 ?? '';
      row.bundle_harga_1 = item.BUNDLE_HARGA_1 ?? '';
      row.bundle_profit_1 = item.BUNDLE_PROFIT_1 ?? '';
      row.bundle_qty_2 = item.BUNDLE_QTY_2 ?? '';
      row.bundle_harga_2 = item.BUNDLE_HARGA_2 ?? '';
      row.bundle_profit_2 = item.BUNDLE_PROFIT_2 ?? '';
      row.bundle_qty_3 = item.BUNDLE_QTY_3 ?? '';
      row.bundle_harga_3 = item.BUNDLE_HARGA_3 ?? '';
      row.bundle_profit_3 = item.BUNDLE_PROFIT_3 ?? '';
      row.bundle_qty_4 = item.BUNDLE_QTY_4 ?? '';
      row.bundle_harga_4 = item.BUNDLE_HARGA_4 ?? '';
      row.bundle_profit_4 = item.BUNDLE_PROFIT_4 ?? '';
      row.bundle_qty_5 = item.BUNDLE_QTY_5 ?? '';
      row.bundle_harga_5 = item.BUNDLE_HARGA_5 ?? '';
      row.bundle_profit_5 = item.BUNDLE_PROFIT_5 ?? '';

      // Comparison Suppliers
      row.sup2_nama = item.SUP2_NAMA || '';
      row.sup2_hpp = item.SUP2_HPP ?? '';
      row.sup2_tgl = item.SUP2_TGL || '';
      row.sup2_catatan = item.SUP2_CATATAN || '';
      row.sup3_nama = item.SUP3_NAMA || '';
      row.sup3_hpp = item.SUP3_HPP ?? '';
      row.sup3_tgl = item.SUP3_TGL || '';
      row.sup3_catatan = item.SUP3_CATATAN || '';
      row.sup4_nama = item.SUP4_NAMA || '';
      row.sup4_hpp = item.SUP4_HPP ?? '';
      row.sup4_tgl = item.SUP4_TGL || '';
      row.sup4_catatan = item.SUP4_CATATAN || '';

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

/**
 * PUSH LAPORAN (PENJUALAN & PEMBELIAN)
 * Mengirim data laporan transaksi ke sheet "Laporan" via aksi sync_laporan di Google Apps Script.
 */
export async function rawPushStoreLaporan(
  store: Store,
  reports: LaporanRow[]
): Promise<{ ok: boolean; msg: string; updated?: number; inserted?: number; confirmed: boolean }> {
  const webhookUrl = await validateStoreForPush(store);

  const payload = {
    action: 'sync_laporan',
    store_id: store.id,
    store_name: store.name,
    data: reports.map((r) => ({
      key_unik: r.key_unik,
      tipe_transaksi: r.tipe_transaksi,
      nomor_faktur: r.nomor_faktur,
      tanggal: r.tanggal,
      waktu: r.waktu,
      tahun: r.tahun,
      bulan: r.bulan,
      minggu: r.minggu,
      hari: r.hari,
      status_transaksi: r.status_transaksi,
      status_bayar: r.status_bayar,
      metode_bayar: r.metode_bayar,
      kasir: r.kasir,
      pelanggan_supplier: r.pelanggan_supplier,
      jatuh_tempo: r.jatuh_tempo,
      kode_barang: r.kode_barang,
      barcode: r.barcode,
      nama_barang: r.nama_barang,
      kategori: r.kategori,
      satuan: r.satuan,
      qty: r.qty,
      harga_satuan: r.harga_satuan,
      hpp_satuan: r.hpp_satuan,
      diskon_nominal: r.diskon_nominal,
      subtotal: r.subtotal,
      total_hpp: r.total_hpp,
      laba_kotor: r.laba_kotor,
      margin_persen: r.margin_persen,
      catatan: r.catatan,

      KEY_UNIK: r.key_unik,
      TIPE_TRANSAKSI: r.tipe_transaksi,
      NOMOR_FAKTUR: r.nomor_faktur,
      TANGGAL: r.tanggal,
      WAKTU: r.waktu,
      TAHUN: r.tahun,
      BULAN: r.bulan,
      MINGGU: r.minggu,
      HARI: r.hari,
      STATUS_TRANSAKSI: r.status_transaksi,
      STATUS_BAYAR: r.status_bayar,
      METODE_BAYAR: r.metode_bayar,
      KASIR: r.kasir,
      PELANGGAN_SUPPLIER: r.pelanggan_supplier,
      JATUH_TEMPO: r.jatuh_tempo,
      KODE_BARANG: r.kode_barang,
      BARCODE: r.barcode,
      NAMA_BARANG: r.nama_barang,
      KATEGORI: r.kategori,
      SATUAN: r.satuan,
      QTY: r.qty,
      HARGA_SATUAN: r.harga_satuan,
      HPP_SATUAN: r.hpp_satuan,
      DISKON_NOMINAL: r.diskon_nominal,
      SUBTOTAL: r.subtotal,
      TOTAL_HPP: r.total_hpp,
      LABA_KOTOR: r.laba_kotor,
      MARGIN_PERSEN: r.margin_persen,
      CATATAN: r.catatan,
    })),
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
      msg: json.message || `Sync Laporan berhasil: ${json.inserted || 0} baru, ${json.updated || 0} diperbarui.`,
      updated: json.updated,
      inserted: json.inserted,
      confirmed: true,
    };
  } catch {
    try {
      await fetch(webhookUrl, { ...options, mode: 'no-cors' });
      return {
        ok: true,
        msg: 'Laporan dikirim ke webhook (background mode).',
        confirmed: false,
      };
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Koneksi gagal';
      throw new Error(`Gagal mengirim laporan ke sheet "Laporan": ${errMessage}`);
    }
  }
}

/**
 * PULL LAPORAN (PENJUALAN & PEMBELIAN)
 * Mengambil data baris laporan dari sheet "Laporan".
 */
export async function rawPullStoreLaporan(store: Store): Promise<LaporanRow[]> {
  const sheetId = await validateStoreForPull(store);
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Laporan&headers=1&_=${Date.now()}`;
  const response = await fetch(url, { cache: 'no-store' });
  const text = await response.text();

  if (!response.ok || /^\s*</.test(text)) {
    throw new Error(
      `Sheet "Laporan" belum ditemukan atau tidak dapat diakses di spreadsheet toko "${store.name}". Pastikan Anda telah melakukan Kirim Laporan setidaknya satu kali.`
    );
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => S(h).toUpperCase().replace(/\s+/g, '_'),
  });

  return parsed.data
    .filter((r) => S(r.KEY_UNIK) || S(r.NOMOR_FAKTUR))
    .map((row) => ({
      key_unik: S(row.KEY_UNIK),
      tipe_transaksi: (S(row.TIPE_TRANSAKSI).toUpperCase() === 'PEMBELIAN' ? 'PEMBELIAN' : 'PENJUALAN') as 'PENJUALAN' | 'PEMBELIAN',
      nomor_faktur: S(row.NOMOR_FAKTUR),
      tanggal: S(row.TANGGAL),
      waktu: S(row.WAKTU),
      tahun: toNum(row.TAHUN),
      bulan: S(row.BULAN),
      minggu: S(row.MINGGU),
      hari: S(row.HARI),
      status_transaksi: S(row.STATUS_TRANSAKSI) || 'Selesai',
      status_bayar: S(row.STATUS_BAYAR) || 'Lunas',
      metode_bayar: S(row.METODE_BAYAR) || 'Tunai',
      kasir: S(row.KASIR) || 'Kasir',
      pelanggan_supplier: S(row.PELANGGAN_SUPPLIER),
      jatuh_tempo: S(row.JATUH_TEMPO),
      kode_barang: S(row.KODE_BARANG),
      barcode: S(row.BARCODE).replace(/^'/, ''),
      nama_barang: S(row.NAMA_BARANG),
      kategori: S(row.KATEGORI) || 'Umum',
      satuan: S(row.SATUAN) || 'PCS',
      qty: toNum(row.QTY),
      harga_satuan: toNum(row.HARGA_SATUAN),
      hpp_satuan: toNum(row.HPP_SATUAN),
      diskon_nominal: toNum(row.DISKON_NOMINAL),
      subtotal: toNum(row.SUBTOTAL),
      total_hpp: toNum(row.TOTAL_HPP),
      laba_kotor: toNum(row.LABA_KOTOR),
      margin_persen: toNum(row.MARGIN_PERSEN),
      catatan: S(row.CATATAN),
    }));
}

/**
 * Otomatis mengompilasi transaksi Pembelian lokal toko aktif menjadi baris LaporanRow
 * yang siap disinkronkan ke Sheet "Laporan".
 */
export function generateLaporanRowsFromPurchases(storeId: string): LaporanRow[] {
  const purchases = getStorePurchases(storeId);
  const items = getStorePurchaseItems(storeId);
  const products = getStoreProducts(storeId);
  const prodMap = new Map<string, Product>(products.map((p) => [p.product_id, p]));

  const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const rows: LaporanRow[] = [];

  for (const pur of purchases) {
    const purItems = items.filter((it) => it.purchase_id === pur.purchase_id);
    const dateObj = new Date(pur.purchase_date || pur.createdAt);
    const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dayName = isNaN(dateObj.getDay()) ? 'Senin' : daysIndo[dateObj.getDay()];
    const ym = `${year}-${month}`;

    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (dateObj.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    const weekStr = `W${String(weekNum).padStart(2, '0')}`;

    for (const it of purItems) {
      const prod = prodMap.get(it.product_id);
      const qty = it.received_quantity > 0 ? it.received_quantity : it.order_quantity;
      const subtotal = it.subtotal || qty * it.purchase_price;
      const keyUnik = `${pur.purchase_number}_${it.product_code || it.product_id}_${it.unit || 'PCS'}`;

      rows.push({
        key_unik: keyUnik,
        tipe_transaksi: 'PEMBELIAN',
        nomor_faktur: pur.purchase_number,
        tanggal: pur.purchase_date || pur.createdAt.slice(0, 10),
        waktu: pur.createdAt ? pur.createdAt.slice(11, 19) : '12:00:00',
        tahun: year,
        bulan: ym,
        minggu: weekStr,
        hari: dayName,
        status_transaksi:
          pur.status === 'RECEIVED' ? 'Selesai' : pur.status === 'CANCELLED' ? 'Batal' : 'Draft',
        status_bayar: 'Lunas',
        metode_bayar: 'Transfer',
        kasir: 'Admin',
        pelanggan_supplier: pur.supplier || 'Umum',
        jatuh_tempo: '',
        kode_barang: it.product_code,
        barcode: it.product_barcode,
        nama_barang: it.product_name,
        kategori: prod?.KATEGORI || 'Umum',
        satuan: it.unit || 'PCS',
        qty,
        harga_satuan: it.purchase_price,
        hpp_satuan: it.purchase_price,
        diskon_nominal: it.discount || 0,
        subtotal,
        total_hpp: subtotal,
        laba_kotor: 0,
        margin_persen: 0,
        catatan: pur.notes || '',
      });
    }
  }

  return rows;
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

  public async manualPushLaporan(
    store: Store,
    reports?: LaporanRow[]
  ): Promise<{ ok: boolean; msg: string; updated?: number; inserted?: number }> {
    if (this._isSyncing) {
      throw new Error('Proses sinkronisasi sedang berjalan. Harap tunggu.');
    }
    this._isSyncing = true;
    try {
      const dataToSend = reports || generateLaporanRowsFromPurchases(store.id);
      return await rawPushStoreLaporan(store, dataToSend);
    } finally {
      this._isSyncing = false;
    }
  }

  public async manualPullLaporan(store: Store): Promise<LaporanRow[]> {
    if (this._isSyncing) {
      throw new Error('Proses sinkronisasi sedang berjalan. Harap tunggu.');
    }
    this._isSyncing = true;
    try {
      return await rawPullStoreLaporan(store);
    } finally {
      this._isSyncing = false;
    }
  }
}

export const SyncManager = new SyncController();
