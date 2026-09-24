use chrono::{DateTime, Datelike, Local};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::time::Duration;

use crate::error::{AppError, AppResult};
use crate::models::Transaksi;

/// Opsi cetak yang dipilih pengguna di dialog Cetak Struk.
#[derive(Deserialize)]
pub struct CetakOpsi {
    pub port: String,
    pub lebar: usize,
    pub salinan: u8,
    pub logo: bool,
    pub pesan: bool,
}

const LOGO_PNG: &[u8] = include_bytes!("../../../public/logo-mark.png");

/// Mengubah logo menjadi bitmap 1-bit (dithering Bayer) dalam format raster ESC/POS (GS v 0).
fn logo_raster(lebar_titik: u32) -> Option<Vec<u8>> {
    use image::imageops::FilterType;
    let img = image::load_from_memory_with_format(LOGO_PNG, image::ImageFormat::Png).ok()?.to_rgba8();
    let (w, h) = img.dimensions();
    let tinggi = ((h as f32) * (lebar_titik as f32) / (w as f32)).round().max(1.0) as u32;
    let kecil = image::imageops::resize(&img, lebar_titik, tinggi, FilterType::Triangle);
    let byte_per_baris = lebar_titik.div_ceil(8);
    let bayer: [[u8; 4]; 4] = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    let mut data = vec![0u8; (byte_per_baris * tinggi) as usize];
    for y in 0..tinggi {
        for x in 0..lebar_titik {
            let p = kecil.get_pixel(x, y);
            if p[3] < 128 {
                continue; // latar transparan = kertas kosong
            }
            let lum = 0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32;
            let gelap = ((255.0 - lum) * 1.9).clamp(0.0, 255.0);
            let ambang = (bayer[(y % 4) as usize][(x % 4) as usize] as f32 + 0.5) / 16.0 * 255.0;
            if gelap > ambang {
                data[(y * byte_per_baris + x / 8) as usize] |= 0x80 >> (x % 8);
            }
        }
    }
    let mut out = vec![0x1D, 0x76, 0x30, 0x00];
    out.extend_from_slice(&(byte_per_baris as u16).to_le_bytes());
    out.extend_from_slice(&(tinggi as u16).to_le_bytes());
    out.extend_from_slice(&data);
    Some(out)
}

#[derive(Serialize)]
pub struct PortInfo {
    pub nama: String,
    pub deskripsi: String,
}

pub fn daftar_port() -> AppResult<Vec<PortInfo>> {
    let ports = serialport::available_ports()
        .map_err(|e| AppError::Validasi(format!("Gagal membaca daftar port: {e}")))?;
    let mut hasil: Vec<PortInfo> = ports
        .into_iter()
        .map(|p| {
            let deskripsi = match &p.port_type {
                serialport::SerialPortType::BluetoothPort => "Bluetooth".to_string(),
                serialport::SerialPortType::UsbPort(u) => {
                    format!("USB {}", u.product.clone().unwrap_or_default()).trim().to_string()
                }
                serialport::SerialPortType::PciPort => "PCI".to_string(),
                serialport::SerialPortType::Unknown => "Serial".to_string(),
            };
            PortInfo { nama: p.port_name, deskripsi }
        })
        .collect();
    hasil.sort_by(|a, b| a.nama.cmp(&b.nama));
    Ok(hasil)
}

/// Mengirim byte ESC/POS langsung ke port serial (printer thermal Bluetooth SPP atau USB serial).
pub fn kirim(port: &str, data: &[u8]) -> AppResult<()> {
    let mut sp = serialport::new(port, 9600)
        .timeout(Duration::from_secs(8))
        .open()
        .map_err(|e| {
            AppError::Validasi(format!(
                "Tidak bisa terhubung ke printer di {port}. Pastikan printer menyala, dalam jangkauan, dan sudah dipasangkan lewat Bluetooth Windows. ({e})"
            ))
        })?;
    sp.write_all(data)
        .map_err(|e| AppError::Validasi(format!("Gagal mengirim data ke printer: {e}")))?;
    sp.flush()
        .map_err(|e| AppError::Validasi(format!("Gagal mengirim data ke printer: {e}")))?;
    // Beri waktu buffer Bluetooth terkirim sebelum koneksi ditutup.
    std::thread::sleep(Duration::from_millis(1200));
    Ok(())
}

struct Escpos {
    buf: Vec<u8>,
    lebar: usize,
}

impl Escpos {
    fn baru(lebar: usize) -> Self {
        let mut e = Escpos { buf: Vec::new(), lebar };
        e.buf.extend_from_slice(&[0x1B, 0x40]); // inisialisasi
        e
    }

    fn rata(&mut self, tengah: bool) {
        self.buf.extend_from_slice(&[0x1B, 0x61, if tengah { 1 } else { 0 }]);
    }

    fn tebal(&mut self, aktif: bool) {
        self.buf.extend_from_slice(&[0x1B, 0x45, aktif as u8]);
    }

    fn ganda(&mut self, aktif: bool) {
        // GS ! n : n=0x11 lebar & tinggi 2x
        self.buf.extend_from_slice(&[0x1D, 0x21, if aktif { 0x11 } else { 0x00 }]);
    }

    fn teks(&mut self, s: &str) {
        for c in s.chars() {
            self.buf.push(if c.is_ascii() && (c as u32 >= 32 || c == '\n') { c as u8 } else { b'?' });
        }
    }

    fn baris(&mut self, s: &str) {
        self.teks(s);
        self.buf.push(b'\n');
    }

    fn tengah(&mut self, s: &str) {
        self.rata(true);
        for potong in bungkus(s, self.lebar) {
            self.baris(&potong);
        }
        self.rata(false);
    }

    fn garis(&mut self) {
        let g = "-".repeat(self.lebar);
        self.baris(&g);
    }

    fn kiri_kanan(&mut self, kiri: &str, kanan: &str) {
        let sisa = self.lebar.saturating_sub(kanan.chars().count() + 1);
        let kiri: String = kiri.chars().take(sisa).collect();
        let spasi = self.lebar.saturating_sub(kiri.chars().count() + kanan.chars().count());
        self.baris(&format!("{kiri}{}{kanan}", " ".repeat(spasi)));
    }

    fn selesai(mut self) -> Vec<u8> {
        self.buf.extend_from_slice(b"\n\n\n\n");
        self.buf
    }
}

/// Membungkus teks per kata; kata yang lebih panjang dari satu baris dipotong paksa.
fn bungkus(s: &str, lebar: usize) -> Vec<String> {
    let lebar = lebar.max(1);
    let mut baris: Vec<String> = Vec::new();
    let mut saat_ini = String::new();
    for kata in s.split_whitespace() {
        let mut kata: Vec<char> = kata.chars().collect();
        while kata.len() > lebar {
            if !saat_ini.is_empty() {
                baris.push(std::mem::take(&mut saat_ini));
            }
            baris.push(kata.drain(..lebar).collect());
        }
        let kata: String = kata.into_iter().collect();
        if kata.is_empty() {
            continue;
        }
        if saat_ini.is_empty() {
            saat_ini = kata;
        } else if saat_ini.chars().count() + 1 + kata.chars().count() <= lebar {
            saat_ini.push(' ');
            saat_ini.push_str(&kata);
        } else {
            baris.push(std::mem::replace(&mut saat_ini, kata));
        }
    }
    if !saat_ini.is_empty() {
        baris.push(saat_ini);
    }
    if baris.is_empty() {
        baris.push(String::new());
    }
    baris
}

fn angka(n: f64) -> String {
    let bulat = n.round() as i64;
    let negatif = bulat < 0;
    let digit = bulat.abs().to_string();
    let mut hasil = String::new();
    for (i, c) in digit.chars().enumerate() {
        if i > 0 && (digit.len() - i) % 3 == 0 {
            hasil.push('.');
        }
        hasil.push(c);
    }
    if negatif { format!("-{hasil}") } else { hasil }
}

fn rupiah(n: f64) -> String {
    format!("Rp{}", angka(n))
}

pub fn bangun_tes(lebar: usize) -> Vec<u8> {
    let mut e = Escpos::baru(lebar);
    e.tebal(true);
    e.ganda(true);
    e.tengah("TOKOPOS");
    e.ganda(false);
    e.tebal(false);
    e.tengah("Tes cetak printer Bluetooth");
    e.garis();
    e.kiri_kanan("Aqua Botol 600ml", "5.000");
    e.kiri_kanan("TOTAL", "Rp 5.000");
    e.garis();
    e.tengah("Printer siap digunakan");
    e.selesai()
}

pub fn bangun_struk(trx: &Transaksi, toko: &HashMap<String, String>, opsi: &CetakOpsi) -> Vec<u8> {
    let lebar = opsi.lebar.clamp(20, 64);
    let catatan = toko.get("struk_catatan").map(String::as_str).unwrap_or("");
    let nama_toko = toko.get("nama_toko").map(String::as_str).unwrap_or("Toko");
    let alamat = toko.get("alamat_toko").map(String::as_str).unwrap_or("");
    let telepon = toko.get("telepon_toko").map(String::as_str).unwrap_or("");

    let waktu = DateTime::parse_from_rfc3339(&trx.created_at)
        .map(|d| {
            let d = d.with_timezone(&Local);
            const BULAN: [&str; 12] = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
            format!("{} {} {} {}", d.format("%d"), BULAN[d.month0() as usize], d.format("%Y"), d.format("%H:%M"))
        })
        .unwrap_or_else(|_| trx.created_at.clone());

    let mut e = Escpos::baru(lebar);
    if opsi.logo {
        let titik = if lebar >= 40 { 150 } else { 112 };
        if let Some(raster) = logo_raster(titik) {
            e.rata(true);
            e.buf.extend_from_slice(&raster);
            e.buf.push(b'\n');
            e.rata(false);
        }
    }
    e.tebal(true);
    e.tengah(nama_toko);
    e.tebal(false);
    if !alamat.is_empty() {
        e.tengah(alamat);
    }
    if !telepon.is_empty() {
        e.tengah(&format!("Telp {telepon}"));
    }
    e.garis();
    e.kiri_kanan("No. Nota", &trx.kode_transaksi);
    e.kiri_kanan("Waktu", &waktu);
    e.kiri_kanan("Kasir", &trx.kasir_nama.clone().unwrap_or_default());
    e.garis();

    for item in &trx.items {
        for potong in bungkus(&item.nama_produk_snapshot, lebar) {
            e.baris(&potong);
        }
        e.kiri_kanan(
            &format!("{} x {}", item.jumlah, rupiah(item.harga_satuan)),
            &rupiah(item.jumlah as f64 * item.harga_satuan),
        );
        if item.diskon_item > 0.0 {
            e.kiri_kanan("Diskon item", &format!("-{}", rupiah(item.diskon_item)));
        }
    }

    e.garis();
    if trx.diskon > 0.0 || trx.pajak > 0.0 {
        e.kiri_kanan("Subtotal", &rupiah(trx.subtotal));
    }
    if trx.diskon > 0.0 {
        e.kiri_kanan("Diskon", &format!("-{}", rupiah(trx.diskon)));
    }
    if trx.pajak > 0.0 {
        e.kiri_kanan("Pajak", &rupiah(trx.pajak));
    }
    e.tebal(true);
    e.kiri_kanan("TOTAL", &rupiah(trx.total));
    e.tebal(false);
    let metode = if trx.metode_bayar == "tunai" { "Tunai".to_string() } else { trx.metode_bayar.clone() };
    e.kiri_kanan(&metode, &rupiah(trx.jumlah_dibayar));
    e.kiri_kanan("Kembali", &rupiah(trx.kembalian));
    e.garis();
    if opsi.pesan {
        e.tengah("Terima kasih atas kunjungan Anda");
    }
    if !catatan.is_empty() {
        e.tengah(catatan);
    }
    e.selesai()
}

/// Menyusun data cetak lengkap (termasuk pengulangan untuk jumlah salinan).
pub fn susun_cetak(trx: &Transaksi, toko: &HashMap<String, String>, opsi: &CetakOpsi) -> Vec<u8> {
    let satu = bangun_struk(trx, toko, opsi);
    let salinan = opsi.salinan.clamp(1, 5) as usize;
    let mut semua = Vec::with_capacity(satu.len() * salinan);
    for _ in 0..salinan {
        semua.extend_from_slice(&satu);
    }
    semua
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TransaksiItemOut;

    fn contoh() -> Transaksi {
        Transaksi {
            id: 1,
            kode_transaksi: "TRX-20260924-0001".into(),
            kasir_id: 1,
            kasir_nama: Some("Administrator".into()),
            sesi_kasir_id: 1,
            subtotal: 37500.0,
            diskon: 2500.0,
            pajak: 3850.0,
            total: 38850.0,
            metode_bayar: "tunai".into(),
            jumlah_dibayar: 50000.0,
            kembalian: 11150.0,
            status: "selesai".into(),
            created_at: "2026-09-24T04:41:00.000Z".into(),
            items: vec![
                TransaksiItemOut { id: 1, produk_id: Some(1), nama_produk_snapshot: "Aqua Botol 600ml".into(), harga_satuan: 5000.0, jumlah: 3, diskon_item: 0.0, subtotal_item: 15000.0 },
                TransaksiItemOut { id: 2, produk_id: Some(2), nama_produk_snapshot: "Indomie Goreng Special Jumbo Pedas Manis".into(), harga_satuan: 3500.0, jumlah: 5, diskon_item: 0.0, subtotal_item: 17500.0 },
                TransaksiItemOut { id: 3, produk_id: Some(3), nama_produk_snapshot: "Nivea".into(), harga_satuan: 6000.0, jumlah: 1, diskon_item: 1000.0, subtotal_item: 5000.0 },
            ],
        }
    }

    #[test]
    fn struk_contoh_tertulis_ke_file() {
        let mut toko = HashMap::new();
        toko.insert("nama_toko".to_string(), "Toko Maju Jaya".to_string());
        toko.insert("alamat_toko".to_string(), "Jl. Merdeka No. 12, Jakarta".to_string());
        toko.insert("telepon_toko".to_string(), "0812-3456-7890".to_string());
        toko.insert("struk_catatan".to_string(), "Barang yang sudah dibeli tidak dapat ditukar".to_string());
        let opsi = CetakOpsi { port: "COM4".into(), lebar: 32, salinan: 1, logo: true, pesan: true };
        let data = susun_cetak(&contoh(), &toko, &opsi);
        assert!(data.starts_with(&[0x1B, 0x40]));
        let teks: String = data.iter().filter(|b| **b >= 32 || **b == b'\n').map(|b| *b as char).collect();
        assert!(teks.contains("Rp38.850"));
        assert!(teks.contains("Rp11.150"));
        if let Ok(path) = std::env::var("STRUK_OUT") {
            std::fs::write(path, &data).unwrap();
        }
        println!("{teks}");
    }
}
