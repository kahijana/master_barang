import React, { useState } from 'react';
import { X, FileDown, FileUp, Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Product, Store } from '../types';
import {
  exportStoreProductsAsCSV,
  exportStoreProductsAsJSON,
  parseImportedFile,
} from '../services/import-export';

interface ImportExportModalProps {
  isOpen: boolean;
  activeStore: Store;
  products: Product[];
  onClose: () => void;
  onImportProducts: (imported: Product[]) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  activeStore,
  products,
  onClose,
  onImportProducts,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; msg: string; count?: number } | null>(null);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    exportStoreProductsAsJSON(activeStore, products);
  };

  const handleExportCSV = () => {
    exportStoreProductsAsCSV(activeStore, products);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportStatus(null);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setImportStatus(null);

    const res = await parseImportedFile(selectedFile, activeStore.id);
    setIsProcessing(false);

    if (res.success && res.products.length > 0) {
      setImportStatus({
        ok: true,
        msg: `Berhasil memproses ${res.products.length} barang untuk toko "${activeStore.name}".`,
        count: res.products.length,
      });
      onImportProducts(res.products);
    } else {
      setImportStatus({
        ok: false,
        msg: res.error || 'Tidak ada data valid yang ditemukan dalam file.',
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Import & Export Data</h3>
            <p className="text-xs text-slate-500">
              Operasi khusus untuk toko: <strong className="text-blue-600">{activeStore.name}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-6">
          {/* EXPORT SECTION */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <FileDown className="w-4 h-4 text-slate-500" />
              <span>Export Data ({products.length} Barang)</span>
            </h4>
            <p className="text-xs text-slate-500">
              Unduh cadangan data barang toko ini dalam format CSV atau JSON.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={products.length === 0}
                className="h-10 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={products.length === 0}
                className="h-10 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* IMPORT SECTION */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <FileUp className="w-4 h-4 text-slate-500" />
              <span>Import Data ke Toko Ini</span>
            </h4>
            <p className="text-xs text-slate-500">
              Barang yang diimport akan otomatis diikat ke <strong>{activeStore.name}</strong> dan diberikan ID unik.
            </p>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-slate-300 transition-colors">
              <input
                type="file"
                id="import-file-input"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="import-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
              >
                <Upload className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-semibold text-blue-600">
                  {selectedFile ? selectedFile.name : 'Pilih file CSV atau JSON'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                    : 'Format CSV harus memiliki header KODE_BARANG dan NAMA'}
                </span>
              </label>
            </div>

            {importStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                  importStatus.ok
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {importStatus.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{importStatus.msg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={!selectedFile || isProcessing}
              className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>{isProcessing ? 'Memproses Import...' : 'Mulai Import ke Toko'}</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-5 border-t border-slate-100 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
