import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, ClipboardList } from "lucide-react";
import { produkApi, stokApi } from "../../services/api";
import { Select } from "../components/Select";
import { useProdukBerubah } from "../../utils/useProdukBerubah";
import { formatTanggalWaktu } from "../../utils/currency";
import type { LogStok, Produk, StokKoreksiInput } from "../../types";

export function StokScreen() {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [riwayat, setRiwayat] = useState<LogStok[]>([]);
  const [menipis, setMenipis] = useState<Produk[]>([]);
  const [form, setForm] = useState<StokKoreksiInput>({ produk_id: 0, jenis: "masuk", jumlah: 0, keterangan: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function muatUlang() {
    const [produk, log, stokMenipis] = await Promise.all([
      produkApi.list(true),
      stokApi.riwayat(),
      stokApi.stokMenipis(),
    ]);
    setProdukList(produk);
    setRiwayat(log);
    setMenipis(stokMenipis);
  }

  useEffect(() => {
    muatUlang();
  }, []);

  useProdukBerubah(muatUlang);

  async function submit() {
    setError(null);
    setSuccess(null);
    if (!form.produk_id) {
      setError("Pilih produk terlebih dahulu");
      return;
    }
    if (!Number.isFinite(form.jumlah) || Math.trunc(form.jumlah) === 0) {
      setError("Jumlah wajib diisi dan tidak boleh 0");
      return;
    }
    if (form.jenis !== "koreksi" && form.jumlah < 0) {
      setError("Jumlah harus lebih dari 0. Gunakan jenis Koreksi untuk nilai negatif.");
      return;
    }
    try {
      await stokApi.koreksi({ ...form, jumlah: Math.trunc(form.jumlah) });
      setSuccess("Stok berhasil diperbarui");
      setForm({ produk_id: 0, jenis: "masuk", jumlah: 0, keterangan: "" });
      await muatUlang();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6 p-6">
      <div className="col-span-2 space-y-6">
        <div>
          <h1 className="mb-1 text-xl font-bold text-slate-900">Manajemen Stok</h1>
          <p className="mb-4 text-sm text-slate-400">Koreksi manual dan riwayat pergerakan stok</p>

          {menipis.length > 0 && (
            <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="mb-1 font-semibold">Stok menipis</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {menipis.map((p) => (
                    <li key={p.id}>
                      {p.nama} — tersisa {p.stok} {p.satuan} (batas {p.stok_minimum})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Jumlah</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {riwayat.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500">{formatTanggalWaktu(l.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{l.produk_nama}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{l.jenis}</td>
                  <td className={`px-4 py-3 font-medium ${l.jumlah < 0 ? "text-red-600" : "text-green-600"}`}>
                    {l.jumlah > 0 ? `+${l.jumlah}` : l.jumlah}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{l.keterangan ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{l.dibuat_oleh_nama}</td>
                </tr>
              ))}
              {riwayat.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-slate-400">
                    <ClipboardList size={28} className="mx-auto mb-2" strokeWidth={1.5} />
                    Belum ada riwayat stok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Boxes size={17} />
          </div>
          <h2 className="text-base font-bold text-slate-800">Koreksi / Stok Masuk</h2>
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700">Produk</label>
        <div className="mb-3">
          <Select
            value={form.produk_id}
            onChange={(v) => setForm({ ...form, produk_id: v })}
            placeholder="Pilih produk..."
            options={produkList.map((p) => ({ value: p.id, label: p.nama, hint: `Stok: ${p.stok} ${p.satuan}` }))}
          />
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700">Jenis</label>
        <div className="mb-3">
          <Select<StokKoreksiInput["jenis"]>
            value={form.jenis}
            onChange={(v) => setForm({ ...form, jenis: v })}
            options={[
              { value: "masuk", label: "Stok Masuk" },
              { value: "keluar", label: "Stok Keluar" },
              { value: "koreksi", label: "Koreksi (stock opname)" },
            ]}
          />
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700">Jumlah</label>
        <input
          type="number"
          step={1}
          value={form.jumlah || ""}
          placeholder="0"
          onChange={(e) => setForm({ ...form, jumlah: Number(e.target.value) })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <p className="mb-3 mt-1 text-xs text-slate-400">
          {form.jenis === "koreksi"
            ? "Koreksi: isi angka positif untuk menambah, negatif (mis. -3) untuk mengurangi stok."
            : "Isi angka positif; arah stok mengikuti jenis yang dipilih."}
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-700">Keterangan</label>
        <input
          value={form.keterangan ?? ""}
          onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
          className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

        <button
          onClick={submit}
          className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-slate-900 shadow-sm shadow-brand-600/40 hover:bg-brand-500"
        >
          Simpan
        </button>
      </div>
    </div>
  );
}
