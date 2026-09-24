-- TokoPOS initial schema
PRAGMA foreign_keys = ON;

CREATE TABLE kategori (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nama  TEXT NOT NULL
);

CREATE TABLE produk (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nama          TEXT NOT NULL,
    barcode       TEXT UNIQUE,
    kategori_id   INTEGER REFERENCES kategori(id) ON DELETE SET NULL,
    harga_beli    REAL NOT NULL DEFAULT 0,
    harga_jual    REAL NOT NULL DEFAULT 0,
    stok          INTEGER NOT NULL DEFAULT 0,
    stok_minimum  INTEGER NOT NULL DEFAULT 0,
    satuan        TEXT NOT NULL DEFAULT 'pcs',
    aktif         INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_produk_nama ON produk(nama);
CREATE INDEX idx_produk_barcode ON produk(barcode);
CREATE INDEX idx_produk_kategori ON produk(kategori_id);

CREATE TABLE pengguna (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nama           TEXT NOT NULL,
    username       TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    peran          TEXT NOT NULL CHECK (peran IN ('admin', 'kasir')),
    aktif          INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sesi_kasir (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    kasir_id          INTEGER NOT NULL REFERENCES pengguna(id),
    waktu_buka        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    waktu_tutup       TEXT,
    modal_awal        REAL NOT NULL DEFAULT 0,
    total_kas_sistem  REAL,
    total_kas_aktual  REAL,
    selisih           REAL,
    status            TEXT NOT NULL CHECK (status IN ('terbuka', 'tertutup')) DEFAULT 'terbuka'
);
CREATE INDEX idx_sesi_kasir_status ON sesi_kasir(status);

CREATE TABLE transaksi (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_transaksi   TEXT NOT NULL UNIQUE,
    kasir_id         INTEGER NOT NULL REFERENCES pengguna(id),
    sesi_kasir_id    INTEGER NOT NULL REFERENCES sesi_kasir(id),
    subtotal         REAL NOT NULL DEFAULT 0,
    diskon           REAL NOT NULL DEFAULT 0,
    pajak            REAL NOT NULL DEFAULT 0,
    total            REAL NOT NULL DEFAULT 0,
    metode_bayar     TEXT NOT NULL DEFAULT 'tunai',
    jumlah_dibayar   REAL NOT NULL DEFAULT 0,
    kembalian        REAL NOT NULL DEFAULT 0,
    status           TEXT NOT NULL CHECK (status IN ('selesai', 'dibatalkan', 'draft')) DEFAULT 'selesai',
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_transaksi_created_at ON transaksi(created_at);
CREATE INDEX idx_transaksi_sesi ON transaksi(sesi_kasir_id);
CREATE INDEX idx_transaksi_status ON transaksi(status);

CREATE TABLE transaksi_item (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    transaksi_id          INTEGER NOT NULL REFERENCES transaksi(id) ON DELETE CASCADE,
    produk_id             INTEGER REFERENCES produk(id),
    nama_produk_snapshot  TEXT NOT NULL,
    harga_satuan          REAL NOT NULL,
    jumlah                INTEGER NOT NULL,
    diskon_item           REAL NOT NULL DEFAULT 0,
    subtotal_item         REAL NOT NULL
);
CREATE INDEX idx_transaksi_item_transaksi ON transaksi_item(transaksi_id);

CREATE TABLE log_stok (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    produk_id                INTEGER NOT NULL REFERENCES produk(id),
    jenis                    TEXT NOT NULL CHECK (jenis IN ('masuk', 'keluar', 'koreksi', 'transaksi')),
    jumlah                   INTEGER NOT NULL,
    keterangan               TEXT,
    referensi_transaksi_id   INTEGER REFERENCES transaksi(id),
    created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    dibuat_oleh              INTEGER NOT NULL REFERENCES pengguna(id)
);
CREATE INDEX idx_log_stok_produk ON log_stok(produk_id);
CREATE INDEX idx_log_stok_created_at ON log_stok(created_at);

CREATE TABLE pengaturan (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);

-- Seed data ------------------------------------------------------------

INSERT INTO pengaturan (key, value) VALUES
    ('nama_toko', 'Toko Saya'),
    ('alamat_toko', ''),
    ('telepon_toko', ''),
    ('pajak_aktif', '0'),
    ('pajak_persen', '0');

-- Default admin user, username: admin / password: admin123
-- (bcrypt hash generated at migration time is inserted by the app on first run instead,
--  see db::seed_default_admin, so the hash always matches the running bcrypt version.)
