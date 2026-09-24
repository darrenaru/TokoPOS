import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { UangInput } from "./UangInput";
import { listen } from "@tauri-apps/api/event";
import {
  Barcode,
  Box,
  Coins,
  ImagePlus,
  Layers,
  Package,
  Plus,
  Save,
  ScanLine,
  Tag,
  Tags,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { ScannerHpModal } from "./ScannerHpModal";
import { Select } from "./Select";
import { ProductThumb } from "./ProductThumb";
import { fileKeFotoProduk } from "../../utils/image";
import type { Kategori, Produk, ProdukInput } from "../../types";

interface Props {
  produk: Produk | null;
  kategoriList: Kategori[];
  onClose: () => void;
  onSubmit: (input: ProdukInput) => Promise<void>;
  onTambahKategori: (nama: string) => Promise<Kategori>;
}

const SATUAN_UMUM = ["pcs", "botol", "pack", "dus", "box", "kg", "gram", "liter", "lusin", "sachet", "bungkus"];
const MAKS_FOTO_BYTE = 2 * 1024 * 1024;

const inputBase =
  "h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm text-ink placeholder:text-slate-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-400";

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
        {children}
      </div>
    </div>
  );
}

export function ProdukFormModal({ produk, kategoriList, onClose, onSubmit, onTambahKategori }: Props) {
  const [form, setForm] = useState<ProdukInput>({
    nama: produk?.nama ?? "",
    barcode: produk?.barcode ?? "",
    kategori_id: produk?.kategori_id ?? null,
    harga_beli: produk?.harga_beli ?? 0,
    harga_jual: produk?.harga_jual ?? 0,
    stok: produk?.stok ?? 0,
    stok_minimum: produk?.stok_minimum ?? 0,
    satuan: produk?.satuan ?? "pcs",
    foto: produk?.foto ?? null,
  });
  const [kategoriBaru, setKategoriBaru] = useState("");
  const [tampilKategoriBaru, setTampilKategoriBaru] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [hpTerhubung, setHpTerhubung] = useState(0);
  const [infoScan, setInfoScan] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = Promise.all([
      listen<{ terhubung: number }>("hp-scanner-status", (ev) => setHpTerhubung(ev.payload.terhubung)),
      listen<{ code: string; found: boolean; nama: string; mode?: string }>("hp-scanner-scan", (ev) => {
        // Hanya scan dari HP yang berada di mode "Tambah Produk" yang mengisi barcode form ini.
        if (ev.payload.mode !== "produk") return;
        setForm((f) => ({ ...f, barcode: ev.payload.code }));
        const dipakaiLain = ev.payload.found && ev.payload.code !== produk?.barcode;
        setInfoScan(
          dipakaiLain
            ? `Barcode ${ev.payload.code} sudah dipakai produk "${ev.payload.nama}"`
            : `Barcode terisi dari HP: ${ev.payload.code}`,
        );
      }),
    ]);
    return () => {
      unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [produk?.barcode]);

  async function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAKS_FOTO_BYTE) {
      setError("Ukuran foto maksimal 2MB");
      return;
    }
    try {
      const foto = await fileKeFotoProduk(file);
      setForm((f) => ({ ...f, foto }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function tambahKategoriBaru() {
    if (!kategoriBaru.trim()) return;
    try {
      const k = await onTambahKategori(kategoriBaru.trim());
      setForm((f) => ({ ...f, kategori_id: k.id }));
      setKategoriBaru("");
      setTampilKategoriBaru(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const opsiSatuan = SATUAN_UMUM.includes(form.satuan) ? SATUAN_UMUM : [form.satuan, ...SATUAN_UMUM];

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
      <form
        onSubmit={handleSubmit}
        className="max-h-full w-full max-w-4xl overflow-auto rounded-3xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-ink">{produk ? "Edit Produk" : "Tambah Produk"}</h2>
            <p className="text-sm text-slate-500">
              {produk ? "Perbarui informasi produk." : "Lengkapi informasi produk yang akan ditambahkan ke sistem."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-ink hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-[280px_1fr] gap-6">
          <div className="rounded-2xl bg-[#f4f5f2] p-3">
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-white/60 p-4 text-center">
              {form.foto ? (
                <>
                  <ProductThumb nama={form.nama || "Produk"} foto={form.foto} className="aspect-[16/10] w-full rounded-xl" />
                  <div className="flex w-full gap-2">
                    <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-ink hover:bg-slate-50">
                      <Upload size={15} /> Ganti
                      <input type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, foto: null })}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={15} /> Hapus
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <ImagePlus size={32} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-bold text-ink">Tambah Foto Produk</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      JPG/PNG. Maksimal 2MB.
                      <br />
                      Otomatis dikecilkan dan dipotong.
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-slate-50">
                    <Upload size={15} /> Pilih Foto
                    <input type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
                  </label>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Nama Produk" icon={<Package size={17} />}>
              <input
                required
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Masukkan nama produk"
                className={inputBase}
              />
            </Field>

            <div className="grid grid-cols-[1fr_180px] gap-4">
              <div>
                <Field label="Barcode" icon={<Barcode size={17} />}>
                  <input
                    value={form.barcode ?? ""}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="Ketik, scan USB, atau kamera HP"
                    className={`${inputBase} pr-16`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    title="Scan barcode dengan kamera HP"
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-slate-200 bg-white text-ink hover:bg-slate-50"
                  >
                    <ScanLine size={16} />
                    <span
                      className={`absolute right-1 top-1 h-2 w-2 rounded-full ${
                        hpTerhubung > 0 ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                  </button>
                </Field>
                {infoScan && <p className="mt-1 text-xs text-slate-500">{infoScan}</p>}
              </div>

              <Field label="Satuan" icon={<Box size={17} />}>
                <Select
                  value={form.satuan}
                  onChange={(v) => setForm({ ...form, satuan: v })}
                  options={opsiSatuan.map((s) => ({ value: s, label: s }))}
                  className={inputBase}
                />
              </Field>
            </div>

            <div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <Field label="Kategori" icon={<Tags size={17} />}>
                  <Select
                    value={form.kategori_id ?? 0}
                    onChange={(v) => setForm({ ...form, kategori_id: v === 0 ? null : v })}
                    options={[{ value: 0, label: "Tanpa kategori" }, ...kategoriList.map((k) => ({ value: k.id, label: k.nama }))]}
                    className={inputBase}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => setTampilKategoriBaru((v) => !v)}
                  className="flex h-12 items-center gap-2 rounded-xl bg-[#f0f2ee] px-5 text-sm font-semibold text-ink hover:bg-[#e6e9e3]"
                >
                  <Plus size={16} /> Kategori baru
                </button>
              </div>
              {tampilKategoriBaru && (
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    value={kategoriBaru}
                    onChange={(e) => setKategoriBaru(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        tambahKategoriBaru();
                      }
                    }}
                    placeholder="Nama kategori baru"
                    className="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm focus:border-ink focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={tambahKategoriBaru}
                    className="rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-black"
                  >
                    Simpan
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Harga Beli" icon={<Coins size={17} />}>
                <UangInput
                  value={form.harga_beli}
                  onChange={(v) => setForm({ ...form, harga_beli: v })}
                  className={inputBase}
                />
              </Field>
              <Field label="Harga Jual" icon={<Tag size={17} />}>
                <UangInput
                  value={form.harga_jual}
                  onChange={(v) => setForm({ ...form, harga_jual: v })}
                  className={inputBase}
                />
              </Field>
              <Field label={produk ? "Stok (ubah lewat menu Stok)" : "Stok"} icon={<Layers size={17} />}>
                <UangInput
                  disabled={!!produk}
                  value={form.stok}
                  onChange={(v) => setForm({ ...form, stok: v })}
                  className={inputBase}
                />
              </Field>
              <Field label="Stok Minimum" icon={<TriangleAlert size={17} />}>
                <UangInput
                  value={form.stok_minimum}
                  onChange={(v) => setForm({ ...form, stok_minimum: v })}
                  className={inputBase}
                />
              </Field>
            </div>

            {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={onClose}
                className="h-12 rounded-xl border border-slate-200 text-sm font-semibold text-ink hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-extrabold text-ink hover:bg-brand-500 disabled:opacity-50"
              >
                <Save size={17} /> {saving ? "Menyimpan..." : "Simpan Produk"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {showScanner && (
        <ScannerHpModal
          onTutup={() => setShowScanner(false)}
          onStatusBerubah={(i) => setHpTerhubung(i.terhubung)}
        />
      )}
    </div>
  );
}
