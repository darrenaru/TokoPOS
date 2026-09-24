use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::SesiKasir;

const SELECT_SESI: &str = "SELECT s.id, s.kasir_id, p.nama, s.waktu_buka, s.waktu_tutup, s.modal_awal, \
     s.total_kas_sistem, s.total_kas_aktual, s.selisih, s.status \
     FROM sesi_kasir s JOIN pengguna p ON p.id = s.kasir_id";

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<SesiKasir> {
    Ok(SesiKasir {
        id: row.get(0)?,
        kasir_id: row.get(1)?,
        kasir_nama: row.get(2)?,
        waktu_buka: row.get(3)?,
        waktu_tutup: row.get(4)?,
        modal_awal: row.get(5)?,
        total_kas_sistem: row.get(6)?,
        total_kas_aktual: row.get(7)?,
        selisih: row.get(8)?,
        status: row.get(9)?,
    })
}

pub fn get_sesi_aktif(conn: &Connection, kasir_id: i64) -> AppResult<Option<SesiKasir>> {
    let sql = format!("{SELECT_SESI} WHERE s.kasir_id = ?1 AND s.status = 'terbuka' ORDER BY s.id DESC LIMIT 1");
    let mut stmt = conn.prepare(&sql)?;
    Ok(stmt.query_row(params![kasir_id], map_row).optional()?)
}

pub fn buka_sesi(conn: &Connection, kasir_id: i64, modal_awal: f64) -> AppResult<SesiKasir> {
    if modal_awal < 0.0 {
        return Err(AppError::Validasi("Modal awal tidak boleh negatif".into()));
    }
    if get_sesi_aktif(conn, kasir_id)?.is_some() {
        return Err(AppError::Validasi(
            "Sesi kasir untuk pengguna ini masih terbuka".into(),
        ));
    }

    conn.execute(
        "INSERT INTO sesi_kasir (kasir_id, modal_awal, status) VALUES (?1, ?2, 'terbuka')",
        params![kasir_id, modal_awal],
    )?;
    let id = conn.last_insert_rowid();

    let sql = format!("{SELECT_SESI} WHERE s.id = ?1");
    let mut stmt = conn.prepare(&sql)?;
    Ok(stmt.query_row(params![id], map_row)?)
}

pub fn tutup_sesi(conn: &Connection, kasir_id: i64, sesi_id: i64, total_kas_aktual: f64) -> AppResult<SesiKasir> {
    if total_kas_aktual < 0.0 {
        return Err(AppError::Validasi("Total kas aktual tidak boleh negatif".into()));
    }

    let sesi: SesiKasir = {
        let sql = format!("{SELECT_SESI} WHERE s.id = ?1");
        let mut stmt = conn.prepare(&sql)?;
        stmt.query_row(params![sesi_id], map_row)
            .optional()?
            .ok_or(AppError::TidakDitemukan)?
    };

    if sesi.kasir_id != kasir_id {
        return Err(AppError::Validasi("Sesi kasir ini dibuka oleh pengguna lain".into()));
    }
    if sesi.status != "terbuka" {
        return Err(AppError::Validasi("Sesi kasir ini sudah ditutup".into()));
    }

    let total_penjualan_tunai: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total), 0) FROM transaksi \
         WHERE sesi_kasir_id = ?1 AND status = 'selesai' AND metode_bayar = 'tunai'",
        params![sesi_id],
        |row| row.get(0),
    )?;

    let total_kas_sistem = sesi.modal_awal + total_penjualan_tunai;
    let selisih = total_kas_aktual - total_kas_sistem;

    conn.execute(
        "UPDATE sesi_kasir SET waktu_tutup = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), \
         total_kas_sistem = ?1, total_kas_aktual = ?2, selisih = ?3, status = 'tertutup' WHERE id = ?4",
        params![total_kas_sistem, total_kas_aktual, selisih, sesi_id],
    )?;

    let sql = format!("{SELECT_SESI} WHERE s.id = ?1");
    let mut stmt = conn.prepare(&sql)?;
    Ok(stmt.query_row(params![sesi_id], map_row)?)
}

pub fn riwayat_sesi(conn: &Connection, limit: i64) -> AppResult<Vec<SesiKasir>> {
    let sql = format!("{SELECT_SESI} ORDER BY s.id DESC LIMIT ?1");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![limit], map_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}
