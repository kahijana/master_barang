import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Product } from '../types';
import { fmt, formatRupiah } from '../utils/format';

interface ProductTableProps {
  products: Product[];
  priceDisplay: 'retail' | 'hpp';
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  priceDisplay,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600">
            <th className="py-3 px-4 w-28">Kode</th>
            <th className="py-3 px-4 w-32">Barcode</th>
            <th className="py-3 px-4 min-w-[200px]">Nama Barang</th>
            <th className="py-3 px-4 w-32">Kategori</th>
            <th className="py-3 px-4 w-32">Supplier</th>
            <th className="py-3 px-3 text-right w-24">Stok Toko</th>
            <th className="py-3 px-3 text-right w-24">Stok Gudang</th>
            <th className="py-3 px-3 text-right w-28">{priceDisplay === 'hpp' ? 'HPP' : 'Retail'}</th>
            <th className="py-3 px-3 text-right w-28">Grosir</th>
            <th className="py-3 px-4 text-center w-24">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((p) => {
            const isTokoZero = p.TOKO <= 0;
            const isTokoLow = p.TOKO > 0 && p.TOKO <= 5;
            const isGudangZero = p.GUDANG <= 0;
            const isGudangLow = p.GUDANG > 0 && p.GUDANG <= 5;

            return (
              <tr
                key={`${p.KODE_BARANG}__${p.KODE_BARCODE}`}
                onClick={() => onEdit(p)}
                className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
              >
                {/* Kode */}
                <td className="py-3 px-4 font-mono text-xs font-medium text-slate-800">
                  {p.KODE_BARANG}
                </td>

                {/* Barcode */}
                <td className="py-3 px-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono">{p.KODE_BARCODE || '—'}</span>
                    {p.BARCODE_2 ? (
                      <span
                        className="text-[10px] px-1 py-0.2 rounded bg-blue-50 text-blue-600 font-semibold border border-blue-200/50"
                        title={`Multi-barcode aktif (Slot 2: ${p.BARCODE_2})`}
                      >
                        +Multi
                      </span>
                    ) : null}
                  </div>
                </td>

                {/* Nama Barang */}
                <td className="py-3 px-4 font-medium text-slate-900">
                  <div className="flex items-center gap-1.5">
                    <span className="line-clamp-2">{p.NAMA}</span>
                    {p.BUNDLE_QTY_1 ? (
                      <span
                        className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200/50 shrink-0"
                        title="Tersedia harga bundle/grosir bertingkat"
                      >
                        Bundle
                      </span>
                    ) : null}
                  </div>
                </td>

                {/* Kategori */}
                <td className="py-3 px-4 text-xs text-slate-600 truncate max-w-[140px]">
                  {p.KATEGORI || '—'}
                </td>

                {/* Supplier */}
                <td className="py-3 px-4 text-xs text-slate-500 truncate max-w-[140px]">
                  {p.SUPPLIER || '—'}
                </td>

                {/* Stok Toko */}
                <td className="py-3 px-3 text-right tabular-nums">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                      isTokoZero
                        ? 'bg-red-50 text-red-700'
                        : isTokoLow
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {fmt(p.TOKO)}
                  </span>
                </td>

                {/* Stok Gudang */}
                <td className="py-3 px-3 text-right tabular-nums">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                      isGudangZero
                        ? 'bg-red-50 text-red-700'
                        : isGudangLow
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {fmt(p.GUDANG)}
                  </span>
                </td>

                {/* Selected product price */}
                <td className="py-3 px-3 text-right text-xs font-semibold tabular-nums text-slate-900">
                  {formatRupiah(priceDisplay === 'hpp' ? p.HPP : p.HARGA_RETAIL_1)}
                </td>

                {/* Grosir */}
                <td className="py-3 px-3 text-right text-xs tabular-nums text-slate-700">
                  {formatRupiah(p.HARGA_GROSIR_1)}
                </td>

                {/* Actions */}
                <td
                  className="py-3 px-4 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(p)}
                      title="Edit Barang"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(p)}
                      title="Hapus Barang"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="Hapus"
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
  );
};
