import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import QRCode from "qrcode";
import { Smartphone, Wifi, X } from "lucide-react";
import { scannerHpApi, type PerangkatHp, type ScannerInfo } from "../../services/api";
import { formatTanggalWaktu } from "../../utils/currency";
import { Select } from "./Select";

interface Props {
  onTutup: () => void;
  onStatusBerubah: (info: ScannerInfo) => void;
}

export function ScannerHpModal({ onTutup, onStatusBerubah }: Props) {
  const [info, setInfo] = useState<ScannerInfo | null>(null);
  const [indeksUrl, setIndeksUrl] = useState(0);
  const [qr, setQr] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function terapkan(i: ScannerInfo) {
    setInfo(i);
    onStatusBerubah(i);
  }

  useEffect(() => {
    scannerHpApi.start().then(terapkan).catch((e) => setError((e as Error).message));
    let batal: (() => void) | undefined;
    listen<{ terhubung: number; perangkat: PerangkatHp[] }>("hp-scanner-status", (ev) => {
      setInfo((prev) => (prev ? { ...prev, terhubung: ev.payload.terhubung, perangkat: ev.payload.perangkat } : prev));
      onStatusBerubah({ aktif: true, urls: [], terhubung: ev.payload.terhubung, perangkat: ev.payload.perangkat });
    }).then((un) => (batal = un));
    return () => batal?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const url = info?.urls[indeksUrl];

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 400, margin: 1 }).then(setQr);
  }, [url]);

  async function putuskan() {
    await scannerHpApi.stop();
    terapkan({ aktif: false, urls: [], terhubung: 0, perangkat: [] });
    onTutup();
  }

  const terhubung = (info?.terhubung ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      {/* Tinggi dibatasi sesuai jendela; bagian tengah bisa di-scroll, header dan tombol tetap terlihat. */}
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Smartphone size={17} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Scan Barcode via HP</h2>
          </div>
          <button onClick={onTutup} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 pb-3">
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {!error && !info && <p className="py-10 text-center text-sm text-slate-400">Menyiapkan server...</p>}

          {info && url && (
            <div className="grid gap-5 md:grid-cols-[230px_1fr]">
              <div>
                <div className="mb-3 flex justify-center rounded-2xl bg-slate-50 p-3">
                  {qr && <img src={qr} alt="QR Code untuk menghubungkan HP" width={200} height={200} />}
                </div>

                <div
                  className={`mb-3 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                    terhubung ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Wifi size={15} />
                  {terhubung ? `${info.terhubung} HP terhubung` : "Menunggu HP terhubung..."}
                </div>

                <p className="text-xs text-slate-500">
                  Bisa menghubungkan beberapa HP sekaligus: scan QR yang sama di tiap HP.
                </p>

                {info.urls.length > 1 && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      Beberapa jaringan terdeteksi — pilih yang satu WiFi dengan HP:
                    </label>
                    <Select
                      value={indeksUrl}
                      onChange={setIndeksUrl}
                      options={info.urls.map((u, i) => ({ value: i, label: new URL(u).host }))}
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-brand-50 p-3 text-brand-800">
                    <p className="mb-0.5 font-bold">Tambah ke Keranjang</p>
                    <p>Scan barcode untuk membeli: produk masuk ke keranjang kasir.</p>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-3 text-sky-800">
                    <p className="mb-0.5 font-bold">Tambah Produk</p>
                    <p>Scan barcode produk baru lalu isi datanya di HP. Tersimpan langsung ke database.</p>
                  </div>
                </div>
                <p className="mb-3 text-xs text-slate-500">Pilih mode lewat tombol di bagian atas layar HP.</p>

                <ol className="mb-4 list-inside list-decimal space-y-1 text-sm text-slate-600">
                  <li>Sambungkan HP ke WiFi yang sama dengan komputer ini.</li>
                  <li>Scan QR di samping dengan kamera HP (iPhone atau Android).</li>
                  <li>
                    Jika muncul peringatan sertifikat, pilih <b>Lanjutkan / Advanced → Proceed</b> (koneksi hanya di
                    jaringan lokal toko).
                  </li>
                  <li>Tekan &quot;Mulai Kamera&quot; dan arahkan ke barcode produk.</li>
                </ol>

                {info.perangkat.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Perangkat terhubung ({info.perangkat.length})
                    </p>
                    <ul className="space-y-1.5">
                      {info.perangkat.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-ink">
                            <Smartphone size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-bold text-ink">{p.nama}</p>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  p.mode === "produk" ? "bg-sky-100 text-sky-700" : "bg-brand-100 text-brand-800"
                                }`}
                              >
                                {p.mode === "produk" ? "Tambah Produk" : "Pembelian"}
                              </span>
                            </div>
                            <p className="truncate text-xs text-slate-400">
                              {p.ip} · sejak {formatTanggalWaktu(p.sejak)} · {p.jumlah_scan} scan
                            </p>
                          </div>
                          <button
                            onClick={() => scannerHpApi.putuskanPerangkat(p.id)}
                            title="Putuskan perangkat ini"
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Putuskan
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onTutup}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Tutup
          </button>
          {info?.aktif && (
            <button
              onClick={putuskan}
              className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Putuskan & Matikan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
