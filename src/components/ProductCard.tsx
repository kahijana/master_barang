import React from 'react';
import { Product } from '../types';
import { fmt, formatRupiah } from '../utils/format';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  displayPriceField?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onClick,
  displayPriceField = 'HARGA_RETAIL_1',
}) => {
  const isTokoZero = product.TOKO <= 0;
  const isGudangZero = product.GUDANG <= 0;
  const isTokoLow = product.TOKO > 0 && product.TOKO <= 5;
  const isGudangLow = product.GUDANG > 0 && product.GUDANG <= 5;

  let priceValue = product.HARGA_RETAIL_1;
  let priceBadge = '';
  let unitLabel = product.SATUAN_1;

  if (displayPriceField === 'HPP') {
    priceValue = product.HPP;
    priceBadge = 'HPP';
    unitLabel = product.SATUAN_1;
  } else if (displayPriceField === 'HARGA_RETAIL_2') {
    priceValue = product.HARGA_RETAIL_2;
    priceBadge = 'Retail Besar';
    unitLabel = product.SATUAN_2 || product.SATUAN_1;
  } else if (displayPriceField === 'HARGA_GROSIR_1') {
    priceValue = product.HARGA_GROSIR_1;
    priceBadge = 'Grosir 1';
    unitLabel = product.SATUAN_1;
  } else if (displayPriceField === 'HARGA_GROSIR_2') {
    priceValue = product.HARGA_GROSIR_2;
    priceBadge = 'Grosir 2';
    unitLabel = product.SATUAN_2 || product.SATUAN_1;
  } else if (displayPriceField === 'HARGA_CABANG_1') {
    priceValue = product.HARGA_CABANG_1;
    priceBadge = 'Cabang 1';
    unitLabel = product.SATUAN_1;
  }

  const altCount = (product.alternate_barcodes?.length || 0) +
    ([product.BARCODE_2, product.BARCODE_3, product.BARCODE_4, product.BARCODE_5, product.BARCODE_6].filter(Boolean).length);

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
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate flex-wrap">
            <span className="font-mono text-slate-700">{product.KODE_BARANG}</span>
            {product.KODE_BARCODE ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{product.KODE_BARCODE}</span>
              </>
            ) : null}
            {altCount > 0 ? (
              <span className="text-[10px] px-1 py-0.2 rounded bg-blue-50 text-blue-600 font-semibold border border-blue-200/50">
                +{altCount} Barcode
              </span>
            ) : null}
            {product.BUNDLE_QTY_1 ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200/50">
                Bundle
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-right shrink-0">
          {priceBadge ? (
            <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5">
              {priceBadge}
            </div>
          ) : null}
          <div className="text-sm font-bold text-slate-900 tabular-nums">
            {formatRupiah(priceValue)}
          </div>
          {unitLabel ? (
            <div className="text-[11px] text-slate-400">/{unitLabel}</div>
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
