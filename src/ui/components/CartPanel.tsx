import { useState } from "react";
import { Banknote, FileClock, Minus, Plus, RotateCcw, Save, ShoppingCart, Trash2 } from "lucide-react";
import { formatRupiah } from "../../utils/currency";
import { ProductThumb } from "./ProductThumb";
import { UangInput } from "./UangInput";
import type { CartItem } from "../../types";

interface Props {
  items: CartItem[];
  diskon: number;
  subtotal: number;
  pajak: number;
  pajakPersen: number;
  total: number;
  onUbahJumlah: (produkId: number, jumlah: number) => void;
  onHapus: (produkId: number) => void;
  onUbahDiskon: (diskon: number) => void;
  onBayar: () => void;
  onSimpanDraft: () => void;
  onBukaDraftList: () => void;
  onReset: () => void;
  jumlahDraft: number;
}

export function CartPanel({
  items,
  diskon,
  subtotal,
  pajak,
  pajakPersen,
  total,
  onUbahJumlah,
  onHapus,
  onUbahDiskon,
  onBayar,
  onSimpanDraft,
  onBukaDraftList,
  onReset,
  jumlahDraft,
}: Props) {
  const [modeDiskon, setModeDiskon] = useState<"nominal" | "persen">("nominal");
  const persenTampil = subtotal > 0 ? Math.round((diskon / subtotal) * 10000) / 100 : 0;

  function ubahDiskonInput(value: number) {
    // Rupiah tidak berpecahan, dan diskon tidak boleh melebihi subtotal.
    const nominal = modeDiskon === "persen" ? Math.round((value / 100) * subtotal) : value;
    onUbahDiskon(Math.min(Math.max(0, nominal), subtotal));
  }

  return (
    <div className="my-4 mr-4 flex w-[400px] shrink-0 flex-col rounded-3xl border border-slate-200 bg-[#eceee9] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-extrabold text-ink">Detail Transaksi</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onBukaDraftList}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-slate-50"
          >
            <FileClock size={13} /> Draft
            {jumlahDraft > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-ink">
                {jumlahDraft}
              </span>
            )}
          </button>
          <button
            onClick={onReset}
            disabled={items.length === 0 && diskon === 0}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-auto pr-0.5">
        {items.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 text-slate-300">
            <ShoppingCart size={36} strokeWidth={1.5} />
            <p className="text-sm text-slate-400">Keranjang masih kosong</p>
          </div>
        ) : (
          items.map((item) => {
            const itemSubtotal = item.produk.harga_jual * item.jumlah - item.diskonItem;
            return (
              <div key={item.produk.id} className="item-keranjang flex gap-3 rounded-2xl bg-white p-3">
                <ProductThumb nama={item.produk.nama} foto={item.produk.foto} className="h-[68px] w-[68px] shrink-0 rounded-xl text-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-bold text-ink">{item.produk.nama}</p>
                    <button
                      onClick={() => onHapus(item.produk.id)}
                      aria-label="Hapus item"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="mb-2 text-xs text-slate-400">{formatRupiah(item.produk.harga_jual)}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUbahJumlah(item.produk.id, item.jumlah - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-ink hover:bg-slate-100"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-ink">
                        {String(item.jumlah).padStart(2, "0")}
                      </span>
                      <button
                        onClick={() => onUbahJumlah(item.produk.id, item.jumlah + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-ink hover:bg-brand-500"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-ink">{formatRupiah(itemSubtotal)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 rounded-2xl bg-white p-3">
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[#eceee9] px-3 py-2">
          <span className="text-sm font-semibold text-ink">Diskon Transaksi</span>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-lg bg-white p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setModeDiskon("nominal")}
                className={`rounded-md px-2 py-1 font-bold ${modeDiskon === "nominal" ? "bg-brand-600 text-ink" : "text-slate-500"}`}
              >
                Rp
              </button>
              <button
                type="button"
                onClick={() => setModeDiskon("persen")}
                className={`rounded-md px-2 py-1 font-bold ${modeDiskon === "persen" ? "bg-brand-600 text-ink" : "text-slate-500"}`}
              >
                %
              </button>
            </div>
            {modeDiskon === "persen" ? (
              <input
                type="number"
                min={0}
                max={100}
                value={persenTampil || ""}
                placeholder="0"
                onChange={(e) => ubahDiskonInput(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm font-semibold focus:border-ink focus:outline-none"
              />
            ) : (
              <UangInput value={diskon} onChange={ubahDiskonInput} className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm font-semibold focus:border-ink focus:outline-none" />
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 px-3 py-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Sub-Total</span>
            <span className="font-semibold text-ink">{formatRupiah(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Pajak{pajakPersen > 0 ? ` (${pajakPersen}%)` : ""}</span>
            <span className="font-semibold text-ink">{formatRupiah(pajak)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Diskon</span>
            <span className="font-semibold text-ink">-{formatRupiah(diskon)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
            <span className="font-bold text-ink">Total Pembayaran</span>
            <span className="font-extrabold text-ink">{formatRupiah(total)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-brand-600">
            <Banknote size={16} />
          </div>
          <span className="text-sm font-semibold text-ink">Tunai</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          disabled={items.length === 0}
          onClick={onSimpanDraft}
          title="Simpan sebagai draft"
          className="flex items-center justify-center rounded-2xl bg-white px-4 text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={18} />
        </button>
        <button
          disabled={items.length === 0}
          onClick={onBayar}
          className="flex-1 rounded-2xl bg-brand-600 py-3.5 text-base font-extrabold text-ink transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lanjutkan
        </button>
      </div>
    </div>
  );
}
