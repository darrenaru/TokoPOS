# TokoPOS

Sistem kasir desktop offline-first untuk toko/UMKM.

## Tech Stack

- **Desktop shell:** Tauri v2 (Rust)
- **Frontend:** React + TypeScript + Tailwind CSS v4 + React Router
- **Database:** SQLite lokal (`rusqlite`, bundled — tanpa server terpisah)
- **Auth:** bcrypt, sesi disimpan di memory proses Rust (bukan di browser)

## Fitur

- **Kasir:** grid produk + pencarian, scan barcode (scanner USB/HID atau HP), keranjang, diskon
  (nominal/persen), pajak opsional, pembayaran tunai, draft/transaksi tertunda, cetak struk
  (printer thermal ESC/POS via port serial/Bluetooth, atau simpan PDF).
- **Scan via HP:** HP terhubung lewat QR (WiFi yang sama). Dua mode yang dipilih di HP:
  *Tambah ke Keranjang* (pembelian) dan *Tambah Produk* (form produk lengkap di HP, tersimpan
  langsung ke database; khusus admin). Berbunyi "beep" saat barcode terbaca.
- **Produk & stok (admin):** CRUD produk, kategori, foto, stok minimum, koreksi/stock opname, riwayat stok.
- **Kas:** buka/tutup sesi kasir dan rekonsiliasi selisih.
- **Riwayat transaksi** dengan filter tanggal dan pencarian kode.
- **Laporan (admin):** omzet, jumlah transaksi, laba kotor (estimasi), produk terlaris/kurang laku, ekspor CSV.
- **Pengguna (admin):** akun admin/kasir, log aktivitas.
- **Pengaturan (admin):** info toko, pajak, printer, backup & restore database.

Hak akses: **admin** penuh; **kasir** hanya Kasir, Kas, dan Riwayat Transaksi.

## Menjalankan (Development)

Prasyarat: Node.js, Rust toolchain (`rustup`), dan pada Windows: Visual Studio Build Tools
dengan workload "Desktop development with C++".

```bash
npm install
npm run tauri dev
```

Database dibuat otomatis di direktori data aplikasi (mis. `%APPDATA%/com.tokopos.app/tokopos.db`)
beserta skema dan akun admin default.

**Login default:** `admin` / `admin123` — **ganti passwordnya** lewat menu Pengguna sebelum dipakai.

## Pengecekan kualitas

```bash
npm run build                 # tsc + vite build
npm run lint                  # oxlint
cd src-tauri && cargo clippy --all-targets && cargo test
```

## Build Installer

```bash
npm run tauri build
```

Hasil: `src-tauri/target/release/bundle/` (MSI dan NSIS).

## Struktur Proyek

```
src/                       # Frontend React
  ui/screens/              # Kasir, Produk, Stok, Kas, Riwayat, Laporan, Pengguna, Pengaturan, Login
  ui/components/           # Komponen bersama (CartPanel, ProductGrid, modal, dll.)
  services/api.ts          # Wrapper tipis ke Tauri invoke()
  context/                 # AuthContext
  utils/                   # Format rupiah, tanggal lokal, beep, gambar, dll.
  types/                   # Tipe TypeScript yang mencerminkan model Rust

src-tauri/
  src/commands.rs          # Tauri command (lapisan yang diexpose ke frontend, cek peran)
  src/services/            # Business logic: auth, produk, transaksi, stok, kas, laporan,
                           # pengguna, pengaturan, backup, printer, phone_scanner
  src/db.rs                # Koneksi SQLite, migrasi, seed admin default
  migrations/              # Skema database (001 awal, 002 log aktivitas, 003 foto produk)
  scanner/                 # Halaman web scanner untuk HP (dilayani server lokal HTTPS)
```

## Catatan

- Server scanner HP memakai HTTPS dengan sertifikat self-signed; browser HP akan menampilkan
  peringatan sekali (pilih Lanjutkan/Advanced → Proceed). Kamera mensyaratkan HTTPS.
- Laba kotor memakai harga beli produk saat ini (bukan snapshot historis).
- Metode pembayaran yang didukung saat ini hanya tunai.
