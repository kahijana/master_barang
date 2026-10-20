import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  X,
  RefreshCw,
  Send,
  Download,
  Search,
  Building2,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Tag,
} from 'lucide-react';
import { LaporanRow, Store } from '../types';
import {
  generateLaporanRowsFromPurchases,
  rawPullStoreLaporan,
  rawPushStoreLaporan,
} from '../services/sync-manager';
import { formatRupiah, fmt, S } from '../utils/format';

interface LaporanModalProps {
  isOpen: boolean;
  activeStore: Store;
  onClose: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const LaporanModal: React.FC<LaporanModalProps> = ({
  isOpen,
  activeStore,
  onClose,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'remote'>('local');
  const [localRows, setLocalRows] = useState<LaporanRow[]>([]);
  const [remoteRows, setRemoteRows] = useState<LaporanRow[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PEMBELIAN' | 'PENJUALAN'>('ALL');

  // Load local rows generated from purchases on open
  useEffect(() => {
    if (isOpen) {
      const generated = generateLaporanRowsFromPurchases(activeStore.id);
      setLocalRows(generated);
      setSearchQuery('');
      setFilterType('ALL');
    }
  }, [isOpen, activeStore.id]);

  const handleFetchRemote = async () => {
    setIsLoadingRemote(true);
    try {
      const fetched = await rawPullStoreLaporan(activeStore);
      setRemoteRows(fetched);
      setActiveTab('remote');
      showToast(`Berhasil memuat ${fetched.length} baris dari Sheet "Laporan"`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat data sheet', 'error');
    } finally {
      setIsLoadingRemote(false);
    }
  };

  const handlePushToGoogleSheets = async () => {
    if (localRows.length === 0) {
      showToast('Tidak ada baris laporan untuk dikirim.', 'info');
      return;
    }
    setIsPushing(true);
    try {
      const res = await rawPushStoreLaporan(activeStore, localRows);
      showToast(res.msg, res.ok ? 'success' : 'error');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mengirim laporan', 'error');
    } finally {
      setIsPushing(false);
    }
  };

  const activeRows = activeTab === 'local' ? localRows : remoteRows;

  const filteredRows = useMemo(() => {
    return activeRows.filter((row) => {
      if (filterType !== 'ALL' && row.tipe_transaksi !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchFaktur = row.nomor_faktur.toLowerCase().includes(q);
        const matchNama = row.nama_barang.toLowerCase().includes(q);
        const matchKode = row.kode_barang.toLowerCase().includes(q);
        const matchBarcode = (row.barcode || '').toLowerCase().includes(q);
        const matchSup = (row.pelanggan_supplier || '').toLowerCase().includes(q);
        return matchFaktur || matchNama || matchKode || matchBarcode || matchSup;
      }
      return true;
    });
  }, [activeRows, filterType, searchQuery]);

  // Statistics
  const summary = useMemo(() => {
    let totalQty = 0;
    let totalSubtotal = 0;
    let totalHpp = 0;
    let totalLaba = 0;

    for (const r of filteredRows) {
      totalQty += r.qty || 0;
      totalSubtotal += r.subtotal || 0;
      totalHpp += r.total_hpp || 0;
      totalLaba += r.laba_kotor || 0;
    }

    return { totalQty, totalSubtotal, totalHpp, totalLaba };
  }, [filteredRows]);

  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;
    const headers = [
      'KEY_UNIK',
      'TIPE_TRANSAKSI',
      'NOMOR_FAKTUR',
      'TANGGAL',
      'WAKTU',
      'TAHUN',
      'BULAN',
      'MINGGU',
      'HARI',
      'STATUS_TRANSAKSI',
      'STATUS_BAYAR',
      'METODE_BAYAR',
      'KASIR',
      'PELANGGAN_SUPPLIER',
      'JATUH_TEMPO',
      'KODE_BARANG',
      'BARCODE',
      'NAMA_BARANG',
      'KATEGORI',
      'SATUAN',
      'QTY',
      'HARGA_SATUAN',
      'HPP_SATUAN',
      'DISKON_NOMINAL',
      'SUBTOTAL',
      'TOTAL_HPP',
      'LABA_KOTOR',
      'MARGIN_PERSEN',
      'CATATAN',
    ];

    const lines = [headers.join(',')];
    for (const r of filteredRows) {
      const vals = [
        `"${r.key_unik}"`,
        `"${r.tipe_transaksi}"`,
        `"${r.nomor_faktur}"`,
        `"${r.tanggal}"`,
        `"${r.waktu}"`,
        r.tahun,
        `"${r.bulan}"`,
        `"${r.minggu}"`,
        `"${r.hari}"`,
        `"${r.status_transaksi}"`,
        `"${r.status_bayar}"`,
        `"${r.metode_bayar}"`,
        `"${r.kasir}"`,
        `"${r.pelanggan_supplier}"`,
        `"${r.jatuh_tempo || ''}"`,
        `"${r.kode_barang}"`,
        `"'${r.barcode || ''}"`,
        `"${r.nama_barang.replace(/"/g, '""')}"`,
        `"${r.kategori}"`,
        `"${r.satuan}"`,
        r.qty,
        r.harga_satuan,
        r.hpp_satuan,
        r.diskon_nominal,
        r.subtotal,
        r.total_hpp,
        r.laba_kotor,
        r.margin_persen,
        `"${(r.catatan || '').replace(/"/g, '""')}"`,
      ];
      lines.push(vals.join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_${activeStore.name}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('File CSV Laporan berhasil diunduh', 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-900 text-white shadow-xs">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Sinkronisasi & Data Sheet &ldquo;Laporan&rdquo;
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                  29 Kolom Format GS
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Toko: <strong>{activeStore.name}</strong> • Sinkronisasi laporan transaksi berbasis key unik idempotent
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredRows.length === 0}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Action Bar */}
        <div className="px-4 py-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('local')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'local'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Data Lokal ({localRows.length} Baris)
              </button>

              <button
                type="button"
                onClick={() => {
                  if (remoteRows.length === 0) {
                    handleFetchRemote();
                  } else {
                    setActiveTab('remote');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'remote'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isLoadingRemote ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : null}
                <span>Data di Spreadsheet ({remoteRows.length})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFetchRemote}
              disabled={isLoadingRemote}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRemote ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Tarik dari Sheet</span>
            </button>

            <button
              type="button"
              onClick={handlePushToGoogleSheets}
              disabled={isPushing || localRows.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isPushing ? 'animate-pulse' : ''}`} />
              <span>{isPushing ? 'Mengirim…' : 'Kirim Laporan ke Sheet'}</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari no faktur, barang, barcode, supplier..."
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Tipe:</span>
            <div className="flex p-0.5 bg-slate-200/70 rounded-lg">
              {(
                [
                  { key: 'ALL', label: 'Semua' },
                  { key: 'PEMBELIAN', label: 'Pembelian' },
                  { key: 'PENJUALAN', label: 'Penjualan' },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilterType(t.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    filterType === t.key
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {filteredRows.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">No Faktur</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Tipe</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Pihak (Supplier/Pelanggan)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap min-w-[180px]">Barang</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Qty</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Harga</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Subtotal</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Key Unik (Upsert)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRows.map((r, i) => (
                    <tr key={r.key_unik + i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {r.nomor_faktur}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.tipe_transaksi === 'PEMBELIAN'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {r.tipe_transaksi}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {r.tanggal}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                        {r.pelanggan_supplier || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900 truncate max-w-xs">{r.nama_barang}</p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {r.kode_barang} {r.barcode ? `• ${r.barcode}` : ''}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {fmt(r.qty)} <span className="text-[10px] text-slate-500 font-normal">{r.satuan}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-mono text-slate-600 whitespace-nowrap">
                        {fmt(r.harga_satuan)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(r.subtotal)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400 truncate max-w-[160px]">
                        {r.key_unik}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">Tidak Ada Baris Laporan</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {activeTab === 'local'
                  ? 'Belum ada transaksi pembelian yang dicatat untuk toko ini.'
                  : 'Belum ada data di sheet "Laporan" atau sheet belum ditarik.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-600">
            <span>
              Menampilkan: <strong>{filteredRows.length}</strong> baris
            </span>
            <span>•</span>
            <span>
              Total Qty: <strong>{fmt(summary.totalQty)}</strong>
            </span>
            <span>•</span>
            <span>
              Total Nilai: <strong className="text-blue-600">{formatRupiah(summary.totalSubtotal)}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
