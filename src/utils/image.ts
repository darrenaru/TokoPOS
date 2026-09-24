/** Membaca file gambar, memotong ke rasio persegi-panjang tengah, mengecilkan, dan mengembalikan data URL JPEG. */
export function fileKeFotoProduk(file: File, lebar = 400, tinggi = 250, kualitas = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("File harus berupa gambar"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = lebar;
      canvas.height = tinggi;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Gagal memproses gambar"));
        return;
      }
      // Potong tengah (cover) agar sesuai rasio kartu produk.
      const skala = Math.max(lebar / img.width, tinggi / img.height);
      const w = img.width * skala;
      const h = img.height * skala;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, lebar, tinggi);
      ctx.drawImage(img, (lebar - w) / 2, (tinggi - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", kualitas));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak dapat dibaca"));
    };
    img.src = url;
  });
}
