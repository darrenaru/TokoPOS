import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

/** Menjalankan `onBerubah` setiap kali produk/kategori berubah dari sumber lain (mis. tambah produk lewat HP). */
export function useProdukBerubah(onBerubah: () => void) {
  useEffect(() => {
    const unlisten = listen("produk-berubah", () => onBerubah());
    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
