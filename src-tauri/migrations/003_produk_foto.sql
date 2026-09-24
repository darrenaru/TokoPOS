-- Foto produk disimpan sebagai data URL (JPEG kecil) agar ikut ter-backup bersama database.
ALTER TABLE produk ADD COLUMN foto TEXT;
