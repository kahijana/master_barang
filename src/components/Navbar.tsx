import React from 'react';
import {
  Package,
  ClipboardCheck,
  ShoppingCart,
  FileSpreadsheet,
  ScanBarcode,
  Settings,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { NavTab, Store, SyncStatus } from '../types';
import { StoreSwitcher } from './StoreSwitcher';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenScanner: () => void;
  onOpenAddModal: () => void;
  onSync: () => void;
  syncStatus: SyncStatus;
  productCount: number;
  stores: Store[];
  activeStore: Store | null;
  onSelectStore: (storeId: string) => void;
  onOpenAddStore: () => void;
}

export const AppLogo: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Box outline */}
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
    {/* Barcode detail on front face */}
    <path d="M15.5 15.5v3" stroke="#2563EB" strokeWidth="1.8" />
    <path d="M17.5 14.5v4" stroke="#2563EB" strokeWidth="1.8" />
  </svg>
);

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenScanner,
  onOpenAddModal,
  onSync,
  syncStatus,
  productCount,
  stores,
  activeStore,
  onSelectStore,
  onOpenAddStore,
}) => {
  const syncLabel = syncStatus.isSyncing
    ? 'Menyinkron…'
    : {
        off: activeStore?.autoSync ? 'Belum terhubung' : 'Mode Manual',
        ok: 'Tersinkron',
        pending: 'Belum terkirim',
        busy: 'Menyinkron…',
        err: 'Gagal sinkron',
      }[syncStatus.state];

  const syncDotColor = syncStatus.isSyncing
    ? 'bg-blue-600 animate-pulse'
    : {
        off: 'bg-slate-400',
        ok: 'bg-emerald-600',
        pending: 'bg-amber-500',
        busy: 'bg-blue-600 animate-pulse',
        err: 'bg-red-600',
      }[syncStatus.state];

  const tooltipText = `Mode: ${activeStore?.autoSync ? 'Auto Sync (ON)' : 'Manual Sync (OFF)'} | ${
    syncStatus.lastPull ? `Tarik: ${syncStatus.lastPull}` : ''
  } ${syncStatus.lastPush ? `Kirim: ${syncStatus.lastPush}` : ''} | Klik untuk sinkronisasi manual`;

  return (
    <>
      {/* DESKTOP & MOBILE TOP HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand & Store Switcher */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <button
              onClick={() => onSelectTab('inventory')}
              className="flex items-center gap-2 text-left group shrink-0"
              title="Ke Halaman Barang"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs transition-transform group-active:scale-95">
                <AppLogo className="w-5 h-5 text-blue-400" />
              </div>
              <div className="hidden lg:block">
                <span className="text-sm font-bold tracking-tight text-slate-900 block leading-tight">
                  Master Barang
                </span>
                <span className="text-[11px] text-slate-500 font-medium tabular-nums block">
                  {productCount.toLocaleString('id-ID')} barang
                </span>
              </div>
            </button>

            {/* STORE SWITCHER (Always Visible & Prominent) */}
            <StoreSwitcher
              stores={stores}
              activeStore={activeStore}
              onSelectStore={onSelectStore}
              onOpenAddStore={onOpenAddStore}
            />
          </div>

          {/* Center Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => onSelectTab('inventory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentTab === 'inventory'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4 text-slate-600" />
              <span>Barang</span>
            </button>

            <button
              onClick={() => onSelectTab('opname')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentTab === 'opname'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 text-slate-600" />
              <span>Opname</span>
            </button>

            <button
              onClick={() => onSelectTab('purchase')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentTab === 'purchase'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4 text-slate-600" />
              <span>Pembelian</span>
            </button>

            <button
              onClick={() => onSelectTab('laporan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentTab === 'laporan'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              <span>Laporan</span>
            </button>

            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
            >
              <ScanBarcode className="w-4 h-4 text-blue-600" />
              <span>Scan</span>
            </button>

            <button
              onClick={() => onSelectTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>Pengaturan</span>
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Scan Button */}
            <button
              onClick={onOpenScanner}
              type="button"
              className="md:hidden p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 active:scale-95"
              title="Buka Scanner Barcode"
            >
              <ScanBarcode className="w-4 h-4 text-blue-600" />
            </button>

            {/* Sync Badge Button */}
            <button
              onClick={onSync}
              disabled={syncStatus.isSyncing}
              title={tooltipText}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-xs font-semibold text-slate-700 transition-colors active:scale-98 disabled:opacity-50"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${syncDotColor}`} />
              <span className="hidden sm:inline">{syncLabel}</span>
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-400 ${
                  syncStatus.isSyncing ? 'animate-spin text-blue-600' : ''
                }`}
              />
            </button>

            {/* Desktop Add Button (When on Inventory Tab) */}
            {currentTab === 'inventory' && (
              <button
                onClick={onOpenAddModal}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Barang</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
        <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto px-1">
          {/* Barang */}
          <button
            onClick={() => onSelectTab('inventory')}
            className={`flex flex-col items-center justify-center gap-1 h-full min-h-[44px] transition-colors ${
              currentTab === 'inventory' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Package className="w-4 h-4" />
            <span className="text-[10px]">Barang</span>
          </button>

          {/* Opname */}
          <button
            onClick={() => onSelectTab('opname')}
            className={`flex flex-col items-center justify-center gap-1 h-full min-h-[44px] transition-colors ${
              currentTab === 'opname' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span className="text-[10px]">Opname</span>
          </button>

          {/* Pembelian */}
          <button
            onClick={() => onSelectTab('purchase')}
            className={`flex flex-col items-center justify-center gap-1 h-full min-h-[44px] transition-colors ${
              currentTab === 'purchase' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="text-[10px]">Beli</span>
          </button>

          {/* Laporan */}
          <button
            onClick={() => onSelectTab('laporan')}
            className={`flex flex-col items-center justify-center gap-1 h-full min-h-[44px] transition-colors ${
              currentTab === 'laporan' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-[10px]">Laporan</span>
          </button>

          {/* Pengaturan */}
          <button
            onClick={() => onSelectTab('settings')}
            className={`flex flex-col items-center justify-center gap-1 h-full min-h-[44px] transition-colors ${
              currentTab === 'settings' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="text-[10px]">Atur</span>
          </button>
        </div>
      </nav>
    </>
  );
};
