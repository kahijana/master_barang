import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  Package,
  Layers,
  X,
  RefreshCw,
  Eye,
  Trash2,
} from 'lucide-react';
import { LaporanRow, Store } from '../types';
import { formatRupiah, fmt, getToday, S, toNum } from '../utils/format';

interface LaporanViewProps {
  activeStore: Store;
  laporanRows: LaporanRow[];
  isSyncing: boolean;
  onPullLaporan: () => Promise<void>;
  onPushLaporan: () => Promise<void>;
  onSaveLaporanRows: (rows: LaporanRow[]) => void;
  openConfirm: (config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  activeStore,
  laporanRows,
  isSyncing,
  onPullLaporan,
  onPushLaporan,
  onSaveLaporanRows,
  openConfirm,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PENJUALAN' | 'PEMBELIAN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Lunas' | 'Belum Lunas'>('ALL');
  const [activeTab, setActiveTab] = useState<'table' | 'pivot'>('table');
  const [selectedRow, setSelectedRow] = useState<LaporanRow | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form for adding new manual transaction entry
  const [formType, setFormType] = useState<'PENJUALAN' | 'PEMBELIAN'>('PEMBELIAN');
  const [formFaktur, setFormFaktur] = useState('');
  const [formDate, setFormDate] = useState(getToday());
  const [formSupplier, setFormSupplier] = useState('');
  const [formBarang, setFormBarang] = useState('');
  const [formKode, setFormKode] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formKategori, setFormKategori] = useState('Umum');
  const [formSatuan, setFormSatuan] = useState('PCS');
  const [formQty, setFormQty] = useState<number>(1);
  const [formHarga, setFormHarga] = useState<number>(0);
  const [formHpp, setFormHpp] = useState<number>(0);
  const [formDiskon, setFormDiskon] = useState<number>(0);
  const [formMetodeBayar, setFormMetodeBayar] = useState('Tunai');
  const [formStatusBayar, setFormStatusBayar] = useState('Lunas');
  const [formKasir, setFormKasir] = useState('Admin');
  const [formCatatan, setFormCatatan] = useState('');

  // Filtering
  const filteredRows = useMemo(() => {
    return laporanRows.filter((r) => {
      if (typeFilter !== 'ALL' && r.tipe_transaksi !== typeFilter) return false;
      if (statusFilter !== 'ALL' && r.status_bayar !== statusFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        r.nomor_faktur.toLowerCase().includes(q) ||
        r.nama_barang.toLowerCase().includes(q) ||
        r.kode_barang.toLowerCase().includes(q) ||
        r.barcode.toLowerCase().includes(q) ||
        r.pelanggan_supplier.toLowerCase().includes(q) ||
        r.kategori.toLowerCase().includes(q)
      );
    });
  }, [laporanRows, typeFilter, statusFilter, searchQuery]);

  // Aggregate KPI metrics
  const metrics = useMemo(() => {
    let totalPenjualan = 0;
    let totalPembelian = 0;
    let totalLabaKotor = 0;
    let countPenjualan = 0;
    let countPembelian = 0;

    for (const r of laporanRows) {
      if (r.tipe_transaksi === 'PENJUALAN') {
        totalPenjualan += r.subtotal;
        totalLabaKotor += r.laba_kotor;
        countPenjualan++;
      } else {
        totalPembelian += r.subtotal;
        countPembelian++;
      }
    }

    return {
      totalPenjualan,
      totalPembelian,
      totalLabaKotor,
      countPenjualan,
      countPembelian,
      totalRows: laporanRows.length,
    };
  }, [laporanRows]);

  // Pivot calculations (by Category, Payment Method, and Month)
  const pivotData = useMemo(() => {
    const byCategory: Record<string, { omset: number; qty: number; hpp: number }> = {};
    const byMethod: Record<string, { omset: number; count: number }> = {};
    const byMonth: Record<string, { penjualan: number; pembelian: number }> = {};

    for (const r of laporanRows) {
      // By Category
      const cat = r.kategori || 'Tanpa Kategori';
      if (!byCategory[cat]) byCategory[cat] = { omset: 0, qty: 0, hpp: 0 };
      byCategory[cat].omset += r.subtotal;
      byCategory[cat].qty += r.qty;
      byCategory[cat].hpp += r.total_hpp;

      // By Payment Method
      const method = r.metode_bayar || 'Tunai';
      if (!byMethod[method]) byMethod[method] = { omset: 0, count: 0 };
      byMethod[method].omset += r.subtotal;
      byMethod[method].count += 1;

      // By Month
      const month = r.bulan || r.tanggal.slice(0, 7) || '2026-10';
      if (!byMonth[month]) byMonth[month] = { penjualan: 0, pembelian: 0 };
      if (r.tipe_transaksi === 'PENJUALAN') {
        byMonth[month].penjualan += r.subtotal;
      } else {
        byMonth[month].pembelian += r.subtotal;
      }
    }

    return {
      categories: Object.entries(byCategory).sort((a, b) => b[1].omset - a[1].omset),
      methods: Object.entries(byMethod).sort((a, b) => b[1].omset - a[1].omset),
      months: Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])),
    };
  }, [laporanRows]);

  const handleOpenAddModal = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setFormFaktur(`INV-${new Date().getFullYear()}-${rand}`);
    setFormDate(getToday());
    setFormSupplier('');
    setFormBarang('');
    setFormKode('');
    setFormBarcode('');
    setFormKategori('Umum');
    setFormSatuan('PCS');
    setFormQty(1);
    setFormHarga(0);
    setFormHpp(0);
    setFormDiskon(0);
    setFormMetodeBayar('Tunai');
    setFormStatusBayar('Lunas');
    setFormKasir('Admin');
    setFormCatatan('');
    setIsAddModalOpen(true);
  };

  const handleSaveNewRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFaktur.trim() || !formBarang.trim()) {
      showToast('Nomor Faktur dan Nama Barang wajib diisi', 'error');
      return;
    }

    const dateObj = new Date(formDate);
    const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = isNaN(dateObj.getDay()) ? 'Senin' : daysIndo[dateObj.getDay()];
    const ym = `${year}-${month}`;

    const subtotal = formQty * formHarga - formDiskon;
    const totalHpp = formQty * formHpp;
    const labaKotor = formType === 'PENJUALAN' ? subtotal - totalHpp : 0;
    const marginPersen = formType === 'PENJUALAN' && subtotal > 0 ? (labaKotor / subtotal) * 100 : 0;

    const newRow: LaporanRow = {
      key_unik: `${formFaktur}_${formKode || 'ITEM'}_${formSatuan || 'PCS'}`,
      tipe_transaksi: formType,
      nomor_faktur: formFaktur,
      tanggal: formDate,
      waktu: new Date().toTimeString().slice(0, 8),
      tahun: year,
      bulan: ym,
      minggu: `W${Math.ceil((dateObj.getDate() + 6) / 7)}`,
      hari: dayName,
      status_transaksi: 'Selesai',
      status_bayar: formStatusBayar,
      metode_bayar: formMetodeBayar,
      kasir: formKasir,
      pelanggan_supplier: formSupplier || 'Umum',
      jatuh_tempo: '',
      kode_barang: formKode,
      barcode: formBarcode,
      nama_barang: formBarang,
      kategori: formKategori,
      satuan: formSatuan,
      qty: formQty,
      harga_satuan: formHarga,
      hpp_satuan: formHpp,
      diskon_nominal: formDiskon,
      subtotal,
      total_hpp: totalHpp,
      laba_kotor: labaKotor,
      margin_persen: marginPersen,
      catatan: formCatatan,
    };

    const nextRows = [newRow, ...laporanRows];
    onSaveLaporanRows(nextRows);
    setIsAddModalOpen(false);
    showToast(`Transaksi ${formFaktur} berhasil ditambahkan`, 'success');
  };

  const handleDeleteRow = (keyUnik: string) => {
    openConfirm({
      title: 'Hapus Baris Laporan?',
      message: 'Baris transaksi ini akan dihapus dari data lokal toko.',
      confirmLabel: 'Hapus',
      isDestructive: true,
      onConfirm: () => {
        const nextRows = laporanRows.filter((r) => r.key_unik !== keyUnik);
        onSaveLaporanRows(nextRows);
        setSelectedRow(null);
        showToast('Baris transaksi dihapus dari cache lokal', 'info');
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-5">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Laporan Penjualan & Pembelian
              </h1>
              <p className="text-xs text-slate-500">
                Toko: <strong>{activeStore.name}</strong> • Sinkronisasi 29 kolom lengkap dengan Sheet &ldquo;Laporan&rdquo;.
              </p>
            </div>
          </div>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onPullLaporan}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50"
            title="Tarik data transaksi 29 kolom dari sheet 'Laporan'"
          >
            <Download className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Tarik dari Sheet</span>
          </button>

          <button
            type="button"
            onClick={onPushLaporan}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
            title="Kirim dan perbarui data ke sheet 'Laporan' di Google Sheets"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Kirim ke Sheet</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xs font-semibold text-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Catatan</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Penjualan</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900">
            {formatRupiah(metrics.totalPenjualan)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {metrics.countPenjualan} transaksi
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Pembelian</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900">
            {formatRupiah(metrics.totalPembelian)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {metrics.countPembelian} faktur
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Laba Kotor</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900">
            {formatRupiah(metrics.totalLabaKotor)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {metrics.totalPenjualan > 0
              ? `${fmt((metrics.totalLabaKotor / metrics.totalPenjualan) * 100)}% Margin`
              : '0% Margin'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Baris Data Terdaftar</span>
            <span className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900">
            {metrics.totalRows.toLocaleString('id-ID')} Baris
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Sheet &ldquo;Laporan&rdquo;
          </div>
        </div>
      </div>

      {/* VIEW SUB-TABS & SEARCH */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* TAB TOGGLE: TABEL vs PIVOT ANALISIS */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daftar Transaksi ({filteredRows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pivot')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'pivot' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ringkasan Pivot Sheet
          </button>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari faktur, barang, kontak..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Semua Tipe</option>
            <option value="PENJUALAN">Penjualan</option>
            <option value="PEMBELIAN">Pembelian</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="Lunas">Lunas</option>
            <option value="Belum Lunas">Belum Lunas</option>
          </select>
        </div>
      </div>

      {/* CONTENT: TABEL TRANSAKSI 29 KOLOM */}
      {activeTab === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Belum ada data laporan transaksi untuk toko ini
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Gunakan tombol <strong>&ldquo;Tarik dari Sheet&rdquo;</strong> untuk membaca transaksi dari Google Sheet &ldquo;Laporan&rdquo;, atau <strong>&ldquo;Kirim ke Sheet&rdquo;</strong> untuk mengunggah faktur pembelian toko.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={onPullLaporan}
                  disabled={isSyncing}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  Tarik Data dari Spreadsheet
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Tambah Transaksi Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3">Faktur & Waktu</th>
                    <th className="py-3 px-3">Tipe</th>
                    <th className="py-3 px-3">Pelanggan / Supplier</th>
                    <th className="py-3 px-3">Barang</th>
                    <th className="py-3 px-3 text-right">Qty</th>
                    <th className="py-3 px-3 text-right">Harga Satuan</th>
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-3 text-right">Laba Kotor</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row, idx) => {
                    const isPenjualan = row.tipe_transaksi === 'PENJUALAN';
                    return (
                      <tr
                        key={row.key_unik || idx}
                        className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                        onClick={() => setSelectedRow(row)}
                      >
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900 font-mono">
                            {row.nomor_faktur || '—'}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {row.tanggal} {row.waktu ? `• ${row.waktu}` : ''}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isPenjualan
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            }`}
                          >
                            {row.tipe_transaksi}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800">
                            {row.pelanggan_supplier || 'Umum'}
                          </div>
                          <div className="text-[11px] text-slate-400">{row.kasir ? `Kasir: ${row.kasir}` : ''}</div>
                        </td>

                        <td className="py-3 px-3 max-w-[200px]">
                          <div className="font-medium text-slate-900 truncate">
                            {row.nama_barang || '—'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {row.kode_barang || row.barcode || '—'}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-semibold text-slate-800">
                          {fmt(row.qty)} <span className="text-[11px] text-slate-400 font-normal">{row.satuan}</span>
                        </td>

                        <td className="py-3 px-3 text-right text-slate-700">
                          {formatRupiah(row.harga_satuan)}
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatRupiah(row.subtotal)}
                        </td>

                        <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                          {row.laba_kotor > 0 ? formatRupiah(row.laba_kotor) : '—'}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              row.status_bayar === 'Lunas'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            }`}
                          >
                            {row.status_bayar}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedRow(row)}
                              title="Lihat Detail 29 Kolom"
                              className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.key_unik)}
                              title="Hapus dari cache"
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CONTENT: PIVOT RINGKASAN SHEET */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Pivot by Category */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Ringkasan per Kategori</span>
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {pivotData.categories.length === 0 ? (
                <p className="text-slate-400 text-xs py-3">Belum ada data kategori</p>
              ) : (
                pivotData.categories.map(([cat, stats]) => (
                  <div key={cat} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{cat}</div>
                      <div className="text-[11px] text-slate-400">{fmt(stats.qty)} unit terjual/dibeli</div>
                    </div>
                    <div className="font-bold text-slate-900 text-right">
                      {formatRupiah(stats.omset)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pivot by Payment Method */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Ringkasan Metode Bayar</span>
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {pivotData.methods.length === 0 ? (
                <p className="text-slate-400 text-xs py-3">Belum ada data metode bayar</p>
              ) : (
                pivotData.methods.map(([method, stats]) => (
                  <div key={method} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{method}</div>
                      <div className="text-[11px] text-slate-400">{stats.count} transaksi</div>
                    </div>
                    <div className="font-bold text-slate-900 text-right">
                      {formatRupiah(stats.omset)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pivot by Month */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Analisis Bulanan</span>
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {pivotData.months.length === 0 ? (
                <p className="text-slate-400 text-xs py-3">Belum ada data bulanan</p>
              ) : (
                pivotData.months.map(([month, stats]) => (
                  <div key={month} className="py-2.5 flex items-center justify-between">
                    <div className="font-semibold text-slate-900 font-mono">{month}</div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600 text-xs">
                        +{formatRupiah(stats.penjualan)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Beli: {formatRupiah(stats.pembelian)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (29 KOLOM LENGKAP) */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Detail Transaksi 29 Kolom ({selectedRow.nomor_faktur})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">KEY UNIK</div>
                  <div className="font-mono font-semibold text-slate-900 break-all">{selectedRow.key_unik}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">Tipe Transaksi</div>
                  <div className="font-semibold text-blue-600">{selectedRow.tipe_transaksi}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">Tanggal / Waktu</div>
                  <div className="font-semibold text-slate-900">{selectedRow.tanggal} {selectedRow.waktu}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">Hari / Minggu / Bulan</div>
                  <div className="font-semibold text-slate-900">{selectedRow.hari}, {selectedRow.minggu} ({selectedRow.bulan})</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">Pelanggan / Supplier</div>
                  <div className="font-semibold text-slate-900">{selectedRow.pelanggan_supplier}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">Kasir / User</div>
                  <div className="font-semibold text-slate-900">{selectedRow.kasir}</div>
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/60 space-y-2">
                <div className="font-bold text-slate-900 text-sm">{selectedRow.nama_barang}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>Kode: <strong className="font-mono text-slate-800">{selectedRow.kode_barang || '—'}</strong></div>
                  <div>Barcode: <strong className="font-mono text-slate-800">{selectedRow.barcode || '—'}</strong></div>
                  <div>Kategori: <strong>{selectedRow.kategori}</strong></div>
                  <div>Satuan: <strong>{selectedRow.satuan}</strong></div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">Kuantitas (Qty)</div>
                  <div className="font-bold text-slate-900">{fmt(selectedRow.qty)} {selectedRow.satuan}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">Harga Satuan</div>
                  <div className="font-semibold text-slate-900">{formatRupiah(selectedRow.harga_satuan)}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">HPP Satuan</div>
                  <div className="font-semibold text-slate-900">{formatRupiah(selectedRow.hpp_satuan)}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[11px] text-slate-400">Diskon</div>
                  <div className="font-semibold text-slate-900">{formatRupiah(selectedRow.diskon_nominal)}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-semibold">
                <span>Subtotal: <strong className="text-slate-900 font-bold">{formatRupiah(selectedRow.subtotal)}</strong></span>
                <span>Total HPP: <strong className="text-slate-900 font-bold">{formatRupiah(selectedRow.total_hpp)}</strong></span>
                <span>Laba Kotor: <strong className="text-emerald-700 font-bold">{formatRupiah(selectedRow.laba_kotor)}</strong> ({fmt(selectedRow.margin_persen)}%)</span>
              </div>

              {selectedRow.catatan && (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-[11px] text-slate-600">
                  <span className="font-semibold block mb-0.5">Catatan:</span>
                  {selectedRow.catatan}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => handleDeleteRow(selectedRow.key_unik)}
                className="px-3.5 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
              >
                Hapus Baris
              </button>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MANUAL TRANSACTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">
                Tambah Catatan Transaksi (Laporan 29 Kolom)
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRow} className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tipe Transaksi</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
                  >
                    <option value="PEMBELIAN">PEMBELIAN (Beli dari Supplier)</option>
                    <option value="PENJUALAN">PENJUALAN (Jual ke Pelanggan)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nomor Faktur / Nota</label>
                  <input
                    type="text"
                    required
                    value={formFaktur}
                    onChange={(e) => setFormFaktur(e.target.value)}
                    placeholder="PB-2026-0001"
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {formType === 'PEMBELIAN' ? 'Nama Supplier' : 'Nama Pelanggan'}
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="Contoh: PT Sumber Makmur"
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Barang</label>
                <input
                  type="text"
                  required
                  value={formBarang}
                  onChange={(e) => setFormBarang(e.target.value)}
                  placeholder="Nama produk transaksi"
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Kode Barang</label>
                  <input
                    type="text"
                    value={formKode}
                    onChange={(e) => setFormKode(e.target.value)}
                    placeholder="BRG01"
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Barcode</label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="899..."
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Satuan</label>
                  <input
                    type="text"
                    value={formSatuan}
                    onChange={(e) => setFormSatuan(e.target.value)}
                    placeholder="PCS"
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={formQty}
                    onChange={(e) => setFormQty(Number(e.target.value))}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Harga Satuan</label>
                  <input
                    type="number"
                    min="0"
                    value={formHarga}
                    onChange={(e) => setFormHarga(Number(e.target.value))}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">HPP Satuan</label>
                  <input
                    type="number"
                    min="0"
                    value={formHpp}
                    onChange={(e) => setFormHpp(Number(e.target.value))}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Metode Bayar</label>
                  <select
                    value={formMetodeBayar}
                    onChange={(e) => setFormMetodeBayar(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="Tunai">Tunai / Cash</option>
                    <option value="Transfer">Transfer Bank</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Hutang">Hutang / Tempo</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status Bayar</label>
                  <select
                    value={formStatusBayar}
                    onChange={(e) => setFormStatusBayar(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="Lunas">Lunas</option>
                    <option value="Belum Lunas">Belum Lunas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Catatan</label>
                <input
                  type="text"
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Catatan tambahan..."
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Simpan Catatan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
