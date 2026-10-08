import React, { useState, useEffect } from 'react';
import { X, ScanBarcode, Trash2, Check } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && product) {
        setFormData({
          ...product,
          TANGGAL_BELI: toISO(product.TANGGAL_BELI) || product.TANGGAL_BELI,
        });
      } else if (mode === 'add') {
        const blank = createBlankProduct(activeStoreId);
        if (product) {
          // prefill from scanner or search query
          Object.assign(blank, product);
          blank.product_id = blank.product_id || product.product_id;
          blank.store_id = activeStoreId;
        }
        setFormData(blank);
      }
      setErrorMsg('');
    }
  }, [isOpen, mode, product, activeStoreId]);

  // If a barcode was scanned from the inline scan button
  useEffect(() => {
    if (scannedBarcodeValue && isOpen) {
      setFormData((prev) => ({
        ...prev,
        KODE_BARCODE: scannedBarcodeValue,
        // If product code is still empty, suggest the barcode as code too
        KODE_BARANG: prev.KODE_BARANG ? prev.KODE_BARANG : scannedBarcodeValue,
      }));
    }
  }, [scannedBarcodeValue, isOpen]);

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

    // Check duplicate KODE_BARCODE strictly in the active store (if set)
    if (normalized.KODE_BARCODE) {
      const dupBarcode = allProducts.find(
        (p) =>
          p.product_id !== currentProductId &&
          p.KODE_BARCODE === normalized.KODE_BARCODE &&
          p.KODE_BARCODE !== ''
      );
      if (dupBarcode) {
        setErrorMsg(`Barcode "${normalized.KODE_BARCODE}" sudah dipakai oleh ${dupBarcode.NAMA} di toko ini.`);
        return;
      }
    }

    onSave(normalized, currentProductId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in slide-in-from-bottom md:zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
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
        <form id="product-form" onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-6">
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
                  Barcode
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.KODE_BARCODE}
                    onChange={(e) => handleChange('KODE_BARCODE', e.target.value)}
                    placeholder="Scan atau ketik barcode"
                    className="w-full h-10 pl-3 pr-10 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono transition-all"
                  />
                  <button
                    type="button"
                    onClick={onScanForBarcode}
                    title="Scan Barcode via Kamera"
                    className="absolute right-1 top-1 w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition-colors"
                  >
                    <ScanBarcode className="w-4 h-4" />
                  </button>
                </div>
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
                        {group.label} {idx}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={formData[key] || ''}
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
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl">
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
