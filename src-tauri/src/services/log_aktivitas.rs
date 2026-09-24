use rusqlite::{params, Connection};

use crate::error::AppResult;
use crate::models::LogAktivitas;

pub fn catat(conn: &Connection, pengguna_id: i64, aksi: &str, keterangan: Option<String>) -> AppResult<()> {
    conn.execute(
        "INSERT INTO log_aktivitas (pengguna_id, aksi, keterangan) VALUES (?1, ?2, ?3)",
        params![pengguna_id, aksi, keterangan],
    )?;
    Ok(())
}

pub fn riwayat(conn: &Connection, limit: i64) -> AppResult<Vec<LogAktivitas>> {
    let mut stmt = conn.prepare(
        "SELECT l.id, l.pengguna_id, p.nama, l.aksi, l.keterangan, l.created_at \
         FROM log_aktivitas l JOIN pengguna p ON p.id = l.pengguna_id \
         ORDER BY l.id DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], |row| {
        Ok(LogAktivitas {
            id: row.get(0)?,
            pengguna_id: row.get(1)?,
            pengguna_nama: row.get(2)?,
            aksi: row.get(3)?,
            keterangan: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}
