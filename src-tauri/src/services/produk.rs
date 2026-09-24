use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::{Kategori, Produk, ProdukInput};

const SELECT_PRODUK: &str = "SELECT p.id, p.nama, p.barcode, p.kategori_id, k.nama, p.harga_beli, \
     p.harga_jual, p.stok, p.stok_minimum, p.satuan, p.aktif, p.created_at, p.updated_at, p.foto \
     FROM produk p LEFT JOIN kategori k ON k.id = p.kategori_id";

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<Produk> {
    Ok(Produk {
        id: row.get(0)?,
        nama: row.get(1)?,
        barcode: row.get(2)?,
        kategori_id: row.get(3)?,
        kategori_nama: row.get(4)?,
        harga_beli: row.get(5)?,
        harga_jual: row.get(6)?,
        stok: row.get(7)?,
        stok_minimum: row.get(8)?,
        satuan: row.get(9)?,
        aktif: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
        foto: row.get(13)?,
    })
}

pub fn list(conn: &Connection, hanya_aktif: bool) -> AppResult<Vec<Produk>> {
    let sql = if hanya_aktif {
        format!("{SELECT_PRODUK} WHERE p.aktif = 1 ORDER BY p.nama ASC")
    } else {
        format!("{SELECT_PRODUK} ORDER BY p.nama ASC")
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn get_by_barcode(conn: &Connection, barcode: &str) -> AppResult<Option<Produk>> {
    let sql = format!("{SELECT_PRODUK} WHERE p.barcode = ?1 AND p.aktif = 1");
    let mut stmt = conn.prepare(&sql)?;
    let produk = stmt.query_row(params![barcode.trim()], map_row).optional()?;
    Ok(produk)
}

fn bersihkan_barcode(barcode: Option<String>) -> Option<String> {
    barcode.map(|b| b.trim().to_string()).filter(|b| !b.is_empty())
}

fn petakan_error_barcode(e: rusqlite::Error) -> AppError {
    match e {
        rusqlite::Error::SqliteFailure(err, _) if err.extended_code == 2067 => {
            AppError::Validasi("Barcode sudah digunakan produk lain".into())
        }
        other => other.into(),
    }
}

fn validasi_input(input: &ProdukInput) -> AppResult<()> {
    if input.nama.trim().is_empty() {
        return Err(AppError::Validasi("Nama produk wajib diisi".into()));
    }
    if input.harga_jual < 0.0 || input.harga_beli < 0.0 {
        return Err(AppError::Validasi("Harga tidak boleh negatif".into()));
    }
    if input.stok < 0 || input.stok_minimum < 0 {
        return Err(AppError::Validasi("Stok tidak boleh negatif".into()));
    }
    if input.satuan.trim().is_empty() {
        return Err(AppError::Validasi("Satuan wajib diisi".into()));
    }
    if let Some(foto) = &input.foto {
        if !foto.starts_with("data:image/") || foto.len() > 600_000 {
            return Err(AppError::Validasi("Foto produk tidak valid atau terlalu besar".into()));
        }
    }
    Ok(())
}

/// Stok awal dicatat di log_stok agar riwayat pergerakan stok selalu cocok dengan stok saat ini.
pub fn create(conn: &Connection, dibuat_oleh: i64, input: ProdukInput) -> AppResult<i64> {
    validasi_input(&input)?;

    let barcode = bersihkan_barcode(input.barcode);

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO produk (nama, barcode, kategori_id, harga_beli, harga_jual, stok, stok_minimum, satuan, foto) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            input.nama.trim(),
            barcode,
            input.kategori_id,
            input.harga_beli,
            input.harga_jual,
            input.stok,
            input.stok_minimum,
            input.satuan.trim(),
            input.foto,
        ],
    ).map_err(petakan_error_barcode)?;
    let id = tx.last_insert_rowid();

    if input.stok > 0 {
        tx.execute(
            "INSERT INTO log_stok (produk_id, jenis, jumlah, keterangan, dibuat_oleh) VALUES (?1, 'masuk', ?2, 'Stok awal', ?3)",
            params![id, input.stok, dibuat_oleh],
        )?;
    }
    tx.commit()?;

    Ok(id)
}

pub fn update(conn: &Connection, id: i64, input: ProdukInput) -> AppResult<()> {
    validasi_input(&input)?;

    let barcode = bersihkan_barcode(input.barcode);

    let affected = conn.execute(
        "UPDATE produk SET nama = ?1, barcode = ?2, kategori_id = ?3, harga_beli = ?4, harga_jual = ?5, \
         stok_minimum = ?6, satuan = ?7, foto = ?9, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?8",
        params![
            input.nama.trim(),
            barcode,
            input.kategori_id,
            input.harga_beli,
            input.harga_jual,
            input.stok_minimum,
            input.satuan.trim(),
            id,
            input.foto,
        ],
    ).map_err(petakan_error_barcode)?;

    if affected == 0 {
        return Err(AppError::TidakDitemukan);
    }
    Ok(())
}

/// Soft-delete: produk tidak dihapus fisik agar riwayat transaksi lama tetap konsisten.
/// Barcode dilepas supaya bisa dipakai lagi oleh produk baru (kolom barcode bersifat UNIQUE).
pub fn hapus(conn: &Connection, id: i64) -> AppResult<()> {
    let affected = conn.execute(
        "UPDATE produk SET aktif = 0, barcode = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
        params![id],
    )?;
    if affected == 0 {
        return Err(AppError::TidakDitemukan);
    }
    Ok(())
}

pub fn list_kategori(conn: &Connection) -> AppResult<Vec<Kategori>> {
    let mut stmt = conn.prepare("SELECT id, nama FROM kategori ORDER BY nama ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Kategori {
            id: row.get(0)?,
            nama: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn create_kategori(conn: &Connection, nama: &str) -> AppResult<i64> {
    if nama.trim().is_empty() {
        return Err(AppError::Validasi("Nama kategori wajib diisi".into()));
    }
    let sudah_ada: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM kategori WHERE nama = ?1 COLLATE NOCASE)",
        params![nama.trim()],
        |row| row.get(0),
    )?;
    if sudah_ada {
        return Err(AppError::Validasi("Kategori dengan nama tersebut sudah ada".into()));
    }
    conn.execute("INSERT INTO kategori (nama) VALUES (?1)", params![nama.trim()])?;
    Ok(conn.last_insert_rowid())
}
