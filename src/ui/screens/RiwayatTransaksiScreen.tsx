import { useEffect, useState } from "react";
import { Receipt, Search } from "lucide-react";
import { transaksiApi } from "../../services/api";
import { DatePicker } from "../components/DatePicker";
import { formatRupiah, formatTanggalWaktu } from "../../utils/currency";
import { akhirHariIso, awalHariIso } from "../../utils/tanggal";
import type { Transaksi } from "../../types";

export function RiwayatTransaksiScreen() {
  const [list, setList] = useState<Transaksi[]>([]);
  const [keyword, setKeyword] = useState("");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [detail, setDetail] = useState<Transaksi | null>(null);

  async function muat() {
    const data = await transaksiApi.riwayat(
      dari ? awalHariIso(dari) : undefined,
      sampai ? akhirHariIso(sampai) : undefined,
      keyword || undefined,
    );
    setList(data);
  }

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Riwayat Transaksi</h1>
        <p className="text-sm text-slate-400">{list.length} transaksi ditemukan</p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Kode Transaksi</label>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="rounded-lg border border-slate-200 py-1.5 pl-7 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Dari Tanggal</label>
          <div className="w-44">
            <DatePicker value={dari} onChange={setDari} max={sampai || undefined} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Sampai Tanggal</label>
          <div className="w-44">
            <DatePicker value={sampai} onChange={setSampai} min={dari || undefined} />
          </div>
        </div>
        <button
          onClick={muat}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-slate-900 hover:bg-brand-500"
        >
          Cari
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Kode</th>
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">Kasir</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-800">{t.kode_transaksi}</td>
                <td className="px-4 py-3 text-slate-500">{formatTanggalWaktu(t.created_at)}</td>
                <td className="px-4 py-3 text-slate-500">{t.kasir_nama}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{formatRupiah(t.total)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.status === "selesai" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setDetail(t)} className="text-sm font-medium text-brand-700 hover:underline">
                    Detail
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-slate-400">
                  <Receipt size={28} className="mx-auto mb-2" strokeWidth={1.5} />
                  Tidak ada transaksi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-slate-800">{detail.kode_transaksi}</h2>
            <p className="mb-4 text-sm text-slate-500">{formatTanggalWaktu(detail.created_at)}</p>
            <div className="mb-4 max-h-60 space-y-2 overflow-auto">
              {detail.items.map((i) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span>
                    {i.nama_produk_snapshot} x{i.jumlah}
                  </span>
                  <span>{formatRupiah(i.subtotal_item)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatRupiah(detail.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Diskon</span>
                <span>{formatRupiah(detail.diskon)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pajak</span>
                <span>{formatRupiah(detail.pajak)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatRupiah(detail.total)}</span>
              </div>
            </div>
            <button
              onClick={() => setDetail(null)}
              className="mt-4 w-full rounded-xl bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-900"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
