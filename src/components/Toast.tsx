import React from 'react';
import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';

export interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastProps {
  toast: ToastData | null;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  if (!toast) return null;

  const bgStyles = {
    success: 'bg-emerald-800 text-white border-emerald-700',
    error: 'bg-red-800 text-white border-red-700',
    warning: 'bg-amber-800 text-white border-amber-700',
    info: 'bg-slate-900 text-white border-slate-800',
  }[toast.type];

  const Icon = {
    success: CircleCheck,
    error: CircleX,
    warning: CircleAlert,
    info: CircleCheck,
  }[toast.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200"
    >
      <div
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-sm font-medium ${bgStyles}`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{toast.message}</span>
      </div>
    </div>
  );
};
