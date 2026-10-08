import React from 'react';
import { Product } from '../types';
import { fmt, formatRupiah } from '../utils/format';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const isTokoZero = product.TOKO <= 0;
  const isGudangZero = product.GUDANG <= 0;
  const isTokoLow = product.TOKO > 0 && product.TOKO <= 5;
  const isGudangLow = product.GUDANG > 0 && product.GUDANG <= 5;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3.5 bg-white border-b border-slate-200 active:bg-slate-50 transition-colors flex flex-col gap-2 min-h-[44px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
            {product.NAMA || '(Tanpa Nama)'}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
            <span className="font-mono text-slate-700">{product.KODE_BARANG}</span>
            {product.KODE_BARCODE ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{product.KODE_BARCODE}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-slate-900 tabular-nums">
            {formatRupiah(product.HARGA_RETAIL_1)}
          </div>
          {product.SATUAN_1 ? (
            <div className="text-[11px] text-slate-400">/{product.SATUAN_1}</div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
        <div className="text-slate-500 truncate text-[11px]">
          {product.KATEGORI || 'Tanpa Kategori'}
          {product.SUPPLIER ? ` · ${product.SUPPLIER}` : ''}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${
              isTokoZero
                ? 'bg-red-50 text-red-700 border border-red-200/60'
                : isTokoLow
                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Toko {fmt(product.TOKO)}
          </span>

          <span
            className={`px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${
              isGudangZero
                ? 'bg-red-50 text-red-700 border border-red-200/60'
                : isGudangLow
                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Gudang {fmt(product.GUDANG)}
          </span>
        </div>
      </div>
    </button>
  );
};
