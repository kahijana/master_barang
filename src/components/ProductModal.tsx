import React, { useState, useEffect } from 'react';
import {
  X,
  ScanBarcode,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Boxes,
  Truck,
  Tag,
} from 'lucide-react';
import { PRICE_GROUPS, Product } from '../types';
import { createBlankProduct, normalizeProduct, toISO, toNum } from '../utils/format';

interface ProductModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  product: Product | null;
  activeStoreId: string;
  allProducts: Product[];
  categories: string[];
  suppliers: string[];
  units: string[];
  onClose: () => void;
  onSave: (savedProduct: Product, originalProductId: string | null) => void;
  onDelete: (product: Product) => void;
  onScanForBarcode: () => void;
  scannedBarcodeValue?: string;
}

interface AlternateBarcodeItem {
  barcode: string;
  unit: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  mode,
  product,
  activeStoreId,
  allProducts,
  categories,
  suppliers,
  units,
  onClose,
  onSave,
  onDelete,
  onScanForBarcode,
  scannedBarcodeValue,
}) => {
  const [formData, setFormData] = useState<Product>(() => createBlankProduct(activeStoreId));
  const [errorMsg, setErrorMsg] = useState('');
  const [alternateBarcodes, setAlternateBarcodes] = useState<AlternateBarcodeItem[]>([]);
  const [barcodeScanTarget, setBarcodeScanTarget] = useState<'primary' | number>('primary');

  // Accordion toggles for Sheet1 55-column extensions
  const [showMultiBarcode, setShowMultiBarcode] = useState(false);
  const [showBundlePricing, setShowBundlePricing] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);

  const activeBundleCount = [1, 2, 3, 4, 5].filter(
    (idx) =>
      Boolean(
        formData[`BUNDLE_QTY_${idx}` as keyof Product] ||
          formData[`BUNDLE_HARGA_${idx}` as keyof Product]
      )
  ).length;

  const activeSupplierCount = [2, 3, 4].filter((idx) =>
    Boolean(formData[`SUP${idx}_NAMA` as keyof Product])
  ).length;

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && product) {
        setFormData({
          ...product,
          TANGGAL_BELI: toISO(product.TANGGAL_BELI) || product.TANGGAL_BELI,
        });

        // Initialize alternate barcodes
        const initialAlt: AlternateBarcodeItem[] = [];
        if (product.alternate_barcodes && product.alternate_barcodes.length > 0) {
          for (const ab of product.alternate_barcodes) {
            initialAlt.push({ barcode: ab.barcode || '', unit: ab.unit || '' });
          }
        } else {
          for (let slot = 2; slot <= 6; slot++) {
            const bc = (product[`BARCODE_${slot}` as keyof Product] as string) || '';
            const sat = (product[`SATUAN_BARCODE_${slot}` as keyof Product] as string) || '';
            if (bc.trim()) {
              initialAlt.push({ barcode: bc.trim(), unit: sat.trim() });
            }
          }
          if (product.BARCODE_EXTRA) {
            const extras = product.BARCODE_EXTRA.split(',').map((s) => s.trim()).filter(Boolean);
            for (const eb of extras) {
              if (!initialAlt.some((item) => item.barcode === eb)) {
                initialAlt.push({ barcode: eb, unit: product.SATUAN_1 || 'PCS' });
              }
            }
          }
        }
        setAlternateBarcodes(initialAlt);
      } else if (mode === 'add') {
        const blank = createBlankProduct(activeStoreId);
        if (product) {
          Object.assign(blank, product);
          blank.product_id = blank.product_id || product.product_id;
          blank.store_id = activeStoreId;
        }
        setFormData(blank);
        setAlternateBarcodes([]);
      }
      setErrorMsg('');
      setBarcodeScanTarget('primary');
    }
  }, [isOpen, mode, product, activeStoreId]);

  // If a barcode was scanned from the inline scan button
  useEffect(() => {
    if (scannedBarcodeValue && isOpen) {
      if (barcodeScanTarget === 'primary') {
        setFormData((prev) => {
          const next = { ...prev, KODE_BARCODE: scannedBarcodeValue };
          if (!prev.KODE_BARANG) {
            next.KODE_BARANG = scannedBarcodeValue;
          }
          return next;
        });
      } else if (typeof barcodeScanTarget === 'number') {
        setAlternateBarcodes((prev) => {
          const updated = [...prev];
          if (updated[barcodeScanTarget]) {
            updated[barcodeScanTarget] = {
              ...updated[barcodeScanTarget],
              barcode: scannedBarcodeValue,
            };
          }
          return updated;
        });
      }
    }
  }, [scannedBarcodeValue, isOpen, barcodeScanTarget]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Product, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errorMsg) setErrorMsg('');
  };

  const handleNumericChange = (field: keyof Product, value: string) => {
    handleChange(field, toNum(value));
  };

  const handleSyncCodeWithBarcode = () => {
    if (formData.KODE_BARCODE) {
      handleChange('KODE_BARANG', formData.KODE_BARCODE);
    }
  };

  const handleAddBarcodeRow = () => {
    setAlternateBarcodes((prev) => [
      ...prev,
      { barcode: '', unit: formData.SATUAN_1 || 'PCS' },
    ]);
  };

  const handleRemoveBarcodeRow = (index: number) => {
    setAlternateBarcodes((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateBarcodeRow = (index: number, field: 'barcode' | 'unit', val: string) => {
    setAlternateBarcodes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const checkDuplicateBarcode = (code: string): { isDuplicate: boolean; duplicateProduct?: Product } => {
    const clean = code.trim();
    if (!clean) return { isDuplicate: false };
    const currentProductId = mode === 'edit' && product ? product.product_id : null;
    const match = allProducts.find((p) => {
      if (p.product_id === currentProductId) return false;
      const allPBarcodes = [
        p.KODE_BARCODE,
        p.BARCODE_2,
        p.BARCODE_3,
        p.BARCODE_4,
        p.BARCODE_5,
        p.BARCODE_6,
        ...(p.alternate_barcodes || []).map((ab) => ab.barcode),
        ...(p.BARCODE_EXTRA ? p.BARCODE_EXTRA.split(',') : []),
      ].map((b) => (b || '').trim()).filter(Boolean);
      return allPBarcodes.includes(clean);
    });
    return { isDuplicate: Boolean(match), duplicateProduct: match };
  };

  const getDynamicPriceLabel = (prefix: 'RETAIL' | 'GROSIR' | 'CABANG', idx: '1' | '2') => {
    const isIdx1 = idx === '1';
    const unit = isIdx1 ? formData.SATUAN_1?.trim() : formData.SATUAN_2?.trim();
    const base = prefix === 'RETAIL' ? 'Retail' : prefix === 'GROSIR' ? 'Grosir' : 'Cabang';
    if (unit) {
      return `${base} ${unit}`;
    }
    return `${base} (satuan ${isIdx1 ? '1' : '2'} belum diisi)`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeProduct(formData, activeStoreId);
    normalized.product_id = formData.product_id || (product?.product_id ?? normalized.product_id);
    normalized.store_id = activeStoreId;
    normalized.TANGGAL_BELI = toISO(formData.TANGGAL_BELI) || formData.TANGGAL_BELI;

    if (!normalized.NAMA) {
      setErrorMsg('Nama barang wajib diisi.');
      return;
    }
    if (!normalized.KODE_BARANG) {
      setErrorMsg('Kode barang wajib diisi.');
      return;
    }

    const currentProductId = mode === 'edit' && product ? product.product_id : null;

    // Check duplicate KODE_BARANG strictly in the active store
    const dupKode = allProducts.find(
      (p) =>
        p.product_id !== currentProductId &&
        p.KODE_BARANG.toLowerCase() === normalized.KODE_BARANG.toLowerCase()
    );
    if (dupKode) {
      setErrorMsg(`Kode "${normalized.KODE_BARANG}" sudah dipakai oleh ${dupKode.NAMA} di toko ini.`);
      return;
    }

    // Check duplicate primary barcode
    if (normalized.KODE_BARCODE) {
      const dup = checkDuplicateBarcode(normalized.KODE_BARCODE);
      if (dup.isDuplicate && dup.duplicateProduct) {
        setErrorMsg(
          `Barcode "${normalized.KODE_BARCODE}" sudah dipakai oleh barang "${dup.duplicateProduct.NAMA}" (${dup.duplicateProduct.KODE_BARANG}) di toko ini.`
        );
        return;
      }
    }

    // Check alternate barcodes for duplicates against other products and internal duplicates
    const seenBarcodesInForm = new Set<string>();
    if (normalized.KODE_BARCODE) {
      seenBarcodesInForm.add(normalized.KODE_BARCODE.trim());
    }

    for (let i = 0; i < alternateBarcodes.length; i++) {
      const bCode = alternateBarcodes[i].barcode.trim();
      if (!bCode) continue;

      if (seenBarcodesInForm.has(bCode)) {
        setErrorMsg(`Barcode "${bCode}" duplikat di dalam form barang ini.`);
        return;
      }
      seenBarcodesInForm.add(bCode);

      const dup = checkDuplicateBarcode(bCode);
      if (dup.isDuplicate && dup.duplicateProduct) {
        setErrorMsg(
          `Barcode alternatif "${bCode}" sudah dipakai oleh barang "${dup.duplicateProduct.NAMA}" (${dup.duplicateProduct.KODE_BARANG}) di toko ini.`
        );
        return;
      }
    }

    // Map alternate barcodes
    const validAlt = alternateBarcodes
      .map((b) => ({ barcode: b.barcode.trim(), unit: b.unit.trim() }))
      .filter((b) => b.barcode !== '');

    normalized.alternate_barcodes = validAlt;

    // Backward compatibility: fill BARCODE_2..6
    for (let slot = 2; slot <= 6; slot++) {
      const item = validAlt[slot - 2];
      (normalized as any)[`BARCODE_${slot}`] = item ? item.barcode : '';
      (normalized as any)[`SATUAN_BARCODE_${slot}`] = item ? item.unit : '';
    }

    // Extra barcodes beyond slot 6 comma-separated
    if (validAlt.length > 5) {
      normalized.BARCODE_EXTRA = validAlt.slice(5).map((b) => b.barcode).join(',');
    } else {
      normalized.BARCODE_EXTRA = '';
    }

    onSave(normalized, currentProductId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 px-3 pt-safe pb-[calc(var(--sab)+0.75rem)] backdrop-blur-xs sm:px-4 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="my-auto flex max-h-[calc(100dvh-var(--sat)-var(--sab)-1.5rem)] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in slide-in-from-bottom md:max-h-[92vh] md:zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'add' ? 'Tambah Barang Baru' : 'Edit Data Barang'}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'add'
                ? 'Lengkapi rincian produk, stok, dan harga'
                : `Kode: ${product?.KODE_BARANG || ''} (ID: ${product?.product_id?.slice(0, 8)}…)`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="product-form" onSubmit={handleSubmit} className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-6 sm:px-5">
          {errorMsg ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          ) : null}

          {/* SECTION: Informasi Barang */}
          <section className="space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Informasi Barang
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Barang <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.NAMA}
                onChange={(e) => handleChange('NAMA', e.target.value)}
                placeholder="Contoh: Lampu LED 12W Philips"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Barcode Utama
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.KODE_BARCODE}
                    onChange={(e) => handleChange('KODE_BARCODE', e.target.value)}
                    placeholder="Scan atau ketik barcode"
                    className={`w-full h-10 pl-3 pr-10 rounded-xl border outline-none text-sm font-mono transition-all ${
                      checkDuplicateBarcode(formData.KODE_BARCODE).isDuplicate
                        ? 'border-amber-500 bg-amber-50/30 focus:border-amber-600 focus:ring-2 focus:ring-amber-100'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeScanTarget('primary');
                      onScanForBarcode();
                    }}
                    title="Scan Barcode via Kamera"
                    className="absolute right-1 top-1 w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition-colors"
                  >
                    <ScanBarcode className="w-4 h-4" />
                  </button>
                </div>
                {formData.KODE_BARCODE && checkDuplicateBarcode(formData.KODE_BARCODE).isDuplicate ? (
                  <p className="text-[11px] text-amber-700 mt-1 font-medium leading-tight">
                    ⚠️ Barcode sudah dipakai oleh {checkDuplicateBarcode(formData.KODE_BARCODE).duplicateProduct?.NAMA} ({checkDuplicateBarcode(formData.KODE_BARCODE).duplicateProduct?.KODE_BARANG})
                  </p>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Kode Barang <span className="text-red-500">*</span>
                  </label>
                  {formData.KODE_BARCODE && formData.KODE_BARCODE !== formData.KODE_BARANG ? (
                    <button
                      type="button"
                      onClick={handleSyncCodeWithBarcode}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Samakan dg barcode
                    </button>
                  ) : null}
                </div>
                <input
                  type="text"
                  required
                  value={formData.KODE_BARANG}
                  onChange={(e) => handleChange('KODE_BARANG', e.target.value)}
                  placeholder="Contoh: LMP-001"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori
                </label>
                <input
                  type="text"
                  list="categories-list"
                  value={formData.KATEGORI}
                  onChange={(e) => handleChange('KATEGORI', e.target.value)}
                  placeholder="Pilih atau ketik kategori"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  list="suppliers-list"
                  value={formData.SUPPLIER}
                  onChange={(e) => handleChange('SUPPLIER', e.target.value)}
                  placeholder="Pilih atau ketik supplier"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Beli
              </label>
              <input
                type="date"
                value={formData.TANGGAL_BELI}
                onChange={(e) => handleChange('TANGGAL_BELI', e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
              />
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* SECTION: Satuan */}
          <section className="space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Satuan & Kemasan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Satuan 1 (Terkecil)
                </label>
                <input
                  type="text"
                  list="units-list"
                  value={formData.SATUAN_1}
                  onChange={(e) => handleChange('SATUAN_1', e.target.value)}
                  placeholder="PCS"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Satuan 2 (Besar)
                </label>
                <input
                  type="text"
                  list="units-list"
                  value={formData.SATUAN_2}
                  onChange={(e) => handleChange('SATUAN_2', e.target.value)}
                  placeholder="DUS / PACK"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Isi (Satuan 2 per 1)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={formData.ISI || ''}
                  onChange={(e) => handleNumericChange('ISI', e.target.value)}
                  placeholder="1"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all tabular-nums"
                />
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* SECTION: Stok */}
          <section className="space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Stok Fisik
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stok Toko
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.TOKO}
                  onChange={(e) => handleNumericChange('TOKO', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold transition-all tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stok Gudang
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.GUDANG}
                  onChange={(e) => handleNumericChange('GUDANG', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold transition-all tabular-nums"
                />
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* SECTION: Harga */}
          <section className="space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Harga (Rupiah)
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                HPP (Harga Pokok Pembelian)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.HPP || ''}
                onChange={(e) => handleNumericChange('HPP', e.target.value)}
                placeholder="0"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono transition-all tabular-nums"
              />
            </div>

            {PRICE_GROUPS.map((group) => (
              <div key={group.prefix} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.indices.map((idx) => {
                  const key = `HARGA_${group.prefix}_${idx}` as keyof Product;
                  return (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {getDynamicPriceLabel(group.prefix, idx)}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={(formData[key] as number) || ''}
                        onChange={(e) => handleNumericChange(key, e.target.value)}
                        placeholder="0"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono transition-all tabular-nums"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          <hr className="border-slate-100" />

          {/* SECTION: Barcode Alternatif Tanpa Batas */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40">
            <button
              type="button"
              onClick={() => setShowMultiBarcode((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">
                  Barcode Alternatif & Kemasan Lain
                </span>
                {alternateBarcodes.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    {alternateBarcodes.length} Barcode
                  </span>
                )}
              </div>
              {showMultiBarcode ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showMultiBarcode && (
              <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Tambahkan barcode alternatif tanpa batas (misal barcode kemasan Dus, Pack, atau barcode distributor). Kamera kasir dan opname dapat membaca seluruh barcode ini.
                </p>

                {alternateBarcodes.map((item, idx) => {
                  const dup = checkDuplicateBarcode(item.barcode);
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all ${
                        dup.isDuplicate
                          ? 'bg-amber-50/50 border-amber-300'
                          : 'bg-slate-50/70 border-slate-200/80'
                      }`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-7">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Barcode Alternatif #{idx + 1}
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={item.barcode}
                              onChange={(e) => handleUpdateBarcodeRow(idx, 'barcode', e.target.value)}
                              placeholder={`Scan atau ketik barcode #${idx + 1}`}
                              className="w-full h-9 pl-3 pr-9 rounded-lg border border-slate-200 bg-white text-xs font-mono focus:border-blue-600 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setBarcodeScanTarget(idx);
                                onScanForBarcode();
                              }}
                              title={`Scan barcode baris #${idx + 1}`}
                              className="absolute right-1 top-1 w-7 h-7 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition-colors"
                            >
                              <ScanBarcode className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Satuan
                          </label>
                          <input
                            type="text"
                            list="units-list"
                            value={item.unit}
                            onChange={(e) => handleUpdateBarcodeRow(idx, 'unit', e.target.value)}
                            placeholder="Contoh: DUS / PACK"
                            className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-600 outline-none"
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveBarcodeRow(idx)}
                            title="Hapus Barcode Ini"
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 bg-white transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {item.barcode && dup.isDuplicate && (
                        <p className="text-[11px] text-amber-700 mt-2 font-medium leading-tight">
                          ⚠️ Barcode sudah dipakai oleh {dup.duplicateProduct?.NAMA} ({dup.duplicateProduct?.KODE_BARANG})
                        </p>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleAddBarcodeRow}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5" />
                  + Tambah Barcode
                </button>
              </div>
            )}
          </div>

          {/* SECTION: Bundle Pricing (Kolom 29 - 43) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40">
            <button
              type="button"
              onClick={() => setShowBundlePricing((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800">
                  Bundle Pricing / Grosir Bertingkat (Tier 1 s/d 5)
                </span>
                {activeBundleCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                    {activeBundleCount} Tier
                  </span>
                )}
              </div>
              {showBundlePricing ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showBundlePricing && (
              <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Pengaturan harga promo grosir jika pembeli membeli dalam jumlah banyak (misal beli 3 pcs Rp 25.000, profit otomatis terhitung).
                </p>

                {[1, 2, 3, 4, 5].map((tier) => {
                  const qtyKey = `BUNDLE_QTY_${tier}` as keyof Product;
                  const hargaKey = `BUNDLE_HARGA_${tier}` as keyof Product;
                  const profitKey = `BUNDLE_PROFIT_${tier}` as keyof Product;

                  const currentQty = toNum(formData[qtyKey]);
                  const currentHarga = toNum(formData[hargaKey]);
                  const currentHpp = toNum(formData.HPP);
                  const estimatedProfit =
                    currentHarga > 0 && currentQty > 0
                      ? currentHarga - currentQty * currentHpp
                      : null;

                  return (
                    <div key={tier} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 items-center">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tier #{tier} Min Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={(formData[qtyKey] as number) || ''}
                          onChange={(e) => handleNumericChange(qtyKey, e.target.value)}
                          placeholder="Min Qty (misal 3)"
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold tabular-nums focus:border-blue-600 outline-none"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Harga Paket / Bundle (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={(formData[hargaKey] as number) || ''}
                          onChange={(e) => {
                            const val = toNum(e.target.value);
                            handleNumericChange(hargaKey, e.target.value);
                            // Auto estimate profit if HPP & Qty exist
                            if (currentQty > 0 && currentHpp > 0) {
                              handleChange(profitKey, Math.max(0, val - currentQty * currentHpp));
                            }
                          }}
                          placeholder="0"
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono tabular-nums focus:border-blue-600 outline-none"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Profit Estimasi (Rp)
                        </label>
                        <input
                          type="number"
                          value={(formData[profitKey] as number) ?? (estimatedProfit ?? '')}
                          onChange={(e) => handleNumericChange(profitKey, e.target.value)}
                          placeholder={estimatedProfit !== null ? String(estimatedProfit) : '0'}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono text-emerald-700 font-semibold tabular-nums focus:border-blue-600 outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION: Supplier Pembanding (Kolom 44 - 55) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40">
            <button
              type="button"
              onClick={() => setShowSuppliers((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Supplier Pembanding (Supplier 2, 3, 4)
                </span>
                {activeSupplierCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    {activeSupplierCount} Terisi
                  </span>
                )}
              </div>
              {showSuppliers ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showSuppliers && (
              <div className="p-4 bg-white border-t border-slate-200 space-y-4">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Catat histori penawaran harga beli dari supplier alternatif untuk mendapatkan margin HPP terbaik.
                </p>

                {[2, 3, 4].map((supIdx) => {
                  const namaKey = `SUP${supIdx}_NAMA` as keyof Product;
                  const hppKey = `SUP${supIdx}_HPP` as keyof Product;
                  const tglKey = `SUP${supIdx}_TGL` as keyof Product;
                  const catKey = `SUP${supIdx}_CATATAN` as keyof Product;

                  return (
                    <div key={supIdx} className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          Supplier Pembanding #{supIdx}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Nama Supplier
                          </label>
                          <input
                            type="text"
                            value={(formData[namaKey] as string) || ''}
                            onChange={(e) => handleChange(namaKey, e.target.value)}
                            placeholder={`Distributor ${supIdx}`}
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-600 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            HPP Penawaran (Rp)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={(formData[hppKey] as number) || ''}
                            onChange={(e) => handleNumericChange(hppKey, e.target.value)}
                            placeholder="0"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono tabular-nums focus:border-blue-600 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Tanggal Penawaran
                          </label>
                          <input
                            type="date"
                            value={(formData[tglKey] as string) || ''}
                            onChange={(e) => handleChange(tglKey, e.target.value)}
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-600 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Catatan / Syarat Minimum Beli
                        </label>
                        <input
                          type="text"
                          value={(formData[catKey] as string) || ''}
                          onChange={(e) => handleChange(catKey, e.target.value)}
                          placeholder="Misal: Minimal 1 karton, tempo 14 hari"
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-600 outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-between rounded-b-2xl border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:px-5">
          {mode === 'edit' && product ? (
            <button
              type="button"
              onClick={() => onDelete(product)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              form="product-form"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{mode === 'add' ? 'Simpan Barang' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </div>

        {/* Datalists for autocompletion */}
        <datalist id="categories-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id="suppliers-list">
          {suppliers.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="units-list">
          {units.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
    </div>
  );
};
