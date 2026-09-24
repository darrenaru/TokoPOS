use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Validasi(String),
    #[error("Belum login")]
    BelumLogin,
    #[error("Akses ditolak: fitur ini khusus admin")]
    AksesDitolak,
    #[error("Data tidak ditemukan")]
    TidakDitemukan,
    #[error("Kesalahan database: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Kesalahan berkas: {0}")]
    Io(#[from] std::io::Error),
}

// Diserialisasi sebagai string polos supaya mudah ditampilkan langsung di UI.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
