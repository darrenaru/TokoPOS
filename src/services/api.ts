import { invoke } from "@tauri-apps/api/core";
import type {
  BackupInfo,
  CheckoutInput,
  DraftInput,
  Kategori,
  LogAktivitas,
  LogStok,
  Pengguna,
  PenggunaInput,
  PenggunaUpdateInput,
  Produk,
  ProdukInput,
  ProdukTerjual,
  RingkasanPenjualan,
  SesiKasir,
  StokKoreksiInput,
  Transaksi,
} from "../types";

// Setiap error dari backend Rust dikirim sebagai string polos (lihat error.rs),
// jadi cukup dilempar ulang sebagai Error biasa untuk ditangkap komponen React.
async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw new Error(typeof err === "string" ? err : "Terjadi kesalahan tak terduga");
  }
}

export const authApi = {
  login: (username: string, password: string) => call<Pengguna>("login", { username, password }),
  logout: () => call<void>("logout"),
  currentSession: () => call<Pengguna | null>("current_session"),
};

export const produkApi = {
  list: (hanyaAktif = true) => call<Produk[]>("list_produk", { hanyaAktif }),
  getByBarcode: (barcode: string) => call<Produk | null>("get_produk_by_barcode", { barcode }),
  create: (input: ProdukInput) => call<number>("create_produk", { input }),
  update: (id: number, input: ProdukInput) => call<void>("update_produk", { id, input }),
  hapus: (id: number) => call<void>("hapus_produk", { id }),
  listKategori: () => call<Kategori[]>("list_kategori"),
  createKategori: (nama: string) => call<number>("create_kategori", { nama }),
};

export const kasApi = {
  getSesiAktif: () => call<SesiKasir | null>("get_sesi_aktif"),
  bukaSesi: (modalAwal: number) => call<SesiKasir>("buka_sesi", { modalAwal }),
  tutupSesi: (sesiId: number, totalKasAktual: number) =>
    call<SesiKasir>("tutup_sesi", { sesiId, totalKasAktual }),
  riwayat: () => call<SesiKasir[]>("riwayat_sesi"),
};

export const transaksiApi = {
  checkout: (input: CheckoutInput) => call<Transaksi>("checkout", { input }),
  riwayat: (dari?: string, sampai?: string, keyword?: string) =>
    call<Transaksi[]>("riwayat_transaksi", { dari, sampai, keyword }),
  simpanDraft: (input: DraftInput) => call<Transaksi>("simpan_draft", { input }),
  listDraft: () => call<Transaksi[]>("list_draft"),
  hapusDraft: (id: number) => call<void>("hapus_draft", { id }),
};

export const stokApi = {
  koreksi: (input: StokKoreksiInput) => call<void>("koreksi_stok", { input }),
  riwayat: (produkId?: number) => call<LogStok[]>("riwayat_stok", { produkId }),
  stokMenipis: () => call<Produk[]>("produk_stok_menipis"),
};

export const pengaturanApi = {
  getAll: () => call<Record<string, string>>("get_pengaturan"),
  setMany: (values: Record<string, string>) => call<void>("set_pengaturan", { values }),
};

export const penggunaApi = {
  list: () => call<Pengguna[]>("list_pengguna"),
  create: (input: PenggunaInput) => call<number>("create_pengguna", { input }),
  update: (id: number, input: PenggunaUpdateInput) => call<void>("update_pengguna", { id, input }),
};

export const logAktivitasApi = {
  riwayat: () => call<LogAktivitas[]>("riwayat_aktivitas"),
};

export const laporanApi = {
  ringkasan: (dari: string, sampai: string) => call<RingkasanPenjualan>("laporan_ringkasan", { dari, sampai }),
  produkTerlaris: (dari: string, sampai: string) =>
    call<ProdukTerjual[]>("laporan_produk_terlaris", { dari, sampai }),
  produkKurangLaku: (dari: string, sampai: string) =>
    call<ProdukTerjual[]>("laporan_produk_kurang_laku", { dari, sampai }),
};

export const backupApi = {
  backupSekarang: () => call<string>("backup_sekarang"),
  list: () => call<BackupInfo[]>("list_backup"),
  restore: (namaFile: string) => call<void>("restore_backup", { namaFile }),
};

export interface PerangkatHp {
  id: number;
  nama: string;
  ip: string;
  sejak: string;
  jumlah_scan: number;
  /** "beli" = tambah ke keranjang, "produk" = tambah produk baru. */
  mode: "beli" | "produk";
}

export interface ScannerInfo {
  aktif: boolean;
  urls: string[];
  terhubung: number;
  perangkat: PerangkatHp[];
}

export const scannerHpApi = {
  start: () => call<ScannerInfo>("start_phone_scanner"),
  stop: () => call<void>("stop_phone_scanner"),
  status: () => call<ScannerInfo>("status_phone_scanner"),
  putuskanPerangkat: (id: number) => call<void>("putuskan_perangkat_hp", { id }),
};

export interface PortPrinter {
  nama: string;
  deskripsi: string;
}

export interface CetakOpsi {
  port: string;
  lebar: number;
  salinan: number;
  logo: boolean;
  pesan: boolean;
}

export const printerApi = {
  ports: () => call<PortPrinter[]>("list_printer_ports"),
  cetakTes: (port: string, lebar: number) => call<void>("cetak_tes_printer", { port, lebar }),
  cetakStruk: (id: number, opsi: CetakOpsi) => call<void>("cetak_struk_printer", { id, opsi }),
};
