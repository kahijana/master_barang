import { Product, TEXT_FIELDS, NUM_FIELDS } from '../types';
import { generateUUID } from './uuid';

export const S = (v: unknown): string => String(v ?? '').trim();

export function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = S(v).replace(/[^\d.,-]/g, '');
  if (!s) return 0;

  // Indonesian format with thousand separators like 17.000 or 1.234,50
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+,\d+$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function fmt(n: number | null | undefined): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n || 0);
}

export function formatRupiah(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return '—';
  return `Rp ${fmt(n)}`;
}

export function toISO(v: unknown): string {
  const s = S(v);
  if (!s) return '';
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // Indonesian date: dd/mm/yyyy or dd-mm-yyyy
  const idMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (idMatch) {
    return `${idMatch[3]}-${idMatch[2].padStart(2, '0')}-${idMatch[1].padStart(2, '0')}`;
  }
  return '';
}

export function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function stripLeadingZeros(s: string): string {
  return S(s).replace(/^0+/, '');
}

export function extractSheetId(urlOrId: string): string {
  const s = S(urlOrId);
  if (!s) return '';
  const match = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return /^[a-zA-Z0-9_-]{25,}$/.test(s) ? s : '';
}

export function normalizeProduct(raw: Partial<Product> | Record<string, unknown>, storeId: string): Product {
  const r = raw as Record<string, unknown>;
  const o = {} as Product;
  o.product_id = S(r.product_id) || (r.id ? String(r.id) : generateUUID());
  o.store_id = storeId;

  for (const k of TEXT_FIELDS) {
    const val = r[k] ?? r[k.toLowerCase()];
    o[k] = S(val);
  }
  for (const k of NUM_FIELDS) {
    const val = r[k] ?? r[k.toLowerCase()];
    o[k] = toNum(val);
  }

  // Handle aliases for stock
  if (!o.TOKO && (r.stok_toko !== undefined || r.STOK_TOKO !== undefined)) {
    o.TOKO = toNum(r.stok_toko ?? r.STOK_TOKO);
  }
  if (!o.GUDANG && (r.stok_gudang !== undefined || r.STOK_GUDANG !== undefined)) {
    o.GUDANG = toNum(r.stok_gudang ?? r.STOK_GUDANG);
  }

  if (!o.ISI || o.ISI <= 0) o.ISI = 1;
  if (!o.SATUAN_1) o.SATUAN_1 = 'PCS';
  if (!o.TANGGAL_BELI) o.TANGGAL_BELI = getToday();

  return o;
}

export function createBlankProduct(storeId: string): Product {
  const o = {} as Product;
  o.product_id = generateUUID();
  o.store_id = storeId;

  for (const k of TEXT_FIELDS) {
    o[k] = '';
  }
  for (const k of NUM_FIELDS) {
    o[k] = 0;
  }
  o.ISI = 1;
  o.SATUAN_1 = 'PCS';
  o.SATUAN_2 = '';
  o.TANGGAL_BELI = getToday();
  return o;
}
