import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  ScanBarcode,
  Calendar,
  Layers,
  CheckCircle2,
  Trash2,
  PackageCheck,
  AlertCircle,
  X,
  Camera,
  Image as ImageIcon,
  Eye,
  RefreshCw,
  Building2,
  Warehouse,
  History,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { Product, PurchaseDocument, PurchaseItem, PurchaseStatus, Store } from '../types';
import {
  createPurchaseDocument,
  receivePurchaseDocument,
  cancelPurchaseDocument,
  deletePurchaseDocument,
} from '../services/purchase-manager';
import {
  getStorePurchases,
  getStorePurchaseItems,
  getStoreProducts,
  saveStoreProducts,
} from '../services/storage-manager';
import { recordStockTransaction } from '../services/transaction-manager';
import { findProductByBarcode } from '../services/search-manager';
import { fmt, formatRupiah, getToday, S, toNum } from '../utils/format';

interface PurchaseViewProps {
  activeStore: Store;
  products: Product[];
  onOpenScannerForPurchase: (onScanned: (code: string) => void) => void;
  onStockUpdated: (newProducts: Product[]) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  openConfirm: (config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onRegisterQuickAdd?: (action: (() => void) | null) => void;
}

export interface PurchaseFormLineItem {
  id: string; // unique client line id
  product_id: string;
  product_name: string;
  product_code: string;
  product_barcode: string;
  quantity: number;
  unit: string;
  purchase_price: number;
  subtotal: number;
}

/**
 * Compresses an image file client-side using HTML5 Canvas to keep localStorage light.
 * Max dimension 1024px, JPEG quality 0.70.
 */
async function compressImageFile(file: File, maxDim = 1024, quality = 0.70): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Gagal memproses gambar'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar'));
    reader.readAsDataURL(file);
  });
}

function getProductUnits(product: Product | undefined): string[] {
  if (!product) return [];

  const units = [
    product.SATUAN_1,
    product.SATUAN_2,
    product.SATUAN_BARCODE_2,
    product.SATUAN_BARCODE_3,
    product.SATUAN_BARCODE_4,
    product.SATUAN_BARCODE_5,
    product.SATUAN_BARCODE_6,
    ...(product.alternate_barcodes ?? []).map((barcode) => barcode.unit),
  ];

  return Array.from(new Set(units.map((unit) => S(unit)).filter(Boolean)));
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  activeStore,
  products,
  onOpenScannerForPurchase,
  onStockUpdated,
  showToast,
  openConfirm,
  onDirtyChange,
  onRegisterQuickAdd,
}) => {
  // Navigation between Full Page Form and History
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Purchases list for history tab
  const [purchases, setPurchases] = useState<PurchaseDocument[]>(() =>
    getStorePurchases(activeStore.id)
  );

  // Selected purchase for detailed inspection in History tab
  const [inspectPurchase, setInspectPurchase] = useState<PurchaseDocument | null>(null);
  const [inspectItems, setInspectItems] = useState<PurchaseItem[]>([]);

  // ---------------- FORM STATE (FULL PAGE) ----------------
  const [formSupplier, setFormSupplier] = useState('');
  const [formDate, setFormDate] = useState(getToday());
  const [formLocation, setFormLocation] = useState<'TOKO' | 'GUDANG'>('TOKO');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<PurchaseFormLineItem[]>([]);
  const [invoicePhotos, setInvoicePhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Image zoom modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Replace photo tracking
  const [replacePhotoIndex, setReplacePhotoIndex] = useState<number | null>(null);

  // File input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete suppliers list
  const existingSuppliers = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.SUPPLIER && p.SUPPLIER.trim()) set.add(p.SUPPLIER.trim());
    });
    purchases.forEach((p) => {
      if (p.supplier && p.supplier.trim()) set.add(p.supplier.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [products, purchases]);

  // Track dirty state to prevent accidental tab navigation
  const isFormDirty = Boolean(formSupplier.trim() || formItems.length > 0 || invoicePhotos.length > 0);
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isFormDirty && activeTab === 'form');
    }
  }, [isFormDirty, activeTab, onDirtyChange]);

  useEffect(() => {
    onRegisterQuickAdd?.(() => setActiveTab('form'));
    return () => onRegisterQuickAdd?.(null);
  }, [onRegisterQuickAdd]);

  // Reload when store changes
  useEffect(() => {
    setPurchases(getStorePurchases(activeStore.id));
    setInspectPurchase(null);
    setInspectItems([]);
  }, [activeStore.id]);

  // Subtotal & Total calculations
  const totalAmount = useMemo(() => {
    return formItems.reduce((acc, it) => acc + (it.quantity * it.purchase_price), 0);
  }, [formItems]);

  const totalItemCount = useMemo(() => {
    return formItems.reduce((acc, it) => acc + it.quantity, 0);
  }, [formItems]);

  // Handle adding a new blank item line
  const handleAddItemRow = () => {
    const newLine: PurchaseFormLineItem = {
      id: crypto.randomUUID(),
      product_id: '',
      product_name: '',
      product_code: '',
      product_barcode: '',
      quantity: 1,
      unit: '',
      purchase_price: 0,
      subtotal: 0,
    };
    setFormItems((prev) => [...prev, newLine]);
  };

  // Handle selecting a product for a line item
  const handleSelectProductForLine = (lineId: string, product: Product) => {
    setFormItems((prev) =>
      prev.map((it) => {
        if (it.id !== lineId) return it;
        const price = product.HPP || 0;
        const qty = it.quantity > 0 ? it.quantity : 1;
        return {
          ...it,
          product_id: product.product_id,
          product_name: product.NAMA,
          product_code: product.KODE_BARANG,
          product_barcode: product.KODE_BARCODE || '',
          unit: getProductUnits(product)[0] || '',
          purchase_price: price,
          subtotal: qty * price,
        };
      })
    );
    setValidationError('');
  };

  // Handle line item field changes
  const handleUpdateLine = (
    lineId: string,
    field: 'quantity' | 'unit' | 'purchase_price',
    value: string | number
  ) => {
    setFormItems((prev) =>
      prev.map((it) => {
        if (it.id !== lineId) return it;
        const updated = { ...it };
        if (field === 'quantity') {
          const qty = Math.max(0, toNum(String(value)));
          updated.quantity = qty;
          updated.subtotal = qty * updated.purchase_price;
        } else if (field === 'purchase_price') {
          const price = Math.max(0, toNum(String(value)));
          updated.purchase_price = price;
          updated.subtotal = updated.quantity * price;
        } else if (field === 'unit') {
          updated.unit = String(value);
        }
        return updated;
      })
    );
  };

  // Handle removing a line item
  const handleRemoveLine = (lineId: string) => {
    setFormItems((prev) => prev.filter((it) => it.id !== lineId));
  };

  // Inline scanner for a specific line item or adding new line item
  const handleScanForLine = (lineId?: string) => {
    onOpenScannerForPurchase((scannedCode) => {
      const match = findProductByBarcode(products, scannedCode);
      if (!match) {
        showToast(`Barang dengan barcode "${scannedCode}" tidak ditemukan.`, 'error');
        return;
      }

      if (lineId) {
        handleSelectProductForLine(lineId, match);
        showToast(`Memilih: ${match.NAMA}`, 'info');
      } else {
        // Add new line for this scanned product
        const newLine: PurchaseFormLineItem = {
          id: crypto.randomUUID(),
          product_id: match.product_id,
          product_name: match.NAMA,
          product_code: match.KODE_BARANG,
          product_barcode: match.KODE_BARCODE || '',
          quantity: 1,
          unit: match.SATUAN_1 || 'PCS',
          purchase_price: match.HPP || 0,
          subtotal: match.HPP || 0,
        };
        setFormItems((prev) => [...prev, newLine]);
        showToast(`Ditambahkan: ${match.NAMA}`, 'success');
      }
    });
  };

  // ---------------- PHOTO HANDLING & COMPRESSION ----------------
  const handleProcessPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      showToast('Mengompres foto...', 'info');
      const compressedList: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const compressedBase64 = await compressImageFile(file);
        compressedList.push(compressedBase64);
      }
      setInvoicePhotos((prev) => [...prev, ...compressedList]);
      showToast(`${compressedList.length} foto berhasil ditambahkan & dikompres.`, 'success');
    } catch (err) {
      showToast('Gagal memproses gambar foto faktur.', 'error');
    }
  };

  const handleReplacePhoto = async (files: FileList | null) => {
    if (!files || files.length === 0 || replacePhotoIndex === null) return;
    try {
      const file = files[0];
      const compressedBase64 = await compressImageFile(file);
      setInvoicePhotos((prev) => {
        const next = [...prev];
        next[replacePhotoIndex] = compressedBase64;
        return next;
      });
      showToast('Foto faktur berhasil diperbarui.', 'success');
      setReplacePhotoIndex(null);
    } catch {
      showToast('Gagal mengganti foto faktur.', 'error');
    }
  };

  const handleDeletePhoto = (index: number) => {
    setInvoicePhotos((prev) => prev.filter((_, idx) => idx !== index));
    showToast('Foto faktur dihapus.', 'info');
  };

  // ---------------- FORM SAVE / COMMIT ----------------
  const handleSavePurchase = () => {
    // 1. Validation
    const supplierClean = formSupplier.trim();
    if (!supplierClean) {
      setValidationError('Supplier wajib diisi atau dipilih.');
      showToast('Supplier belum diisi.', 'error');
      return;
    }

    if (formItems.length === 0) {
      setValidationError('Minimal masukkan 1 barang yang dibeli.');
      showToast('Belum ada barang di daftar pembelian.', 'error');
      return;
    }

    // Check each line has valid product and qty > 0
    for (let i = 0; i < formItems.length; i++) {
      const it = formItems[i];
      if (!it.product_id || !it.product_name) {
        setValidationError(`Baris ke-${i + 1}: Silakan pilih barang terlebih dahulu.`);
        showToast(`Baris ke-${i + 1} belum memilih barang.`, 'error');
        return;
      }
      if (it.quantity <= 0) {
        setValidationError(`Baris ke-${i + 1} (${it.product_name}): Jumlah beli harus lebih dari 0.`);
        showToast(`Jumlah beli ${it.product_name} harus lebih dari 0.`, 'error');
        return;
      }
    }

    setValidationError('');
    setIsSubmitting(true);

    try {
      const storeProducts = getStoreProducts(activeStore.id);
      const productMap = new Map<string, Product>();
      for (const p of storeProducts) {
        productMap.set(p.product_id, { ...p });
      }

      // Auto increment stock in chosen location (TOKO or GUDANG)
      const now = new Date().toISOString();
      const updatedProductsList: Product[] = [];

      for (const item of formItems) {
        const prod = productMap.get(item.product_id);
        if (!prod) continue;

        const prevStock = formLocation === 'TOKO' ? (prod.TOKO ?? 0) : (prod.GUDANG ?? 0);
        const nextStock = prevStock + item.quantity;

        if (formLocation === 'TOKO') {
          prod.TOKO = nextStock;
        } else {
          prod.GUDANG = nextStock;
        }

        // Also update HPP if purchase price > 0
        if (item.purchase_price > 0) {
          prod.HPP = item.purchase_price;
          prod.TANGGAL_BELI = formDate;
          prod.SUPPLIER = supplierClean;
        }

        productMap.set(prod.product_id, prod);

        // Record audit transaction
        recordStockTransaction(activeStore.id, {
          product_id: prod.product_id,
          product_name: prod.NAMA,
          product_code: prod.KODE_BARANG,
          location: formLocation,
          type: 'PEMBELIAN',
          quantity: item.quantity,
          previous_stock: prevStock,
          final_stock: nextStock,
          reference_id: '',
          reference_number: '',
          notes: `Pembelian dari ${supplierClean} (Tgl: ${formDate})`,
        });
      }

      // Convert map back to list and persist
      const finalProducts = Array.from(productMap.values());
      saveStoreProducts(activeStore.id, finalProducts);
      onStockUpdated(finalProducts);

      // Create purchase document with status RECEIVED and invoice photos
      const { purchase: newDoc } = createPurchaseDocument(activeStore.id, {
        supplier: supplierClean,
        purchase_date: formDate,
        notes: formNotes,
        target_location: formLocation,
        invoice_photos: invoicePhotos,
        discount: 0,
        additional_cost: 0,
        status: 'RECEIVED',
        items: formItems.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          product_code: it.product_code,
          product_barcode: it.product_barcode,
          order_quantity: it.quantity,
          received_quantity: it.quantity,
          unit: it.unit,
          purchase_price: it.purchase_price,
          discount: 0,
          subtotal: it.subtotal,
        })),
      });

      // Refresh local purchases list
      const updatedPurchases = getStorePurchases(activeStore.id);
      setPurchases(updatedPurchases);

      // Reset form
      setFormSupplier('');
      setFormDate(getToday());
      setFormLocation('TOKO');
      setFormNotes('');
      setFormItems([]);
      setInvoicePhotos([]);

      showToast(
        `✅ Pembelian berhasil disimpan! Stok ${totalItemCount} barang otomatis bertambah di ${formLocation}.`,
        'success'
      );
    } catch (err: any) {
      showToast(`Gagal menyimpan pembelian: ${err.message || 'Kesalahan sistem'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetFormWithConfirm = () => {
    if (!isFormDirty) return;
    openConfirm({
      title: 'Kosongkan Form Pembelian?',
      message: 'Semua isian barang dan foto yang belum disimpan akan hilang.',
      confirmLabel: 'Ya, Kosongkan',
      cancelLabel: 'Batal',
      isDestructive: true,
      onConfirm: () => {
        setFormSupplier('');
        setFormDate(getToday());
        setFormLocation('TOKO');
        setFormNotes('');
        setFormItems([]);
        setInvoicePhotos([]);
        setValidationError('');
        showToast('Form pembelian dikosongkan.', 'info');
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6 pb-24">
      {/* Top Header & Tab Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <span>Pembelian Barang</span>
          </h1>
        </div>

        {/* View Toggle: Form Pembelian vs Riwayat */}
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'form'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Form Pembelian Baru</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'history'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat ({purchases.length})</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: FORM PEMBELIAN (HALAMAN PENUH — TANPA POPUP)
         ========================================================================= */}
      {activeTab === 'form' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {validationError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. BAGIAN ATAS: INFORMASI FAKTUR & LOKASI MASUK */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Informasi Pembelian & Lokasi Masuk
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              {/* Supplier Input (Select from list or type new) */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="purchase-suppliers-list"
                    required
                    value={formSupplier}
                    onChange={(e) => {
                      setFormSupplier(e.target.value);
                      if (validationError) setValidationError('');
                    }}
                    placeholder="Pilih supplier atau ketik supplier baru"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                  />
                  <datalist id="purchase-suppliers-list">
                    {existingSuppliers.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Tanggal Pembelian */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Pembelian
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              {/* Lokasi Masuk (Toko / Gudang) */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi Masuk Stok <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormLocation('TOKO')}
                    className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                      formLocation === 'TOKO'
                        ? 'bg-blue-50 text-blue-700 border-blue-500 ring-2 ring-blue-100 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Toko</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormLocation('GUDANG')}
                    className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                      formLocation === 'GUDANG'
                        ? 'bg-blue-50 text-blue-700 border-blue-500 ring-2 ring-blue-100 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Warehouse className="w-4 h-4" />
                    <span>Gudang</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. DAFTAR BARANG YANG DIBELI */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Daftar Barang yang Dibeli
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleScanForLine()}
                  className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ScanBarcode className="w-4 h-4 text-blue-600" />
                  <span>Scan Barcode Kamera</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Barang</span>
                </button>
              </div>
            </div>

            {/* List / Table of Purchased Items */}
            {formItems.length === 0 ? (
              <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Daftar barang masih kosong</p>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Barang</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {formItems.map((line, index) => {
                  const selectedProduct = products.find((product) => product.product_id === line.product_id);
                  const productUnits = getProductUnits(selectedProduct);

                  return (
                    <div
                      key={line.id}
                      className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Barang #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          title="Hapus baris barang ini"
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        {/* Product Picker */}
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Pilih / Cari Barang
                          </label>
                          <div className="relative">
                            <select
                              value={line.product_id}
                              onChange={(e) => {
                                const selected = products.find((p) => p.product_id === e.target.value);
                                if (selected) handleSelectProductForLine(line.id, selected);
                              }}
                              className="w-full h-10 pl-3 pr-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                            >
                              <option value="">-- Pilih Barang dari Master --</option>
                              {products.map((p) => (
                                <option key={p.product_id} value={p.product_id}>
                                  {p.NAMA} ({p.KODE_BARANG}) - Stok: {formLocation === 'TOKO' ? p.TOKO : p.GUDANG}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleScanForLine(line.id)}
                              title="Scan barcode untuk baris ini"
                              className="absolute right-1 top-1 w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition-colors"
                            >
                              <ScanBarcode className="w-4 h-4" />
                            </button>
                          </div>
                          {line.product_code && (
                            <div className="text-[10px] text-slate-500 font-mono mt-1">
                              Kode: {line.product_code} {line.product_barcode ? `· BC: ${line.product_barcode}` : ''}
                            </div>
                          )}
                        </div>

                        {/* Jumlah (Qty) */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Jumlah
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={line.quantity || ''}
                            onChange={(e) => handleUpdateLine(line.id, 'quantity', e.target.value)}
                            placeholder="1"
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-blue-600 outline-none tabular-nums"
                          />
                        </div>

                        {/* Satuan */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Satuan
                          </label>
                          <select
                            value={line.unit}
                            onChange={(e) => handleUpdateLine(line.id, 'unit', e.target.value)}
                            disabled={productUnits.length === 0}
                            aria-label={`Satuan barang ${index + 1}`}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-blue-600 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="">
                              {selectedProduct ? '-- Satuan belum tersedia --' : '-- Pilih barang dahulu --'}
                            </option>
                            {productUnits.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Harga Beli */}
                        <div className="sm:col-span-3">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-600">
                              Harga Beli (Satuan)
                            </label>
                            <span className="text-[10px] text-slate-400 font-mono">Subtotal</span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.purchase_price || ''}
                              onChange={(e) => handleUpdateLine(line.id, 'purchase_price', e.target.value)}
                              placeholder="0"
                              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 focus:border-blue-600 outline-none tabular-nums"
                            />
                          </div>
                          <div className="text-right text-xs font-bold text-blue-600 tabular-nums mt-1">
                            = {formatRupiah(line.subtotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Button tambah barang di bawah daftar */}
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="w-full py-3 rounded-xl border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Baris Barang</span>
                </button>
              </div>
            )}

            {/* Total Pembelian Summary Card */}
            {formItems.length > 0 && (
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    Total Pembelian ({formItems.length} Jenis Barang · {totalItemCount} Total Qty)
                  </span>
                  <div className="text-2xl font-bold tracking-tight font-mono text-emerald-400">
                    {formatRupiah(totalAmount)}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* 3. FOTO FAKTUR / BUKTI PEMBELIAN */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  3. Foto Faktur / Bukti Pembelian
                </h2>
              </div>

              {/* 2 Action Buttons: Ambil Foto (Kamera) & Pilih dari Galeri */}
              <div className="flex items-center gap-2">
                {/* Hidden camera input with capture="environment" for smartphones */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    handleProcessPhotos(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-10 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-blue-200"
                >
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>Ambil Foto</span>
                </button>

                {/* Hidden gallery input with multiple support */}
                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleProcessPhotos(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-slate-200"
                >
                  <ImageIcon className="w-4 h-4 text-slate-600" />
                  <span>Pilih dari Galeri</span>
                </button>
              </div>
            </div>

            {/* Hidden replace input */}
            <input
              type="file"
              ref={replaceInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleReplacePhoto(e.target.files);
                e.target.value = '';
              }}
            />

            {/* Photos Thumbnails List */}
            {invoicePhotos.length === 0 ? (
              <div className="py-8 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Camera className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs text-slate-500 font-medium">Belum ada foto faktur atau bukti pembelian</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {invoicePhotos.map((photoUrl, idx) => (
                  <div
                    key={idx}
                    className="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100 aspect-3/4 flex flex-col shadow-2xs"
                  >
                    <img
                      src={photoUrl}
                      alt={`Faktur #${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setPreviewPhotoUrl(photoUrl)}
                    />

                    {/* Overlay Actions */}
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-slate-900/90 to-transparent flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoUrl(photoUrl)}
                        title="Lihat Pratinjau Besar"
                        className="p-1 rounded bg-white/20 hover:bg-white/40 text-white text-[10px] font-bold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setReplacePhotoIndex(idx);
                          replaceInputRef.current?.click();
                        }}
                        title="Ganti Foto Ini"
                        className="p-1 rounded bg-white/20 hover:bg-white/40 text-white text-[10px] font-bold transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(idx)}
                        title="Hapus Foto"
                        className="p-1 rounded bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-bold transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. CATATAN TAMBAHAN (OPSIONAL) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Catatan / Nomor Invoice Asli (Opsional)
            </label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Contoh: No Faktur Supplier INV-8891, Tempo 30 Hari, dll."
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs transition-all"
            />
          </div>

          {/* 5. TOMBOL AKSI SIMPAN (THUMB-FRIENDLY & ERGONOMIC) */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSavePurchase}
              className="w-full sm:flex-1 h-13 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <PackageCheck className="w-5 h-5" />
              <span>{isSubmitting ? 'Menyimpan & Menambah Stok…' : 'SIMPAN PEMBELIAN SEKARANG'}</span>
            </button>

            {isFormDirty && (
              <button
                type="button"
                onClick={handleResetFormWithConfirm}
                className="w-full sm:w-auto h-13 px-5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors flex items-center justify-center"
              >
                Kosongkan Form
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: RIWAYAT PEMBELIAN (INVOICE ARCHIVE & AUDIT)
         ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Riwayat Transaksi Pembelian ({purchases.length} Dokumen)
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>+ Buat Pembelian Baru</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {purchases.length === 0 ? (
            <div className="py-16 text-center border border-slate-200 rounded-2xl bg-white p-6">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Belum Ada Riwayat Pembelian</h3>
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Input Pembelian Pertama</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {purchases.map((p) => {
                const isSelected = inspectPurchase?.purchase_id === p.purchase_id;
                const photoCount = p.invoice_photos?.length || 0;

                return (
                  <div
                    key={p.purchase_id}
                    className={`rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-blue-50/40 border-blue-500 ring-2 ring-blue-100'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {p.purchase_number}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 uppercase">
                            {p.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                            Masuk: {p.target_location}
                          </span>
                          {photoCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center gap-1">
                              <Camera className="w-3 h-3" />
                              <span>{photoCount} Foto</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                          <span>Supplier: <strong>{p.supplier}</strong></span>
                          <span>·</span>
                          <span>Tgl: {p.purchase_date}</span>
                          {p.notes ? (
                            <>
                              <span>·</span>
                              <span className="text-slate-400 italic truncate max-w-xs">{p.notes}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Total</div>
                          <div className="text-sm font-bold text-slate-900 font-mono">
                            {formatRupiah(p.grand_total)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setInspectPurchase(null);
                              setInspectItems([]);
                            } else {
                              setInspectPurchase(p);
                              setInspectItems(getStorePurchaseItems(activeStore.id, p.purchase_id));
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          {isSelected ? 'Tutup Rincian' : 'Lihat Rincian'}
                        </button>
                      </div>
                    </div>

                    {/* Detailed Accordion when inspecting */}
                    {isSelected && (
                      <div className="border-t border-slate-200 p-4 bg-white/80 space-y-4 rounded-b-2xl">
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Barang yang Diterima
                          </h4>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                  <th className="py-2.5 px-3">Kode</th>
                                  <th className="py-2.5 px-3">Nama Barang</th>
                                  <th className="py-2.5 px-3 text-right">Jumlah</th>
                                  <th className="py-2.5 px-3">Satuan</th>
                                  <th className="py-2.5 px-3 text-right">Harga Beli</th>
                                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {inspectItems.map((item) => (
                                  <tr key={item.purchase_item_id}>
                                    <td className="py-2 px-3 font-mono text-slate-600">{item.product_code}</td>
                                    <td className="py-2 px-3 font-medium text-slate-900">{item.product_name}</td>
                                    <td className="py-2 px-3 text-right font-bold tabular-nums">{item.received_quantity}</td>
                                    <td className="py-2 px-3 text-slate-600 uppercase">{item.unit}</td>
                                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatRupiah(item.purchase_price)}</td>
                                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-900">{formatRupiah(item.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Photos Attached */}
                        {p.invoice_photos && p.invoice_photos.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                              Foto Faktur / Bukti Fisik ({p.invoice_photos.length})
                            </h4>
                            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                              {p.invoice_photos.map((photo, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => setPreviewPhotoUrl(photo)}
                                  className="w-20 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 hover:opacity-90 transition-opacity"
                                >
                                  <img src={photo} alt="Faktur" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PHOTO PREVIEW MODAL */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-100"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Pratinjau Foto Faktur"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
