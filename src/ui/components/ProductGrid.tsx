import { useEffect, useMemo, useRef, useState } from "react";
import { PackageX, Plus, Search } from "lucide-react";
import { produkApi } from "../../services/api";
import { formatRupiah } from "../../utils/currency";
import { ProductThumb } from "./ProductThumb";
import { bunyiBeep } from "../../utils/beep";
import { useProdukBerubah } from "../../utils/useProdukBerubah";
import type { Kategori, Produk } from "../../types";

interface Props {
  onPilihProduk: (produk: Produk) => void;
  refreshToken?: number;
}

function Tab({ aktif, label, jumlah, onClick }: { aktif: boolean; label: string; jumlah: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        aktif ? "border-ink bg-white text-ink" : "border-slate-200 bg-white/60 text-slate-500 hover:bg-white"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
          aktif ? "bg-brand-600 text-ink" : "bg-slate-100 text-slate-500"
        }`}
      >
        {jumlah}
      </span>
    </button>
  );
}

export function ProductGrid({ onPilihProduk, refreshToken }: Props) {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [kategoriList, setKategoriList] = useState<Kategori[]>([]);
  const [kategoriAktif, setKategoriAktif] = useState<number | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const muat = () =>
    Promise.all([produkApi.list(true), produkApi.listKategori()]).then(([produk, kategori]) => {
      setProdukList(produk);
      setKategoriList(kategori);
    });

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  useProdukBerubah(muat);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return produkList.filter((p) => {
      const cocokKategori = kategoriAktif === "all" || p.kategori_id === kategoriAktif;
      const cocokKeyword =
        kw.length === 0 || p.nama.toLowerCase().includes(kw) || (p.barcode ?? "").toLowerCase().includes(kw);
      return cocokKategori && cocokKeyword;
    });
  }, [produkList, kategoriAktif, keyword]);

  // Barcode scanner USB/HID mengetik cepat lalu menekan Enter.
  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    setError(null);
    const kw = keyword.trim();
    if (!kw) return;

    const persisEksak = produkList.find((p) => p.barcode === kw);
    if (persisEksak) {
      bunyiBeep();
      pilih(persisEksak);
      return;
    }
    if (filtered.length === 1) {
      pilih(filtered[0]);
      return;
    }
    try {
      const produk = await produkApi.getByBarcode(kw);
      if (produk) {
        bunyiBeep();
        pilih(produk);
      } else if (filtered.length === 0) {
        setError(`"${kw}" tidak ditemukan`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function pilih(produk: Produk) {
    onPilihProduk(produk);
    setKeyword("");
    inputRef.current?.focus();
  }

  const jumlahPerKategori = (id: number) => produkList.filter((p) => p.kategori_id === id).length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tab aktif={kategoriAktif === "all"} label="Semua Produk" jumlah={produkList.length} onClick={() => setKategoriAktif("all")} />
        {kategoriList.map((k) => (
          <Tab
            key={k.id}
            aktif={kategoriAktif === k.id}
            label={k.nama}
            jumlah={jumlahPerKategori(k.id)}
            onClick={() => setKategoriAktif(k.id)}
          />
        ))}
        <div className="relative ml-auto min-w-[240px] flex-1 sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            autoFocus
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Scan barcode atau cari produk..."
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-ink focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex-1 overflow-auto pr-1">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            <PackageX size={32} strokeWidth={1.5} />
            <p className="text-sm">Produk tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
            {filtered.map((p, idx) => {
              const habis = p.stok <= 0;
              const menipis = !habis && p.stok <= p.stok_minimum;
              return (
                <div
                  key={p.id}
                  style={{ "--tunda": `${150 + Math.min(idx, 14) * 35}ms` } as React.CSSProperties}
                  className={`kartu-masuk flex flex-col rounded-3xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:shadow-md ${
                    habis ? "opacity-60" : ""
                  }`}
                >
                  <div className="relative overflow-hidden rounded-2xl">
                    <ProductThumb nama={p.nama} foto={p.foto} className="aspect-[16/10] w-full rounded-2xl text-3xl" />
                    <span
                      className={`absolute left-0 top-0 rounded-br-2xl px-3 py-1.5 text-xs font-bold ${
                        habis ? "bg-red-600 text-white" : menipis ? "bg-amber-400 text-ink" : "bg-ink text-white"
                      }`}
                    >
                      {habis ? "Habis" : `${p.stok} Stok`}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
                    <p className="line-clamp-1 text-sm font-bold text-ink">{p.nama}</p>
                    <p className="mb-2 line-clamp-1 text-xs text-slate-400">
                      {p.kategori_nama ?? "Tanpa kategori"}
                      {p.barcode ? ` · ${p.barcode}` : ""}
                    </p>
                    <p className="mb-3 text-lg font-extrabold text-ink">{formatRupiah(p.harga_jual)}</p>
                    <button
                      disabled={habis}
                      onClick={() => pilih(p)}
                      className="mt-auto flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-ink transition hover:border-brand-600 hover:bg-brand-600 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                    >
                      <Plus size={15} className="shrink-0" /> <span className="truncate">Tambah ke Keranjang</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
