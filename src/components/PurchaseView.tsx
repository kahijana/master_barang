import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  ScanBarcode,
  ArrowLeft,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  FileText,
  Truck,
  Trash2,
  Pencil,
  PackageCheck,
  AlertCircle,
  X,
  Boxes,
} from 'lucide-react';
import { Product, PurchaseDocument, PurchaseItem, PurchaseStatus, Store } from '../types';
import {
  createPurchaseDocument,
  updatePurchaseDocument,
  receivePurchaseDocument,
  cancelPurchaseDocument,
  deletePurchaseDocument,
} from '../services/purchase-manager';
import { getStorePurchases, getStorePurchaseItems } from '../services/storage-manager';
import { fmt, formatRupiah, getToday, S, toNum } from '../utils/format';
import { LaporanModal } from './LaporanModal';

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
}

interface FormItemState {
  product_id: string;
  product_name: string;
  product_code: string;
  product_barcode: string;
  unit: string;
  order_quantity: number;
  received_quantity: number;
  purchase_price: number;
  discount: number;
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  activeStore,
  products,
  onOpenScannerForPurchase,
  onStockUpdated,
  showToast,
  openConfirm,
}) => {
  // Store-isolated purchases list
  const [purchases, setPurchases] = useState<PurchaseDocument[]>(() =>
    getStorePurchases(activeStore.id)
  );

  // Selected purchase for detail view
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseDocument | null>(null);
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState<PurchaseItem[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseStatus>('ALL');

  // Create / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  // Form Fields
  const [formSupplier, setFormSupplier] = useState('');
  const [formDate, setFormDate] = useState(getToday());
  const [formLocation, setFormLocation] = useState<'TOKO' | 'GUDANG'>('TOKO');
  const [formNotes, setFormNotes] = useState('');
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formAdditionalCost, setFormAdditionalCost] = useState<number>(0);
  const [formItems, setFormItems] = useState<FormItemState[]>([]);

  // Item selector in form
  const [productSearchInForm, setProductSearchInForm] = useState('');
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);

  // Laporan Sheet Modal
  const [isLaporanModalOpen, setIsLaporanModalOpen] = useState(false);

  // Reload when store changes
  useEffect(() => {
    const list = getStorePurchases(activeStore.id);
    setPurchases(list);
    setSelectedPurchase(null);
    setSelectedPurchaseItems([]);
  }, [activeStore.id]);

  const refreshPurchasesList = () => {
    const list = getStorePurchases(activeStore.id);
    setPurchases(list);
    if (selectedPurchase) {
      const refreshedDoc = list.find((p) => p.purchase_id === selectedPurchase.purchase_id);
      if (refreshedDoc) {
        setSelectedPurchase(refreshedDoc);
        setSelectedPurchaseItems(getStorePurchaseItems(activeStore.id, refreshedDoc.purchase_id));
      } else {
        setSelectedPurchase(null);
        setSelectedPurchaseItems([]);
      }
    }
  };

  const handleSelectPurchase = (p: PurchaseDocument) => {
    setSelectedPurchase(p);
    setSelectedPurchaseItems(getStorePurchaseItems(activeStore.id, p.purchase_id));
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingPurchaseId(null);
    setFormSupplier('');
    setFormDate(getToday());
    setFormLocation('TOKO');
    setFormNotes('');
    setFormDiscount(0);
    setFormAdditionalCost(0);
    setFormItems([]);
    setProductSearchInForm('');
    setIsItemPickerOpen(false);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: PurchaseDocument) => {
    if (p.status !== 'DRAFT') {
      showToast('Hanya pembelian berstatus DRAFT yang dapat diedit.', 'error');
      return;
    }
    const items = getStorePurchaseItems(activeStore.id, p.purchase_id);
    setFormMode('edit');
    setEditingPurchaseId(p.purchase_id);
    setFormSupplier(p.supplier);
    setFormDate(p.purchase_date);
    setFormLocation(p.target_location);
    setFormNotes(p.notes || '');
    setFormDiscount(p.discount || 0);
    setFormAdditionalCost(p.additional_cost || 0);
    setFormItems(
      items.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        product_code: it.product_code,
        product_barcode: it.product_barcode,
        unit: it.unit,
        order_quantity: it.order_quantity,
        received_quantity: it.received_quantity,
        purchase_price: it.purchase_price,
        discount: it.discount || 0,
      }))
    );
    setProductSearchInForm('');
    setIsItemPickerOpen(false);
    setIsFormOpen(true);
  };

  // Add product to purchase form
  const handleAddProductToForm = (prod: Product) => {
    const existingIndex = formItems.findIndex((it) => it.product_id === prod.product_id);
    if (existingIndex >= 0) {
      // Increase qty by 1
      setFormItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, order_quantity: item.order_quantity + 1, received_quantity: item.received_quantity + 1 }
            : item
        )
      );
      showToast(`Jumlah ${prod.NAMA} ditambah`, 'info');
    } else {
      const newItem: FormItemState = {
        product_id: prod.product_id,
        product_name: prod.NAMA,
        product_code: prod.KODE_BARANG,
        product_barcode: prod.KODE_BARCODE,
        unit: prod.SATUAN_1 || 'PCS',
        order_quantity: 1,
        received_quantity: 1,
        purchase_price: prod.HPP || 0,
        discount: 0,
      };
      setFormItems((prev) => [...prev, newItem]);
      showToast(`Ditambahkan: ${prod.NAMA}`, 'success');
    }
    setIsItemPickerOpen(false);
    setProductSearchInForm('');
  };

  // Barcode scanning helper inside form
  const handleScanForPurchase = () => {
    onOpenScannerForPurchase((scannedCode) => {
      const code = S(scannedCode).toLowerCase();
      const matched = products.find(
        (p) =>
          p.KODE_BARCODE.toLowerCase() === code ||
          p.KODE_BARANG.toLowerCase() === code
      );
      if (matched) {
        handleAddProductToForm(matched);
      } else {
        showToast(`Barcode ${scannedCode} tidak ditemukan di master barang`, 'error');
      }
    });
  };

  const handleRemoveFormItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateFormItem = (index: number, updates: Partial<FormItemState>) => {
    setFormItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, ...updates } : it))
    );
  };

  // Form financials calculations
  const formSubtotal = useMemo(() => {
    return formItems.reduce((acc, it) => {
      const qty = it.received_quantity > 0 ? it.received_quantity : it.order_quantity;
      const total = qty * it.purchase_price - (it.discount || 0);
      return acc + Math.max(0, total);
    }, 0);
  }, [formItems]);

  const formGrandTotal = useMemo(() => {
    return Math.max(0, formSubtotal - formDiscount + formAdditionalCost);
  }, [formSubtotal, formDiscount, formAdditionalCost]);

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplier.trim()) {
      showToast('Nama supplier wajib diisi', 'error');
      return;
    }
    if (formItems.length === 0) {
      showToast('Tambahkan minimal satu barang ke dalam pembelian', 'error');
      return;
    }

    try {
      if (formMode === 'create') {
        const { purchase: newDoc } = createPurchaseDocument(activeStore.id, {
          supplier: formSupplier,
          purchase_date: formDate,
          target_location: formLocation,
          notes: formNotes,
          discount: formDiscount,
          additional_cost: formAdditionalCost,
          items: formItems.map((it) => ({
            product_id: it.product_id,
            product_name: it.product_name,
            product_code: it.product_code,
            product_barcode: it.product_barcode,
            unit: it.unit,
            order_quantity: it.order_quantity,
            received_quantity: it.received_quantity,
            purchase_price: it.purchase_price,
            discount: it.discount,
            subtotal: Math.max(
              0,
              (it.received_quantity > 0 ? it.received_quantity : it.order_quantity) *
                it.purchase_price -
                (it.discount || 0)
            ),
          })),
        });

        setIsFormOpen(false);
        refreshPurchasesList();
        setSelectedPurchase(newDoc);
        setSelectedPurchaseItems(getStorePurchaseItems(activeStore.id, newDoc.purchase_id));
        showToast(`Pembelian ${newDoc.purchase_number} berhasil disimpan sebagai Draft`, 'success');
      } else if (editingPurchaseId) {
        const res = updatePurchaseDocument(activeStore.id, editingPurchaseId, {
          supplier: formSupplier,
          purchase_date: formDate,
          target_location: formLocation,
          notes: formNotes,
          discount: formDiscount,
          additional_cost: formAdditionalCost,
          items: formItems.map((it) => ({
            product_id: it.product_id,
            product_name: it.product_name,
            product_code: it.product_code,
            product_barcode: it.product_barcode,
            unit: it.unit,
            order_quantity: it.order_quantity,
            received_quantity: it.received_quantity,
            purchase_price: it.purchase_price,
            discount: it.discount,
            subtotal: Math.max(
              0,
              (it.received_quantity > 0 ? it.received_quantity : it.order_quantity) *
                it.purchase_price -
                (it.discount || 0)
            ),
          })),
        });

        if (res) {
          setIsFormOpen(false);
          refreshPurchasesList();
          setSelectedPurchase(res.purchase);
          setSelectedPurchaseItems(res.items);
          showToast(`Pembelian ${res.purchase.purchase_number} diperbarui`, 'success');
        }
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan pembelian', 'error');
    }
  };

  // Receive Purchase (Apply to System Stock)
  const handleReceivePurchase = (p: PurchaseDocument) => {
    const items = getStorePurchaseItems(activeStore.id, p.purchase_id);
    const totalQty = items.reduce(
      (acc, it) => acc + (it.received_quantity > 0 ? it.received_quantity : it.order_quantity),
      0
    );

    openConfirm({
      title: `Terima Pembelian ${p.purchase_number}?`,
      message: `Sebanyak ${items.length} jenis barang (total ${totalQty} unit) akan ditambahkan ke stok ${p.target_location} toko ${activeStore.name}. Tindakan ini akan langsung memperbarui stok sistem.`,
      confirmLabel: 'Terima & Tambah Stok',
      isDestructive: false,
      onConfirm: () => {
        const res = receivePurchaseDocument(activeStore.id, p.purchase_id);
        if (res.success) {
          onStockUpdated(res.updatedProducts);
          refreshPurchasesList();
          showToast(`Pembelian ${p.purchase_number} berhasil diterima! Stok telah ditambahkan.`, 'success');
        } else {
          showToast(res.error || 'Gagal menerima pembelian', 'error');
        }
      },
    });
  };

  // Cancel Purchase
  const handleCancelPurchase = (p: PurchaseDocument) => {
    const isAlreadyReceived = p.status === 'RECEIVED';
    openConfirm({
      title: `Batalkan Pembelian ${p.purchase_number}?`,
      message: isAlreadyReceived
        ? `PERINGATAN: Pembelian ini sudah diterima sebelumnya. Membatalkan akan MENGURANGI KEMBALI stok ${p.target_location} sebanyak barang yang pernah diterima!`
        : `Pembelian berstatus DRAFT ini akan ditandai dibatalkan.`,
      confirmLabel: 'Ya, Batalkan Pembelian',
      isDestructive: true,
      onConfirm: () => {
        const res = cancelPurchaseDocument(activeStore.id, p.purchase_id);
        if (res.success) {
          if (isAlreadyReceived) {
            onStockUpdated(res.updatedProducts);
          }
          refreshPurchasesList();
          showToast(`Pembelian ${p.purchase_number} telah dibatalkan`, 'info');
        } else {
          showToast(res.error || 'Gagal membatalkan pembelian', 'error');
        }
      },
    });
  };

  // Delete Draft Purchase
  const handleDeletePurchase = (p: PurchaseDocument) => {
    openConfirm({
      title: `Hapus Pembelian ${p.purchase_number}?`,
      message: 'Dokumen pembelian ini akan dihapus secara permanen dari penyimpanan.',
      confirmLabel: 'Hapus Dokumen',
      isDestructive: true,
      onConfirm: () => {
        const res = deletePurchaseDocument(activeStore.id, p.purchase_id);
        if (res.success) {
          refreshPurchasesList();
          setSelectedPurchase(null);
          setSelectedPurchaseItems([]);
          showToast(`Pembelian ${p.purchase_number} dihapus`, 'info');
        } else {
          showToast(res.error || 'Gagal menghapus dokumen', 'error');
        }
      },
    });
  };

  // Filtered Purchases list
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = p.purchase_number.toLowerCase().includes(q);
        const matchSupplier = p.supplier.toLowerCase().includes(q);
        const matchNotes = (p.notes || '').toLowerCase().includes(q);
        return matchNumber || matchSupplier || matchNotes;
      }
      return true;
    });
  }, [purchases, statusFilter, searchQuery]);

  // Product suggestions for item picker
  const filteredProductsForPicker = useMemo(() => {
    if (!productSearchInForm.trim()) return products.slice(0, 20);
    const q = productSearchInForm.toLowerCase();
    return products.filter(
      (p) =>
        p.NAMA.toLowerCase().includes(q) ||
        p.KODE_BARANG.toLowerCase().includes(q) ||
        p.KODE_BARCODE.toLowerCase().includes(q)
    ).slice(0, 25);
  }, [products, productSearchInForm]);

  // Existing suppliers suggestions
  const existingSuppliers = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.SUPPLIER && p.SUPPLIER.trim()) set.add(p.SUPPLIER.trim());
    });
    purchases.forEach((p) => {
      if (p.supplier && p.supplier.trim()) set.add(p.supplier.trim());
    });
    return Array.from(set).sort();
  }, [products, purchases]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Pembelian Barang
              </h1>
              <p className="text-xs text-slate-500">
                Pencatatan restock dan faktur masuk untuk <strong className="text-slate-700">{activeStore.name}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Pembelian Baru</span>
          </button>
        </div>
      </div>

      {/* SEARCH & STATUS FILTER */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 bg-white rounded-xl border border-slate-200 p-1 flex items-center shadow-2xs">
          <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor pembelian (PB-...) atau nama supplier..."
            className="w-full h-9 px-2 text-xs bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 mr-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { key: 'ALL', label: 'Semua Status' },
              { key: 'DRAFT', label: 'Draft' },
              { key: 'RECEIVED', label: 'Diterima' },
              { key: 'CANCELLED', label: 'Dibatalkan' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT: SPLIT LIST & DETAIL (OR FULL LIST) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LIST COLUMN */}
        <div className={`${selectedPurchase ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-3`}>
          {filteredPurchases.length > 0 ? (
            <div className="space-y-2.5">
              {filteredPurchases.map((doc) => {
                const isSelected = selectedPurchase?.purchase_id === doc.purchase_id;
                const statusConfig = {
                  DRAFT: {
                    bg: 'bg-amber-50 text-amber-700 border-amber-200',
                    dot: 'bg-amber-500',
                    label: 'Draft',
                  },
                  RECEIVED: {
                    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    dot: 'bg-emerald-500',
                    label: 'Diterima',
                  },
                  CANCELLED: {
                    bg: 'bg-slate-100 text-slate-600 border-slate-200',
                    dot: 'bg-slate-400',
                    label: 'Dibatalkan',
                  },
                }[doc.status];

                return (
                  <div
                    key={doc.purchase_id}
                    onClick={() => handleSelectPurchase(doc)}
                    role="button"
                    tabIndex={0}
                    className={`p-4 rounded-2xl border transition-all text-left cursor-pointer bg-white ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {doc.purchase_number}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{doc.supplier}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900 block tabular-nums">
                          {formatRupiah(doc.grand_total)}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 justify-end mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{doc.purchase_date}</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Masuk ke: <strong>{doc.target_location}</strong></span>
                      </span>
                      {doc.notes ? (
                        <span className="truncate max-w-[160px] text-slate-400">
                          {doc.notes}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Belum Ada Transaksi Pembelian</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mulai catat pembelian barang untuk menambah stok {activeStore.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Pembelian</span>
              </button>
            </div>
          )}
        </div>

        {/* DETAIL VIEW COLUMN */}
        {selectedPurchase && (
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Detail Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 font-mono">
                    {selectedPurchase.purchase_number}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      selectedPurchase.status === 'RECEIVED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : selectedPurchase.status === 'DRAFT'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {selectedPurchase.status === 'RECEIVED'
                      ? 'Diterima'
                      : selectedPurchase.status === 'DRAFT'
                      ? 'Draft'
                      : 'Dibatalkan'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <strong>{selectedPurchase.supplier}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {selectedPurchase.purchase_date}
                  </span>
                  <span>•</span>
                  <span>
                    Masuk ke: <strong>{selectedPurchase.target_location}</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Tutup Detail"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Information Callout */}
            {selectedPurchase.status === 'DRAFT' && (
              <div className="px-5 py-3 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Stok sistem <strong>belum bertambah</strong>. Tekan &ldquo;Terima Pembelian&rdquo; saat barang telah sampai.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleReceivePurchase(selectedPurchase)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Terima Pembelian</span>
                </button>
              </div>
            )}

            {selectedPurchase.status === 'RECEIVED' && (
              <div className="px-5 py-3 bg-emerald-50/70 border-b border-emerald-200/60 flex items-center justify-between gap-3 text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Stok sistem telah ditambahkan ke <strong>{selectedPurchase.target_location}</strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCancelPurchase(selectedPurchase)}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold"
                >
                  Batalkan Penerimaan
                </button>
              </div>
            )}

            {/* Items Table */}
            <div className="p-4 sm:p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Daftar Barang ({selectedPurchaseItems.length})
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="bg-slate-50 px-4 py-2.5 grid grid-cols-12 text-[11px] font-bold text-slate-600">
                  <div className="col-span-5">Barang</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Harga Beli</div>
                  <div className="col-span-3 text-right">Subtotal</div>
                </div>

                {selectedPurchaseItems.map((item) => (
                  <div
                    key={item.purchase_item_id}
                    className="px-4 py-3 grid grid-cols-12 items-center text-xs gap-2"
                  >
                    <div className="col-span-5 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {item.product_name}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">
                        {item.product_code || item.product_barcode}
                      </p>
                    </div>

                    <div className="col-span-2 text-center">
                      <span className="font-bold text-slate-900 tabular-nums">
                        {fmt(item.received_quantity || item.order_quantity)}
                      </span>{' '}
                      <span className="text-[10px] text-slate-500">{item.unit}</span>
                    </div>

                    <div className="col-span-2 text-right font-medium text-slate-600 tabular-nums">
                      {fmt(item.purchase_price)}
                    </div>

                    <div className="col-span-3 text-right font-bold text-slate-900 tabular-nums">
                      {formatRupiah(item.subtotal)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Calculation Summary */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Barang:</span>
                  <span className="font-semibold tabular-nums">
                    {formatRupiah(selectedPurchase.subtotal)}
                  </span>
                </div>

                {selectedPurchase.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Diskon Pembelian:</span>
                    <span className="font-semibold tabular-nums">
                      - {formatRupiah(selectedPurchase.discount)}
                    </span>
                  </div>
                )}

                {selectedPurchase.additional_cost > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Biaya Tambahan / Ongkir:</span>
                    <span className="font-semibold tabular-nums">
                      + {formatRupiah(selectedPurchase.additional_cost)}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                  <span>Grand Total:</span>
                  <span className="text-base text-blue-600 tabular-nums">
                    {formatRupiah(selectedPurchase.grand_total)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {selectedPurchase.notes && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                  <span className="text-slate-400 font-medium block">Catatan:</span>
                  <p className="text-slate-700 mt-0.5">{selectedPurchase.notes}</p>
                </div>
              )}

              {/* Bottom Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {selectedPurchase.status === 'DRAFT' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(selectedPurchase)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit Draft</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePurchase(selectedPurchase)}
                        className="px-3.5 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </>
                  )}
                </div>

                {selectedPurchase.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => handleReceivePurchase(selectedPurchase)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Terima Pembelian (Tambah Stok)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE & EDIT PURCHASE MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
                  <ShoppingCart className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {formMode === 'create' ? 'Buat Pembelian Baru' : 'Edit Dokumen Pembelian'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Toko: <strong>{activeStore.name}</strong> • Status disimpan sebagai Draft
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveForm} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* Document Meta Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Supplier with Datalist */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="supplier-suggestions"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="Nama distributor / supplier"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none"
                  />
                  <datalist id="supplier-suggestions">
                    {existingSuppliers.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pembelian
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none"
                  />
                </div>

                {/* Target Location */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lokasi Masuk Stok
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormLocation('TOKO')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formLocation === 'TOKO'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      TOKO
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormLocation('GUDANG')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formLocation === 'GUDANG'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      GUDANG
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Barang yang Dibeli ({formItems.length})
                  </h3>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleScanForPurchase}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                    >
                      <ScanBarcode className="w-3.5 h-3.5" />
                      <span>Scan Barcode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsItemPickerOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Barang</span>
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {formItems.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                    <div className="bg-slate-50 px-3 py-2 grid grid-cols-12 text-[11px] font-bold text-slate-500 gap-2">
                      <div className="col-span-5">Barang</div>
                      <div className="col-span-2 text-center">Qty Pesan / Masuk</div>
                      <div className="col-span-2 text-right">Harga Beli (Rp)</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                      <div className="col-span-1 text-center">Aksi</div>
                    </div>

                    {formItems.map((item, idx) => {
                      const itemSub = Math.max(
                        0,
                        item.order_quantity * item.purchase_price - (item.discount || 0)
                      );
                      return (
                        <div
                          key={item.product_id + idx}
                          className="px-3 py-2.5 grid grid-cols-12 items-center text-xs gap-2"
                        >
                          <div className="col-span-5 min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {item.product_name}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400 truncate">
                              {item.product_code || item.product_barcode} ({item.unit})
                            </p>
                          </div>

                          <div className="col-span-2 flex items-center justify-center">
                            <input
                              type="number"
                              min="1"
                              value={item.order_quantity}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                handleUpdateFormItem(idx, {
                                  order_quantity: val,
                                  received_quantity: val,
                                });
                              }}
                              className="w-16 h-8 text-center rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:border-blue-600 outline-none"
                            />
                          </div>

                          <div className="col-span-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={item.purchase_price}
                              onChange={(e) =>
                                handleUpdateFormItem(idx, {
                                  purchase_price: Math.max(0, toNum(e.target.value)),
                                })
                              }
                              className="w-24 h-8 text-right px-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 focus:border-blue-600 outline-none"
                            />
                          </div>

                          <div className="col-span-2 text-right font-bold text-slate-900 tabular-nums">
                            {formatRupiah(itemSub)}
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFormItem(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-md"
                              aria-label="Hapus item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center space-y-2 bg-slate-50/50">
                    <Boxes className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-500">
                      Belum ada barang dipilih. Tekan <strong>+ Tambah Barang</strong> atau <strong>Scan Barcode</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* Financials & Notes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Pembelian (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Contoh: No faktur supplier, termin pembayaran, dll."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none resize-none"
                  />
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5">
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>Subtotal Barang:</span>
                    <span className="font-semibold tabular-nums">{formatRupiah(formSubtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>Diskon Nota (Rp):</span>
                    <input
                      type="number"
                      min="0"
                      value={formDiscount || ''}
                      onChange={(e) => setFormDiscount(Math.max(0, toNum(e.target.value)))}
                      placeholder="0"
                      className="w-28 h-7 text-right px-2 rounded-lg border border-slate-200 text-xs bg-white font-semibold outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>Biaya Tambahan / Ongkir (Rp):</span>
                    <input
                      type="number"
                      min="0"
                      value={formAdditionalCost || ''}
                      onChange={(e) => setFormAdditionalCost(Math.max(0, toNum(e.target.value)))}
                      placeholder="0"
                      className="w-28 h-7 text-right px-2 rounded-lg border border-slate-200 text-xs bg-white font-semibold outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                    <span>Total Faktur:</span>
                    <span className="text-base text-blue-600 tabular-nums">
                      {formatRupiah(formGrandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Dokumen akan disimpan dengan status <strong>DRAFT</strong>. Stok fisik di toko atau gudang baru akan bertambah saat tombol <strong>Terima Pembelian</strong> ditekan pada daftar faktur.
                </span>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Simpan Pembelian (Draft)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PRODUCT PICKER MODAL */}
      {isItemPickerOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Pilih Barang dari Master</h3>
              <button
                type="button"
                onClick={() => setIsItemPickerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
                <input
                  type="search"
                  autoFocus
                  value={productSearchInForm}
                  onChange={(e) => setProductSearchInForm(e.target.value)}
                  placeholder="Ketik nama, kode, atau barcode barang..."
                  className="w-full h-9 px-2 text-xs bg-transparent outline-none text-slate-900"
                />
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 p-1">
              {filteredProductsForPicker.length > 0 ? (
                filteredProductsForPicker.map((prod) => (
                  <button
                    key={prod.product_id}
                    type="button"
                    onClick={() => handleAddProductToForm(prod)}
                    className="w-full px-3 py-2.5 text-left hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                        {prod.NAMA}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        {prod.KODE_BARANG} • {prod.KODE_BARCODE || 'No Barcode'} • Stok: {prod.TOKO}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-700 block tabular-nums">
                        {formatRupiah(prod.HPP)}
                      </span>
                      <span className="text-[10px] text-blue-600 font-semibold group-hover:underline">
                        + Tambahkan
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">
                  Tidak ada barang yang cocok.
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsItemPickerOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-semibold"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
