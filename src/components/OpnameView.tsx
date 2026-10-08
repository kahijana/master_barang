import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  ScanBarcode,
  Check,
  ArrowLeft,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import { OpnameItem, OpnameSession, Product, Store } from '../types';
import {
  applyOpnameStockAdjustment,
  cancelOpnameSession,
  completeOpnameSession,
  startOpnameSession,
  updateOpnameItemCount,
} from '../services/opname-manager';
import { getStoreOpnameItems, getStoreOpnameSessions } from '../services/storage-manager';
import { fmt, getToday, S } from '../utils/format';

interface OpnameViewProps {
  activeStore: Store;
  products: Product[];
  onOpenScannerForOpname: (onScanned: (code: string) => void) => void;
  onStockUpdated: (newProducts: Product[]) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  openConfirm: (config: {
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => void;
}

export const OpnameView: React.FC<OpnameViewProps> = ({
  activeStore,
  products,
  onOpenScannerForOpname,
  onStockUpdated,
  showToast,
  openConfirm,
}) => {
  // Store-isolated sessions
  const [sessions, setSessions] = useState<OpnameSession[]>(() =>
    getStoreOpnameSessions(activeStore.id)
  );
  const [selectedSession, setSelectedSession] = useState<OpnameSession | null>(() => {
    const list = getStoreOpnameSessions(activeStore.id);
    return list.find((s) => s.status === 'IN PROGRESS' || s.status === 'DRAFT') || null;
  });

  // Current session items
  const [sessionItems, setSessionItems] = useState<OpnameItem[]>(() => {
    if (!selectedSession) return [];
    return getStoreOpnameItems(activeStore.id, selectedSession.opname_id);
  });

  // New Opname Modal state
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [opnameDate, setOpnameDate] = useState(getToday());
  const [opnameLocation, setOpnameLocation] = useState<'TOKO' | 'GUDANG'>('TOKO');
  const [opnameNotes, setOpnameNotes] = useState('');

  // Counting interface filter & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'UNCOUNTED' | 'MATCH' | 'SHORT' | 'OVER'
  >('ALL');

  // Reload sessions when activeStore changes
  React.useEffect(() => {
    const list = getStoreOpnameSessions(activeStore.id);
    setSessions(list);
    const active = list.find((s) => s.status === 'IN PROGRESS' || s.status === 'DRAFT') || null;
    setSelectedSession(active);
    if (active) {
      setSessionItems(getStoreOpnameItems(activeStore.id, active.opname_id));
    } else {
      setSessionItems([]);
    }
  }, [activeStore.id]);

  const handleSelectSession = (session: OpnameSession) => {
    setSelectedSession(session);
    setSessionItems(getStoreOpnameItems(activeStore.id, session.opname_id));
    setSearchQuery('');
    setFilterStatus('ALL');
  };

  const handleStartOpname = (e: React.FormEvent) => {
    e.preventDefault();
    if (products.length === 0) {
      showToast('Tidak ada produk untuk di-opname. Tambahkan barang terlebih dahulu.', 'error');
      return;
    }

    const { session, items } = startOpnameSession(activeStore.id, {
      date: opnameDate,
      notes: opnameNotes,
      target_location: opnameLocation,
      products,
    });

    const updatedSessions = getStoreOpnameSessions(activeStore.id);
    setSessions(updatedSessions);
    setSelectedSession(session);
    setSessionItems(items);
    setIsStartModalOpen(false);
    setOpnameNotes('');
    showToast(`Stock Opname ${session.opname_number} dimulai (${session.target_location})`, 'success');
  };

  // Direct physical stock input
  const handleItemCountChange = (productId: string, physicalCount: number) => {
    if (!selectedSession) return;
    const safeCount = Math.max(0, physicalCount);
    updateOpnameItemCount(activeStore.id, selectedSession.opname_id, productId, safeCount);
    setSessionItems(getStoreOpnameItems(activeStore.id, selectedSession.opname_id));
  };

  // Barcode scanning directly inside opname
  const handleScanForOpname = () => {
    onOpenScannerForOpname((code) => {
      const q = S(code).toLowerCase();
      const matched = sessionItems.find(
        (it) => it.product_barcode.toLowerCase() === q || it.product_code.toLowerCase() === q
      );

      if (matched) {
        setSearchQuery(matched.product_code);
        showToast(`Produk ditemukan: ${matched.product_name}`, 'info');
      } else {
        showToast(`Barcode ${code} tidak ditemukan di opname toko ini`, 'error');
      }
    });
  };

  // Complete session (DRAFT / IN PROGRESS -> COMPLETED)
  const handleCompleteOpname = () => {
    if (!selectedSession) return;
    const uncountedCount = sessionItems.filter((i) => !i.counted).length;

    openConfirm({
      title: `Selesaikan Stock Opname ${selectedSession.opname_number}?`,
      message: uncountedCount > 0
        ? `Terdapat ${uncountedCount} barang yang belum dihitung. Barang yang belum dihitung tidak akan disesuaikan stoknya.`
        : 'Semua barang telah diverifikasi. Anda dapat meninjau hasil sebelum menerapkan selisih ke stok sistem.',
      confirmLabel: 'Selesaikan Opname',
      onConfirm: () => {
        const completed = completeOpnameSession(activeStore.id, selectedSession.opname_id);
        if (completed) {
          const list = getStoreOpnameSessions(activeStore.id);
          setSessions(list);
          setSelectedSession(completed);
          showToast(`Stock Opname ${completed.opname_number} selesai dihitung`, 'success');
        }
      },
    });
  };

  // Explicitly apply difference to stock ("Terapkan Selisih ke Stok")
  const handleApplyAdjustment = () => {
    if (!selectedSession) return;
    const itemsWithDiff = sessionItems.filter((i) => i.counted && i.difference !== 0);
    const increaseCount = itemsWithDiff.filter((i) => i.difference > 0).length;
    const decreaseCount = itemsWithDiff.filter((i) => i.difference < 0).length;

    if (itemsWithDiff.length === 0) {
      showToast('Tidak ada selisih stok yang perlu diterapkan.', 'info');
      return;
    }

    openConfirm({
      title: 'Terapkan Hasil Opname ke Stok Sistem?',
      message: `${decreaseCount} barang akan dikurangi dan ${increaseCount} barang akan ditambah pada stok ${selectedSession.target_location}. Perubahan ini akan memengaruhi stok sistem dan dicatat pada riwayat audit.`,
      confirmLabel: 'Terapkan ke Stok',
      isDestructive: false,
      onConfirm: () => {
        const res = applyOpnameStockAdjustment(activeStore.id, selectedSession.opname_id);
        if (res.success) {
          onStockUpdated(res.updatedProducts);
          const list = getStoreOpnameSessions(activeStore.id);
          setSessions(list);
          const updatedSession = list.find((s) => s.opname_id === selectedSession.opname_id);
          if (updatedSession) setSelectedSession(updatedSession);
          showToast(
            `Stok sistem berhasil disesuaikan (${res.adjustedCount} barang diperbarui)`,
            'success'
          );
        } else {
          showToast(res.error || 'Gagal menerapkan selisih stok', 'error');
        }
      },
    });
  };

  const handleCancelSession = () => {
    if (!selectedSession) return;
    openConfirm({
      title: `Batalkan Sesi Opname ${selectedSession.opname_number}?`,
      message: 'Sesi opname ini akan dibatalkan dan tidak dapat dilanjutkan kembali.',
      confirmLabel: 'Batalkan Opname',
      isDestructive: true,
      onConfirm: () => {
        const cancelled = cancelOpnameSession(activeStore.id, selectedSession.opname_id);
        if (cancelled) {
          const list = getStoreOpnameSessions(activeStore.id);
          setSessions(list);
          setSelectedSession(cancelled);
          showToast(`Sesi ${cancelled.opname_number} dibatalkan`, 'info');
        }
      },
    });
  };

  // Summary statistics for active session
  const stats = useMemo(() => {
    let counted = 0;
    let match = 0;
    let short = 0;
    let over = 0;

    for (const item of sessionItems) {
      if (item.counted) {
        counted++;
        if (item.difference === 0) match++;
        else if (item.difference < 0) short++;
        else over++;
      }
    }

    return {
      total: sessionItems.length,
      counted,
      uncounted: sessionItems.length - counted,
      match,
      short,
      over,
    };
  }, [sessionItems]);

  // Filtered session items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessionItems.filter((it) => {
      if (q) {
        const matchName = it.product_name.toLowerCase().includes(q);
        const matchCode = it.product_code.toLowerCase().includes(q);
        const matchBarcode = it.product_barcode.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchBarcode) return false;
      }

      if (filterStatus === 'UNCOUNTED') return !it.counted;
      if (filterStatus === 'MATCH') return it.counted && it.difference === 0;
      if (filterStatus === 'SHORT') return it.counted && it.difference < 0;
      if (filterStatus === 'OVER') return it.counted && it.difference > 0;
      return true;
    });
  }, [sessionItems, searchQuery, filterStatus]);

  // If no session is actively selected, show Session List & History View
  if (!selectedSession) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              <span>Stock Opname</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bandingkan stok fisik toko dengan stok sistem ({activeStore.name})
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsStartModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Mulai Opname Baru</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Sesi Opname Toko ({sessions.length})
          </h3>

          {sessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sessions.map((s) => {
                const sItems = getStoreOpnameItems(activeStore.id, s.opname_id);
                const isFinished = s.status === 'COMPLETED' || s.status === 'CANCELLED';

                return (
                  <div
                    key={s.opname_id}
                    className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-600">
                          {s.opname_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tight ${
                            s.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : s.status === 'CANCELLED'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.date}</span>
                        <span aria-hidden="true">·</span>
                        <span>Stok {s.target_location}</span>
                      </div>

                      <div className="text-xs text-slate-500">
                        {sItems.length} Produk · {s.adjusted ? '✓ Selisih Diterapkan' : 'Belum Diterapkan'}
                      </div>

                      {s.notes && (
                        <p className="text-xs text-slate-500 italic line-clamp-1">&ldquo;{s.notes}&rdquo;</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectSession(s)}
                      className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                    >
                      {isFinished ? 'Lihat Rincian' : 'Lanjutkan Opname'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto space-y-3">
              <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Belum Ada Sesi Opname</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mulai sesi opname untuk mencocokkan stok fisik di toko Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStartModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Mulai Stock Opname</span>
              </button>
            </div>
          )}
        </div>

        {/* Start Opname Modal */}
        {isStartModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-3">Mulai Stock Opname Baru</h3>
              <form onSubmit={handleStartOpname} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Opname
                  </label>
                  <input
                    type="date"
                    required
                    value={opnameDate}
                    onChange={(e) => setOpnameDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Lokasi Stok
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOpnameLocation('TOKO')}
                      className={`h-9 rounded-xl text-xs font-semibold border transition-colors ${
                        opnameLocation === 'TOKO'
                          ? 'bg-blue-50 border-blue-600 text-blue-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Stok Toko
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameLocation('GUDANG')}
                      className={`h-9 rounded-xl text-xs font-semibold border transition-colors ${
                        opnameLocation === 'GUDANG'
                          ? 'bg-blue-50 border-blue-600 text-blue-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Stok Gudang
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Sesi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={opnameNotes}
                    onChange={(e) => setOpnameNotes(e.target.value)}
                    placeholder="Contoh: Opname rutin akhir bulan"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none"
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  Sesi ini akan menyalin data stok sistem toko <strong>{activeStore.name}</strong> saat ini. Stok sistem tidak akan berubah selama perhitungan berlangsung.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsStartModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                  >
                    Mulai Opname ({products.length} Barang)
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ACTIVE COUNTING WORKSPACE
  const isReadOnly = selectedSession.status === 'COMPLETED' || selectedSession.status === 'CANCELLED';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4">
      {/* Workspace Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
              title="Kembali ke Daftar Opname"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{selectedSession.opname_number}</h2>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tight ${
                    selectedSession.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : selectedSession.status === 'CANCELLED'
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                  }`}
                >
                  {selectedSession.status}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                  Lokasi: {selectedSession.target_location}
                </span>
                {selectedSession.adjusted && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                    ✓ Selisih Diterapkan
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedSession.date} · Toko: {activeStore.name}
                {selectedSession.notes ? ` · "${selectedSession.notes}"` : ''}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={handleScanForOpname}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <ScanBarcode className="w-4 h-4 text-blue-600" />
                  <span>Scan Barcode</span>
                </button>
                <button
                  type="button"
                  onClick={handleCompleteOpname}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Selesaikan Opname</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelSession}
                  className="px-3 py-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold"
                >
                  Batal
                </button>
              </>
            )}

            {/* Explicit Action: "Terapkan Selisih ke Stok" */}
            {!selectedSession.adjusted && selectedSession.status !== 'CANCELLED' && (
              <button
                type="button"
                onClick={handleApplyAdjustment}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Terapkan Selisih ke Stok</span>
              </button>
            )}
          </div>
        </div>

        {/* Statistical Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500">Total Item</span>
            <div className="font-bold text-slate-900 text-sm tabular-nums">{stats.total}</div>
          </div>
          <div className="p-2 bg-blue-50/60 rounded-xl border border-blue-100">
            <span className="text-[11px] text-blue-600 font-semibold">Sudah Dihitung</span>
            <div className="font-bold text-blue-800 text-sm tabular-nums">{stats.counted}</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500">Belum Dihitung</span>
            <div className="font-bold text-slate-600 text-sm tabular-nums">{stats.uncounted}</div>
          </div>
          <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-[11px] text-emerald-600 font-semibold">Sesuai (Match)</span>
            <div className="font-bold text-emerald-800 text-sm tabular-nums">{stats.match}</div>
          </div>
          <div className="p-2 bg-red-50/60 rounded-xl border border-red-100">
            <span className="text-[11px] text-red-600 font-semibold">Kurang (Short)</span>
            <div className="font-bold text-red-800 text-sm tabular-nums">{stats.short}</div>
          </div>
          <div className="p-2 bg-amber-50/60 rounded-xl border border-amber-100">
            <span className="text-[11px] text-amber-600 font-semibold">Lebih (Over)</span>
            <div className="font-bold text-amber-800 text-sm tabular-nums">{stats.over}</div>
          </div>
        </div>
      </div>

      {/* Counting Controls & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, kode, atau barcode di opname ini..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={handleScanForOpname}
            className="h-10 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0"
          >
            <ScanBarcode className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Scan Cepat</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({sessionItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('UNCOUNTED')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap ${
              filterStatus === 'UNCOUNTED'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Belum Dihitung ({stats.uncounted})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('MATCH')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap ${
              filterStatus === 'MATCH'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Sesuai ({stats.match})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('SHORT')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap ${
              filterStatus === 'SHORT'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Kurang ({stats.short})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('OVER')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap ${
              filterStatus === 'OVER'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Lebih ({stats.over})
          </button>
        </div>
      </div>

      {/* Items List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4 min-w-[200px]">Produk</th>
                <th className="py-3 px-3 text-right w-24">Stok Sistem</th>
                <th className="py-3 px-3 text-center w-40">Stok Fisik</th>
                <th className="py-3 px-3 text-right w-24">Selisih</th>
                <th className="py-3 px-4 text-center w-28">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const diff = item.difference;
                const statusTag = !item.counted
                  ? 'UNCOUNTED'
                  : diff === 0
                  ? 'MATCH'
                  : diff < 0
                  ? 'SHORT'
                  : 'OVER';

                return (
                  <tr key={item.opname_item_id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Produk */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.product_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {item.product_code}
                        {item.product_barcode ? ` · ${item.product_barcode}` : ''}
                      </div>
                    </td>

                    {/* Stok Sistem */}
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-600">
                      {fmt(item.system_stock)} {item.unit}
                    </td>

                    {/* Stok Fisik (Quick Counting Stepper) */}
                    <td className="py-2 px-3 text-center">
                      {isReadOnly ? (
                        <span className="font-bold text-sm tabular-nums text-slate-900">
                          {item.counted ? fmt(item.physical_stock) : '—'} {item.unit}
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleItemCountChange(item.product_id, (item.physical_stock || 0) - 1)
                            }
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="any"
                            value={item.counted ? item.physical_stock : ''}
                            placeholder={String(item.system_stock)}
                            onChange={(e) =>
                              handleItemCountChange(item.product_id, parseFloat(e.target.value) || 0)
                            }
                            className={`w-16 h-7 text-center rounded-lg border font-bold text-xs outline-none tabular-nums ${
                              item.counted
                                ? 'border-blue-500 bg-blue-50/30 text-blue-900'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleItemCountChange(item.product_id, (item.physical_stock || 0) + 1)
                            }
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Selisih */}
                    <td className="py-3 px-3 text-right tabular-nums font-bold">
                      {!item.counted ? (
                        <span className="text-slate-400">—</span>
                      ) : diff === 0 ? (
                        <span className="text-slate-500">0</span>
                      ) : diff > 0 ? (
                        <span className="text-emerald-600">+{fmt(diff)}</span>
                      ) : (
                        <span className="text-red-600">{fmt(diff)}</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight uppercase ${
                          statusTag === 'MATCH'
                            ? 'bg-slate-100 text-slate-700'
                            : statusTag === 'SHORT'
                            ? 'bg-red-50 text-red-700 border border-red-200/60'
                            : statusTag === 'OVER'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {statusTag}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              Tidak ada produk yang cocok dengan filter atau pencarian.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
