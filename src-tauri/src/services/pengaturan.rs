use rusqlite::{params, Connection};
use std::collections::HashMap;

use crate::error::{AppError, AppResult};

pub fn get_all(conn: &Connection) -> AppResult<HashMap<String, String>> {
    let mut stmt = conn.prepare("SELECT key, value FROM pengaturan")?;
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
    let mut map = HashMap::new();
    for row in rows {
        let (k, v) = row?;
        map.insert(k, v);
    }
    Ok(map)
}

pub fn set_many(conn: &Connection, values: HashMap<String, String>) -> AppResult<()> {
    if let Some(persen) = values.get("pajak_persen") {
        match persen.trim().parse::<f64>() {
            Ok(p) if (0.0..=100.0).contains(&p) => {}
            _ => return Err(AppError::Validasi("Persentase pajak harus berupa angka 0 sampai 100".into())),
        }
    }

    // Satu transaksi agar pengaturan tersimpan seluruhnya atau tidak sama sekali.
    let tx = conn.unchecked_transaction()?;
    for (key, value) in values {
        tx.execute(
            "INSERT INTO pengaturan (key, value) VALUES (?1, ?2) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value.trim()],
        )?;
    }
    tx.commit()?;
    Ok(())
}
