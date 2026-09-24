/** Tanggal lokal (bukan UTC) dalam format YYYY-MM-DD untuk nilai <DatePicker>. */
export function keInputTanggal(d: Date): string {
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const hari = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${hari}`;
}

/**
 * Batas awal hari lokal sebagai ISO UTC, sama formatnya dengan kolom created_at di database.
 * Catatan: `new Date("YYYY-MM-DD")` dibaca sebagai UTC, sehingga harus diberi jam agar dibaca lokal.
 */
export function awalHariIso(tanggal: string): string {
  return new Date(`${tanggal}T00:00:00`).toISOString();
}

export function akhirHariIso(tanggal: string): string {
  return new Date(`${tanggal}T23:59:59.999`).toISOString();
}
