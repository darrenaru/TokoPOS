-- Log aktivitas untuk aksi sensitif: buka/tutup kasir, ubah harga, dsb.
CREATE TABLE log_aktivitas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pengguna_id  INTEGER NOT NULL REFERENCES pengguna(id),
    aksi         TEXT NOT NULL,
    keterangan   TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_log_aktivitas_created_at ON log_aktivitas(created_at);
