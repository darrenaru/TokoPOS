import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Smartphone, Wallet } from "lucide-react";
import { ProductGrid } from "../components/ProductGrid";
import { CartPanel } from "../components/CartPanel";
import { DraftListModal } from "../components/DraftListModal";
import { ScannerHpModal } from "../components/ScannerHpModal";
import { PaymentModal } from "../components/PaymentModal";
import { CetakStrukModal } from "../components/CetakStrukModal";
import { kasApi, pengaturanApi, produkApi, scannerHpApi, transaksiApi } from "../../services/api";
import { formatRupiah, formatTanggalWaktu } from "../../utils/currency";
import type { CartItem, Produk, SesiKasir, Transaksi } from "../../types";
import { UangInput } from "../components/UangInput";
import { bunyiBeep } from "../../utils/beep";

export function KasirScreen() {
  const [sesi, setSesi] = useState<SesiKasir | null | undefined>(undefined);
  const [modalAwal, setModalAwal] = useState(0);
  const [items, setItems] = useState<CartItem[]>([]);
  const [diskon, setDiskon] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Transaksi | null>(null);
  const [pajakAktif, setPajakAktif] = useState(false);
  const [pajakPersen, setPajakPersen] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  const [drafts, setDrafts] = useState<Transaksi[]>([]);
  const [showDraftList, setShowDraftList] = useState(false);
  const [showScannerHp, setShowScannerHp] = useState(false);
  const [hpTerhubung, setHpTerhubung] = useState(0);
  const [pesanScan, setPesanScan] = useState<string | null>(null);

  useEffect(() => {
    scannerHpApi.status().then((i) => setHpTerhubung(i.terhubung)).catch(() => {});
    const unlisten = Promise.all([
      listen<{ terhubung: number }>("hp-scanner-status", (ev) => setHpTerhubung(ev.payload.terhubung)),
      listen<{ code: string; found: boolean; nama: string; mode?: string }>("hp-scanner-scan", async (ev) => {
        // Scan dengan mode "Tambah Produk" bukan pembelian; jangan masuk keranjang.
        if (ev.payload.mode === "produk") return;
        if (!ev.payload.found) {
          setPesanScan(`Barcode ${ev.payload.code} tidak ditemukan`);
          return;
        }
        const produk = await produkApi.getByBarcode(ev.payload.code);
        if (produk && produk.stok > 0) {
          tambahProduk(produk);
          bunyiBeep();
          setPesanScan(null);
        } else if (produk) {
          setPesanScan(`Stok "${produk.nama}" habis`);
        }
      }),
    ]);
    return () => {
      unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  useEffect(() => {
    kasApi.getSesiAktif().then(setSesi);
    pengaturanApi.getAll().then((p) => {
      setPajakAktif(p.pajak_aktif === "1");
      setPajakPersen(Number(p.pajak_persen ?? 0) || 0);
    });
  }, []);

  useEffect(() => {
    if (sesi) {
      transaksiApi.listDraft().then(setDrafts);
    }
  }, [sesi]);

  function tambahProduk(produk: Produk) {
    if (produk.stok <= 0) {
      setPesanScan(`Stok "${produk.nama}" habis`);
      return;
    }
    setPesanScan(null);
    setItems((prev) => {
      const existing = prev.find((i) => i.produk.id === produk.id);
      if (existing) {
        return prev.map((i) =>
          i.produk.id === produk.id ? { ...i, jumlah: Math.min(i.jumlah + 1, produk.stok) } : i,
        );
      }
      return [...prev, { produk, jumlah: 1, diskonItem: 0 }];
    });
  }

  function ubahJumlah(produkId: number, jumlah: number) {
    if (jumlah <= 0) {
      hapusItem(produkId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.produk.id === produkId ? { ...i, jumlah: Math.max(1, Math.min(jumlah, i.produk.stok)) } : i,
      ),
    );
  }

  function hapusItem(produkId: number) {
    setItems((prev) => prev.filter((i) => i.produk.id !== produkId));
  }

  const subtotal = items.reduce((sum, i) => sum + i.produk.harga_jual * i.jumlah - i.diskonItem, 0);
  // Diskon tidak boleh melebihi subtotal; aturan yang sama diterapkan di backend.
  const diskonEfektif = Math.min(diskon, subtotal);
  const dasarPajak = subtotal - diskonEfektif;
  const pajak = pajakAktif ? Math.round((dasarPajak * pajakPersen) / 100) : 0;
  const total = dasarPajak + pajak;

  async function bukaSesi() {
    setError(null);
    try {
      const s = await kasApi.bukaSesi(modalAwal);
      setSesi(s);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleBayar(jumlahDibayar: number) {
    if (!sesi) return;
    setProcessing(true);
    setError(null);
    try {
      const trx = await transaksiApi.checkout({
        sesi_kasir_id: sesi.id,
        items: items.map((i) => ({ produk_id: i.produk.id, jumlah: i.jumlah, diskon_item: i.diskonItem })),
        diskon: diskonEfektif,
        metode_bayar: "tunai",
        jumlah_dibayar: jumlahDibayar,
      });
      setReceipt(trx);
      setShowPayment(false);
      setRefreshToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  function transaksiBaru() {
    setItems([]);
    setDiskon(0);
    setReceipt(null);
    setError(null);
  }

  async function simpanDraft() {
    if (!sesi || items.length === 0) return;
    setError(null);
    try {
      await transaksiApi.simpanDraft({
        sesi_kasir_id: sesi.id,
        items: items.map((i) => ({ produk_id: i.produk.id, jumlah: i.jumlah, diskon_item: i.diskonItem })),
        diskon: diskonEfektif,
      });
      setItems([]);
      setDiskon(0);
      setDrafts(await transaksiApi.listDraft());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function lanjutkanDraft(draft: Transaksi) {
    setError(null);
    setPesanScan(null);
    // Memuat draft akan menimpa keranjang; jangan sampai belanjaan yang sedang dilayani hilang.
    if (items.length > 0) {
      setShowDraftList(false);
      setError("Keranjang masih berisi barang. Simpan sebagai draft atau reset dulu sebelum melanjutkan draft.");
      return;
    }
    try {
      const produkList = await produkApi.list(true);
      const cartItems: CartItem[] = [];
      const dilewati: string[] = [];
      for (const item of draft.items) {
        const produk = produkList.find((p) => p.id === item.produk_id);
        if (!produk || produk.stok <= 0) {
          dilewati.push(item.nama_produk_snapshot);
          continue;
        }
        // Stok bisa berubah sejak draft dibuat; jumlah dibatasi sisa stok.
        const jumlah = Math.min(item.jumlah, produk.stok);
        if (jumlah < item.jumlah) dilewati.push(`${produk.nama} (dikurangi jadi ${jumlah})`);
        cartItems.push({ produk, jumlah, diskonItem: jumlah < item.jumlah ? 0 : item.diskon_item });
      }
      await transaksiApi.hapusDraft(draft.id);
      setItems(cartItems);
      setDiskon(draft.diskon);
      setDrafts(await transaksiApi.listDraft());
      setShowDraftList(false);
      if (dilewati.length > 0) {
        setPesanScan(`Sebagian item draft disesuaikan karena stok berubah: ${dilewati.join(", ")}`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function hapusDraft(id: number) {
    try {
      await transaksiApi.hapusDraft(id);
      setDrafts(await transaksiApi.listDraft());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (sesi === undefined) {
    return <div className="flex h-full items-center justify-center text-slate-400">Memuat...</div>;
  }

  if (sesi === null) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <Wallet size={22} />
          </div>
          <h2 className="mb-1 text-center text-lg font-bold text-slate-800">Buka Kasir</h2>
          <p className="mb-5 text-center text-sm text-slate-500">
            Masukkan modal awal untuk memulai sesi kasir hari ini.
          </p>
          <label className="mb-1 block text-sm font-medium text-slate-700">Modal Awal</label>
          <UangInput
            value={modalAwal}
            onChange={setModalAwal}
            className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={bukaSesi}
            className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-slate-900 shadow-sm shadow-brand-600/40 hover:bg-brand-500"
          >
            Buka Kasir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kasir</h1>
            <p className="text-xs text-slate-400">
              Sesi dibuka {formatTanggalWaktu(sesi.waktu_buka)} · Modal {formatRupiah(sesi.modal_awal)}
            </p>
          </div>
          <button
            onClick={() => setShowScannerHp(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Smartphone size={15} /> Scan HP
            <span
              className={`h-2 w-2 rounded-full ${hpTerhubung > 0 ? "bg-emerald-500" : "bg-slate-300"}`}
              title={hpTerhubung > 0 ? `${hpTerhubung} HP terhubung` : "Belum ada HP terhubung"}
            />
          </button>
        </div>

        {error && !showPayment && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {pesanScan && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{pesanScan}</p>
        )}

        <div className="min-h-0 flex-1">
          <ProductGrid onPilihProduk={tambahProduk} refreshToken={refreshToken} />
        </div>
      </div>

      <CartPanel
        items={items}
        diskon={diskonEfektif}
        subtotal={subtotal}
        pajak={pajak}
        pajakPersen={pajakAktif ? pajakPersen : 0}
        total={total}
        onReset={transaksiBaru}
        onUbahJumlah={ubahJumlah}
        onHapus={hapusItem}
        onUbahDiskon={setDiskon}
        onBayar={() => setShowPayment(true)}
        onSimpanDraft={simpanDraft}
        onBukaDraftList={() => setShowDraftList(true)}
        jumlahDraft={drafts.length}
      />

      {showPayment && (
        <PaymentModal
          total={total}
          processing={processing}
          error={error}
          onBatal={() => setShowPayment(false)}
          onBayar={handleBayar}
        />
      )}

      {receipt && <CetakStrukModal transaksi={receipt} onTutup={transaksiBaru} />}

      {showScannerHp && (
        <ScannerHpModal
          onTutup={() => setShowScannerHp(false)}
          onStatusBerubah={(i) => setHpTerhubung(i.terhubung)}
        />
      )}

      {showDraftList && (
        <DraftListModal
          drafts={drafts}
          onTutup={() => setShowDraftList(false)}
          onLanjutkan={lanjutkanDraft}
          onHapus={hapusDraft}
        />
      )}
    </div>
  );
}
