import React, { useState, useRef, useEffect } from 'react';
import { Store as StoreIcon, ChevronDown, Check, Plus, Building2 } from 'lucide-react';
import { Store } from '../types';

interface StoreSwitcherProps {
  stores: Store[];
  activeStore: Store | null;
  onSelectStore: (storeId: string) => void;
  onOpenAddStore: () => void;
}

export const StoreSwitcher: React.FC<StoreSwitcherProps> = ({
  stores,
  activeStore,
  onSelectStore,
  onOpenAddStore,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/80 text-left transition-colors min-h-[38px] max-w-[200px] sm:max-w-[240px]"
        title={activeStore ? `Toko Aktif: ${activeStore.name}` : 'Pilih Toko'}
        aria-label="Pilih Toko Aktif"
      >
        <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
          <StoreIcon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight leading-none">
            Toko Aktif
          </div>
          <div className="text-xs font-bold text-slate-900 truncate mt-0.5 leading-tight">
            {activeStore ? activeStore.name : 'Pilih Toko...'}
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-100">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Daftar Toko ({stores.length})
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-50">
            {stores.map((s) => {
              const isSelected = activeStore?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSelectStore(s.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 transition-colors ${
                    isSelected ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="truncate font-semibold">{s.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              );
            })}

            {stores.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-slate-400">
                Belum ada toko yang terdaftar.
              </div>
            )}
          </div>

          <div className="p-1.5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenAddStore();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-semibold text-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              <span>Tambah Toko Baru</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
