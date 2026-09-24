use chrono::Local;
use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::{CartItemInput, CheckoutInput, DraftInput, Transaksi, TransaksiItemOut};

fn get_pengaturan(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM pengaturan WHERE key = ?1", params![key], |row| {
        row.get::<_, String>(0)
    })
    .optional()
    .ok()
    .flatten()
}

/// Nomor urut berikutnya untuk `awalan` pada hari ini. Memakai MAX (bukan COUNT) karena draft
/// bisa dihapus, sehingga COUNT akan menghasilkan kode yang sudah terpakai (melanggar UNIQUE).
fn next_kode(conn: &Connection, awalan: &str) -> AppResult<String> {
    let tanggal = Local::now().format("%Y%m%d").to_string();
    let prefix = format!("{awalan}-{tanggal}-");
    let like = format!("{prefix}%");

    let terakhir: i64 = conn.query_row(
        "SELECT COALESCE(MAX(CAST(SUBSTR(kode_transaksi, ?1) AS INTEGER)), 0) \
         FROM transaksi WHERE kode_transaksi LIKE ?2",
        params![prefix.len() as i64 + 1, like],
        |row| row.get(0),
    )?;

    Ok(format!("{prefix}{:04}", terakhir + 1))
}

/// Menggabungkan baris keranjang dengan produk yang sama dan memvalidasi jumlah/diskon per item,
/// sehingga pengecekan stok selalu memakai total kebutuhan per produk.
fn normalisasi_item(items: &[CartItemInput]) -> AppResult<Vec<CartItemInput>> {
    let mut hasil: Vec<CartItemInput> = Vec::with_capacity(items.len());
    for item in items {
        if item.jumlah <= 0 {
            return Err(AppError::Validasi("Jumlah item harus lebih dari 0".into()));
        }
        if item.diskon_item < 0.0 {
            return Err(AppError::Validasi("Diskon item tidak boleh negatif".into()));
        }
        match hasil.iter_mut().find(|i| i.produk_id == item.produk_id) {
            Some(ada) => {
                ada.jumlah += item.jumlah;
                ada.diskon_item += item.diskon_item;
            }
            None => hasil.push(item.clone()),
        }
    }
    Ok(hasil)
}

fn hitung_subtotal_item(nama: &str, harga: f64, item: &CartItemInput) -> AppResult<f64> {
    let kotor = harga * item.jumlah as f64;
    if item.diskon_item > kotor {
        return Err(AppError::Validasi(format!("Diskon item \"{nama}\" melebihi harga barang")));
    }
    Ok(kotor - item.diskon_item)
}

/// Checkout dibungkus dalam satu DB transaction (BEGIN...COMMIT):
/// validasi stok, kalkulasi, penyimpanan transaksi, dan pengurangan stok harus atomic.
pub fn checkout(conn: &mut Connection, kasir_id: i64, input: CheckoutInput) -> AppResult<Transaksi> {
    if input.items.is_empty() {
        return Err(AppError::Validasi("Keranjang masih kosong".into()));
    }
    if input.metode_bayar != "tunai" {
        return Err(AppError::Validasi("Metode pembayaran tidak didukung".into()));
    }
    let items = normalisasi_item(&input.items)?;

    let tx = conn.transaction()?;

    // Validasi sesi kasir aktif.
    let sesi_status: Option<String> = tx
        .query_row(
            "SELECT status FROM sesi_kasir WHERE id = ?1 AND kasir_id = ?2",
            params![input.sesi_kasir_id, kasir_id],
            |row| row.get(0),
        )
        .optional()?;
    match sesi_status.as_deref() {
        Some("terbuka") => {}
        Some(_) => return Err(AppError::Validasi("Sesi kasir sudah ditutup".into())),
        None => return Err(AppError::Validasi("Sesi kasir tidak valid".into())),
    }

    struct ItemHitung {
        produk_id: i64,
        nama: String,
        harga_satuan: f64,
        jumlah: i64,
        diskon_item: f64,
        subtotal_item: f64,
    }

    let mut item_hitung = Vec::with_capacity(items.len());
    let mut subtotal = 0.0_f64;

    for item in &items {
        let (nama, harga_jual, stok): (String, f64, i64) = tx
            .query_row(
                "SELECT nama, harga_jual, stok FROM produk WHERE id = ?1 AND aktif = 1",
                params![item.produk_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()?
            .ok_or_else(|| AppError::Validasi(format!("Produk id {} tidak ditemukan", item.produk_id)))?;

        if stok < item.jumlah {
            return Err(AppError::Validasi(format!(
                "Stok \"{nama}\" tidak cukup (tersisa {stok}, diminta {})",
                item.jumlah
            )));
        }

        let subtotal_item = hitung_subtotal_item(&nama, harga_jual, item)?;
        subtotal += subtotal_item;

        item_hitung.push(ItemHitung {
            produk_id: item.produk_id,
            nama,
            harga_satuan: harga_jual,
            jumlah: item.jumlah,
            diskon_item: item.diskon_item,
            subtotal_item,
        });
    }

    let diskon = input.diskon.clamp(0.0, subtotal).round();
    let dasar_pajak = subtotal - diskon;

    let pajak_aktif = get_pengaturan(&tx, "pajak_aktif").unwrap_or_else(|| "0".into()) == "1";
    let pajak_persen: f64 = get_pengaturan(&tx, "pajak_persen")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.0);
    // Rupiah tidak punya pecahan, jadi pajak dibulatkan agar total di layar = total yang dibayar.
    let pajak = if pajak_aktif { (dasar_pajak * pajak_persen / 100.0).round() } else { 0.0 };

    let total = dasar_pajak + pajak;

    if input.jumlah_dibayar < total {
        return Err(AppError::Validasi("Jumlah dibayar kurang dari total belanja".into()));
    }
    let kembalian = input.jumlah_dibayar - total;

    let kode_transaksi = next_kode(&tx, "TRX")?;

    tx.execute(
        "INSERT INTO transaksi (kode_transaksi, kasir_id, sesi_kasir_id, subtotal, diskon, pajak, total, \
         metode_bayar, jumlah_dibayar, kembalian, status) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'selesai')",
        params![
            kode_transaksi,
            kasir_id,
            input.sesi_kasir_id,
            subtotal,
            diskon,
            pajak,
            total,
            input.metode_bayar,
            input.jumlah_dibayar,
            kembalian,
        ],
    )?;
    let transaksi_id = tx.last_insert_rowid();

    let mut items_out = Vec::with_capacity(item_hitung.len());
    for item in item_hitung {
        tx.execute(
            "INSERT INTO transaksi_item (transaksi_id, produk_id, nama_produk_snapshot, harga_satuan, jumlah, diskon_item, subtotal_item) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                transaksi_id,
                item.produk_id,
                item.nama,
                item.harga_satuan,
                item.jumlah,
                item.diskon_item,
                item.subtotal_item,
            ],
        )?;
        let item_id = tx.last_insert_rowid();

        tx.execute(
            "UPDATE produk SET stok = stok - ?1 WHERE id = ?2",
            params![item.jumlah, item.produk_id],
        )?;

        tx.execute(
            "INSERT INTO log_stok (produk_id, jenis, jumlah, keterangan, referensi_transaksi_id, dibuat_oleh) \
             VALUES (?1, 'transaksi', ?2, ?3, ?4, ?5)",
            params![
                item.produk_id,
                -item.jumlah,
                format!("Terjual pada transaksi {kode_transaksi}"),
                transaksi_id,
                kasir_id,
            ],
        )?;

        items_out.push(TransaksiItemOut {
            id: item_id,
            produk_id: Some(item.produk_id),
            nama_produk_snapshot: item.nama,
            harga_satuan: item.harga_satuan,
            jumlah: item.jumlah,
            diskon_item: item.diskon_item,
            subtotal_item: item.subtotal_item,
        });
    }

    let created_at: String = tx.query_row(
        "SELECT created_at FROM transaksi WHERE id = ?1",
        params![transaksi_id],
        |row| row.get(0),
    )?;
    let kasir_nama: Option<String> = tx
        .query_row("SELECT nama FROM pengguna WHERE id = ?1", params![kasir_id], |row| row.get(0))
        .optional()?;

    tx.commit()?;

    Ok(Transaksi {
        id: transaksi_id,
        kode_transaksi,
        kasir_id,
        kasir_nama,
        sesi_kasir_id: input.sesi_kasir_id,
        subtotal,
        diskon,
        pajak,
        total,
        metode_bayar: input.metode_bayar,
        jumlah_dibayar: input.jumlah_dibayar,
        kembalian,
        status: "selesai".into(),
        created_at,
        items: items_out,
    })
}

const SELECT_TRANSAKSI: &str = "SELECT t.id, t.kode_transaksi, t.kasir_id, p.nama, t.sesi_kasir_id, t.subtotal, \
     t.diskon, t.pajak, t.total, t.metode_bayar, t.jumlah_dibayar, t.kembalian, t.status, t.created_at \
     FROM transaksi t JOIN pengguna p ON p.id = t.kasir_id";

fn map_transaksi_row(row: &rusqlite::Row) -> rusqlite::Result<Transaksi> {
    Ok(Transaksi {
        id: row.get(0)?,
        kode_transaksi: row.get(1)?,
        kasir_id: row.get(2)?,
        kasir_nama: row.get(3)?,
        sesi_kasir_id: row.get(4)?,
        subtotal: row.get(5)?,
        diskon: row.get(6)?,
        pajak: row.get(7)?,
        total: row.get(8)?,
        metode_bayar: row.get(9)?,
        jumlah_dibayar: row.get(10)?,
        kembalian: row.get(11)?,
        status: row.get(12)?,
        created_at: row.get(13)?,
        items: Vec::new(),
    })
}

fn load_items(conn: &Connection, transaksi_id: i64) -> AppResult<Vec<TransaksiItemOut>> {
    let mut stmt = conn.prepare(
        "SELECT id, produk_id, nama_produk_snapshot, harga_satuan, jumlah, diskon_item, subtotal_item \
         FROM transaksi_item WHERE transaksi_id = ?1",
    )?;
    let rows = stmt.query_map(params![transaksi_id], |row| {
        Ok(TransaksiItemOut {
            id: row.get(0)?,
            produk_id: row.get(1)?,
            nama_produk_snapshot: row.get(2)?,
            harga_satuan: row.get(3)?,
            jumlah: row.get(4)?,
            diskon_item: row.get(5)?,
            subtotal_item: row.get(6)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn get_by_id(conn: &Connection, id: i64) -> AppResult<Transaksi> {
    let sql = format!("{SELECT_TRANSAKSI} WHERE t.id = ?1");
    let mut stmt = conn.prepare(&sql)?;
    let mut trx = stmt
        .query_row(params![id], map_transaksi_row)
        .optional()?
        .ok_or(AppError::TidakDitemukan)?;
    trx.items = load_items(conn, id)?;
    Ok(trx)
}

pub fn riwayat(conn: &Connection, dari: Option<String>, sampai: Option<String>, keyword: Option<String>) -> AppResult<Vec<Transaksi>> {
    let mut sql = SELECT_TRANSAKSI.to_string();
    // Draft adalah keranjang tertunda, bukan transaksi, sehingga tidak ikut riwayat.
    let mut clauses: Vec<String> = vec!["t.status != 'draft'".to_string()];
    let mut binds: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(d) = dari {
        clauses.push(format!("t.created_at >= ?{}", binds.len() + 1));
        binds.push(Box::new(d));
    }
    if let Some(s) = sampai {
        clauses.push(format!("t.created_at <= ?{}", binds.len() + 1));
        binds.push(Box::new(s));
    }
    if let Some(k) = keyword {
        clauses.push(format!("t.kode_transaksi LIKE ?{} ESCAPE '\\'", binds.len() + 1));
        let aman = k.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
        binds.push(Box::new(format!("%{aman}%")));
    }

    sql.push_str(" WHERE ");
    sql.push_str(&clauses.join(" AND "));
    sql.push_str(" ORDER BY t.id DESC LIMIT 500");

    let mut stmt = conn.prepare(&sql)?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = binds.iter().map(|b| b.as_ref()).collect();
    let rows = stmt.query_map(params_refs.as_slice(), map_transaksi_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// Simpan keranjang sebagai draft (hold transaction) — tidak mengurangi
/// stok maupun menulis log_stok karena belum benar-benar terjual.
pub fn simpan_draft(conn: &mut Connection, kasir_id: i64, input: DraftInput) -> AppResult<Transaksi> {
    if input.items.is_empty() {
        return Err(AppError::Validasi("Keranjang masih kosong".into()));
    }

    let items = normalisasi_item(&input.items)?;
    let tx = conn.transaction()?;

    let mut subtotal = 0.0_f64;
    let mut items_out = Vec::with_capacity(items.len());

    for item in &items {
        let (nama, harga_jual): (String, f64) = tx
            .query_row(
                "SELECT nama, harga_jual FROM produk WHERE id = ?1 AND aktif = 1",
                params![item.produk_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?
            .ok_or_else(|| AppError::Validasi(format!("Produk id {} tidak ditemukan", item.produk_id)))?;

        let subtotal_item = hitung_subtotal_item(&nama, harga_jual, item)?;
        subtotal += subtotal_item;
        items_out.push((item.produk_id, nama, harga_jual, item.jumlah, item.diskon_item, subtotal_item));
    }

    let diskon = input.diskon.clamp(0.0, subtotal).round();
    let total = subtotal - diskon;
    let kode_transaksi = next_kode(&tx, "DRAFT")?;

    tx.execute(
        "INSERT INTO transaksi (kode_transaksi, kasir_id, sesi_kasir_id, subtotal, diskon, pajak, total, \
         metode_bayar, jumlah_dibayar, kembalian, status) \
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, '', 0, 0, 'draft')",
        params![kode_transaksi, kasir_id, input.sesi_kasir_id, subtotal, diskon, total],
    )?;
    let transaksi_id = tx.last_insert_rowid();

    let mut out = Vec::with_capacity(items_out.len());
    for (produk_id, nama, harga_satuan, jumlah, diskon_item, subtotal_item) in items_out {
        tx.execute(
            "INSERT INTO transaksi_item (transaksi_id, produk_id, nama_produk_snapshot, harga_satuan, jumlah, diskon_item, subtotal_item) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![transaksi_id, produk_id, nama, harga_satuan, jumlah, diskon_item, subtotal_item],
        )?;
        out.push(TransaksiItemOut {
            id: tx.last_insert_rowid(),
            produk_id: Some(produk_id),
            nama_produk_snapshot: nama,
            harga_satuan,
            jumlah,
            diskon_item,
            subtotal_item,
        });
    }

    let created_at: String = tx.query_row(
        "SELECT created_at FROM transaksi WHERE id = ?1",
        params![transaksi_id],
        |row| row.get(0),
    )?;

    tx.commit()?;

    Ok(Transaksi {
        id: transaksi_id,
        kode_transaksi,
        kasir_id,
        kasir_nama: None,
        sesi_kasir_id: input.sesi_kasir_id,
        subtotal,
        diskon,
        pajak: 0.0,
        total,
        metode_bayar: String::new(),
        jumlah_dibayar: 0.0,
        kembalian: 0.0,
        status: "draft".into(),
        created_at,
        items: out,
    })
}

/// Draft tetap tersedia lintas sesi, sehingga keranjang tertunda tidak hilang saat kasir ditutup.
pub fn list_draft(conn: &Connection, kasir_id: i64) -> AppResult<Vec<Transaksi>> {
    let sql = format!("{SELECT_TRANSAKSI} WHERE t.kasir_id = ?1 AND t.status = 'draft' ORDER BY t.id DESC");
    let mut stmt = conn.prepare(&sql)?;
    let mut list = stmt
        .query_map(params![kasir_id], map_transaksi_row)?
        .collect::<Result<Vec<_>, _>>()?;
    for trx in &mut list {
        trx.items = load_items(conn, trx.id)?;
    }
    Ok(list)
}

/// Menghapus draft, dipanggil setelah draft dimuat ulang ke keranjang atau dibatalkan.
pub fn hapus_draft(conn: &Connection, kasir_id: i64, id: i64) -> AppResult<()> {
    let affected = conn.execute(
        "DELETE FROM transaksi WHERE id = ?1 AND kasir_id = ?2 AND status = 'draft'",
        params![id, kasir_id],
    )?;
    if affected == 0 {
        return Err(AppError::TidakDitemukan);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::StokKoreksiInput;
    use crate::services::{pengguna, produk, stok};

    fn db_uji() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        db::run_migrations(&conn);
        db::seed_default_admin(&conn);
        conn.execute("INSERT INTO sesi_kasir (kasir_id, modal_awal) VALUES (1, 0)", []).unwrap();
        conn
    }

    fn produk_uji(conn: &Connection, nama: &str, barcode: Option<&str>, stok: i64) -> i64 {
        produk::create(
            conn,
            1,
            crate::models::ProdukInput {
                nama: nama.into(),
                barcode: barcode.map(String::from),
                kategori_id: None,
                harga_beli: 800.0,
                harga_jual: 1000.0,
                stok,
                stok_minimum: 1,
                satuan: "pcs".into(),
                foto: None,
            },
        )
        .unwrap()
    }

    fn item(produk_id: i64, jumlah: i64) -> CartItemInput {
        CartItemInput { produk_id, jumlah, diskon_item: 0.0 }
    }

    fn checkout_input(items: Vec<CartItemInput>, diskon: f64, bayar: f64) -> CheckoutInput {
        CheckoutInput { sesi_kasir_id: 1, items, diskon, metode_bayar: "tunai".into(), jumlah_dibayar: bayar }
    }

    #[test]
    fn kode_draft_tidak_bentrok_setelah_draft_dihapus() {
        let mut conn = db_uji();
        let p = produk_uji(&conn, "Teh", None, 10);
        let input = || DraftInput { sesi_kasir_id: 1, items: vec![item(p, 1)], diskon: 0.0 };
        let d1 = simpan_draft(&mut conn, 1, input()).unwrap();
        let _d2 = simpan_draft(&mut conn, 1, input()).unwrap();
        hapus_draft(&conn, 1, d1.id).unwrap();
        // Sebelumnya memakai COUNT sehingga kode draft ke-3 bentrok dengan draft ke-2.
        assert!(simpan_draft(&mut conn, 1, input()).is_ok());
    }

    #[test]
    fn checkout_menggabungkan_baris_kembar_saat_cek_stok() {
        let mut conn = db_uji();
        let p = produk_uji(&conn, "Teh", None, 3);
        let hasil = checkout(&mut conn, 1, checkout_input(vec![item(p, 2), item(p, 2)], 0.0, 10_000.0));
        assert!(hasil.is_err(), "2+2 melebihi stok 3");
        let stok_akhir: i64 = conn.query_row("SELECT stok FROM produk WHERE id = ?1", [p], |r| r.get(0)).unwrap();
        assert_eq!(stok_akhir, 3);
    }

    #[test]
    fn checkout_menghitung_diskon_pajak_dan_stok() {
        let mut conn = db_uji();
        let p = produk_uji(&conn, "Teh", None, 10);
        conn.execute("UPDATE pengaturan SET value = '1' WHERE key = 'pajak_aktif'", []).unwrap();
        conn.execute("UPDATE pengaturan SET value = '11' WHERE key = 'pajak_persen'", []).unwrap();
        let trx = checkout(&mut conn, 1, checkout_input(vec![item(p, 3)], 500.0, 5_000.0)).unwrap();
        assert_eq!(trx.subtotal, 3000.0);
        assert_eq!(trx.diskon, 500.0);
        assert_eq!(trx.pajak, 275.0); // 11% dari 2.500
        assert_eq!(trx.total, 2775.0);
        assert_eq!(trx.kembalian, 2225.0);
        let stok_akhir: i64 = conn.query_row("SELECT stok FROM produk WHERE id = ?1", [p], |r| r.get(0)).unwrap();
        assert_eq!(stok_akhir, 7);
    }

    #[test]
    fn diskon_dibatasi_subtotal_dan_bayar_kurang_ditolak() {
        let mut conn = db_uji();
        let p = produk_uji(&conn, "Teh", None, 10);
        let trx = checkout(&mut conn, 1, checkout_input(vec![item(p, 1)], 99_999.0, 0.0)).unwrap();
        assert_eq!(trx.diskon, 1000.0);
        assert_eq!(trx.total, 0.0);
        assert!(checkout(&mut conn, 1, checkout_input(vec![item(p, 1)], 0.0, 999.0)).is_err());
    }

    #[test]
    fn riwayat_tidak_memuat_draft() {
        let mut conn = db_uji();
        let p = produk_uji(&conn, "Teh", None, 10);
        simpan_draft(&mut conn, 1, DraftInput { sesi_kasir_id: 1, items: vec![item(p, 1)], diskon: 0.0 }).unwrap();
        checkout(&mut conn, 1, checkout_input(vec![item(p, 1)], 0.0, 1000.0)).unwrap();
        let list = riwayat(&conn, None, None, None).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].status, "selesai");
    }

    #[test]
    fn koreksi_stok_bertanda_bisa_mengurangi() {
        let mut conn = db_uji();
        let p = produk_uji(&conn, "Teh", None, 10);
        let kirim = |conn: &mut Connection, jenis: &str, jumlah: i64| {
            stok::koreksi(conn, 1, StokKoreksiInput { produk_id: p, jenis: jenis.into(), jumlah, keterangan: None })
        };
        kirim(&mut conn, "koreksi", -4).unwrap();
        let sisa: i64 = conn.query_row("SELECT stok FROM produk WHERE id = ?1", [p], |r| r.get(0)).unwrap();
        assert_eq!(sisa, 6);
        assert!(kirim(&mut conn, "koreksi", -7).is_err(), "tidak boleh negatif");
        assert!(kirim(&mut conn, "koreksi", 0).is_err());
        assert!(kirim(&mut conn, "masuk", -1).is_err());
    }

    #[test]
    fn barcode_bisa_dipakai_lagi_setelah_produk_dihapus() {
        let conn = db_uji();
        let lama = produk_uji(&conn, "Lama", Some("123"), 1);
        produk::hapus(&conn, lama).unwrap();
        produk_uji(&conn, "Baru", Some(" 123 "), 1);
        assert!(produk::get_by_barcode(&conn, "123").unwrap().is_some());
    }

    #[test]
    fn stok_awal_produk_tercatat_di_log() {
        let conn = db_uji();
        let p = produk_uji(&conn, "Teh", None, 5);
        let jumlah: i64 =
            conn.query_row("SELECT jumlah FROM log_stok WHERE produk_id = ?1", [p], |r| r.get(0)).unwrap();
        assert_eq!(jumlah, 5);
    }

    #[test]
    fn admin_terakhir_tidak_bisa_dinonaktifkan_atau_diturunkan() {
        let conn = db_uji();
        let ubah = |peran: &str, aktif: bool| {
            pengguna::update(
                &conn,
                99,
                1,
                crate::models::PenggunaUpdateInput {
                    nama: "Administrator".into(),
                    peran: peran.into(),
                    aktif,
                    password: String::new(),
                },
            )
        };
        assert!(ubah("admin", false).is_err());
        assert!(ubah("kasir", true).is_err());
        assert!(ubah("admin", true).is_ok());
    }

    #[test]
    fn tutup_sesi_hanya_oleh_pemilik() {
        let conn = db_uji();
        assert!(crate::services::kas::tutup_sesi(&conn, 2, 1, 0.0).is_err());
        assert!(crate::services::kas::tutup_sesi(&conn, 1, 1, -1.0).is_err());
        assert!(crate::services::kas::tutup_sesi(&conn, 1, 1, 0.0).is_ok());
    }
}

#[cfg(test)]
mod tests_kategori {
    use super::*;
    use crate::db;
    use crate::services::produk;

    #[test]
    fn kategori_ganda_ditolak_tanpa_peduli_huruf_besar() {
        let conn = Connection::open_in_memory().unwrap();
        db::run_migrations(&conn);
        produk::create_kategori(&conn, "Minuman").unwrap();
        assert!(produk::create_kategori(&conn, " minuman ").is_err());
        assert!(produk::create_kategori(&conn, "Makanan").is_ok());
    }
}
