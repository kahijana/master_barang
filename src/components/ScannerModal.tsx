import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  X,
  Flashlight,
  Plus,
  Minus,
  Check,
  Search,
  ExternalLink,
  RefreshCw,
  Store as StoreIcon,
  Settings,
} from 'lucide-react';
import { Product } from '../types';
import { findProductByCodeInStore } from '../services/product-manager';
import { S, toNum } from '../utils/format';

interface AppSettingsPlugin {
  open(): Promise<void>;
}

const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings');

interface ScannerModalProps {
  isOpen: boolean;
  mode: 'lookup' | 'field';
  activeStoreName?: string;
  allProducts: Product[];
  onClose: () => void;
  onSelectForField?: (code: string) => void;
  onUpdateStock: (product: Product, newToko: number, newGudang: number) => void;
  onOpenEditFromScan: (product: Product) => void;
  onOpenAddFromScan: (code: string) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  mode,
  activeStoreName,
  allProducts,
  onClose,
  onSelectForField,
  onUpdateStock,
  onOpenEditFromScan,
  onOpenAddFromScan,
}) => {
  const [scannedCode, setScannedCode] = useState<string>('');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [stockToko, setStockToko] = useState<number>(0);
  const [stockGudang, setStockGudang] = useState<number>(0);
  const [manualCode, setManualCode] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isLockedRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(60);
      }
      if (!audioCtxRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      if (audioCtxRef.current) {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1040, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch (e) {
      console.warn('Audio feedback error', e);
    }
  };

  const handleBarcodeDetected = (rawText: string) => {
    const code = S(rawText);
    if (!code || isLockedRef.current) return;

    isLockedRef.current = true;
    playBeep();

    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        scannerRef.current.pause(true);
      } catch (e) {
        console.warn('Pause error', e);
      }
    }

    if (mode === 'field') {
      if (onSelectForField) {
        onSelectForField(code);
      }
      onClose();
      return;
    }

    // Lookup mode strictly isolated to active store's products
    const product = findProductByCodeInStore(allProducts, code);
    setScannedCode(code);
    setFoundProduct(product);

    if (product) {
      setStockToko(product.TOKO);
      setStockGudang(product.GUDANG);
    }
  };

  const startScanner = async () => {
    setCameraError('');
    isLockedRef.current = false;
    setScannedCode('');
    setFoundProduct(null);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader', {
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        });
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => ({
            width: Math.floor(Math.min(viewfinderWidth * 0.88, 380)),
            height: Math.floor(Math.min(viewfinderHeight * 0.36, 170)),
          }),
        },
        handleBarcodeDetected,
        () => {}
      );

      // Check if torch/flashlight is supported
      try {
        const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
        const torchFeature = capabilities.torchFeature();
        setHasTorch(torchFeature.isSupported());
      } catch {
        setHasTorch(false);
      }
    } catch (err: unknown) {
      const errStr = String(err);
      if (/Permission|NotAllowed/i.test(errStr)) {
        setCameraError('Izin akses kamera ditolak. Silakan izinkan kamera di browser.');
      } else {
        setCameraError('Kamera tidak dapat dimulai. Pastikan perangkat memiliki kamera dan izin aktif.');
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping camera', e);
      }
    }
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.getRunningTrackCameraCapabilities().torchFeature().apply(nextState);
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Torch error', e);
    }
  };

  const handleScanAgain = () => {
    setScannedCode('');
    setFoundProduct(null);
    setManualCode('');
    isLockedRef.current = false;
    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
      } catch (e) {
        console.warn('Resume error', e);
      }
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeDetected(manualCode.trim());
  };

  const handleSaveStock = () => {
    if (!foundProduct) return;
    onUpdateStock(foundProduct, toNum(stockToko), toNum(stockGudang));
    handleScanAgain();
  };

  const openCameraSettings = async () => {
    try {
      await AppSettings.open();
    } catch (error: unknown) {
      console.error('Failed to open Android app settings:', error);
      setCameraError('Pengaturan aplikasi tidak dapat dibuka. Aktifkan izin kamera melalui Setelan Android.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between">
      {/* Viewport Camera Container */}
      <div className="absolute inset-0 z-0">
        <div id="qr-reader" className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />
      </div>

      {/* Target Reticle Overlay */}
      {!scannedCode && !cameraError ? (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-72 sm:w-80 h-36 sm:h-40 border-2 border-blue-500/80 rounded-2xl relative shadow-lg">
            {/* Corner accents */}
            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-white rounded-tl-sm" />
            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-white rounded-tr-sm" />
            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-white rounded-bl-sm" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-white rounded-br-sm" />
            {/* Center laser line */}
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 animate-pulse shadow-sm" />
          </div>
          <p className="mt-4 text-xs font-semibold text-white/90 drop-shadow-md bg-black/40 px-3 py-1 rounded-full backdrop-blur-xs">
            Arahkan kamera ke barcode produk
          </p>
        </div>
      ) : null}

      {/* Camera Error Message */}
      {cameraError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-white bg-slate-900/90">
          <div className="max-w-sm space-y-3">
            <p className="font-semibold text-sm">{cameraError}</p>
            <p className="text-xs text-slate-400">
              Kamu tetap dapat mencari barang dengan mengetik kode/barcode di kolom bawah.
            </p>
            {Capacitor.getPlatform() === 'android' && (
              <button
                type="button"
                onClick={() => void openCameraSettings()}
                className="mx-auto inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <Settings className="h-4 w-4" />
                Buka Pengaturan Izin Kamera
              </button>
            )}
            <button
              type="button"
              onClick={() => void startScanner()}
              className="mx-auto inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-semibold text-white transition-colors hover:bg-white/20"
            >
              <RefreshCw className="h-4 w-4" />
              Coba Lagi
            </button>
          </div>
        </div>
      ) : null}

      {/* Top Header Actions */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-safe">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
          {activeStoreName && (
            <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5">
              <StoreIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>{activeStoreName}</span>
            </div>
          )}
        </div>

        {hasTorch ? (
          <button
            onClick={toggleTorch}
            className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
              torchOn ? 'bg-amber-500 text-white' : 'bg-black/60 text-white hover:bg-black/80'
            }`}
            aria-label="Senter"
          >
            <Flashlight className="w-5 h-5" />
          </button>
        ) : null}
      </div>

      {/* Bottom Interactive Panel */}
      <div className="relative z-20 w-full max-w-lg mx-auto bg-white rounded-t-3xl p-5 shadow-2xl pb-safe">
        {/* State A: Waiting for scan or manual entry */}
        {!scannedCode ? (
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-900">
                {mode === 'field' ? 'Scan Barcode untuk Formulir' : 'Scan & Update Cepat'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === 'field'
                  ? 'Barcode yang terdeteksi akan otomatis mengisi kolom'
                  : 'Stok toko dan gudang dapat langsung disesuaikan'}
              </p>
            </div>

            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Atau ketik nomor barcode / kode..."
                  className="w-full h-11 pl-3 pr-8 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono"
                />
                {manualCode ? (
                  <button
                    type="button"
                    onClick={() => setManualCode('')}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Cari</span>
              </button>
            </form>
          </div>
        ) : null}

        {/* State B: Item Found in database */}
        {scannedCode && foundProduct ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  Barang Ditemukan
                </span>
                <span className="text-xs font-mono text-slate-500">{scannedCode}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5 line-clamp-2">
                {foundProduct.NAMA}
              </h3>
              <p className="text-xs text-slate-500">
                {foundProduct.KODE_BARANG}
                {foundProduct.KATEGORI ? ` · ${foundProduct.KATEGORI}` : ''}
              </p>
            </div>

            {/* Fast Stock Steppers */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              {/* STOK TOKO */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Stok Toko
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStockToko((prev) => Math.max(0, prev - 1))}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center text-slate-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    step="any"
                    value={stockToko}
                    onChange={(e) => setStockToko(toNum(e.target.value))}
                    className="w-full h-9 text-center rounded-xl bg-white border border-slate-200 font-bold text-sm text-slate-900 outline-none tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setStockToko((prev) => prev + 1)}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center text-slate-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* STOK GUDANG */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Stok Gudang
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStockGudang((prev) => Math.max(0, prev - 1))}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center text-slate-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    step="any"
                    value={stockGudang}
                    onChange={(e) => setStockGudang(toNum(e.target.value))}
                    className="w-full h-9 text-center rounded-xl bg-white border border-slate-200 font-bold text-sm text-slate-900 outline-none tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setStockGudang((prev) => prev + 1)}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center text-slate-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenEditFromScan(foundProduct)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Detail</span>
              </button>

              <button
                type="button"
                onClick={handleScanAgain}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Scan Lagi</span>
              </button>

              <button
                type="button"
                onClick={handleSaveStock}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Stok</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* State C: Item NOT found */}
        {scannedCode && !foundProduct ? (
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Barang Belum Ditemukan
              </span>
              <h3 className="text-base font-bold font-mono text-slate-900 mt-0.5">
                {scannedCode}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Barcode ini belum terdaftar di database {activeStoreName ? `toko ${activeStoreName}` : 'Master Barang'}.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleScanAgain}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Scan Lagi</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddFromScan(scannedCode)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Barang Baru</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
