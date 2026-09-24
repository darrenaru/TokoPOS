mod commands;
mod db;
mod error;
mod models;
mod services;
mod state;

use std::sync::Mutex;
use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_handle = app.handle().clone();
            let conn = db::open_connection(&app_handle);
            app.manage(AppState {
                db: Mutex::new(conn),
                current_user: Mutex::new(None),
                app_handle,
                phone_scanner: Mutex::new(None),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::login,
            commands::logout,
            commands::current_session,
            commands::list_produk,
            commands::get_produk_by_barcode,
            commands::create_produk,
            commands::update_produk,
            commands::hapus_produk,
            commands::list_kategori,
            commands::create_kategori,
            commands::get_sesi_aktif,
            commands::buka_sesi,
            commands::tutup_sesi,
            commands::riwayat_sesi,
            commands::checkout,
            commands::riwayat_transaksi,
            commands::simpan_draft,
            commands::list_draft,
            commands::hapus_draft,
            commands::koreksi_stok,
            commands::riwayat_stok,
            commands::produk_stok_menipis,
            commands::get_pengaturan,
            commands::set_pengaturan,
            commands::list_pengguna,
            commands::create_pengguna,
            commands::update_pengguna,
            commands::riwayat_aktivitas,
            commands::laporan_ringkasan,
            commands::laporan_produk_terlaris,
            commands::laporan_produk_kurang_laku,
            commands::backup_sekarang,
            commands::list_backup,
            commands::restore_backup,
            commands::start_phone_scanner,
            commands::stop_phone_scanner,
            commands::status_phone_scanner,
            commands::putuskan_perangkat_hp,
            commands::list_printer_ports,
            commands::cetak_tes_printer,
            commands::cetak_struk_printer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
