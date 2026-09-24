import { useEffect, useState } from "react";
import { Plus, Search, Smartphone, SquarePen, Trash2, Package } from "lucide-react";
import { ScannerHpModal } from "../components/ScannerHpModal";
import { useProdukBerubah } from "../../utils/useProdukBerubah";
import { ProdukFormModal } from "../components/ProdukFormModal";
import { ProductThumb } from "../components/ProductThumb";
import { produkApi } from "../../services/api";
import { formatRupiah } from "../../utils/currency";
import type { Kategori, Produk, ProdukInput } from "../../types";

export function ProdukScreen() {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<Produk | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScannerHp, setShowScannerHp] = useState(false);

  async function muatUlang() {
    const [produk, kategori] = await Promise.all([produkApi.list(true), produkApi.listKategori()]);
    setProdukList(produk);
    setKategoriList(kategori);
  }

  useEffect(() => {
    muatUlang();
  }, []);

  // Produk yang ditambahkan lewat HP langsung muncul di daftar.
  useProdukBerubah(muatUlang);

  const filtered = produkList.filter(
    (p) =>
      p.nama.toLowerCase().includes(keyword.toLowerCase()) ||
      (p.barcode ?? "").toLowerCase().includes(keyword.toLowerCase()),
  );

  function bukaTambah() {
    setEditing(null);
    setShowForm(true);
  }

  function bukaEdit(p: Produk) {
    setEditing(p);
    setShowForm(true);
  }

  async function simpan(input: ProdukInput) {
    if (editing) {
      await produkApi.update(editing.id, input);
    } else {
      await produkApi.create(input);
    }
    setShowForm(false);
    await muatUlang();
  }

  async function hapus(p: Produk) {
    if (!confirm(`Hapus produk "${p.nama}"?`)) return;
    setError(null);
    try {
      await produkApi.hapus(p.id);
      await muatUlang();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Produk</h1>
          <p className="text-sm text-slate-400">{produkList.length} produk terdaftar</p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => setShowScannerHp(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Smartphone size={16} /> Tambah via HP
        </button>
        <button
          onClick={bukaTambah}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm shadow-brand-600/40 hover:bg-brand-500"
        >
          <Plus size={16} /> Tambah Produk
        </button>
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Cari nama atau barcode..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Produk</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Barcode</th>
              <th className="px-4 py-3 font-medium">Harga Jual</th>
              <th className="px-4 py-3 font-medium">Stok</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <ProductThumb nama={p.nama} foto={p.foto} className="h-9 w-9 shrink-0 text-xs" />
                    <span className="font-medium text-slate-800">{p.nama}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{p.kategori_nama ?? "-"}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.barcode ?? "-"}</td>
                <td className="px-4 py-2.5 text-slate-600">{formatRupiah(p.harga_jual)}</td>
                <td className={`px-4 py-2.5 ${p.stok <= p.stok_minimum ? "font-semibold text-amber-600" : "text-slate-600"}`}>
                  {p.stok} {p.satuan}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => bukaEdit(p)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                      title="Edit"
                    >
                      <SquarePen size={15} />
                    </button>
                    <button
                      onClick={() => hapus(p)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Hapus"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-slate-400">
                  <Package size={28} className="mx-auto mb-2" strokeWidth={1.5} />
                  Belum ada produk
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showScannerHp && <ScannerHpModal onTutup={() => setShowScannerHp(false)} onStatusBerubah={() => {}} />}

      {showForm && (
        <ProdukFormModal
          produk={editing}
          kategoriList={kategoriList}
          onClose={() => setShowForm(false)}
          onSubmit={simpan}
          onTambahKategori={async (nama) => {
            const id = await produkApi.createKategori(nama);
            const baru = { id, nama };
            setKategoriList((prev) => [...prev, baru]);
            return baru;
          }}
        />
      )}
    </div>
  );
}
