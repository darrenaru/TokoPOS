use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::{Pengguna, PenggunaInput, PenggunaUpdateInput};

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<Pengguna> {
    Ok(Pengguna {
        id: row.get(0)?,
        nama: row.get(1)?,
        username: row.get(2)?,
        peran: row.get(3)?,
        aktif: row.get(4)?,
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<Pengguna>> {
    let mut stmt = conn.prepare("SELECT id, nama, username, peran, aktif FROM pengguna ORDER BY nama ASC")?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn validasi_peran(peran: &str) -> AppResult<()> {
    if peran != "admin" && peran != "kasir" {
        return Err(AppError::Validasi("Peran harus admin atau kasir".into()));
    }
    Ok(())
}

pub fn create(conn: &Connection, input: PenggunaInput) -> AppResult<i64> {
    if input.nama.trim().is_empty() || input.username.trim().is_empty() {
        return Err(AppError::Validasi("Nama dan username wajib diisi".into()));
    }
    if input.password.len() < 6 {
        return Err(AppError::Validasi("Password minimal 6 karakter".into()));
    }
    validasi_peran(&input.peran)?;

    let hash = bcrypt::hash(&input.password, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::Validasi("Gagal memproses password".into()))?;

    conn.execute(
        "INSERT INTO pengguna (nama, username, password_hash, peran, aktif) VALUES (?1, ?2, ?3, ?4, 1)",
        params![input.nama.trim(), input.username.trim(), hash, input.peran],
    )
    .map_err(|e| match e {
        rusqlite::Error::SqliteFailure(err, _) if err.extended_code == 2067 => {
            AppError::Validasi("Username sudah digunakan".into())
        }
        other => other.into(),
    })?;

    Ok(conn.last_insert_rowid())
}

/// Mengembalikan data pengguna terbaru (dipakai untuk menyegarkan sesi login di memory).
pub fn get(conn: &Connection, id: i64) -> AppResult<Pengguna> {
    conn.query_row("SELECT id, nama, username, peran, aktif FROM pengguna WHERE id = ?1", params![id], map_row)
        .optional()?
        .ok_or(AppError::TidakDitemukan)
}

pub fn update(conn: &Connection, oleh_id: i64, id: i64, input: PenggunaUpdateInput) -> AppResult<()> {
    if input.nama.trim().is_empty() {
        return Err(AppError::Validasi("Nama wajib diisi".into()));
    }
    validasi_peran(&input.peran)?;

    // Cegah kondisi tanpa admin aktif: tidak ada lagi yang bisa mengelola aplikasi.
    let sebelum = get(conn, id)?;
    let tetap_admin_aktif = input.peran == "admin" && input.aktif;
    if sebelum.peran == "admin" && sebelum.aktif && !tetap_admin_aktif {
        let admin_lain: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pengguna WHERE peran = 'admin' AND aktif = 1 AND id != ?1",
            params![id],
            |row| row.get(0),
        )?;
        if admin_lain == 0 {
            return Err(AppError::Validasi(
                "Minimal harus ada satu admin aktif. Buat admin lain terlebih dahulu.".into(),
            ));
        }
    }
    if id == oleh_id && !input.aktif {
        return Err(AppError::Validasi("Anda tidak dapat menonaktifkan akun yang sedang dipakai".into()));
    }

    if input.password.trim().is_empty() {
        let affected = conn.execute(
            "UPDATE pengguna SET nama = ?1, peran = ?2, aktif = ?3 WHERE id = ?4",
            params![input.nama.trim(), input.peran, input.aktif, id],
        )?;
        if affected == 0 {
            return Err(AppError::TidakDitemukan);
        }
    } else {
        if input.password.len() < 6 {
            return Err(AppError::Validasi("Password minimal 6 karakter".into()));
        }
        let hash = bcrypt::hash(&input.password, bcrypt::DEFAULT_COST)
            .map_err(|_| AppError::Validasi("Gagal memproses password".into()))?;
        let affected = conn.execute(
            "UPDATE pengguna SET nama = ?1, peran = ?2, aktif = ?3, password_hash = ?4 WHERE id = ?5",
            params![input.nama.trim(), input.peran, input.aktif, hash, id],
        )?;
        if affected == 0 {
            return Err(AppError::TidakDitemukan);
        }
    }
    Ok(())
}
