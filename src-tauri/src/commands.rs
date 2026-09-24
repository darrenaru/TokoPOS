use std::collections::HashMap;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{
    BackupInfo, CheckoutInput, DraftInput, Kategori, LogAktivitas, LogStok, Pengguna, PenggunaInput,
    PenggunaUpdateInput, Produk, ProdukInput, ProdukTerjual, RingkasanPenjualan, SesiKasir, StokKoreksiInput,
    Transaksi,
};
use crate::services;
use crate::state::AppState;

fn current_user(state: &State<AppState>) -> AppResult<Pengguna> {
    state
        .current_user
        .lock()
        .unwrap()
        .clone()
        .ok_or(AppError::BelumLogin)
}

fn require_admin(state: &State<AppState>) -> AppResult<Pengguna> {
    let user = current_user(state)?;
    if user.peran != "admin" {
        return Err(AppError::AksesDitolak);
    }
    Ok(user)
}

// ---------- Auth ----------

#[tauri::command]
pub fn login(state: State<AppState>, username: String, password: String) -> AppResult<Pengguna> {
    let conn = state.db.lock().unwrap();
    let user = services::auth::login(&conn, &username, &password)?;
    *state.current_user.lock().unwrap() = Some(user.clone());
    Ok(user)
}

#[tauri::command]
pub fn logout(state: State<AppState>) {
    *state.current_user.lock().unwrap() = None;
    // Server scanner HP tidak boleh tetap terbuka di jaringan setelah kasir keluar.
    services::phone_scanner::stop(&mut state.phone_scanner.lock().unwrap());
}

#[tauri::command]
pub fn current_session(state: State<AppState>) -> Option<Pengguna> {
    state.current_user.lock().unwrap().clone()
}

// ---------- Produk ----------

#[tauri::command]
pub fn list_produk(state: State<AppState>, hanya_aktif: bool) -> AppResult<Vec<Produk>> {
    current_user(&state)?;
    let conn = state.db.lock().unwrap();
    services::produk::list(&conn, hanya_aktif)
}

#[tauri::command]
pub fn get_produk_by_barcode(state: State<AppState>, barcode: String) -> AppResult<Option<Produk>> {
    current_user(&state)?;
    let conn = state.db.lock().unwrap();
    services::produk::get_by_barcode(&conn, &barcode)
}

#[tauri::command]
pub fn create_produk(state: State<AppState>, input: ProdukInput) -> AppResult<i64> {
    let user = require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    let nama = input.nama.clone();
    let id = services::produk::create(&conn, user.id, input)?;
    let _ = services::log_aktivitas::catat(&conn, user.id, "tambah_produk", Some(nama));
    Ok(id)
}

#[tauri::command]
pub fn update_produk(state: State<AppState>, id: i64, input: ProdukInput) -> AppResult<()> {
    let user = require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    let nama = input.nama.clone();
    services::produk::update(&conn, id, input)?;
    let _ = services::log_aktivitas::catat(&conn, user.id, "ubah_produk", Some(nama));
    Ok(())
}

#[tauri::command]
pub fn hapus_produk(state: State<AppState>, id: i64) -> AppResult<()> {
    let user = require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::produk::hapus(&conn, id)?;
    let _ = services::log_aktivitas::catat(&conn, user.id, "hapus_produk", Some(format!("id={id}")));
    Ok(())
}

#[tauri::command]
pub fn list_kategori(state: State<AppState>) -> AppResult<Vec<Kategori>> {
    current_user(&state)?;
    let conn = state.db.lock().unwrap();
    services::produk::list_kategori(&conn)
}

#[tauri::command]
pub fn create_kategori(state: State<AppState>, nama: String) -> AppResult<i64> {
    require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::produk::create_kategori(&conn, &nama)
}

// ---------- Kas ----------

#[tauri::command]
pub fn get_sesi_aktif(state: State<AppState>) -> AppResult<Option<SesiKasir>> {
    let user = current_user(&state)?;
    let conn = state.db.lock().unwrap();
    services::kas::get_sesi_aktif(&conn, user.id)
}

#[tauri::command]
pub fn buka_sesi(state: State<AppState>, modal_awal: f64) -> AppResult<SesiKasir> {
    let user = current_user(&state)?;
    let conn = state.db.lock().unwrap();
    let sesi = services::kas::buka_sesi(&conn, user.id, modal_awal)?;
    let _ = services::log_aktivitas::catat(
        &conn,
        user.id,
        "buka_kasir",
        Some(format!("Modal awal {modal_awal}")),
    );
    Ok(sesi)
}

#[tauri::command]
pub fn tutup_sesi(state: State<AppState>, sesi_id: i64, total_kas_aktual: f64) -> AppResult<SesiKasir> {
    let user = current_user(&state)?;
    let conn = state.db.lock().unwrap();
    let sesi = services::kas::tutup_sesi(&conn, user.id, sesi_id, total_kas_aktual)?;
    let _ = services::log_aktivitas::catat(
        &conn,
        user.id,
        "tutup_kasir",
        Some(format!("Selisih {}", sesi.selisih.unwrap_or(0.0))),
    );
    Ok(sesi)
}

#[tauri::command]
pub fn riwayat_sesi(state: State<AppState>) -> AppResult<Vec<SesiKasir>> {
    current_user(&state)?;
    let conn = state.db.lock().unwrap();
    services::kas::riwayat_sesi(&conn, 100)
}

// ---------- Transaksi ----------

#[tauri::command]
pub fn checkout(state: State<AppState>, input: CheckoutInput) -> AppResult<Transaksi> {
    let user = current_user(&state)?;
    let mut conn = state.db.lock().unwrap();
    services::transaksi::checkout(&mut conn, user.id, input)
}

#[tauri::command]
pub fn riwayat_transaksi(
    state: State<AppState>,
    dari: Option<String>,
    sampai: Option<String>,
    keyword: Option<String>,
) -> AppResult<Vec<Transaksi>> {
    current_user(&state)?;
    let conn = state.db.lock().unwrap();
    services::transaksi::riwayat(&conn, dari, sampai, keyword)
}

#[tauri::command]
pub fn simpan_draft(state: State<AppState>, input: DraftInput) -> AppResult<Transaksi> {
    let user = current_user(&state)?;
    let mut conn = state.db.lock().unwrap();
    services::transaksi::simpan_draft(&mut conn, user.id, input)
}

#[tauri::command]
pub fn list_draft(state: State<AppState>) -> AppResult<Vec<Transaksi>> {
    let user = current_user(&state)?;
    let conn = state.db.lock().unwrap();
    services::transaksi::list_draft(&conn, user.id)
}

#[tauri::command]
pub fn hapus_draft(state: State<AppState>, id: i64) -> AppResult<()> {
    let user = current_user(&state)?;
    let conn = state.db.lock().unwrap();
    services::transaksi::hapus_draft(&conn, user.id, id)
}

// ---------- Stok ----------

#[tauri::command]
pub fn koreksi_stok(state: State<AppState>, input: StokKoreksiInput) -> AppResult<()> {
    let user = require_admin(&state)?;
    let mut conn = state.db.lock().unwrap();
    services::stok::koreksi(&mut conn, user.id, input)
}

#[tauri::command]
pub fn riwayat_stok(state: State<AppState>, produk_id: Option<i64>) -> AppResult<Vec<LogStok>> {
    require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::stok::riwayat(&conn, produk_id, 200)
}

#[tauri::command]
pub fn produk_stok_menipis(state: State<AppState>) -> AppResult<Vec<Produk>> {
    require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::stok::produk_stok_menipis(&conn)
}

// ---------- Pengaturan ----------

#[tauri::command]
pub fn get_pengaturan(state: State<AppState>) -> AppResult<HashMap<String, String>> {
    current_user(&state)?;
    let conn = state.db.lock().unwrap();
    services::pengaturan::get_all(&conn)
}

#[tauri::command]
pub fn set_pengaturan(state: State<AppState>, values: HashMap<String, String>) -> AppResult<()> {
    require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::pengaturan::set_many(&conn, values)
}

// ---------- Pengguna ----------

#[tauri::command]
pub fn list_pengguna(state: State<AppState>) -> AppResult<Vec<Pengguna>> {
    require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::pengguna::list(&conn)
}

#[tauri::command]
pub fn create_pengguna(state: State<AppState>, input: PenggunaInput) -> AppResult<i64> {
    let admin = require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    let username = input.username.clone();
    let id = services::pengguna::create(&conn, input)?;
    let _ = services::log_aktivitas::catat(&conn, admin.id, "tambah_pengguna", Some(username));
    Ok(id)
}

#[tauri::command]
pub fn update_pengguna(state: State<AppState>, id: i64, input: PenggunaUpdateInput) -> AppResult<()> {
    let admin = require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::pengguna::update(&conn, admin.id, id, input)?;
    let _ = services::log_aktivitas::catat(&conn, admin.id, "ubah_pengguna", Some(format!("id={id}")));
    // Sesi login disimpan di memory; segarkan bila admin mengubah akunnya sendiri (nama/peran).
    if id == admin.id {
        *state.current_user.lock().unwrap() = Some(services::pengguna::get(&conn, id)?);
        // Hak scanner HP (mis. tambah produk) ditetapkan saat dinyalakan; matikan agar tidak melampaui peran baru.
        services::phone_scanner::stop(&mut state.phone_scanner.lock().unwrap());
    }
    Ok(())
}

// ---------- Log Aktivitas ----------

#[tauri::command]
pub fn riwayat_aktivitas(state: State<AppState>) -> AppResult<Vec<LogAktivitas>> {
    require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::log_aktivitas::riwayat(&conn, 300)
}

// ---------- Laporan ----------

#[tauri::command]
pub fn laporan_ringkasan(state: State<AppState>, dari: String, sampai: String) -> AppResult<RingkasanPenjualan> {
    require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::laporan::ringkasan(&conn, &dari, &sampai)
}

#[tauri::command]
pub fn laporan_produk_terlaris(state: State<AppState>, dari: String, sampai: String) -> AppResult<Vec<ProdukTerjual>> {
    require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::laporan::produk_terlaris(&conn, &dari, &sampai, 10)
}

#[tauri::command]
pub fn laporan_produk_kurang_laku(
    state: State<AppState>,
    dari: String,
    sampai: String,
) -> AppResult<Vec<ProdukTerjual>> {
    require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    services::laporan::produk_kurang_laku(&conn, &dari, &sampai, 10)
}

// ---------- Backup ----------

#[tauri::command]
pub fn backup_sekarang(state: State<AppState>) -> AppResult<String> {
    let user = require_admin(&state)?;
    let conn = state.db.lock().unwrap();
    let nama_file = services::backup::backup_sekarang(&state.app_handle, &conn)?;
    let _ = services::log_aktivitas::catat(&conn, user.id, "backup_database", Some(nama_file.clone()));
    Ok(nama_file)
}

#[tauri::command]
pub fn list_backup(state: State<AppState>) -> AppResult<Vec<BackupInfo>> {
    require_admin(&state)?;
    services::backup::list_backup(&state.app_handle)
}

#[tauri::command]
pub fn restore_backup(state: State<AppState>, nama_file: String) -> AppResult<()> {
    let admin = require_admin(&state)?;
    services::backup::restore_backup(&state, &nama_file)?;
    // dicatat setelah restore karena koneksi database (termasuk tabel log_aktivitas) baru saja diganti.
    // Gagal dicatat bila akun admin ini tidak ada di backup — tidak masalah.
    {
        let conn = state.db.lock().unwrap();
        let _ = services::log_aktivitas::catat(&conn, admin.id, "restore_database", Some(nama_file));
    }
    // Akun, peran, dan sesi kasir di database hasil restore bisa berbeda: paksa login ulang.
    *state.current_user.lock().unwrap() = None;
    services::phone_scanner::stop(&mut state.phone_scanner.lock().unwrap());
    Ok(())
}

// ---------- Scanner HP ----------

#[tauri::command]
pub async fn start_phone_scanner(
    state: State<'_, AppState>,
) -> AppResult<services::phone_scanner::ScannerInfo> {
    let user = current_user(&state)?;
    {
        let runtime = state.phone_scanner.lock().unwrap();
        if runtime.is_some() {
            return Ok(services::phone_scanner::info(&runtime));
        }
    }
    let baru = services::phone_scanner::start(&state.app_handle, user.id, user.peran == "admin").await?;
    let mut runtime = state.phone_scanner.lock().unwrap();
    *runtime = Some(baru);
    Ok(services::phone_scanner::info(&runtime))
}

#[tauri::command]
pub fn stop_phone_scanner(state: State<AppState>) -> AppResult<()> {
    current_user(&state)?;
    services::phone_scanner::stop(&mut state.phone_scanner.lock().unwrap());
    Ok(())
}

#[tauri::command]
pub fn status_phone_scanner(state: State<AppState>) -> AppResult<services::phone_scanner::ScannerInfo> {
    current_user(&state)?;
    Ok(services::phone_scanner::info(&state.phone_scanner.lock().unwrap()))
}

#[tauri::command]
pub fn putuskan_perangkat_hp(state: State<AppState>, id: u64) -> AppResult<()> {
    current_user(&state)?;
    services::phone_scanner::putuskan_perangkat(&state.phone_scanner.lock().unwrap(), id);
    Ok(())
}

// ---------- Printer thermal ----------

#[tauri::command]
pub fn list_printer_ports(state: State<AppState>) -> AppResult<Vec<services::printer::PortInfo>> {
    current_user(&state)?;
    services::printer::daftar_port()
}

#[tauri::command]
pub async fn cetak_tes_printer(state: State<'_, AppState>, port: String, lebar: usize) -> AppResult<()> {
    current_user(&state)?;
    if port.trim().is_empty() {
        return Err(AppError::Validasi("Pilih port printer terlebih dahulu".into()));
    }
    let data = services::printer::bangun_tes(lebar.clamp(20, 64));
    tauri::async_runtime::spawn_blocking(move || services::printer::kirim(&port, &data))
        .await
        .map_err(|e| AppError::Validasi(e.to_string()))?
}

#[tauri::command]
pub async fn cetak_struk_printer(
    state: State<'_, AppState>,
    id: i64,
    opsi: services::printer::CetakOpsi,
) -> AppResult<()> {
    current_user(&state)?;
    if opsi.port.trim().is_empty() {
        return Err(AppError::Validasi("Printer belum dipilih.".into()));
    }
    let (trx, set) = {
        let conn = state.db.lock().unwrap();
        (services::transaksi::get_by_id(&conn, id)?, services::pengaturan::get_all(&conn)?)
    };
    let port = opsi.port.clone();
    let data = services::printer::susun_cetak(&trx, &set, &opsi);
    tauri::async_runtime::spawn_blocking(move || services::printer::kirim(&port, &data))
        .await
        .map_err(|e| AppError::Validasi(e.to_string()))?
}
