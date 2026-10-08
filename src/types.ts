export interface Store {
  id: string; // Permanent UUID
  name: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  webhookUrl: string;
  active: boolean;
  autoSync: boolean; // STRICT DEFAULT: false
  autoSyncIntervalMinutes?: number; // e.g. 5, 10, 15, 30 min (default: 10)
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

export type NavTab = 'inventory' | 'opname' | 'purchase' | 'settings';

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
] as const;

export const PRICE_GROUPS: PriceGroup[] = [
  { label: 'Retail', prefix: 'RETAIL', indices: ['1', '2'] },
  { label: 'Grosir', prefix: 'GROSIR', indices: ['1', '2'] },
  { label: 'Cabang', prefix: 'CABANG', indices: ['1', '2'] },
];
