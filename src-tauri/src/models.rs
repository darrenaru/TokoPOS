use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Kategori {
    pub id: i64,
    pub nama: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Produk {
    pub id: i64,
    pub nama: String,
    pub barcode: Option<String>,
    pub kategori_id: Option<i64>,
    pub kategori_nama: Option<String>,
    pub harga_beli: f64,
    pub harga_jual: f64,
    pub stok: i64,
    pub stok_minimum: i64,
    pub satuan: String,
    pub aktif: bool,
    pub created_at: String,
    pub updated_at: String,
    pub foto: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProdukInput {
    pub nama: String,
    pub barcode: Option<String>,
    pub kategori_id: Option<i64>,
    pub harga_beli: f64,
    pub harga_jual: f64,
    pub stok: i64,
    pub stok_minimum: i64,
    pub satuan: String,
    pub foto: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pengguna {
    pub id: i64,
    pub nama: String,
    pub username: String,
    pub peran: String,
    pub aktif: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PenggunaInput {
    pub nama: String,
    pub username: String,
    pub password: String,
    pub peran: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PenggunaUpdateInput {
    pub nama: String,
    pub peran: String,
    pub aktif: bool,
    /// Kosongkan (string kosong) jika tidak ingin mengubah password.
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SesiKasir {
    pub id: i64,
    pub kasir_id: i64,
    pub kasir_nama: Option<String>,
    pub waktu_buka: String,
    pub waktu_tutup: Option<String>,
    pub modal_awal: f64,
    pub total_kas_sistem: Option<f64>,
    pub total_kas_aktual: Option<f64>,
    pub selisih: Option<f64>,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CartItemInput {
    pub produk_id: i64,
    pub jumlah: i64,
    pub diskon_item: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CheckoutInput {
    pub sesi_kasir_id: i64,
    pub items: Vec<CartItemInput>,
    pub diskon: f64,
    pub metode_bayar: String,
    pub jumlah_dibayar: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DraftInput {
    pub sesi_kasir_id: i64,
    pub items: Vec<CartItemInput>,
    pub diskon: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransaksiItemOut {
    pub id: i64,
    pub produk_id: Option<i64>,
    pub nama_produk_snapshot: String,
    pub harga_satuan: f64,
    pub jumlah: i64,
    pub diskon_item: f64,
    pub subtotal_item: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Transaksi {
    pub id: i64,
    pub kode_transaksi: String,
    pub kasir_id: i64,
    pub kasir_nama: Option<String>,
    pub sesi_kasir_id: i64,
    pub subtotal: f64,
    pub diskon: f64,
    pub pajak: f64,
    pub total: f64,
    pub metode_bayar: String,
    pub jumlah_dibayar: f64,
    pub kembalian: f64,
    pub status: String,
    pub created_at: String,
    pub items: Vec<TransaksiItemOut>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StokKoreksiInput {
    pub produk_id: i64,
    pub jenis: String, // masuk | keluar | koreksi
    pub jumlah: i64,
    pub keterangan: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LogAktivitas {
    pub id: i64,
    pub pengguna_id: i64,
    pub pengguna_nama: Option<String>,
    pub aksi: String,
    pub keterangan: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RingkasanPenjualan {
    pub total_omzet: f64,
    pub jumlah_transaksi: i64,
    pub rata_rata_transaksi: f64,
    pub total_laba_kotor: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProdukTerjual {
    pub produk_id: i64,
    pub nama: String,
    pub jumlah_terjual: i64,
    pub total_omzet: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupInfo {
    pub nama_file: String,
    pub ukuran_bytes: u64,
    pub dibuat_pada: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LogStok {
    pub id: i64,
    pub produk_id: i64,
    pub produk_nama: Option<String>,
    pub jenis: String,
    pub jumlah: i64,
    pub keterangan: Option<String>,
    pub referensi_transaksi_id: Option<i64>,
    pub created_at: String,
    pub dibuat_oleh_nama: Option<String>,
}
