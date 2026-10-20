import React, { useState } from 'react';
import {
  Building2,
  Cloud,
  Layers,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Pencil,
  ExternalLink,
  CheckCircle2,
  FileDown,
  FileUp,
  AlertTriangle,
} from 'lucide-react';
import { Store, SyncStatus } from '../types';
import { extractSheetId } from '../utils/format';
import { DEFAULT_GS_SPREADSHEET_ID } from '../services/sync-manager';

interface SettingsViewProps {
  stores: Store[];
  activeStore: Store | null;
  syncStatus: SyncStatus;
  productCount: number;
  laporanCount?: number;
  isLoaded: boolean;
  productPriceDisplay: 'retail' | 'hpp';
  onProductPriceDisplayChange: (value: 'retail' | 'hpp') => void;
  onSelectStore: (storeId: string) => void;
  onOpenAddStore: () => void;
  onOpenEditStore: (store: Store) => void;
  onDeleteStorePrompt: (store: Store) => void;
  onSaveActiveStoreConfig: (updates: Partial<Store>) => void;
  onToggleAutoSync: (targetState: boolean) => void;
  onChangeAutoSyncInterval: (minutes: number) => void;
  onPullData: () => void;
  onTestSpreadsheet: () => void;
  onTestWebhook: () => void;
  onForcePush: () => void;
  onPullLaporan?: () => void;
  onPushLaporan?: () => void;
  onOpenImportExport: () => void;
  onClearLocalData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  stores,
  activeStore,
  syncStatus,
  productCount,
  laporanCount = 0,
  isLoaded,
  productPriceDisplay,
  onProductPriceDisplayChange,
  onSelectStore,
  onOpenAddStore,
  onOpenEditStore,
  onDeleteStorePrompt,
  onSaveActiveStoreConfig,
  onToggleAutoSync,
  onChangeAutoSyncInterval,
  onPullData,
  onTestSpreadsheet,
  onTestWebhook,
  onForcePush,
  onPullLaporan,
  onPushLaporan,
  onOpenImportExport,
  onClearLocalData,
}) => {
  const [subTab, setSubTab] = useState<'stores' | 'sync' | 'app'>('stores');

  // Form state for active store sync config
  const [sheetUrl, setSheetUrl] = useState(activeStore?.spreadsheetUrl || '');
  const [sheetId, setSheetId] = useState(activeStore?.spreadsheetId || '');
  const [webhookUrl, setWebhookUrl] = useState(activeStore?.webhookUrl || '');

  // Keep state synced if activeStore changes
  React.useEffect(() => {
    if (activeStore) {
      setSheetUrl(activeStore.spreadsheetUrl || '');
      setSheetId(activeStore.spreadsheetId || '');
      setWebhookUrl(activeStore.webhookUrl || '');
    }
  }, [activeStore]);

  const handleSheetUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSheetUrl(val);
    const extracted = extractSheetId(val);
    const nextId = extracted || sheetId;
    if (extracted && !sheetId) {
      setSheetId(extracted);
    }
    onSaveActiveStoreConfig({ spreadsheetUrl: val.trim(), spreadsheetId: nextId.trim() });
  };

  const handleSheetIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSheetId(val);
    onSaveActiveStoreConfig({ spreadsheetId: val.trim() });
  };

  const handleWebhookChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWebhookUrl(val);
    onSaveActiveStoreConfig({ webhookUrl: val.trim() });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Pengaturan</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Manajemen Multi-Toko, konfigurasi Google Sheets, dan utilitas aplikasi.
        </p>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 max-w-md">
        <button
          type="button"
          onClick={() => setSubTab('stores')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
            subTab === 'stores'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Toko ({stores.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('sync')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
            subTab === 'sync'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Sinkronisasi</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('app')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
            subTab === 'app'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Aplikasi & Data</span>
        </button>
      </div>

      {/* ================= SECTION 1: TOKO (STORE MANAGEMENT) ================= */}
      {subTab === 'stores' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Toko Terdaftar</h3>
              <p className="text-xs text-slate-500">
                Setiap toko memiliki basis data dan spreadsheet terisolasi sendiri.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAddStore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Toko</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {stores.map((s) => {
              const isActive = activeStore?.id === s.id;
              const hasSheet = Boolean(s.spreadsheetId || s.spreadsheetUrl);
              const hasWebhook = Boolean(s.webhookUrl);

              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-white border-blue-500 ring-2 ring-blue-100 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {s.name}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200/60 uppercase tracking-tight">
                            Aktif
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            s.autoSync
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Auto Sync: {s.autoSync ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>ID: <code className="font-mono text-[11px] text-slate-600">{s.id.slice(0, 8)}…</code></span>
                        <span aria-hidden="true">·</span>
                        <span className={hasSheet ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                          {hasSheet ? '✓ Spreadsheet' : 'Belum ada Spreadsheet'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={hasWebhook ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                          {hasWebhook ? '✓ Webhook' : 'Belum ada Webhook'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => onSelectStore(s.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          Pilih Toko
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenEditStore(s)}
                        title="Edit Toko"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {stores.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteStorePrompt(s)}
                          title="Hapus Toko"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= SECTION 2: SINKRONISASI ================= */}
      {subTab === 'sync' && (
        <div className="space-y-5 animate-in fade-in duration-100">
          {/* Active Store Indicator */}
          {activeStore ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Konfigurasi untuk Toko Aktif: <strong>{activeStore.name}</strong></span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {productCount.toLocaleString('id-ID')} Barang
              </span>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Silakan pilih atau tambahkan toko aktif terlebih dahulu.</span>
            </div>
          )}

          {/* AUTO SYNC TOGGLE COMPONENT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">Auto Sync</h4>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight uppercase ${
                      activeStore?.autoSync
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {activeStore?.autoSync ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                  Ketika aktif, aplikasi dapat melakukan sinkronisasi otomatis. Ketika OFF, sinkronisasi hanya dilakukan melalui tombol manual.
                </p>
              </div>

              {/* Clean Switch Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(activeStore?.autoSync)}
                onClick={() => onToggleAutoSync(!activeStore?.autoSync)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  activeStore?.autoSync ? 'bg-blue-600' : 'bg-slate-200 hover:bg-slate-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    activeStore?.autoSync ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Configurable Interval when Auto Sync is ON */}
            {activeStore?.autoSync && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Interval Sinkronisasi Otomatis:</span>
                <select
                  value={activeStore.autoSyncIntervalMinutes || 10}
                  onChange={(e) => onChangeAutoSyncInterval(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 text-xs outline-none"
                >
                  <option value={5}>Setiap 5 menit</option>
                  <option value={10}>Setiap 10 menit (Standar)</option>
                  <option value={15}>Setiap 15 menit</option>
                  <option value={30}>Setiap 30 menit</option>
                </select>
              </div>
            )}
          </div>

          {/* CLEAR SYNC STATUS SUMMARY */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Status Sinkronisasi
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-bold tracking-tight ${
                  activeStore?.autoSync
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                Mode: {activeStore?.autoSync ? 'AUTO' : 'MANUAL'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[11px] text-slate-500">Terakhir Ditarik (Last Pull):</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {syncStatus.lastPull || 'Belum pernah'}
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[11px] text-slate-500">Terakhir Dikirim (Last Push):</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {syncStatus.lastPush || 'Belum pernah'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 text-slate-600">
              <span>Status Operasi:</span>
              <span className="font-semibold text-slate-800">
                {syncStatus.isSyncing
                  ? 'Menyinkronkan…'
                  : syncStatus.msg || (syncStatus.state === 'pending' ? 'Perubahan lokal belum dikirim' : 'Siap')}
              </span>
            </div>
          </div>

          {/* SPREADSHEET CONFIGURATION */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>Google Spreadsheet Toko</span>
            </h4>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  URL Google Spreadsheet
                </label>
                {extractSheetId(sheetUrl) ? (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ID Terdeteksi</span>
                  </span>
                ) : null}
              </div>
              <input
                type="url"
                value={sheetUrl}
                onChange={handleSheetUrlChange}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs font-mono transition-all"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Akses spreadsheet harus diset ke <strong>&ldquo;Siapa saja yang memiliki link – Pelihat&rdquo;</strong> (Anyone with link can view).
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Spreadsheet ID
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSheetId(DEFAULT_GS_SPREADSHEET_ID);
                      onSaveActiveStoreConfig({ spreadsheetId: DEFAULT_GS_SPREADSHEET_ID });
                    }}
                    className="text-[11px] font-semibold text-slate-600 hover:text-blue-600 transition-colors"
                    title="Gunakan ID dari Script GS default"
                  >
                    Gunakan ID Script GS
                  </button>
                  <button
                    type="button"
                    onClick={onTestSpreadsheet}
                    disabled={syncStatus.isSyncing}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Tes Baca</span>
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={sheetId}
                onChange={handleSheetIdChange}
                placeholder="Otomatis diambil dari URL atau isi ID spreadsheet"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs font-mono transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                ID default dari Google Script Anda: <code className="text-slate-600 select-all font-mono">{DEFAULT_GS_SPREADSHEET_ID}</code>
              </p>
            </div>
          </div>

          {/* WEBHOOK CONFIGURATION */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Webhook Apps Script Toko</span>
            </h4>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  URL Webhook
                </label>
                <button
                  type="button"
                  onClick={onTestWebhook}
                  disabled={syncStatus.isSyncing}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Tes Webhook</span>
                </button>
              </div>
              <input
                type="url"
                value={webhookUrl}
                onChange={handleWebhookChange}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs font-mono transition-all"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Webhook menangani aksi <strong>sync_master_barang</strong> (55 kolom) dan <strong>sync_laporan</strong> (29 kolom) secara otomatis.
              </p>
            </div>
          </div>

          {/* SYNC ACTIONS (MASTER BARANG 55 KOLOM & LAPORAN 29 KOLOM) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tombol Sinkronisasi Manual Sesuai Sheet
              </h4>
              <span className="text-[11px] text-slate-400">Dapat dijalankan kapan saja</span>
            </div>

            {/* GROUP 1: MASTER BARANG (55 KOLOM) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  1. Master Barang (Sheet1 — 55 Kolom)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {productCount} Barang Tersimpan
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onPullData}
                  disabled={syncStatus.isSyncing}
                  className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                  <span>{syncStatus.isSyncing ? 'Memproses…' : 'TARIK MASTER BARANG (55 Kolom)'}</span>
                </button>

                <button
                  type="button"
                  onClick={onForcePush}
                  disabled={!isLoaded || syncStatus.isSyncing}
                  className="h-11 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Send className="w-4 h-4 text-slate-500" />
                  <span>{syncStatus.isSyncing ? 'Memproses…' : `KIRIM SEMUA BARANG (${productCount})`}</span>
                </button>
              </div>
            </div>

            {/* GROUP 2: LAPORAN (29 KOLOM) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  2. Laporan Penjualan & Pembelian (Sheet &ldquo;Laporan&rdquo; — 29 Kolom)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {laporanCount} Baris Transaksi
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onPullLaporan}
                  disabled={syncStatus.isSyncing}
                  className="h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 text-blue-600 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                  <span>TARIK DARI SHEET &ldquo;LAPORAN&rdquo;</span>
                </button>

                <button
                  type="button"
                  onClick={onPushLaporan}
                  disabled={syncStatus.isSyncing}
                  className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <Send className="w-4 h-4 text-blue-400" />
                  <span>KIRIM LAPORAN PEMBELIAN KE SHEET</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 3: APLIKASI & DATA ================= */}
      {subTab === 'app' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Nilai Barang</h4>
                <p className="text-xs text-slate-500 mt-1">Nilai yang ditampilkan pada kartu barang.</p>
              </div>
              <select
                aria-label="Nilai yang ditampilkan pada kartu barang"
                value={productPriceDisplay}
                onChange={(event) => onProductPriceDisplayChange(event.target.value as 'retail' | 'hpp')}
                className="h-10 min-w-28 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="retail">Retail</option>
                <option value="hpp">HPP</option>
              </select>
            </div>
          </div>

          {/* Active Store Banner */}
          {activeStore && (
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
              <span>Toko aktif: <strong>{activeStore.name}</strong></span>
              <span>{productCount} Barang</span>
            </div>
          )}

          {/* IMPORT & EXPORT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <FileDown className="w-4 h-4 text-slate-700" />
              <span>Import & Export Data Toko</span>
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Unduh cadangan data barang atau import daftar barang baru langsung ke toko aktif dalam format CSV atau JSON.
            </p>
            <button
              type="button"
              onClick={onOpenImportExport}
              className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <FileUp className="w-4 h-4" />
              <span>Buka Menu Import & Export</span>
            </button>
          </div>

          {/* LOCAL CACHE MANAGEMENT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>Data Lokal Toko Ini</span>
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Membersihkan data lokal hanya akan menghapus cache browser untuk toko <strong>{activeStore?.name}</strong>. Data di Google Spreadsheet Anda tetap aman.
            </p>
            <button
              type="button"
              onClick={onClearLocalData}
              className="h-10 px-4 rounded-xl border border-red-200 hover:bg-red-50 active:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Data Tersimpan untuk Toko Ini</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
