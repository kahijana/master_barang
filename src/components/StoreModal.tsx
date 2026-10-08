import React, { useState, useEffect } from 'react';
import { X, Building2, Check, RefreshCw, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Store } from '../types';
import { extractSheetId, S } from '../utils/format';
import { testSpreadsheetConnection, testStoreWebhookConnection } from '../services/sync-manager';

interface StoreModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  storeToEdit: Store | null;
  onClose: () => void;
  onSave: (data: { name: string; spreadsheetUrl: string; spreadsheetId: string; webhookUrl: string }) => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({
  isOpen,
  mode,
  storeToEdit,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [testingSheet, setTestingSheet] = useState(false);
  const [sheetTestMsg, setSheetTestMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestMsg, setWebhookTestMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && storeToEdit) {
        setName(storeToEdit.name);
        setSpreadsheetUrl(storeToEdit.spreadsheetUrl || '');
        setSpreadsheetId(storeToEdit.spreadsheetId || '');
        setWebhookUrl(storeToEdit.webhookUrl || '');
      } else {
        setName('');
        setSpreadsheetUrl('');
        setSpreadsheetId('');
        setWebhookUrl('');
      }
      setErrorMsg('');
      setSheetTestMsg(null);
      setWebhookTestMsg(null);
    }
  }, [isOpen, mode, storeToEdit]);

  const handleUrlChange = (url: string) => {
    setSpreadsheetUrl(url);
    const extracted = extractSheetId(url);
    if (extracted && !spreadsheetId) {
      setSpreadsheetId(extracted);
    }
    setSheetTestMsg(null);
  };

  const handleTestSpreadsheet = async () => {
    const id = spreadsheetId.trim() || extractSheetId(spreadsheetUrl.trim());
    if (!id) {
      setSheetTestMsg({ ok: false, msg: 'Masukkan URL atau ID Spreadsheet terlebih dahulu.' });
      return;
    }
    setTestingSheet(true);
    setSheetTestMsg(null);
    const tempStore: Store = {
      id: storeToEdit?.id || 'temp',
      name: name.trim() || 'Toko',
      spreadsheetId: id,
      spreadsheetUrl: spreadsheetUrl.trim(),
      webhookUrl: webhookUrl.trim(),
      active: true,
      autoSync: false,
      autoSyncIntervalMinutes: 10,
      createdAt: '',
      updatedAt: '',
    };
    const res = await testSpreadsheetConnection(tempStore);
    setSheetTestMsg(res);
    setTestingSheet(false);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setWebhookTestMsg({ ok: false, msg: 'Masukkan Webhook URL terlebih dahulu.' });
      return;
    }
    setTestingWebhook(true);
    setWebhookTestMsg(null);
    const tempStore: Store = {
      id: storeToEdit?.id || 'temp',
      name: name.trim() || 'Toko',
      spreadsheetId: spreadsheetId.trim(),
      spreadsheetUrl: spreadsheetUrl.trim(),
      webhookUrl: webhookUrl.trim(),
      active: true,
      autoSync: false,
      autoSyncIntervalMinutes: 10,
      createdAt: '',
      updatedAt: '',
    };
    const res = await testStoreWebhookConnection(tempStore);
    setWebhookTestMsg(res);
    setTestingWebhook(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = S(name);
    if (!cleanName) {
      setErrorMsg('Nama toko wajib diisi.');
      return;
    }

    const cleanUrl = S(spreadsheetUrl);
    const extractedId = extractSheetId(cleanUrl);
    const finalId = S(spreadsheetId) || extractedId;

    onSave({
      name: cleanName,
      spreadsheetUrl: cleanUrl,
      spreadsheetId: finalId,
      webhookUrl: S(webhookUrl),
    });
    onClose();
  };

  if (!isOpen) return null;

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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {mode === 'add' ? 'Tambah Toko Baru' : 'Edit Konfigurasi Toko'}
              </h3>
              {mode === 'edit' && storeToEdit && (
                <p className="text-[11px] text-slate-400 font-mono">ID: {storeToEdit.id}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg ? (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          ) : null}

          {/* Nama Toko */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Toko <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: SAKA STORE, Toko Cabang BSD"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
            />
          </div>

          {/* Google Spreadsheet URL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                URL Google Spreadsheet (Opsional)
              </label>
              {extractSheetId(spreadsheetUrl) ? (
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ID Terdeteksi</span>
                </span>
              ) : null}
            </div>
            <input
              type="url"
              value={spreadsheetUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs font-mono transition-all"
            />
          </div>

          {/* Spreadsheet ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Spreadsheet ID
              </label>
              <button
                type="button"
                onClick={handleTestSpreadsheet}
                disabled={testingSheet}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
              >
                {testingSheet ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <ExternalLink className="w-3 h-3" />
                )}
                <span>Tes Spreadsheet</span>
              </button>
            </div>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="Otomatis diambil dari URL atau ketik manual"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs font-mono transition-all"
            />
            {sheetTestMsg && (
              <p className={`text-[11px] mt-1 font-medium ${sheetTestMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {sheetTestMsg.msg}
              </p>
            )}
          </div>

          {/* Webhook URL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Webhook URL (Google Apps Script)
              </label>
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={testingWebhook}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
              >
                {testingWebhook ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <ExternalLink className="w-3 h-3" />
                )}
                <span>Tes Webhook</span>
              </button>
            </div>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setWebhookTestMsg(null);
              }}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs font-mono transition-all"
            />
            {webhookTestMsg && (
              <p className={`text-[11px] mt-1 font-medium ${webhookTestMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {webhookTestMsg.msg}
              </p>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            Setiap toko memiliki Spreadsheet dan Webhook masing-masing. Data barang dan inventaris toko ini sepenuhnya terisolasi dan tidak akan tercampur dengan toko lain.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{mode === 'add' ? 'Simpan Toko' : 'Perbarui Toko'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
