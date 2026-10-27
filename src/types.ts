export interface Store {
  id: string; // Permanent UUID
  name: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  webhookUrl: string;
  active: boolean;
  autoSync: boolean; // STRICT DEFAULT: false
  autoSyncIntervalMinutes?: number; // e.g. 5, 10, 15, 30 min (default: 10)
  displayPriceField?: 'HARGA_RETAIL_1' | 'HPP' | 'HARGA_RETAIL_2' | 'HARGA_GROSIR_1' | 'HARGA_GROSIR_2' | 'HARGA_CABANG_1' | string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  product_id: string; // Permanent UUID
  store_id: string;   // Associated Store UUID
  KODE_BARANG: string;
  KODE_BARCODE: string;
  NAMA: string;
  KATEGORI: string;
  SUPPLIER: string;
  TANGGAL_BELI: string;
  ISI: number;
  SATUAN_1: string;
  SATUAN_2: string;
  TOKO: number;
  GUDANG: number;
  HPP: number;
  HARGA_RETAIL_1: number;
  HARGA_RETAIL_2: number;
  HARGA_GROSIR_1: number;
  HARGA_GROSIR_2: number;
  HARGA_CABANG_1: number;
  HARGA_CABANG_2: number;

  // Unlimited Alternate Barcodes
  alternate_barcodes?: Array<{ barcode: string; unit?: string }>;
  BARCODE_EXTRA?: string; // Comma-separated extra barcodes for sheet compatibility

  // Multi-Barcode (Kolom 19 - 28 di Google Sheets)
  BARCODE_2?: string;
  SATUAN_BARCODE_2?: string;
  BARCODE_3?: string;
  SATUAN_BARCODE_3?: string;
  BARCODE_4?: string;
  SATUAN_BARCODE_4?: string;
  BARCODE_5?: string;
  SATUAN_BARCODE_5?: string;
  BARCODE_6?: string;
  SATUAN_BARCODE_6?: string;

  // Bundle Pricing (Kolom 29 - 43 di Google Sheets)
  BUNDLE_QTY_1?: number | null;
  BUNDLE_HARGA_1?: number | null;
  BUNDLE_PROFIT_1?: number | null;
  BUNDLE_QTY_2?: number | null;
  BUNDLE_HARGA_2?: number | null;
  BUNDLE_PROFIT_2?: number | null;
  BUNDLE_QTY_3?: number | null;
  BUNDLE_HARGA_3?: number | null;
  BUNDLE_PROFIT_3?: number | null;
  BUNDLE_QTY_4?: number | null;
  BUNDLE_HARGA_4?: number | null;
  BUNDLE_PROFIT_4?: number | null;
  BUNDLE_QTY_5?: number | null;
  BUNDLE_HARGA_5?: number | null;
  BUNDLE_PROFIT_5?: number | null;

  // Supplier Pembanding 2, 3, 4 (Kolom 44 - 55 di Google Sheets)
  SUP2_NAMA?: string;
  SUP2_HPP?: number | null;
  SUP2_TGL?: string;
  SUP2_CATATAN?: string;
  SUP3_NAMA?: string;
  SUP3_HPP?: number | null;
  SUP3_TGL?: string;
  SUP3_CATATAN?: string;
  SUP4_NAMA?: string;
  SUP4_HPP?: number | null;
  SUP4_TGL?: string;
  SUP4_CATATAN?: string;
}

export interface LaporanRow {
  key_unik: string;
  tipe_transaksi: 'PENJUALAN' | 'PEMBELIAN';
  nomor_faktur: string;
  tanggal: string; // yyyy-mm-dd
  waktu: string;   // hh:mm:ss
  tahun: number;
  bulan: string;   // yyyy-mm
  minggu: string;  // e.g. W42
  hari: string;    // e.g. Selasa
  status_transaksi: string;
  status_bayar: string;
  metode_bayar: string;
  kasir: string;
  pelanggan_supplier: string;
  jatuh_tempo: string;
  kode_barang: string;
  barcode: string;
  nama_barang: string;
  kategori: string;
  satuan: string;
  qty: number;
  harga_satuan: number;
  hpp_satuan: number;
  diskon_nominal: number;
  subtotal: number;
  total_hpp: number;
  laba_kotor: number;
  margin_persen: number;
  catatan: string;
}

export type SyncState = 'off' | 'ok' | 'pending' | 'busy' | 'err';

export interface SyncStatus {
  state: SyncState;
  msg: string;
  lastPull: string;
  lastPush: string;
  mode: 'MANUAL' | 'AUTO';
  isSyncing: boolean;
}

export type NavTab = 'inventory' | 'opname' | 'purchase' | 'laporan' | 'settings';

export const LAPORAN_COLUMNS = [
  'KEY_UNIK',
  'TIPE_TRANSAKSI',
  'NOMOR_FAKTUR',
  'TANGGAL',
  'WAKTU',
  'TAHUN',
  'BULAN',
  'MINGGU',
  'HARI',
  'STATUS_TRANSAKSI',
  'STATUS_BAYAR',
  'METODE_BAYAR',
  'KASIR',
  'PELANGGAN_SUPPLIER',
  'JATUH_TEMPO',
  'KODE_BARANG',
  'BARCODE',
  'NAMA_BARANG',
  'KATEGORI',
  'SATUAN',
  'QTY',
  'HARGA_SATUAN',
  'HPP_SATUAN',
  'DISKON_NOMINAL',
  'SUBTOTAL',
  'TOTAL_HPP',
  'LABA_KOTOR',
  'MARGIN_PERSEN',
  'CATATAN',
] as const;

/* ================== OPNAME / STOCK OPNAME ================== */
export type OpnameStatus = 'DRAFT' | 'IN PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface OpnameSession {
  opname_id: string; // UUID
  store_id: string; // Store UUID
  opname_number: string; // e.g. OP-2026-0001
  date: string; // YYYY-MM-DD
  status: OpnameStatus;
  notes: string;
  target_location: 'TOKO' | 'GUDANG';
  adjusted: boolean; // True if "Terapkan Selisih" has been committed to stock
  adjustedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type OpnameItemStatus = 'MATCH' | 'SHORT' | 'OVER' | 'UNCOUNTED';

export interface OpnameItem {
  opname_item_id: string; // UUID
  opname_id: string;
  store_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  product_barcode: string;
  system_stock: number;
  physical_stock: number;
  difference: number; // physical_stock - system_stock
  unit: string;
  counted: boolean; // true if physical stock explicitly counted/entered
  notes: string;
}

/* ================== PEMBELIAN / PURCHASE ================== */
export type PurchaseStatus = 'DRAFT' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseDocument {
  purchase_id: string; // UUID
  store_id: string;
  purchase_number: string; // e.g. PB-2026-0001
  supplier: string;
  purchase_date: string;
  status: PurchaseStatus;
  notes: string;
  target_location: 'TOKO' | 'GUDANG';
  invoice_photos?: string[]; // Compressed base64 data URLs
  subtotal: number;
  discount: number; // Transaction-level discount
  additional_cost: number; // Ongkir, layanan, etc.
  allocate_cost: boolean; // Proportional allocation across items
  grand_total: number;
  receivedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  purchase_item_id: string; // UUID
  purchase_id: string;
  store_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  product_barcode: string;
  order_quantity: number; // Qty Pesan
  received_quantity: number; // Qty Diterima
  unit: string;
  purchase_price: number; // Harga Beli
  discount: number; // Diskon per item
  subtotal: number;
}

/* ================== STOCK TRANSACTIONS / AUDIT ================== */
export type StockTransactionType = 'PEMBELIAN' | 'OPNAME' | 'PENJUALAN' | 'ADJUSTMENT';

export interface StockTransaction {
  transaction_id: string; // UUID
  store_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  location: 'TOKO' | 'GUDANG';
  type: StockTransactionType;
  quantity: number; // Signed delta (+95, -5)
  previous_stock: number;
  final_stock: number;
  reference_id: string; // purchase_id or opname_id
  reference_number: string; // PB-2026-0001 or OP-2026-0001
  date: string;
  notes: string;
  createdAt: string;
}

export interface PriceGroup {
  label: string;
  prefix: 'RETAIL' | 'GROSIR' | 'CABANG';
  indices: ['1', '2'];
}

export const TEXT_FIELDS = [
  'KODE_BARANG',
  'KODE_BARCODE',
  'NAMA',
  'KATEGORI',
  'SUPPLIER',
  'TANGGAL_BELI',
  'SATUAN_1',
  'SATUAN_2',
  'BARCODE_2',
  'SATUAN_BARCODE_2',
  'BARCODE_3',
  'SATUAN_BARCODE_3',
  'BARCODE_4',
  'SATUAN_BARCODE_4',
  'BARCODE_5',
  'SATUAN_BARCODE_5',
  'BARCODE_6',
  'SATUAN_BARCODE_6',
  'SUP2_NAMA',
  'SUP2_TGL',
  'SUP2_CATATAN',
  'SUP3_NAMA',
  'SUP3_TGL',
  'SUP3_CATATAN',
  'SUP4_NAMA',
  'SUP4_TGL',
  'SUP4_CATATAN',
] as const;

export const NUM_FIELDS = [
  'ISI',
  'TOKO',
  'GUDANG',
  'HPP',
  'HARGA_RETAIL_1',
  'HARGA_RETAIL_2',
  'HARGA_GROSIR_1',
  'HARGA_GROSIR_2',
  'HARGA_CABANG_1',
  'HARGA_CABANG_2',
  'BUNDLE_QTY_1',
  'BUNDLE_HARGA_1',
  'BUNDLE_PROFIT_1',
  'BUNDLE_QTY_2',
  'BUNDLE_HARGA_2',
  'BUNDLE_PROFIT_2',
  'BUNDLE_QTY_3',
  'BUNDLE_HARGA_3',
  'BUNDLE_PROFIT_3',
  'BUNDLE_QTY_4',
  'BUNDLE_HARGA_4',
  'BUNDLE_PROFIT_4',
  'BUNDLE_QTY_5',
  'BUNDLE_HARGA_5',
  'BUNDLE_PROFIT_5',
  'SUP2_HPP',
  'SUP3_HPP',
  'SUP4_HPP',
] as const;

export const COLUMNS = [
  'KODE_BARANG',
  'KODE_BARCODE',
  'NAMA',
  'KATEGORI',
  'SUPPLIER',
  'TANGGAL_BELI',
  'ISI',
  'SATUAN_1',
  'SATUAN_2',
  'TOKO',
  'GUDANG',
  'HPP',
  'HARGA_RETAIL_1',
  'HARGA_RETAIL_2',
  'HARGA_GROSIR_1',
  'HARGA_GROSIR_2',
  'HARGA_CABANG_1',
  'HARGA_CABANG_2',
  'BARCODE_2',
  'SATUAN_BARCODE_2',
  'BARCODE_3',
  'SATUAN_BARCODE_3',
  'BARCODE_4',
  'SATUAN_BARCODE_4',
  'BARCODE_5',
  'SATUAN_BARCODE_5',
  'BARCODE_6',
  'SATUAN_BARCODE_6',
  'BUNDLE_QTY_1',
  'BUNDLE_HARGA_1',
  'BUNDLE_PROFIT_1',
  'BUNDLE_QTY_2',
  'BUNDLE_HARGA_2',
  'BUNDLE_PROFIT_2',
  'BUNDLE_QTY_3',
  'BUNDLE_HARGA_3',
  'BUNDLE_PROFIT_3',
  'BUNDLE_QTY_4',
  'BUNDLE_HARGA_4',
  'BUNDLE_PROFIT_4',
  'BUNDLE_QTY_5',
  'BUNDLE_HARGA_5',
  'BUNDLE_PROFIT_5',
  'SUP2_NAMA',
  'SUP2_HPP',
  'SUP2_TGL',
  'SUP2_CATATAN',
  'SUP3_NAMA',
  'SUP3_HPP',
  'SUP3_TGL',
  'SUP3_CATATAN',
  'SUP4_NAMA',
  'SUP4_HPP',
  'SUP4_TGL',
  'SUP4_CATATAN',
] as const;

export const PRICE_GROUPS: PriceGroup[] = [
  { label: 'Retail', prefix: 'RETAIL', indices: ['1', '2'] },
  { label: 'Grosir', prefix: 'GROSIR', indices: ['1', '2'] },
  { label: 'Cabang', prefix: 'CABANG', indices: ['1', '2'] },
];
