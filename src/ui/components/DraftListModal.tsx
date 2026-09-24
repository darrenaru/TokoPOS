import { FileClock, Trash2 } from "lucide-react";
import { formatRupiah, formatTanggalWaktu } from "../../utils/currency";
import type { Transaksi } from "../../types";

interface Props {
  drafts: Transaksi[];
  onTutup: () => void;
  onLanjutkan: (draft: Transaksi) => void;
  onHapus: (id: number) => void;
}

export function DraftListModal({ drafts, onTutup, onLanjutkan, onHapus }: Props) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Transaksi Tertunda (Draft)</h2>

        {drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-300">
            <FileClock size={32} strokeWidth={1.5} />
            <p className="text-sm text-slate-400">Belum ada draft tersimpan</p>
          </div>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-auto">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{d.kode_transaksi}</p>
                  <p className="text-xs text-slate-400">
                    {d.items.length} item · {formatTanggalWaktu(d.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold text-slate-700">{formatRupiah(d.total)}</span>
                  <button
                    onClick={() => onLanjutkan(d)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-brand-500"
                  >
                    Lanjutkan
                  </button>
                  <button
                    onClick={() => onHapus(d.id)}
                    className="text-slate-300 hover:text-red-500"
                    title="Hapus draft"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={onTutup}
          className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
