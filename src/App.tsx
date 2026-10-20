import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Plus,
  PackageOpen,
  Boxes,
  RefreshCw,
  Folder,
} from 'lucide-react';
import { LaporanRow, NavTab, Product, Store, SyncState, SyncStatus } from './types';
import {
  deleteStoreStorage,
  getStoreProducts,
  getStoreSyncMeta,
  saveStoreProducts,
  saveStoreSyncMeta,
  getStoreLaporanRows,
  saveStoreLaporanRows,
} from './services/storage-manager';
import {
  createStore,
  deleteStore,
  getActiveStore,
  getAllStores,
  setActiveStore,
  updateStore,
} from './services/store-manager';
import { runMigrationIfNeeded } from './services/migration';
import {
  addProduct,
  deleteProduct,
  updateProduct,
} from './services/product-manager';
import { resetSearchIndex, searchStoreProducts } from './services/search-manager';
import {
  SyncManager,
  generateLaporanRowsFromPurchases,
  testSpreadsheetConnection,
  testStoreWebhookConnection,
} from './services/sync-manager';
import { Navbar } from './components/Navbar';
import { ProductTable } from './components/ProductTable';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { ScannerModal } from './components/ScannerModal';
import { OpnameView } from './components/OpnameView';
import { PurchaseView } from './components/PurchaseView';
import { LaporanView } from './components/LaporanView';
import { SettingsView } from './components/SettingsView';
import { StoreModal } from './components/StoreModal';
import { ImportExportModal } from './components/ImportExportModal';
import { ConfirmDialog, ConfirmDialogState } from './components/ConfirmDialog';
import { Toast, ToastData } from './components/Toast';

export default function App() {
  // Store management state
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStoreState] = useState<Store | null>(null);

  // Products Data & Isolated State for Active Store
  const [items, setItems] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'off',
    msg: '',
    lastPull: '',
    lastPush: '',
    mode: 'MANUAL',
    isSyncing: false,
  });

  // Navigation & View State (Barang, Opname, Pembelian, Laporan, Pengaturan)
  const [currentTab, setCurrentTab] = useState<NavTab>('inventory');
  const [laporanRows, setLaporanRows] = useState<LaporanRow[]>([]);

  // Search & Filtering (strictly scoped to active store)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(50);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals & Panels
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [productModalMode, setProductModalMode] = useState<'add' | 'edit'>('add');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Store Modal
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false);
  const [storeModalMode, setStoreModalMode] = useState<'add' | 'edit'>('add');
  const [storeToEdit, setStoreToEdit] = useState<Store | null>(null);

  // Import / Export Modal
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState<boolean>(false);

  // Scanner
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerMode, setScannerMode] = useState<'lookup' | 'field'>('lookup');
  const [scannedBarcodeForField, setScannedBarcodeForField] = useState<string>('');
  const scannerCallbackRef = useRef<((code: string) => void) | null>(null);

  // Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleOpenConfirm = useCallback(
    (config: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      isDestructive?: boolean;
      onConfirm: () => void;
    }) => {
      setConfirmDialog({
        isOpen: true,
        title: config.title,
        message: config.message,
        confirmLabel: config.confirmLabel,
        cancelLabel: config.cancelLabel,
        isDestructive: config.isDestructive,
        onConfirm: config.onConfirm,
      });
    },
    []
  );

  // Toast Notifications
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Debounced auto-push timer (only used when autoSync === true)
  const autoPushTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: ToastData['type'] = 'info') => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ id: Date.now(), message, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  const updateSyncState = useCallback(
    (
      storeId: string,
      state: SyncState,
      msg = '',
      updates?: { lastPull?: string; lastPush?: string }
    ) => {
      setSyncStatus((prev) => {
        const nextLastPull = updates?.lastPull !== undefined ? updates.lastPull : prev.lastPull;
        const nextLastPush = updates?.lastPush !== undefined ? updates.lastPush : prev.lastPush;
        const nextStatus: SyncStatus = {
          ...prev,
          state,
          msg,
          lastPull: nextLastPull,
          lastPush: nextLastPush,
          mode: activeStore?.autoSync ? 'AUTO' : 'MANUAL',
          isSyncing: false,
        };

        saveStoreSyncMeta(storeId, {
          loaded: isLoaded,
          dirty: state === 'pending',
          lastPull: nextLastPull,
          lastPush: nextLastPush,
          msg,
          state,
        });

        return nextStatus;
      });
    },
    [activeStore?.autoSync, isLoaded]
  );

  // SAVE LOCAL DATA
  // CRITICAL REQUIREMENT: When autoSync === false, save to LOCAL STORAGE ONLY!
  // No webhook request, no spreadsheet request, no remote sync.
  const markDirtyAndSave = useCallback(
    (storeId: string, newItems: Product[]) => {
      setIsDirty(true);
      saveStoreProducts(storeId, newItems);
      saveStoreSyncMeta(storeId, {
        loaded: true,
        dirty: true,
        lastPull: syncStatus.lastPull,
        lastPush: syncStatus.lastPush,
        msg: 'Perubahan lokal belum dikirim',
        state: 'pending',
      });

      setSyncStatus((prev) => ({
        ...prev,
        state: 'pending',
        msg: 'Perubahan lokal belum dikirim',
      }));

      // Only schedule auto-push if activeStore has autoSync === true
      if (activeStore && activeStore.autoSync === true && activeStore.webhookUrl) {
        if (autoPushTimerRef.current) {
          window.clearTimeout(autoPushTimerRef.current);
        }
        autoPushTimerRef.current = window.setTimeout(() => {
          if (activeStore && activeStore.autoSync === true) {
            handleExecutePush(activeStore, newItems, false);
          }
        }, 3000);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeStore, syncStatus.lastPull, syncStatus.lastPush]
  );

  // EXECUTE PUSH (via SyncManager)
  const handleExecutePush = async (store: Store, itemsToPush: Product[], manual = false) => {
    if (!store.webhookUrl) {
      updateSyncState(store.id, 'err', `URL Webhook untuk toko "${store.name}" belum diatur`);
      if (manual) {
        showToast(`URL Webhook untuk toko "${store.name}" belum diatur di Pengaturan`, 'error');
      }
      return;
    }

    if (!isLoaded && itemsToPush.length === 0 && !manual) {
      updateSyncState(
        store.id,
        'err',
        'Tarik data terlebih dahulu agar tidak menimpa sheet dengan data kosong'
      );
      return;
    }

    if (SyncManager.isSyncing()) {
      if (manual) showToast('Sinkronisasi sedang berjalan, harap tunggu…', 'info');
      return;
    }

    setSyncStatus((prev) => ({
      ...prev,
      state: 'busy',
      isSyncing: true,
      msg: `Mengirim data toko "${store.name}" ke spreadsheet…`,
    }));

    try {
      const res = await SyncManager.manualPush(store, itemsToPush);
      setIsDirty(false);
      saveStoreProducts(store.id, itemsToPush);
      updateSyncState(store.id, 'ok', 'Data berhasil dikirim ke spreadsheet', {
        lastPush: res.timestamp,
      });

      if (manual || !res.confirmed) {
        showToast(
          res.confirmed
            ? `Data toko "${store.name}" berhasil dikirim ke Google Sheets (${res.timestamp})`
            : 'Terkirim ke webhook. Tarik data untuk memverifikasi pembaruan.',
          'success'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim data';
      updateSyncState(store.id, 'err', msg);
      showToast(`Gagal mengirim: ${msg}`, 'error');
    }
  };

  // MANUAL PULL (via SyncManager)
  const handlePullData = async (manual = true) => {
    if (!activeStore) {
      showToast('Pilih toko aktif terlebih dahulu', 'error');
      return;
    }

    if (!activeStore.spreadsheetId && !activeStore.spreadsheetUrl) {
      if (manual) {
        showToast(`URL Spreadsheet toko "${activeStore.name}" belum diatur`, 'error');
      }
      setCurrentTab('settings');
      return;
    }

    if (manual && isDirty) {
      setConfirmDialog({
        isOpen: true,
        title: 'Timpa Perubahan Lokal?',
        message: `Ada perubahan lokal untuk toko "${activeStore.name}" yang belum dikirim ke Google Sheets. Menarik data sekarang akan mengganti data lokal dengan isi spreadsheet.`,
        confirmLabel: 'Tarik & Timpa',
        isDestructive: true,
        onConfirm: () => {
          setIsDirty(false);
          startPull(activeStore, manual);
        },
      });
      return;
    }

    startPull(activeStore, manual);
  };

  const startPull = async (store: Store, manual: boolean) => {
    if (SyncManager.isSyncing()) {
      if (manual) showToast('Sinkronisasi sedang berjalan, harap tunggu…', 'info');
      return;
    }

    setSyncStatus((prev) => ({
      ...prev,
      state: 'busy',
      isSyncing: true,
      msg: `Mengambil data spreadsheet untuk toko "${store.name}"…`,
    }));

    try {
      const { products: loadedProducts, timestamp } = await SyncManager.manualPull(store);
      setItems(loadedProducts);
      setIsLoaded(true);
      setIsDirty(false);
      saveStoreProducts(store.id, loadedProducts);
      updateSyncState(store.id, 'ok', `${loadedProducts.length} barang termuat`, {
        lastPull: timestamp,
      });
      if (manual) {
        showToast(
          `${loadedProducts.length.toLocaleString('id-ID')} barang toko "${store.name}" berhasil dimuat (${timestamp})`,
          'success'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menarik data spreadsheet';
      updateSyncState(store.id, isLoaded ? 'err' : 'off', msg);
      if (manual || !isLoaded) {
        showToast(msg, 'error');
      }
    }
  };

  // LOAD STORE DATA HELPER (Strictly local data only!)
  const loadStoreData = useCallback((store: Store) => {
    const storeProducts = getStoreProducts(store.id);
    const storeLaporan = getStoreLaporanRows(store.id);
    const syncMeta = getStoreSyncMeta(store.id);

    setItems(storeProducts);
    setLaporanRows(storeLaporan);
    setIsLoaded(syncMeta.loaded || storeProducts.length > 0);
    setIsDirty(syncMeta.dirty);
    setSyncStatus({
      state: syncMeta.state || (syncMeta.dirty ? 'pending' : (storeProducts.length > 0 ? 'ok' : 'off')),
      msg: syncMeta.msg || '',
      lastPull: syncMeta.lastPull || '',
      lastPush: syncMeta.lastPush || '',
      mode: store.autoSync ? 'AUTO' : 'MANUAL',
      isSyncing: false,
    });
  }, []);

  // SWITCH STORE SAFELY
  // CRITICAL REQUIREMENT: When switching stores, DO NOT automatically pull Store B remote data
  // if Store B autoSync === false. Only load local data!
  const handleSelectStore = (storeId: string) => {
    if (activeStore && activeStore.id === storeId) return;

    // 1. Clear any running push timer
    if (autoPushTimerRef.current) {
      window.clearTimeout(autoPushTimerRef.current);
      autoPushTimerRef.current = null;
    }

    // 2. Clear in-memory product state and search index
    setItems([]);
    setLaporanRows([]);
    setSearchQuery('');
    setSelectedCategory('');
    setVisibleLimit(50);
    resetSearchIndex();

    // 3. Set active store
    const nextStore = setActiveStore(storeId);
    if (!nextStore) return;

    setActiveStoreState(nextStore);
    setStores(getAllStores());

    // 4. Load store-specific local data ONLY
    loadStoreData(nextStore);

    showToast(`Beralih ke toko: ${nextStore.name}`, 'info');
  };

  // INITIALIZATION ON MOUNT
  // CRITICAL REQUIREMENT: When autoSync === false, DO NOT automatically pull on app load!
  useEffect(() => {
    const { activeStore: currentActiveStore } = runMigrationIfNeeded();
    const all = getAllStores();
    setStores(all);

    const active = getActiveStore() || currentActiveStore;
    setActiveStoreState(active);

    if (active) {
      loadStoreData(active);
    } else {
      setCurrentTab('settings');
    }

    // Warn before closing tab if there are uncommitted changes
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loadStoreData, isDirty]);

  // BACKGROUND AUTO-SYNC TIMER (Controlled & Only active when autoSync === true)
  useEffect(() => {
    if (!activeStore || !activeStore.autoSync) {
      return; // No timer when autoSync is OFF!
    }

    const intervalMinutes = activeStore.autoSyncIntervalMinutes || 10;
    const intervalMs = intervalMinutes * 60 * 1000;

    const intervalTimer = setInterval(() => {
      if (activeStore && activeStore.autoSync && !SyncManager.isSyncing()) {
        SyncManager.autoSync(activeStore, items, isDirty).then((result) => {
          if (result) {
            if (result.type === 'push') {
              setIsDirty(false);
              updateSyncState(activeStore.id, 'ok', 'Auto sync push berhasil', {
                lastPush: result.timestamp,
              });
            } else if (result.type === 'pull' && result.products) {
              setItems(result.products);
              saveStoreProducts(activeStore.id, result.products);
              updateSyncState(activeStore.id, 'ok', `${result.products.length} barang diperbarui`, {
                lastPull: result.timestamp,
              });
            }
          }
        }).catch((err) => {
          console.warn('Auto sync execution error:', err);
        });
      }
    }, intervalMs);

    return () => clearInterval(intervalTimer);
  }, [activeStore, items, isDirty, updateSyncState]);

  // Global Keyboard Shortcut: Ctrl/Cmd + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCurrentTab('inventory');
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute Categories, Suppliers, Units (strictly for current active store)
  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.KATEGORI).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'id')
    );
  }, [items]);

  const suppliers = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.SUPPLIER).filter(Boolean))).sort();
  }, [items]);

  const units = useMemo(() => {
    const base = ['PCS', 'DUS', 'LUSIN', 'PACK', 'KG', 'LITER', 'METER', 'ROLL'];
    const itemUnits = items.flatMap((i) => [i.SATUAN_1, i.SATUAN_2]).filter(Boolean);
    return Array.from(new Set([...base, ...itemUnits])).sort();
  }, [items]);

  // Filtered & Searched Products (strictly isolated to current active store)
  const filteredProducts = useMemo(() => {
    if (!activeStore) return [];
    return searchStoreProducts(activeStore.id, items, searchQuery, selectedCategory);
  }, [activeStore, items, searchQuery, selectedCategory]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleLimit);
  }, [filteredProducts, visibleLimit]);

  // STORE CRUD HANDLERS
  const handleOpenAddStore = () => {
    setStoreModalMode('add');
    setStoreToEdit(null);
    setIsStoreModalOpen(true);
  };

  const handleOpenEditStore = (store: Store) => {
    setStoreModalMode('edit');
    setStoreToEdit(store);
    setIsStoreModalOpen(true);
  };

  const handleSaveStore = (data: {
    name: string;
    spreadsheetUrl: string;
    spreadsheetId: string;
    webhookUrl: string;
  }) => {
    if (storeModalMode === 'add') {
      const newStore = createStore(data);
      const all = getAllStores();
      setStores(all);
      handleSelectStore(newStore.id);
      showToast(`Toko "${newStore.name}" berhasil dibuat (Mode: Manual)`, 'success');
    } else if (storeModalMode === 'edit' && storeToEdit) {
      const updated = updateStore({
        id: storeToEdit.id,
        ...data,
      });
      if (updated) {
        setStores(getAllStores());
        if (activeStore?.id === updated.id) {
          setActiveStoreState(updated);
        }
        showToast(`Konfigurasi toko "${updated.name}" diperbarui`, 'success');
      }
    }
  };

  const handleDeleteStorePrompt = (store: Store) => {
    setConfirmDialog({
      isOpen: true,
      title: `Hapus Toko "${store.name}"?`,
      message: `Seluruh data barang dan cache lokal toko "${store.name}" akan dihapus dari browser. Spreadsheet di Google Drive tidak akan dihapus.`,
      confirmLabel: 'Hapus Toko',
      isDestructive: true,
      onConfirm: () => {
        const { remainingStores, nextActiveStore } = deleteStore(store.id);
        setStores(remainingStores);
        if (nextActiveStore) {
          handleSelectStore(nextActiveStore.id);
        } else {
          setActiveStoreState(null);
          setItems([]);
        }
        showToast(`Toko "${store.name}" berhasil dihapus`, 'info');
      },
    });
  };

  const handleSaveActiveStoreConfig = (updates: Partial<Store>) => {
    if (!activeStore) return;
    const updated = updateStore({
      id: activeStore.id,
      name: updates.name !== undefined ? updates.name : activeStore.name,
      spreadsheetUrl: updates.spreadsheetUrl,
      spreadsheetId: updates.spreadsheetId,
      webhookUrl: updates.webhookUrl,
      autoSync: updates.autoSync !== undefined ? updates.autoSync : activeStore.autoSync,
      autoSyncIntervalMinutes: updates.autoSyncIntervalMinutes !== undefined
        ? updates.autoSyncIntervalMinutes
        : activeStore.autoSyncIntervalMinutes,
    });
    if (updated) {
      setActiveStoreState(updated);
      setStores(getAllStores());
      setSyncStatus((prev) => ({
        ...prev,
        mode: updated.autoSync ? 'AUTO' : 'MANUAL',
      }));
    }
  };

  // AUTO SYNC TOGGLE WITH REQUIRED CONFIRMATION
  const handleToggleAutoSync = (targetState: boolean) => {
    if (!activeStore) return;

    if (targetState === true) {
      // Prompt confirmation before enabling Auto Sync
      setConfirmDialog({
        isOpen: true,
        title: 'Aktifkan Auto Sync?',
        message: `Aplikasi dapat melakukan sinkronisasi otomatis dengan Spreadsheet/Webhook untuk toko "${activeStore.name}".`,
        confirmLabel: 'Aktifkan',
        isDestructive: false,
        onConfirm: () => {
          handleSaveActiveStoreConfig({ autoSync: true });
          showToast(`Auto Sync diaktifkan untuk toko "${activeStore.name}"`, 'success');
        },
      });
    } else {
      // Immediately disable without confirmation
      if (autoPushTimerRef.current) {
        window.clearTimeout(autoPushTimerRef.current);
        autoPushTimerRef.current = null;
      }
      handleSaveActiveStoreConfig({ autoSync: false });
      showToast(
        'Auto Sync OFF. Sinkronisasi otomatis dihentikan. Gunakan TARIK DATA dan KIRIM DATA untuk sinkronisasi manual.',
        'info'
      );
    }
  };

  const handleChangeAutoSyncInterval = (minutes: number) => {
    handleSaveActiveStoreConfig({ autoSyncIntervalMinutes: minutes });
    showToast(`Interval Auto Sync diatur ke ${minutes} menit`, 'info');
  };

  // PRODUCT CRUD HANDLERS
  const handleOpenAddModal = (initialData?: Partial<Product>) => {
    if (!activeStore) {
      showToast('Pilih atau buat toko terlebih dahulu', 'error');
      return;
    }
    setProductModalMode('add');
    if (initialData) {
      setEditingProduct(initialData as Product);
    } else {
      setEditingProduct(null);
    }
    setScannedBarcodeForField('');
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setProductModalMode('edit');
    setEditingProduct(product);
    setScannedBarcodeForField('');
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (savedProduct: Product, originalProductId: string | null) => {
    if (!activeStore) return;

    if (productModalMode === 'edit' && originalProductId) {
      const res = updateProduct(activeStore.id, savedProduct);
      if (!res.success) {
        showToast(res.error || 'Gagal memperbarui barang', 'error');
        return;
      }
      const updatedList = getStoreProducts(activeStore.id);
      setItems(updatedList);
      setIsProductModalOpen(false);
      markDirtyAndSave(activeStore.id, updatedList);
      showToast('Perubahan data barang berhasil disimpan', 'success');
    } else {
      const res = addProduct(activeStore.id, savedProduct);
      if (!res.success) {
        showToast(res.error || 'Gagal menambahkan barang', 'error');
        return;
      }
      const updatedList = getStoreProducts(activeStore.id);
      setItems(updatedList);
      setIsProductModalOpen(false);
      markDirtyAndSave(activeStore.id, updatedList);
      showToast(`Barang "${savedProduct.NAMA}" berhasil ditambahkan ke ${activeStore.name}`, 'success');
    }
  };

  const handleDeleteProductPrompt = (product: Product) => {
    if (!activeStore) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Barang?',
      message: `Apakah Anda yakin ingin menghapus "${product.NAMA}" (${product.KODE_BARANG}) dari toko "${activeStore.name}"? Data akan dihapus dari daftar lokal.`,
      confirmLabel: 'Hapus Barang',
      isDestructive: true,
      onConfirm: () => {
        const remaining = deleteProduct(activeStore.id, product.product_id);
        setItems(remaining);
        setIsProductModalOpen(false);
        markDirtyAndSave(activeStore.id, remaining);
        showToast(`Barang "${product.NAMA}" dihapus dari ${activeStore.name}`, 'info');
      },
    });
  };

  // Instant Stock Update from Scanner (Local data only when autoSync is false)
  const handleUpdateStockFromScan = (product: Product, newToko: number, newGudang: number) => {
    if (!activeStore) return;
    const updatedProduct = { ...product, TOKO: newToko, GUDANG: newGudang };
    const res = updateProduct(activeStore.id, updatedProduct);
    if (res.success) {
      const updatedList = getStoreProducts(activeStore.id);
      setItems(updatedList);
      markDirtyAndSave(activeStore.id, updatedList);
      showToast(
        `Stok ${product.NAMA} diperbarui (Toko: ${newToko}, Gudang: ${newGudang})`,
        'success'
      );
    }
  };

  // Scanner Modal Triggers
  const handleOpenScanner = (mode: 'lookup' | 'field' = 'lookup') => {
    setScannerMode(mode);
    setIsScannerOpen(true);
  };

  const handleBarcodeScannedForField = (code: string) => {
    if (scannerCallbackRef.current) {
      scannerCallbackRef.current(code);
      scannerCallbackRef.current = null;
      setIsScannerOpen(false);
      return;
    }
    setScannedBarcodeForField(code);
    setIsScannerOpen(false);
  };

  // Stock update triggered by Opname or Purchase module
  const handleStockUpdatedFromModule = (newProducts: Product[]) => {
    if (!activeStore) return;
    setItems(newProducts);
    markDirtyAndSave(activeStore.id, newProducts);
  };

  // Settings Connection Tests
  const handleTestSpreadsheet = async () => {
    if (!activeStore) return;
    showToast('Menguji koneksi spreadsheet…', 'info');
    const res = await testSpreadsheetConnection(activeStore);
    showToast(res.msg, res.ok ? 'success' : 'error');
  };

  const handleTestWebhook = async () => {
    if (!activeStore) return;
    showToast('Menguji webhook…', 'info');
    const res = await testStoreWebhookConnection(activeStore);
    showToast(res.msg, res.ok ? 'success' : 'error');
  };

  const handleForcePushPrompt = () => {
    if (!activeStore) return;
    if (items.length === 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'Kosongkan Spreadsheet?',
        message: `Daftar produk di toko "${activeStore.name}" kosong. Seluruh isi sheet pertama akan dikosongkan.`,
        confirmLabel: 'Kosongkan',
        isDestructive: true,
        onConfirm: () => handleExecutePush(activeStore, [], true),
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Kirim Semua Data?',
      message: `${items.length.toLocaleString('id-ID')} barang akan dikirim ke webhook toko "${activeStore.name}".`,
      confirmLabel: 'Kirim Data',
      onConfirm: () => handleExecutePush(activeStore, items, true),
    });
  };

  // LAPORAN SYNC ACTIONS (SHEET "LAPORAN" — 29 KOLOM)
  const handlePullLaporan = async () => {
    if (!activeStore) {
      showToast('Pilih toko aktif terlebih dahulu', 'error');
      return;
    }
    if (SyncManager.isSyncing()) {
      showToast('Sinkronisasi sedang berjalan, harap tunggu…', 'info');
      return;
    }

    setSyncStatus((prev) => ({
      ...prev,
      state: 'busy',
      isSyncing: true,
      msg: `Menarik data dari sheet "Laporan" (${activeStore.name})…`,
    }));

    try {
      const rows = await SyncManager.manualPullLaporan(activeStore);
      setLaporanRows(rows);
      saveStoreLaporanRows(activeStore.id, rows);
      const timestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      updateSyncState(activeStore.id, 'ok', `${rows.length} baris laporan termuat`, {
        lastPull: timestamp,
      });
      showToast(
        `${rows.length.toLocaleString('id-ID')} transaksi berhasil ditarik dari sheet "Laporan" (${timestamp})`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menarik data laporan';
      updateSyncState(activeStore.id, 'err', msg);
      showToast(msg, 'error');
    }
  };

  const handlePushLaporan = async () => {
    if (!activeStore) {
      showToast('Pilih toko aktif terlebih dahulu', 'error');
      return;
    }
    if (!activeStore.webhookUrl) {
      showToast(`URL Webhook toko "${activeStore.name}" belum diatur di Pengaturan`, 'error');
      setCurrentTab('settings');
      return;
    }

    // Automatically generate rows from local purchases
    const purchaseRows = generateLaporanRowsFromPurchases(activeStore.id);
    // Combine with existing manual / sales rows in laporanRows
    const nonPurchaseRows = laporanRows.filter((r) => r.tipe_transaksi !== 'PEMBELIAN');
    const combinedRows = [...purchaseRows, ...nonPurchaseRows];

    if (combinedRows.length === 0) {
      showToast('Belum ada transaksi pembelian atau catatan penjualan untuk dikirim ke sheet "Laporan"', 'info');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Kirim Data ke Sheet "Laporan"?',
      message: `${combinedRows.length} transaksi toko "${activeStore.name}" akan dikirim dan di-upsert ke sheet "Laporan" di Google Sheets.`,
      confirmLabel: 'Kirim Laporan',
      onConfirm: async () => {
        setSyncStatus((prev) => ({
          ...prev,
          state: 'busy',
          isSyncing: true,
          msg: `Mengirim ${combinedRows.length} transaksi ke sheet "Laporan"…`,
        }));

        try {
          const res = await SyncManager.manualPushLaporan(activeStore, combinedRows);
          setLaporanRows(combinedRows);
          saveStoreLaporanRows(activeStore.id, combinedRows);
          const timestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          updateSyncState(activeStore.id, 'ok', res.msg, { lastPush: timestamp });
          showToast(res.msg || 'Data transaksi berhasil disinkronkan ke sheet "Laporan"', 'success');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Gagal mengirim laporan';
          updateSyncState(activeStore.id, 'err', msg);
          showToast(msg, 'error');
        }
      },
    });
  };

  const handleSaveLaporanRows = (rows: LaporanRow[]) => {
    if (!activeStore) return;
    setLaporanRows(rows);
    saveStoreLaporanRows(activeStore.id, rows);
  };

  const handleClearLocalDataPrompt = () => {
    if (!activeStore) return;
    setConfirmDialog({
      isOpen: true,
      title: `Hapus Data Lokal Toko "${activeStore.name}"?`,
      message: `Cache lokal toko "${activeStore.name}" akan dibersihkan. Data di Google Spreadsheet Anda tetap aman. Perubahan yang belum terkirim akan hilang.`,
      confirmLabel: 'Hapus Data Lokal',
      isDestructive: true,
      onConfirm: () => {
        deleteStoreStorage(activeStore.id);
        setItems([]);
        setIsLoaded(false);
        setIsDirty(false);
        setSyncStatus({
          state: 'off',
          msg: '',
          lastPull: '',
          lastPush: '',
          mode: activeStore.autoSync ? 'AUTO' : 'MANUAL',
          isSyncing: false,
        });
        showToast(`Data lokal toko "${activeStore.name}" berhasil dibersihkan`, 'info');
      },
    });
  };

  // Import handler (Strictly local data only)
  const handleImportProducts = (importedProducts: Product[]) => {
    if (!activeStore) return;
    const existing = getStoreProducts(activeStore.id);
    const combined = [...importedProducts, ...existing];
    const seen = new Set<string>();
    const deduplicated: Product[] = [];
    for (const p of combined) {
      if (!seen.has(p.product_id)) {
        seen.add(p.product_id);
        deduplicated.push(p);
      }
    }

    saveStoreProducts(activeStore.id, deduplicated);
    setItems(deduplicated);
    markDirtyAndSave(activeStore.id, deduplicated);
    setIsImportExportModalOpen(false);
    showToast(
      `${importedProducts.length} barang berhasil diimpor ke toko "${activeStore.name}"`,
      'success'
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 pb-24 md:pb-12">
      {/* Top Navbar & Header with Active Store Switcher */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenScanner={() => handleOpenScanner('lookup')}
        onOpenAddModal={() => handleOpenAddModal()}
        onSync={() => {
          if (!activeStore) return;
          if (isDirty) {
            handleForcePushPrompt();
          } else {
            handlePullData(true);
          }
        }}
        syncStatus={syncStatus}
        productCount={items.length}
        stores={stores}
        activeStore={activeStore}
        onSelectStore={handleSelectStore}
        onOpenAddStore={handleOpenAddStore}
      />

      {/* MAIN VIEW: INVENTORY / BARANG */}
      {currentTab === 'inventory' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4">
          {/* SEARCH BAR & SHORTCUT */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-2xs">
            <div className="flex items-center gap-3 px-3 h-11">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleLimit(50);
                }}
                placeholder={`Cari nama, kode, atau barcode di ${activeStore?.name || 'toko'}...`}
                className="w-full h-full bg-transparent border-none outline-none text-sm text-slate-900 placeholder:text-slate-400"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  aria-label="Hapus kata kunci"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-md">
                  ⌘K
                </kbd>
              )}
            </div>

            {/* HORIZONTAL CATEGORY FILTER CHIPS */}
            {categories.length > 0 ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 no-scrollbar px-1 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('');
                    setVisibleLimit(50);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    !selectedCategory
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                  }`}
                >
                  Semua
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      setVisibleLimit(50);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* ACTIVE FILTER KICKER (ZERO-PILL UNBOXED STYLE) */}
          {(searchQuery || selectedCategory) && (
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <div className="flex items-center gap-2">
                <span>
                  Menampilkan <strong>{filteredProducts.length.toLocaleString('id-ID')}</strong> barang di{' '}
                  <strong>{activeStore?.name}</strong>
                </span>
                {selectedCategory ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 text-slate-700">
                      <Folder className="w-3.5 h-3.5" />
                      <span>{selectedCategory}</span>
                    </span>
                  </>
                ) : null}
                {searchQuery ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Kata kunci: &ldquo;{searchQuery}&rdquo;</span>
                  </>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                }}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Reset Filter
              </button>
            </div>
          )}

          {/* PRODUCTS LIST / TABLE */}
          {filteredProducts.length > 0 ? (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <ProductTable
                  products={visibleProducts}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteProductPrompt}
                />
              </div>

              {/* Mobile Compact Cards List */}
              <div className="md:hidden rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-2xs divide-y divide-slate-100">
                {visibleProducts.map((p) => (
                  <ProductCard
                    key={p.product_id}
                    product={p}
                    onClick={() => handleOpenEditModal(p)}
                  />
                ))}
              </div>

              {/* Pagination / Load More Button */}
              {filteredProducts.length > visibleLimit ? (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((prev) => prev + 50)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
                  >
                    Tampilkan Lebih Banyak ({filteredProducts.length - visibleLimit} Barang Tersisa)
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            /* EMPTY STATES */
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-2xs space-y-4">
              {!isLoaded && items.length === 0 ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">
                      Belum Ada Data di {activeStore?.name || 'Toko Ini'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Hubungkan Spreadsheet toko ini melalui menu Pengaturan, atau tambahkan barang secara manual.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handlePullData(true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Tarik Data Spreadsheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentTab('settings')}
                      className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                    >
                      Pengaturan Toko
                    </button>
                  </div>
                </>
              ) : isLoaded && items.length === 0 ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                    <PackageOpen className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">
                      Daftar Barang {activeStore?.name} Masih Kosong
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Mulai catat barang pertama untuk toko ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal()}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Barang Pertama</span>
                  </button>
                </>
              ) : (
                /* Search Not Found */
                <>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">Barang Tidak Ditemukan</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Tidak ada produk di {activeStore?.name} yang cocok dengan &ldquo;{searchQuery}&rdquo;.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('');
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                    >
                      Hapus Pencarian
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenAddModal(
                          /^\d+$/.test(searchQuery)
                            ? { KODE_BARCODE: searchQuery, KODE_BARANG: searchQuery }
                            : { NAMA: searchQuery }
                        )
                      }
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Sebagai Barang Baru</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      ) : currentTab === 'opname' && activeStore ? (
        <OpnameView
          activeStore={activeStore}
          products={items}
          onOpenScannerForOpname={(cb) => {
            scannerCallbackRef.current = cb;
            handleOpenScanner('field');
          }}
          onStockUpdated={handleStockUpdatedFromModule}
          showToast={showToast}
          openConfirm={handleOpenConfirm}
        />
      ) : currentTab === 'purchase' && activeStore ? (
        <PurchaseView
          activeStore={activeStore}
          products={items}
          onOpenScannerForPurchase={(cb) => {
            scannerCallbackRef.current = cb;
            handleOpenScanner('field');
          }}
          onStockUpdated={handleStockUpdatedFromModule}
          showToast={showToast}
          openConfirm={handleOpenConfirm}
        />
      ) : currentTab === 'laporan' && activeStore ? (
        <LaporanView
          activeStore={activeStore}
          laporanRows={laporanRows}
          isSyncing={syncStatus.isSyncing}
          onPullLaporan={handlePullLaporan}
          onPushLaporan={handlePushLaporan}
          onSaveLaporanRows={handleSaveLaporanRows}
          openConfirm={handleOpenConfirm}
          showToast={showToast}
        />
      ) : (
        /* SETTINGS VIEW WITH TOKO, SINKRONISASI, APLIKASI SUB-TABS */
        <SettingsView
          stores={stores}
          activeStore={activeStore}
          syncStatus={syncStatus}
          productCount={items.length}
          laporanCount={laporanRows.length}
          isLoaded={isLoaded}
          onSelectStore={handleSelectStore}
          onOpenAddStore={handleOpenAddStore}
          onOpenEditStore={handleOpenEditStore}
          onDeleteStorePrompt={handleDeleteStorePrompt}
          onSaveActiveStoreConfig={handleSaveActiveStoreConfig}
          onToggleAutoSync={handleToggleAutoSync}
          onChangeAutoSyncInterval={handleChangeAutoSyncInterval}
          onPullData={() => handlePullData(true)}
          onTestSpreadsheet={handleTestSpreadsheet}
          onTestWebhook={handleTestWebhook}
          onForcePush={handleForcePushPrompt}
          onPullLaporan={handlePullLaporan}
          onPushLaporan={handlePushLaporan}
          onOpenImportExport={() => setIsImportExportModalOpen(true)}
          onClearLocalData={handleClearLocalDataPrompt}
        />
      )}

      {/* FLOATING ACTION BUTTON (Mobile Only) */}
      {currentTab === 'inventory' && (
        <button
          onClick={() => handleOpenAddModal()}
          className="md:hidden fixed right-4 bottom-20 z-30 h-12 px-4 rounded-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold shadow-lg shadow-slate-900/25 flex items-center gap-2 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah</span>
        </button>
      )}

      {/* PRODUCT MODAL (Add & Edit) */}
      <ProductModal
        isOpen={isProductModalOpen}
        mode={productModalMode}
        product={editingProduct}
        activeStoreId={activeStore?.id || ''}
        allProducts={items}
        categories={categories}
        suppliers={suppliers}
        units={units}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProductPrompt}
        onScanForBarcode={() => handleOpenScanner('field')}
        scannedBarcodeValue={scannedBarcodeForField}
      />

      {/* SCANNER MODAL */}
      <ScannerModal
        isOpen={isScannerOpen}
        mode={scannerMode}
        activeStoreName={activeStore?.name}
        allProducts={items}
        onClose={() => setIsScannerOpen(false)}
        onSelectForField={handleBarcodeScannedForField}
        onUpdateStock={handleUpdateStockFromScan}
        onOpenEditFromScan={(p) => {
          setIsScannerOpen(false);
          handleOpenEditModal(p);
        }}
        onOpenAddFromScan={(code) => {
          setIsScannerOpen(false);
          handleOpenAddModal({ KODE_BARCODE: code, KODE_BARANG: code });
        }}
      />

      {/* STORE MODAL (Add & Edit Store) */}
      <StoreModal
        isOpen={isStoreModalOpen}
        mode={storeModalMode}
        storeToEdit={storeToEdit}
        onClose={() => setIsStoreModalOpen(false)}
        onSave={handleSaveStore}
      />

      {/* IMPORT / EXPORT MODAL */}
      {activeStore && (
        <ImportExportModal
          isOpen={isImportExportModalOpen}
          activeStore={activeStore}
          products={items}
          onClose={() => setIsImportExportModalOpen(false)}
          onImportProducts={handleImportProducts}
        />
      )}

      {/* DESTRUCTIVE CONFIRMATION MODAL */}
      <ConfirmDialog
        dialog={confirmDialog}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* TOAST FEEDBACK */}
      <Toast toast={toast} />
    </div>
  );
}
