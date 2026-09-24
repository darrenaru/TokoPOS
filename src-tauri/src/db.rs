use bcrypt::{hash, DEFAULT_COST};
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

pub fn db_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("gagal menentukan direktori data aplikasi");
    fs::create_dir_all(&dir).expect("gagal membuat direktori data aplikasi");
    dir.join("tokopos.db")
}

pub fn backup_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("gagal menentukan direktori data aplikasi")
        .join("backup");
    fs::create_dir_all(&dir).expect("gagal membuat direktori backup");
    dir
}

pub fn open_connection(app: &tauri::AppHandle) -> Connection {
    open_at(&db_path(app)).expect("gagal membuka database SQLite")
}

/// Membuka database di `path`, lalu memastikan skema terbaru dan akun admin default tersedia.
/// Dipakai saat startup dan setelah restore (backup lama bisa berskema lebih lama).
pub fn open_at(path: &std::path::Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;

    run_migrations(&conn);
    seed_default_admin(&conn);

    Ok(conn)
}

pub(crate) fn run_migrations(conn: &Connection) {
    let user_version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap_or(0);

    if user_version < 1 {
        let schema = include_str!("../migrations/001_init.sql");
        conn.execute_batch(schema)
            .expect("gagal menjalankan migrasi awal database");
        conn.pragma_update(None, "user_version", 1).unwrap();
    }

    if user_version < 2 {
        let schema = include_str!("../migrations/002_log_aktivitas.sql");
        conn.execute_batch(schema)
            .expect("gagal menjalankan migrasi log_aktivitas");
        conn.pragma_update(None, "user_version", 2).unwrap();
    }

    if user_version < 3 {
        let schema = include_str!("../migrations/003_produk_foto.sql");
        conn.execute_batch(schema)
            .expect("gagal menjalankan migrasi foto produk");
        conn.pragma_update(None, "user_version", 3).unwrap();
    }
}

/// Membuat akun admin default (admin / admin123) jika tabel pengguna masih kosong.
/// Hash dibuat saat runtime (bukan disimpan di file migrasi) agar selalu cocok
/// dengan versi algoritma bcrypt yang sedang dipakai aplikasi.
pub(crate) fn seed_default_admin(conn: &Connection) {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM pengguna", [], |row| row.get(0))
        .unwrap_or(0);

    if count == 0 {
        let hash = hash("admin123", DEFAULT_COST).expect("gagal hashing password default");
        conn.execute(
            "INSERT INTO pengguna (nama, username, password_hash, peran, aktif) VALUES (?1, ?2, ?3, 'admin', 1)",
            rusqlite::params!["Administrator", "admin", hash],
        )
        .expect("gagal membuat akun admin default");
    }
}
