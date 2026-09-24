import { useState } from "react";
import { Banknote } from "lucide-react";
import { formatRupiah } from "../../utils/currency";
import { UangInput } from "./UangInput";

interface Props {
  total: number;
  processing: boolean;
  error: string | null;
  onBatal: () => void;
  onBayar: (jumlahDibayar: number) => void;
}

const UANG_CEPAT = [5000, 10000, 20000, 50000, 100000];

export function PaymentModal({ total, processing, error, onBatal, onBayar }: Props) {
  const [jumlahDibayar, setJumlahDibayar] = useState(total);

  const kembalian = Math.max(0, jumlahDibayar - total);
  const kurang = jumlahDibayar < total;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Banknote size={18} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Pembayaran Tunai</h2>
        </div>

        <div className="mb-4 rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-500">Total Belanja</p>
          <p className="text-3xl font-bold text-slate-900">{formatRupiah(total)}</p>
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700">Jumlah Dibayar</label>
        <UangInput
          autoFocus
          value={jumlahDibayar}
          onChange={setJumlahDibayar}
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-lg focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {UANG_CEPAT.filter((v) => v >= total).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setJumlahDibayar(v)}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
            >
              {formatRupiah(v)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setJumlahDibayar(total)}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
          >
            Uang pas
          </button>
        </div>

        <div className="mb-4 flex justify-between rounded-xl bg-brand-50 p-4">
          <span className="text-sm font-medium text-brand-700">Kembalian</span>
          <span className="text-lg font-bold text-brand-700">{formatRupiah(kembalian)}</span>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onBatal}
            disabled={processing}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            onClick={() => onBayar(jumlahDibayar)}
            disabled={processing || kurang}
            className="flex-1 rounded-xl bg-brand-600 py-2.5 font-semibold text-slate-900 shadow-sm shadow-brand-600/40 hover:bg-brand-500 disabled:opacity-50 disabled:shadow-none"
          >
            {processing ? "Memproses..." : "Selesaikan"}
          </button>
        </div>
      </div>
    </div>
  );
}
