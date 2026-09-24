use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::{LogStok, StokKoreksiInput};

/// Koreksi/masuk/keluar stok manual. `jumlah` selalu diinput sebagai angka positif
/// oleh UI; arah pergerakan ditentukan oleh `jenis`.
pub fn koreksi(conn: &mut Connection, dibuat_oleh: i64, input: StokKoreksiInput) -> AppResult<()> {
    let delta = match input.jenis.as_str() {
        "masuk" | "keluar" if input.jumlah <= 0 => {
            return Err(AppError::Validasi("Jumlah harus lebih dari 0".into()))
        }
        "masuk" => input.jumlah,
        "keluar" => -input.jumlah,
        // Koreksi (stock opname) bertanda: positif menambah, negatif mengurangi.
        "koreksi" if input.jumlah == 0 => {
            return Err(AppError::Validasi("Jumlah koreksi tidak boleh 0".into()))
        }
        "koreksi" => input.jumlah,
        other => return Err(AppError::Validasi(format!("Jenis stok tidak dikenal: {other}"))),
    };

    let tx = conn.transaction()?;

    let stok_sekarang: i64 = tx
        .query_row("SELECT stok FROM produk WHERE id = ?1 AND aktif = 1", params![input.produk_id], |row| {
            row.get(0)
        })
        .optional()?
        .ok_or(AppError::TidakDitemukan)?;

    let stok_baru = stok_sekarang.saturating_add(delta);
    if stok_baru < 0 {
        return Err(AppError::Validasi("Stok tidak boleh menjadi negatif".into()));
    }

    tx.execute(
        "UPDATE produk SET stok = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?2",
        params![stok_baru, input.produk_id],
    )?;

    tx.execute(
        "INSERT INTO log_stok (produk_id, jenis, jumlah, keterangan, dibuat_oleh) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![input.produk_id, input.jenis, delta, input.keterangan, dibuat_oleh],
    )?;

    tx.commit()?;
    Ok(())
}

pub fn riwayat(conn: &Connection, produk_id: Option<i64>, limit: i64) -> AppResult<Vec<LogStok>> {
    let sql = "SELECT l.id, l.produk_id, p.nama, l.jenis, l.jumlah, l.keterangan, l.referensi_transaksi_id, \
               l.created_at, u.nama \
               FROM log_stok l \
               JOIN produk p ON p.id = l.produk_id \
               JOIN pengguna u ON u.id = l.dibuat_oleh \
               WHERE (?1 IS NULL OR l.produk_id = ?1) \
               ORDER BY l.id DESC LIMIT ?2";
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params![produk_id, limit], |row| {
        Ok(LogStok {
            id: row.get(0)?,
            produk_id: row.get(1)?,
            produk_nama: row.get(2)?,
            jenis: row.get(3)?,
            jumlah: row.get(4)?,
            keterangan: row.get(5)?,
            referensi_transaksi_id: row.get(6)?,
            created_at: row.get(7)?,
            dibuat_oleh_nama: row.get(8)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn produk_stok_menipis(conn: &Connection) -> AppResult<Vec<crate::models::Produk>> {
    crate::services::produk::list(conn, true).map(|list| {
        list.into_iter().filter(|p| p.stok <= p.stok_minimum).collect()
    })
}
