import { useEffect, useState } from "react";
import { History, Wallet } from "lucide-react";
import { kasApi } from "../../services/api";
import { formatRupiah, formatTanggalWaktu } from "../../utils/currency";
import type { SesiKasir } from "../../types";
import { UangInput } from "../components/UangInput";

export function KasScreen() {
  const [sesiAktif, setSesiAktif] = useState<SesiKasir | null>(null);
  const [riwayat, setRiwayat] = useState<SesiKasir[]>([]);
  const [modalAwal, setModalAwal] = useState(0);
  const [totalAktual, setTotalAktual] = useState(0);
  const [showTutup, setShowTutup] = useState(false);
  const [hasilTutup, setHasilTutup] = useState<SesiKasir | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function muatUlang() {
    const [aktif, list] = await Promise.all([kasApi.getSesiAktif(), kasApi.riwayat()]);
    setSesiAktif(aktif);
    setRiwayat(list);
  }

  useEffect(() => {
    muatUlang();
  }, []);

  async function bukaSesi() {
    setError(null);
    try {
      await kasApi.bukaSesi(modalAwal);
      await muatUlang();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function tutupSesi() {
    if (!sesiAktif) return;
    setError(null);
    try {
      const hasil = await kasApi.tutupSesi(sesiAktif.id, totalAktual);
      setHasilTutup(hasil);
      setShowTutup(false);
      await muatUlang();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Manajemen Kas</h1>
        <p className="text-sm text-slate-400">Buka/tutup sesi kasir dan rekonsiliasi kas harian</p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
        {sesiAktif ? (
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet size={20} />
            </div>
            <div className="flex-1">
              <p className="mb-1 text-sm font-medium text-emerald-600">Sesi kasir sedang berjalan</p>
              <p className="mb-4 text-base font-semibold text-slate-800">
                Dibuka {formatTanggalWaktu(sesiAktif.waktu_buka)} · Modal awal {formatRupiah(sesiAktif.modal_awal)}
              </p>
              <button
                onClick={() => {
                  setTotalAktual(0);
                  setShowTutup(true);
                }}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-600/30 hover:bg-red-700"
              >
                Tutup Kasir
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Wallet size={20} />
            </div>
            <div className="flex-1">
              <p className="mb-3 text-sm text-slate-500">Belum ada sesi kasir yang terbuka.</p>
              <label className="mb-1 block text-sm font-medium text-slate-700">Modal Awal</label>
              <UangInput
                value={modalAwal}
                onChange={setModalAwal}
                className="mb-3 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                onClick={bukaSesi}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm shadow-brand-600/40 hover:bg-brand-500"
              >
                Buka Kasir
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <History size={16} className="text-slate-400" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Riwayat Sesi</h2>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Kasir</th>
              <th className="px-4 py-3 font-medium">Buka</th>
              <th className="px-4 py-3 font-medium">Tutup</th>
              <th className="px-4 py-3 font-medium">Modal Awal</th>
              <th className="px-4 py-3 font-medium">Kas Sistem</th>
              <th className="px-4 py-3 font-medium">Kas Aktual</th>
              <th className="px-4 py-3 font-medium">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {riwayat.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-800">{s.kasir_nama}</td>
                <td className="px-4 py-3 text-slate-500">{formatTanggalWaktu(s.waktu_buka)}</td>
                <td className="px-4 py-3 text-slate-500">{s.waktu_tutup ? formatTanggalWaktu(s.waktu_tutup) : "-"}</td>
                <td className="px-4 py-3">{formatRupiah(s.modal_awal)}</td>
                <td className="px-4 py-3">{s.total_kas_sistem != null ? formatRupiah(s.total_kas_sistem) : "-"}</td>
                <td className="px-4 py-3">{s.total_kas_aktual != null ? formatRupiah(s.total_kas_aktual) : "-"}</td>
                <td
                  className={`px-4 py-3 font-medium ${
                    s.selisih == null ? "text-slate-400" : s.selisih === 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {s.selisih != null ? formatRupiah(s.selisih) : "-"}
                </td>
              </tr>
            ))}
            {riwayat.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Belum ada riwayat sesi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showTutup && sesiAktif && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Tutup Kasir</h2>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Hitung uang fisik di laci, masukkan totalnya
            </label>
            <UangInput
              autoFocus
              value={totalAktual}
              onChange={setTotalAktual}
              className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowTutup(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={tutupSesi}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-600/30 hover:bg-red-700"
              >
                Tutup Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      {hasilTutup && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Sesi Kasir Ditutup</h2>
            <div className="mb-4 space-y-1 text-sm">
              <p>Kas Sistem: {formatRupiah(hasilTutup.total_kas_sistem ?? 0)}</p>
              <p>Kas Aktual: {formatRupiah(hasilTutup.total_kas_aktual ?? 0)}</p>
              <p
                className={`text-lg font-bold ${
                  (hasilTutup.selisih ?? 0) === 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                Selisih: {formatRupiah(hasilTutup.selisih ?? 0)}
              </p>
            </div>
            <button
              onClick={() => setHasilTutup(null)}
              className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-slate-900 shadow-sm shadow-brand-600/40 hover:bg-brand-500"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
