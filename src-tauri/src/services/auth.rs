use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::Pengguna;

pub fn login(conn: &Connection, username: &str, password: &str) -> AppResult<Pengguna> {
    let result = conn.query_row(
        "SELECT id, nama, username, password_hash, peran, aktif FROM pengguna WHERE username = ?1",
        [username.trim()],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, bool>(5)?,
            ))
        },
    );

    let (id, nama, username, password_hash, peran, aktif) = match result {
        Ok(row) => row,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(AppError::Validasi("Username atau password salah".into()))
        }
        Err(e) => return Err(e.into()),
    };

    if !aktif {
        return Err(AppError::Validasi("Akun ini sudah dinonaktifkan".into()));
    }

    let valid = bcrypt::verify(password, &password_hash)
        .map_err(|_| AppError::Validasi("Username atau password salah".into()))?;

    if !valid {
        return Err(AppError::Validasi("Username atau password salah".into()));
    }

    Ok(Pengguna {
        id,
        nama,
        username,
        peran,
        aktif,
    })
}
