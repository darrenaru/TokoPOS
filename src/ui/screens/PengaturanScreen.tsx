import { useEffect, useState } from "react";
import { DatabaseBackup, HardDriveDownload, Printer, RefreshCw, RotateCcw, Store } from "lucide-react";
import { backupApi, pengaturanApi, printerApi, type PortPrinter } from "../../services/api";
import { Select } from "../components/Select";
import { useAuth } from "../../context/AuthContext";
import { formatTanggalWaktu } from "../../utils/currency";
import type { BackupInfo } from "../../types";

function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PengaturanScreen() {
  const { logout } = useAuth();
  const [restoreSelesai, setRestoreSelesai] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [backupList, setBackupList] = useState<BackupInfo[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupPesan, setBackupPesan] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [ports, setPorts] = useState<PortPrinter[]>([]);
  const [printerBusy, setPrinterBusy] = useState(false);
  const [printerPesan, setPrinterPesan] = useState<string | null>(null);
  const [printerError, setPrinterError] = useState<string | null>(null);

  useEffect(() => {
    pengaturanApi.getAll().then(setValues);
    muatBackup();
    muatPorts();
  }, []);

  async function muatPorts() {
    try {
      setPorts(await printerApi.ports());
    } catch (err) {
      setPrinterError((err as Error).message);
    }
  }

  // Pilihan printer langsung disimpan agar layar Kasir memakainya tanpa perlu menekan Simpan.
  async function setPrinter(key: string, value: string) {
    set(key, value);
    setPrinterError(null);
    try {
      await pengaturanApi.setMany({ [key]: value });
      setPrinterPesan("Pilihan printer tersimpan.");
    } catch (err) {
      setPrinterError((err as Error).message);
    }
  }

  async function cetakTes() {
    setPrinterBusy(true);
    setPrinterError(null);
    setPrinterPesan(null);
    try {
      await printerApi.cetakTes(values.printer_port ?? "", Number(values.printer_lebar ?? 32) || 32);
      setPrinterPesan("Cetak tes terkirim. Periksa kertas printer.");
    } catch (err) {
      setPrinterError((err as Error).message);
    } finally {
      setPrinterBusy(false);
    }
  }

  async function muatBackup() {
    try {
      setBackupList(await backupApi.list());
    } catch {
      // Direktori backup mungkin belum ada (belum pernah backup) — abaikan.
    }
  }

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function simpan() {
    setError(null);
    try {
      await pengaturanApi.setMany(values);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function backupSekarang() {
    setBackupBusy(true);
    setBackupError(null);
    setBackupPesan(null);
    try {
      const nama = await backupApi.backupSekarang();
      setBackupPesan(`Backup berhasil dibuat: ${nama}`);
      await muatBackup();
    } catch (err) {
      setBackupError((err as Error).message);
    } finally {
      setBackupBusy(false);
    }
  }

  async function restore(namaFile: string) {
    if (!confirm(`Pulihkan database dari "${namaFile}"? Data saat ini akan digantikan.`)) return;
    setBackupBusy(true);
    setBackupError(null);
    setBackupPesan(null);
    try {
      await backupApi.restore(namaFile);
      // Akun dan data di database hasil restore bisa berbeda; sesi lama tidak lagi valid.
      setRestoreSelesai(true);
    } catch (err) {
      setBackupError((err as Error).message);
    } finally {
      setBackupBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Pengaturan Toko</h1>
        <p className="text-sm text-slate-400">Informasi toko, pajak, dan backup database</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Store size={17} />
            </div>
            <h2 className="text-base font-bold text-slate-800">Informasi Toko</h2>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nama Toko</label>
            <input
              value={values.nama_toko ?? ""}
              onChange={(e) => set("nama_toko", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Alamat Toko</label>
            <input
              value={values.alamat_toko ?? ""}
              onChange={(e) => set("alamat_toko", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Telepon Toko</label>
            <input
              value={values.telepon_toko ?? ""}
              onChange={(e) => set("telepon_toko", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Catatan Kaki Struk</label>
            <input
              value={values.struk_catatan ?? ""}
              onChange={(e) => set("struk_catatan", e.target.value)}
              placeholder="Barang yang sudah dibeli tidak dapat ditukar/dikembalikan"
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <input
              id="pajak_aktif"
              type="checkbox"
              checked={values.pajak_aktif === "1"}
              onChange={(e) => set("pajak_aktif", e.target.checked ? "1" : "0")}
              className="h-4 w-4 accent-brand-600"
            />
            <label htmlFor="pajak_aktif" className="text-sm font-medium text-slate-700">
              Aktifkan Pajak (PPN)
            </label>
          </div>

          {values.pajak_aktif === "1" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Persentase Pajak (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={values.pajak_persen === "0" ? "" : (values.pajak_persen ?? "")}
                placeholder="0"
                onChange={(e) => set("pajak_persen", e.target.value.replace(/^0+(?=\d)/, "") || "0")}
                className={inputClass}
              />
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Pengaturan tersimpan</p>}

          <button
            onClick={simpan}
            className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-slate-900 shadow-sm shadow-brand-600/40 hover:bg-brand-500"
          >
            Simpan Pengaturan
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <DatabaseBackup size={17} />
            </div>
            <h2 className="text-base font-bold text-slate-800">Backup & Restore</h2>
          </div>
          <p className="text-sm text-slate-500">
            Backup disimpan lokal di komputer ini. Maksimal 14 backup terakhir disimpan otomatis.
          </p>

          {backupError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{backupError}</p>}
          {backupPesan && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{backupPesan}</p>}

          <button
            onClick={backupSekarang}
            disabled={backupBusy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <HardDriveDownload size={16} /> Backup Sekarang
          </button>

          <div className="max-h-64 overflow-auto rounded-xl border border-slate-100">
            {backupList.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-400">Belum ada backup</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {backupList.map((b) => (
                  <li key={b.nama_file} className="flex items-center justify-between px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{b.nama_file}</p>
                      <p className="text-xs text-slate-400">
                        {formatTanggalWaktu(b.dibuat_pada)} · {formatUkuran(b.ukuran_bytes)}
                      </p>
                    </div>
                    <button
                      onClick={() => restore(b.nama_file)}
                      disabled={backupBusy}
                      title="Pulihkan"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                    >
                      <RotateCcw size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Printer size={17} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Printer Struk (Thermal)</h2>
              <p className="text-xs text-slate-400">
                Printer Bluetooth: pasangkan dulu di Pengaturan Windows, lalu pilih port &quot;Standard Serial over Bluetooth&quot; (COM).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Port Printer</label>
              <Select
                value={values.printer_port ?? ""}
                onChange={(v) => setPrinter("printer_port", v)}
                placeholder="Belum dipilih"
                options={[
                  { value: "", label: "Belum dipilih (pakai cetak Windows)" },
                  ...(values.printer_port && !ports.some((p) => p.nama === values.printer_port)
                    ? [{ value: values.printer_port, label: values.printer_port, hint: "Tidak terdeteksi saat ini" }]
                    : []),
                  ...ports.map((p) => ({ value: p.nama, label: p.nama, hint: p.deskripsi })),
                ]}
              />
            </div>
            <button
              type="button"
              onClick={muatPorts}
              title="Muat ulang daftar port"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-ink hover:bg-slate-50"
            >
              <RefreshCw size={16} />
            </button>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Lebar Kertas</label>
              <Select
                value={values.printer_lebar ?? "32"}
                onChange={(v) => setPrinter("printer_lebar", v)}
                options={[
                  { value: "32", label: "58 mm", hint: "32 karakter per baris" },
                  { value: "48", label: "80 mm", hint: "48 karakter per baris" },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="printer_otomatis"
              type="checkbox"
              checked={values.printer_otomatis === "1"}
              onChange={(e) => setPrinter("printer_otomatis", e.target.checked ? "1" : "0")}
              className="h-4 w-4 accent-brand-600"
            />
            <label htmlFor="printer_otomatis" className="text-sm font-medium text-slate-700">
              Cetak struk otomatis setelah pembayaran berhasil
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="struk_logo"
              type="checkbox"
              checked={values.struk_logo !== "0"}
              onChange={(e) => setPrinter("struk_logo", e.target.checked ? "1" : "0")}
              className="h-4 w-4 accent-brand-600"
            />
            <label htmlFor="struk_logo" className="text-sm font-medium text-slate-700">
              Cetak logo toko di struk
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="struk_pesan"
              type="checkbox"
              checked={values.struk_pesan !== "0"}
              onChange={(e) => setPrinter("struk_pesan", e.target.checked ? "1" : "0")}
              className="h-4 w-4 accent-brand-600"
            />
            <label htmlFor="struk_pesan" className="text-sm font-medium text-slate-700">
              Cetak pesan "Terima kasih atas kunjungan Anda"
            </label>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Jumlah salinan default</label>
            <div className="w-24">
              <Select
                value={values.struk_salinan ?? "1"}
                onChange={(v) => setPrinter("struk_salinan", v)}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>
          </div>

          {printerError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{printerError}</p>}
          {printerPesan && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{printerPesan}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cetakTes}
              disabled={printerBusy || !values.printer_port}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50"
            >
              <Printer size={16} /> {printerBusy ? "Mengirim..." : "Cetak Tes"}
            </button>
            <p className="text-xs text-slate-400">Pilihan printer tersimpan otomatis dan langsung dipakai di layar Kasir.</p>
          </div>
        </div>
      </div>

      {restoreSelesai && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h2 className="mb-2 text-lg font-bold text-slate-800">Database Dipulihkan</h2>
            <p className="mb-5 text-sm text-slate-500">
              Data berhasil dipulihkan dari backup. Demi keamanan, silakan masuk kembali.
            </p>
            <button
              onClick={() => logout()}
              className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-slate-900 hover:bg-brand-500"
            >
              Masuk Kembali
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
