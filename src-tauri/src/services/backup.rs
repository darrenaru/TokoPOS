use chrono::Local;
use rusqlite::backup::Backup;
use rusqlite::Connection;
use std::fs;
use std::time::Duration;
use tauri::AppHandle;

use crate::db;
use crate::error::{AppError, AppResult};
use crate::models::BackupInfo;
use crate::state::AppState;

const MAKS_BACKUP: usize = 14;

/// Backup dibuat lewat SQLite Online Backup API (bukan fs::copy) agar konsisten
/// walau database sedang dalam mode WAL dengan transaksi yang berjalan.
pub fn backup_sekarang(app: &AppHandle, conn: &Connection) -> AppResult<String> {
    backup_sekarang_dengan_akhiran(app, conn, "")
}

fn backup_sekarang_dengan_akhiran(app: &AppHandle, conn: &Connection, akhiran: &str) -> AppResult<String> {
    let dir = db::backup_dir(app);
    let filename = format!("tokopos_backup_{}{akhiran}.db", Local::now().format("%Y%m%d_%H%M%S"));
    let dest_path = dir.join(&filename);

    let mut dest = Connection::open(&dest_path)?;
    {
        let backup = Backup::new(conn, &mut dest)?;
        backup.run_to_completion(5, Duration::from_millis(250), None)?;
    }
    drop(dest);

    prune_backup_lama(&dir)?;
    Ok(filename)
}

fn prune_backup_lama(dir: &std::path::Path) -> AppResult<()> {
    let mut entries: Vec<_> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|ext| ext == "db").unwrap_or(false))
        .collect();
    entries.sort_by_key(|e| e.file_name());
    entries.reverse();

    for entry in entries.into_iter().skip(MAKS_BACKUP) {
        let _ = fs::remove_file(entry.path());
    }
    Ok(())
}

pub fn list_backup(app: &AppHandle) -> AppResult<Vec<BackupInfo>> {
    let dir = db::backup_dir(app);
    let mut list = Vec::new();

    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        if entry.path().extension().map(|ext| ext == "db").unwrap_or(false) {
            let metadata = entry.metadata()?;
            let modified: chrono::DateTime<Local> = metadata.modified()?.into();
            list.push(BackupInfo {
                nama_file: entry.file_name().to_string_lossy().to_string(),
                ukuran_bytes: metadata.len(),
                dibuat_pada: modified.to_rfc3339(),
            });
        }
    }

    list.sort_by(|a, b| b.nama_file.cmp(&a.nama_file));
    Ok(list)
}

/// Restore mengganti isi database aktif dengan isi file backup, tanpa perlu
/// merestart aplikasi: koneksi lama dilepas dulu (agar file tidak terkunci),
/// lalu koneksi baru dibuka dan diisi ulang lewat Backup API dari file backup.
pub fn restore_backup(state: &AppState, nama_file: &str) -> AppResult<()> {
    // Hanya nama berkas di dalam folder backup yang diterima (cegah path traversal).
    let nama_valid = std::path::Path::new(nama_file).file_name().is_some_and(|n| n == nama_file)
        && nama_file.ends_with(".db");
    if !nama_valid {
        return Err(AppError::Validasi("Nama berkas backup tidak valid".into()));
    }

    let dir = db::backup_dir(&state.app_handle);
    let backup_path = dir.join(nama_file);
    if !backup_path.exists() {
        return Err(AppError::TidakDitemukan);
    }

    // Pastikan berkas benar-benar database TokoPOS yang utuh sebelum menimpa data aktif.
    let src = Connection::open_with_flags(&backup_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let utuh: String = src
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|_| AppError::Validasi("Berkas backup rusak atau bukan database TokoPOS".into()))?;
    let punya_tabel: i64 = src
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('pengguna', 'produk', 'transaksi')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if utuh != "ok" || punya_tabel != 3 {
        return Err(AppError::Validasi("Berkas backup rusak atau bukan database TokoPOS".into()));
    }

    let real_path = db::db_path(&state.app_handle);
    let mut guard = state.db.lock().unwrap();

    // Cadangan pengaman: kondisi sebelum restore tetap bisa dipulihkan jika hasilnya tidak sesuai harapan.
    backup_sekarang_dengan_akhiran(&state.app_handle, &guard, "_sebelum_restore")?;

    // Lepas handle file database aktif dengan mengganti isi Mutex sementara.
    *guard = Connection::open_in_memory()?;

    let hasil = (|| -> AppResult<()> {
        let mut dest = Connection::open(&real_path)?;
        let backup = Backup::new(&src, &mut dest)?;
        backup.run_to_completion(5, Duration::from_millis(250), None)?;
        Ok(())
    })();

    // Apa pun hasilnya, buka kembali koneksi ke berkas asli (dengan migrasi, karena backup
    // lama bisa berskema lebih lama) supaya aplikasi tidak tertinggal pada database kosong.
    *guard = db::open_at(&real_path)?;
    hasil
}
