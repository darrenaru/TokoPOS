import { useEffect, useRef, useState } from "react";
import { Check, FileDown, Minus, Plus, Printer, RefreshCw, X } from "lucide-react";
import { pengaturanApi, printerApi, type PortPrinter } from "../../services/api";
import { formatRupiah, formatTanggalWaktu } from "../../utils/currency";
import type { Transaksi } from "../../types";
import { Select } from "./Select";

interface Props {
  transaksi: Transaksi;
  onTutup: () => void;
}

type Status = { tipe: "proses" | "ok" | "error"; pesan: string } | null;

function Toggle({ aktif, onChange }: { aktif: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      onClick={() => onChange(!aktif)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${aktif ? "bg-brand-600" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${aktif ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export function CetakStrukModal({ transaksi, onTutup }: Props) {
  const [toko, setToko] = useState<Record<string, string>>({});
  const [ports, setPorts] = useState<PortPrinter[]>([]);
  const [port, setPort] = useState("");
  const [lebar, setLebar] = useState(32);
  const [salinan, setSalinan] = useState(1);
  const [logo, setLogo] = useState(true);
  const [pesan, setPesan] = useState(true);
  const [siap, setSiap] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const autoRef = useRef(false);

  useEffect(() => {
    pengaturanApi.getAll().then((p) => {
      setToko(p);
      setPort(p.printer_port ?? "");
      setLebar(Number(p.printer_lebar ?? 32) === 48 ? 48 : 32);
      setSalinan(Math.min(5, Math.max(1, Number(p.struk_salinan ?? 1) || 1)));
      setLogo(p.struk_logo !== "0");
      setPesan(p.struk_pesan !== "0");
      setSiap(true);
    });
    printerApi.ports().then(setPorts).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (siap && !autoRef.current && toko.printer_port && toko.printer_otomatis === "1") {
      autoRef.current = true;
      void cetak();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siap]);

  function simpan(key: string, value: string) {
    pengaturanApi.setMany({ [key]: value }).catch(() => undefined);
  }

  async function cetak() {
    if (!port && !toko.printer_port) {
      setStatus({ tipe: "error", pesan: "Pilih printer terlebih dahulu." });
      return;
    }
    setStatus({ tipe: "proses", pesan: "Mengirim struk ke printer..." });
    try {
      await printerApi.cetakStruk(transaksi.id, {
        port: port || toko.printer_port,
        lebar,
        salinan,
        logo,
        pesan,
      });
      setStatus({ tipe: "ok", pesan: "Struk terkirim ke printer." });
    } catch (err) {
      setStatus({ tipe: "error", pesan: (err as Error).message });
    }
  }

  const opsiPort = ports.map((p) => ({ value: p.nama, label: p.nama, hint: p.deskripsi }));
  if (port && !opsiPort.some((o) => o.value === port)) opsiPort.unshift({ value: port, label: port, hint: "" });

  const lebarKertas = lebar === 48 ? 320 : 264;
  const catatan = toko.struk_catatan || "Barang yang sudah dibeli tidak dapat ditukar/dikembalikan";
  const namaToko = toko.nama_toko || "Toko Saya";

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="scroll-thin flex w-[380px] shrink-0 justify-center overflow-y-auto bg-slate-100 px-6 py-8">
          <div className="struk-kertas h-fit bg-white px-4 py-5 font-mono text-[11px] leading-snug text-slate-800" style={{ width: lebarKertas }}>
            <div id="struk-print">
              <div className="mb-2 text-center">
                {logo && <img src="/logo-mark.png" alt="" className="mx-auto mb-1 h-10 w-10 object-contain" />}
                <p className="text-sm font-bold">{namaToko}</p>
                {toko.alamat_toko && <p>{toko.alamat_toko}</p>}
                {toko.telepon_toko && <p>Telp: {toko.telepon_toko}</p>}
              </div>
              <div className="my-2 border-t border-dashed border-slate-400" />
              <div className="space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span>No. Nota</span>
                  <span>{transaksi.kode_transaksi}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Waktu</span>
                  <span>{formatTanggalWaktu(transaksi.created_at)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Kasir</span>
                  <span>{transaksi.kasir_nama}</span>
                </div>
              </div>
              <div className="my-2 border-t border-dashed border-slate-400" />
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="pb-1 font-bold">Nama Produk</th>
                    <th className="pb-1 text-center font-bold">Qty</th>
                    <th className="pb-1 text-right font-bold">Harga</th>
                    <th className="pb-1 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksi.items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="pr-1">{item.nama_produk_snapshot}</td>
                      <td className="text-center">{item.jumlah}</td>
                      <td className="text-right">{formatRupiah(item.harga_satuan)}</td>
                      <td className="text-right">{formatRupiah(item.subtotal_item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="my-2 border-t border-dashed border-slate-400" />
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatRupiah(transaksi.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pajak</span>
                  <span>{formatRupiah(transaksi.pajak)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Diskon</span>
                  <span>{transaksi.diskon > 0 ? `-${formatRupiah(transaksi.diskon)}` : formatRupiah(0)}</span>
                </div>
              </div>
              <div className="-mx-2 my-2 flex justify-between rounded bg-brand-600 px-2 py-1 text-xs font-bold text-slate-900">
                <span>Total</span>
                <span>{formatRupiah(transaksi.total)}</span>
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>Tunai</span>
                  <span>{formatRupiah(transaksi.jumlah_dibayar)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kembali</span>
                  <span>{formatRupiah(transaksi.kembalian)}</span>
                </div>
              </div>
              {pesan && <p className="mt-4 text-center font-bold">Terima kasih atas kunjungan Anda</p>}
              <p className={`text-center text-[10px] text-slate-500 ${pesan ? "mt-0.5" : "mt-4"}`}>{catatan}</p>
            </div>
          </div>
        </div>

        <div className="scroll-thin flex min-w-0 flex-1 flex-col overflow-y-auto p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-ink">
              <Printer size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-ink">Cetak Struk</h2>
              <p className="text-sm text-slate-500">Pilih opsi cetak struk transaksi</p>
            </div>
            <button onClick={onTutup} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" title="Tutup">
              <X size={18} />
            </button>
          </div>

          <label className="mb-1.5 block text-sm font-semibold text-ink">Printer</label>
          <div className="mb-5 flex gap-2">
            <div className="min-w-0 flex-1">
              <Select
                value={port}
                onChange={(v) => {
                  setPort(v);
                  simpan("printer_port", v);
                }}
                options={opsiPort}
                placeholder="Pilih printer"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none"
                leading={<Printer size={15} className="text-slate-400" />}
              />
            </div>
            <button
              onClick={() => printerApi.ports().then(setPorts).catch(() => undefined)}
              title="Muat ulang daftar printer"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-ink hover:bg-slate-50"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <label className="mb-1.5 block text-sm font-semibold text-ink">Jumlah Salinan</label>
          <div className="mb-5 inline-flex h-11 w-40 items-center rounded-xl border border-slate-200">
            <button
              onClick={() => setSalinan((s) => Math.max(1, s - 1))}
              className="flex h-full w-11 items-center justify-center text-slate-500 hover:text-ink"
            >
              <Minus size={15} />
            </button>
            <span className="flex-1 text-center font-semibold text-ink">{salinan}</span>
            <button
              onClick={() => setSalinan((s) => Math.min(5, s + 1))}
              className="flex h-full w-11 items-center justify-center text-slate-500 hover:text-ink"
            >
              <Plus size={15} />
            </button>
          </div>

          <label className="mb-1.5 block text-sm font-semibold text-ink">Ukuran Kertas</label>
          <div className="mb-5 grid grid-cols-2 gap-3">
            {[
              { v: 32, label: "58 mm" },
              { v: 48, label: "80 mm" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => {
                  setLebar(o.v);
                  simpan("printer_lebar", String(o.v));
                }}
                className={`flex h-11 items-center justify-between rounded-xl border px-4 text-sm font-semibold ${
                  lebar === o.v ? "border-ink bg-white text-ink" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {o.label}
                {lebar === o.v && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-ink">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>

          <label className="mb-2 block text-sm font-semibold text-ink">Opsi Cetak</label>
          <div className="mb-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Logo Toko</span>
              <Toggle
                aktif={logo}
                onChange={(v) => {
                  setLogo(v);
                  simpan("struk_logo", v ? "1" : "0");
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Pesan Terima Kasih</span>
              <Toggle
                aktif={pesan}
                onChange={(v) => {
                  setPesan(v);
                  simpan("struk_pesan", v ? "1" : "0");
                }}
              />
            </div>
          </div>

          {status && (
            <p
              className={`mb-4 rounded-lg px-3 py-2 text-xs ${
                status.tipe === "error"
                  ? "bg-red-50 text-red-700"
                  : status.tipe === "ok"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {status.pesan}
            </p>
          )}

          <div className="mt-auto grid grid-cols-[1fr_1.2fr_1.2fr] gap-2.5 pt-2">
            <button onClick={onTutup} className="h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Tutup
            </button>
            <button
              onClick={() => window.print()}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              <FileDown size={15} /> Simpan PDF
            </button>
            <button
              onClick={cetak}
              disabled={status?.tipe === "proses"}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-bold text-ink hover:bg-brand-500 disabled:opacity-60"
            >
              <Printer size={15} /> Cetak
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
