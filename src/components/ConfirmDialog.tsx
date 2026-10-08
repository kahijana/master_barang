import React, { useEffect } from 'react';
import { TriangleAlert, X } from 'lucide-react';

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmDialogProps {
  dialog: ConfirmDialogState;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ dialog, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialog.isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog.isOpen, onClose]);

  if (!dialog.isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            {dialog.isDestructive ? (
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <TriangleAlert className="w-5 h-5" />
              </div>
            ) : null}
            <h3 className="text-base font-semibold text-slate-900">{dialog.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-5 leading-relaxed">{dialog.message}</p>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (dialog.onCancel) dialog.onCancel();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
          >
            {dialog.cancelLabel || 'Batal'}
          </button>
          <button
            type="button"
            onClick={() => {
              dialog.onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white transition-colors ${
              dialog.isDestructive
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {dialog.confirmLabel || 'Lanjutkan'}
          </button>
        </div>
      </div>
    </div>
  );
};
