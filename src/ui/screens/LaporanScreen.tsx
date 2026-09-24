import { useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Download, ShoppingCart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { laporanApi } from "../../services/api";
import { DatePicker } from "../components/DatePicker";
import { formatRupiah } from "../../utils/currency";
import { akhirHariIso, awalHariIso, keInputTanggal } from "../../utils/tanggal";
import type { ProdukTerjual, RingkasanPenjualan } from "../../types";

const toDateInput = keInputTanggal;

function preset(jenis: "hari-ini" | "minggu-ini" | "bulan-ini"): { dari: string; sampai: string } {
  const now = new Date();
  const sampai = toDateInput(now);
  if (jenis === "hari-ini") return { dari: sampai, sampai };
  if (jenis === "minggu-ini") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { dari: toDateInput(d), sampai };
  }
  const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dari: toDateInput(awalBulan), sampai };
}

function toIsoRange(dari: string, sampai: string): { dariIso: string; sampaiIso: string } {
  return { dariIso: awalHariIso(dari), sampaiIso: akhirHariIso(sampai) };
}

function csvEscape(value: string | number): string {
  let str = String(value);
  // Nama produk yang diawali =, +, -, @ akan dieksekusi sebagai rumus saat CSV dibuka di Excel.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function LaporanScreen() {
  const awal = preset("hari-ini");
  const [dari, setDari] = useState(awal.dari);
  const [sampai, setSampai] = useState(awal.sampai);
  const [ringkasan, setRingkasan] = useState<RingkasanPenjualan | null>(null);
  const [terlaris, setTerlaris] = useState<ProdukTerjual[]>([]);
  const [kurangLaku, setKurangLaku] = useState<ProdukTerjual[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function muat() {
    setError(null);
    try {
      const { dariIso, sampaiIso } = toIsoRange(dari, sampai);
      const [r, t, k] = await Promise.all([
        laporanApi.ringkasan(dariIso, sampaiIso),
        laporanApi.produkTerlaris(dariIso, sampaiIso),
        laporanApi.produkKurangLaku(dariIso, sampaiIso),
      ]);
      setRingkasan(r);
      setTerlaris(t);
      setKurangLaku(k);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pakaiPreset(jenis: "hari-ini" | "minggu-ini" | "bulan-ini") {
    const p = preset(jenis);
    setDari(p.dari);
    setSampai(p.sampai);
  }

  async function ekspor() {
    if (!ringkasan) return;
    const baris: string[] = [];
    baris.push("Laporan Penjualan TokoPOS");
    baris.push(`Periode,${dari} s/d ${sampai}`);
    baris.push("");
    baris.push("Ringkasan");
    baris.push(`Total Omzet,${ringkasan.total_omzet}`);
    baris.push(`Jumlah Transaksi,${ringkasan.jumlah_transaksi}`);
    baris.push(`Rata-rata per Transaksi,${ringkasan.rata_rata_transaksi}`);
    baris.push(`Laba Kotor,${ringkasan.total_laba_kotor}`);
    baris.push("");
    baris.push("Produk Terlaris");
    baris.push("Nama,Jumlah Terjual,Total Omzet");
    for (const p of terlaris) {
      baris.push([csvEscape(p.nama), p.jumlah_terjual, p.total_omzet].join(","));
    }
    baris.push("");
    baris.push("Produk Kurang Laku");
    baris.push("Nama,Jumlah Terjual,Total Omzet");
    for (const p of kurangLaku) {
      baris.push([csvEscape(p.nama), p.jumlah_terjual, p.total_omzet].join(","));
    }

    const path = await save({
      defaultPath: `laporan-tokopos-${dari}-${sampai}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!path) return;
    setError(null);
    try {
      await writeTextFile(path, "﻿" + baris.join("\r\n"));
    } catch (err) {
      setError(`Gagal menyimpan file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Laporan</h1>
          <p className="text-sm text-slate-400">Ringkasan penjualan dan performa produk</p>
        </div>
        <button
          onClick={ekspor}
          disabled={!ringkasan}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Download size={15} /> Ekspor CSV
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
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
        <button onClick={muat} className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-slate-900 hover:bg-brand-500">
          Terapkan
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={() => pakaiPreset("hari-ini")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
            Hari Ini
          </button>
          <button onClick={() => pakaiPreset("minggu-ini")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
            7 Hari
          </button>
          <button onClick={() => pakaiPreset("bulan-ini")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
            Bulan Ini
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {ringkasan && (
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <TrendingUp size={17} />
            </div>
            <p className="text-xs text-slate-400">Total Omzet</p>
            <p className="text-lg font-bold text-slate-900">{formatRupiah(ringkasan.total_omzet)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <ShoppingCart size={17} />
            </div>
            <p className="text-xs text-slate-400">Jumlah Transaksi</p>
            <p className="text-lg font-bold text-slate-900">{ringkasan.jumlah_transaksi}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Wallet size={17} />
            </div>
            <p className="text-xs text-slate-400">Rata-rata / Transaksi</p>
            <p className="text-lg font-bold text-slate-900">{formatRupiah(ringkasan.rata_rata_transaksi)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={17} />
            </div>
            <p className="text-xs text-slate-400">Laba Kotor (estimasi)</p>
            <p className="text-lg font-bold text-slate-900">{formatRupiah(ringkasan.total_laba_kotor)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp size={15} className="text-emerald-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Produk Terlaris</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Produk</th>
                  <th className="px-4 py-2.5 font-medium">Terjual</th>
                  <th className="px-4 py-2.5 font-medium text-right">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {terlaris.map((p) => (
                  <tr key={p.produk_id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.nama}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.jumlah_terjual}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatRupiah(p.total_omzet)}</td>
                  </tr>
                ))}
                {terlaris.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      Belum ada penjualan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <TrendingDown size={15} className="text-amber-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Produk Kurang Laku</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Produk</th>
                  <th className="px-4 py-2.5 font-medium">Terjual</th>
                  <th className="px-4 py-2.5 font-medium text-right">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {kurangLaku.map((p) => (
                  <tr key={p.produk_id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.nama}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.jumlah_terjual}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatRupiah(p.total_omzet)}</td>
                  </tr>
                ))}
                {kurangLaku.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
