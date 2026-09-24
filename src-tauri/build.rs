fn main() {
  // Ikon Windows tertanam sebagai resource; pantau folder ikon agar build ulang saat ikon diganti.
  println!("cargo:rerun-if-changed=icons");
  tauri_build::build()
}
