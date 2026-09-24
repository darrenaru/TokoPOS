let audio: HTMLAudioElement | null = null;

/** Bunyi "beep" scanner. Gagal diam-diam bila audio tidak tersedia agar tidak mengganggu transaksi. */
export function bunyiBeep() {
  try {
    audio ??= new Audio("/beep.mp3");
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    // abaikan
  }
}
