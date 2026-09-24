use rusqlite::{params, Connection};

use crate::error::AppResult;
use crate::models::{ProdukTerjual, RingkasanPenjualan};

/// Laba kotor = penjualan bersih item − HPP − diskon tingkat transaksi. Pajak tidak dihitung
/// sebagai laba (bukan pendapatan toko). HPP memakai harga_beli produk SAAT INI (bukan snapshot
/// historis), karena skema hanya menyimpan snapshot harga_jual di transaksi_item; hasilnya
/// estimasi selama harga beli tidak sering berubah drastis.
pub fn ringkasan(conn: &Connection, dari: &str, sampai: &str) -> AppResult<RingkasanPenjualan> {
    let (jumlah_transaksi, total_omzet): (i64, f64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(total), 0) FROM transaksi \
         WHERE status = 'selesai' AND created_at BETWEEN ?1 AND ?2",
        params![dari, sampai],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    let laba_item: f64 = conn.query_row(
        "SELECT COALESCE(SUM(ti.subtotal_item - p.harga_beli * ti.jumlah), 0) \
         FROM transaksi_item ti \
         JOIN transaksi t ON t.id = ti.transaksi_id \
         JOIN produk p ON p.id = ti.produk_id \
         WHERE t.status = 'selesai' AND t.created_at BETWEEN ?1 AND ?2",
        params![dari, sampai],
        |row| row.get(0),
    )?;
    let total_diskon: f64 = conn.query_row(
        "SELECT COALESCE(SUM(diskon), 0) FROM transaksi \
         WHERE status = 'selesai' AND created_at BETWEEN ?1 AND ?2",
        params![dari, sampai],
        |row| row.get(0),
    )?;
    let total_laba_kotor = laba_item - total_diskon;

    let rata_rata_transaksi = if jumlah_transaksi > 0 {
        total_omzet / jumlah_transaksi as f64
    } else {
        0.0
    };

    Ok(RingkasanPenjualan {
        total_omzet,
        jumlah_transaksi,
        rata_rata_transaksi,
        total_laba_kotor,
    })
}

pub fn produk_terlaris(conn: &Connection, dari: &str, sampai: &str, limit: i64) -> AppResult<Vec<ProdukTerjual>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.nama, SUM(ti.jumlah) as qty, SUM(ti.subtotal_item) as omzet \
         FROM transaksi_item ti \
         JOIN transaksi t ON t.id = ti.transaksi_id \
         JOIN produk p ON p.id = ti.produk_id \
         WHERE t.status = 'selesai' AND t.created_at BETWEEN ?1 AND ?2 \
         GROUP BY p.id ORDER BY qty DESC LIMIT ?3",
    )?;
    let rows = stmt.query_map(params![dari, sampai, limit], |row| {
        Ok(ProdukTerjual {
            produk_id: row.get(0)?,
            nama: row.get(1)?,
            jumlah_terjual: row.get(2)?,
            total_omzet: row.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn produk_kurang_laku(conn: &Connection, dari: &str, sampai: &str, limit: i64) -> AppResult<Vec<ProdukTerjual>> {
    let mut stmt = conn.prepare(
        "WITH terjual AS ( \
            SELECT ti.produk_id, SUM(ti.jumlah) as qty, SUM(ti.subtotal_item) as omzet \
            FROM transaksi_item ti JOIN transaksi t ON t.id = ti.transaksi_id \
            WHERE t.status = 'selesai' AND t.created_at BETWEEN ?1 AND ?2 \
            GROUP BY ti.produk_id \
         ) \
         SELECT p.id, p.nama, COALESCE(terjual.qty, 0), COALESCE(terjual.omzet, 0) \
         FROM produk p LEFT JOIN terjual ON terjual.produk_id = p.id \
         WHERE p.aktif = 1 \
         ORDER BY COALESCE(terjual.qty, 0) ASC, p.nama ASC LIMIT ?3",
    )?;
    let rows = stmt.query_map(params![dari, sampai, limit], |row| {
        Ok(ProdukTerjual {
            produk_id: row.get(0)?,
            nama: row.get(1)?,
            jumlah_terjual: row.get(2)?,
            total_omzet: row.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}
