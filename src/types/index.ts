export interface Kategori {
  id: number;
  nama: string;
}

export interface Produk {
  id: number;
  nama: string;
  barcode: string | null;
  kategori_id: number | null;
  kategori_nama: string | null;
  harga_beli: number;
  harga_jual: number;
  stok: number;
  stok_minimum: number;
  satuan: string;
  aktif: boolean;
  created_at: string;
  updated_at: string;
  foto: string | null;
}

export interface ProdukInput {
  nama: string;
  barcode: string | null;
  kategori_id: number | null;
  harga_beli: number;
  harga_jual: number;
  stok: number;
  stok_minimum: number;
  satuan: string;
  foto: string | null;
}

export interface Pengguna {
  id: number;
  nama: string;
  username: string;
  peran: "admin" | "kasir";
  aktif: boolean;
}

export interface PenggunaInput {
  nama: string;
  username: string;
  password: string;
  peran: "admin" | "kasir";
}

export interface PenggunaUpdateInput {
  nama: string;
  peran: "admin" | "kasir";
  aktif: boolean;
  password: string;
}

export interface SesiKasir {
  id: number;
  kasir_id: number;
  kasir_nama: string | null;
  waktu_buka: string;
  waktu_tutup: string | null;
  modal_awal: number;
  total_kas_sistem: number | null;
  total_kas_aktual: number | null;
  selisih: number | null;
  status: "terbuka" | "tertutup";
}

export interface CartItemInput {
  produk_id: number;
  jumlah: number;
  diskon_item: number;
}

export interface CheckoutInput {
  sesi_kasir_id: number;
  items: CartItemInput[];
  diskon: number;
  metode_bayar: string;
  jumlah_dibayar: number;
}

export interface DraftInput {
  sesi_kasir_id: number;
  items: CartItemInput[];
  diskon: number;
}

export interface TransaksiItemOut {
  id: number;
  produk_id: number | null;
  nama_produk_snapshot: string;
  harga_satuan: number;
  jumlah: number;
  diskon_item: number;
  subtotal_item: number;
}

export interface Transaksi {
  id: number;
  kode_transaksi: string;
  kasir_id: number;
  kasir_nama: string | null;
  sesi_kasir_id: number;
  subtotal: number;
  diskon: number;
  pajak: number;
  total: number;
  metode_bayar: string;
  jumlah_dibayar: number;
  kembalian: number;
  status: "selesai" | "dibatalkan" | "draft";
  created_at: string;
  items: TransaksiItemOut[];
}

export interface CartItem {
  produk: Produk;
  jumlah: number;
  diskonItem: number;
}

export interface StokKoreksiInput {
  produk_id: number;
  jenis: "masuk" | "keluar" | "koreksi";
  jumlah: number;
  keterangan: string | null;
}

export interface LogStok {
  id: number;
  produk_id: number;
  produk_nama: string | null;
  jenis: string;
  jumlah: number;
  keterangan: string | null;
  referensi_transaksi_id: number | null;
  created_at: string;
  dibuat_oleh_nama: string | null;
}

export interface LogAktivitas {
  id: number;
  pengguna_id: number;
  pengguna_nama: string | null;
  aksi: string;
  keterangan: string | null;
  created_at: string;
}

export interface RingkasanPenjualan {
  total_omzet: number;
  jumlah_transaksi: number;
  rata_rata_transaksi: number;
  total_laba_kotor: number;
}

export interface ProdukTerjual {
  produk_id: number;
  nama: string;
  jumlah_terjual: number;
  total_omzet: number;
}

export interface BackupInfo {
  nama_file: string;
  ukuran_bytes: number;
  dibuat_pada: string;
}
