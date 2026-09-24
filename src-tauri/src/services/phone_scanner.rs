use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, Query, State as AxState,
    },
    http::{header, HeaderMap},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use axum_server::{tls_rustls::RustlsConfig, Handle};
use rand::distributions::Alphanumeric;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};

use crate::error::{AppError, AppResult};
use crate::models::ProdukInput;
use crate::services;
use crate::state::AppState;

const PORT_AWAL: u16 = 8765;
const JUMLAH_PORT: u16 = 10;

static ID_KLIEN: AtomicU64 = AtomicU64::new(1);

struct Klien {
    id: u64,
    nama: String,
    ip: String,
    sejak: String,
    jumlah_scan: usize,
    /// Mode yang sedang dipilih di HP: "beli" (keranjang) atau "produk" (tambah produk baru).
    mode: String,
    putuskan: UnboundedSender<()>,
}

type DaftarKlien = Arc<Mutex<Vec<Klien>>>;

pub struct ScannerRuntime {
    handle: Handle,
    token: String,
    port: u16,
    ips: Vec<Ipv4Addr>,
    klien: DaftarKlien,
}

#[derive(Serialize, Clone)]
pub struct PerangkatInfo {
    pub id: u64,
    pub nama: String,
    pub ip: String,
    pub sejak: String,
    pub jumlah_scan: usize,
    pub mode: String,
}

#[derive(Serialize, Clone)]
pub struct ScannerInfo {
    pub aktif: bool,
    pub urls: Vec<String>,
    pub terhubung: usize,
    pub perangkat: Vec<PerangkatInfo>,
}

impl ScannerInfo {
    pub fn nonaktif() -> Self {
        Self { aktif: false, urls: vec![], terhubung: 0, perangkat: vec![] }
    }
}

fn daftar_perangkat(klien: &DaftarKlien) -> Vec<PerangkatInfo> {
    klien
        .lock()
        .unwrap()
        .iter()
        .map(|k| PerangkatInfo {
            id: k.id,
            nama: k.nama.clone(),
            ip: k.ip.clone(),
            sejak: k.sejak.clone(),
            jumlah_scan: k.jumlah_scan,
            mode: k.mode.clone(),
        })
        .collect()
}

pub fn info(runtime: &Option<ScannerRuntime>) -> ScannerInfo {
    match runtime {
        None => ScannerInfo::nonaktif(),
        Some(r) => {
            let perangkat = daftar_perangkat(&r.klien);
            ScannerInfo {
                aktif: true,
                urls: r
                    .ips
                    .iter()
                    .map(|ip| format!("https://{ip}:{}/?token={}", r.port, r.token))
                    .collect(),
                terhubung: perangkat.len(),
                perangkat,
            }
        }
    }
}

pub fn stop(runtime: &mut Option<ScannerRuntime>) {
    if let Some(r) = runtime.take() {
        for k in r.klien.lock().unwrap().iter() {
            let _ = k.putuskan.send(());
        }
        r.handle.shutdown();
    }
}

pub fn putuskan_perangkat(runtime: &Option<ScannerRuntime>, id: u64) {
    if let Some(r) = runtime {
        if let Some(k) = r.klien.lock().unwrap().iter().find(|k| k.id == id) {
            let _ = k.putuskan.send(());
        }
    }
}

#[derive(Clone)]
struct Shared {
    app: AppHandle,
    token: String,
    klien: DaftarKlien,
    /// Pengguna yang menyalakan scanner; produk baru dari HP dicatat atas namanya.
    pengguna_id: i64,
    /// Hanya admin yang boleh menambah produk (sama seperti menu Produk di desktop).
    admin: bool,
}

#[derive(Deserialize)]
struct WsQuery {
    token: Option<String>,
}

#[derive(Deserialize)]
struct PesanMasuk {
    #[serde(rename = "type")]
    tipe: String,
    code: Option<String>,
    mode: Option<String>,
    nama: Option<String>,
    data: Option<serde_json::Value>,
}

#[derive(Serialize, Clone)]
struct ScanEvent {
    code: String,
    /// "beli" atau "produk" — layar desktop hanya bereaksi pada mode yang sesuai.
    mode: String,
    found: bool,
    nama: String,
    perangkat: String,
}

#[derive(Serialize, Clone)]
struct StatusEvent {
    terhubung: usize,
    perangkat: Vec<PerangkatInfo>,
}

fn nama_perangkat(ua: &str) -> String {
    if ua.contains("iPhone") || ua.contains("iPad") {
        let jenis = if ua.contains("iPad") { "iPad" } else { "iPhone" };
        let versi = ua
            .split("OS ")
            .nth(1)
            .map(|s| s.chars().take_while(|c| c.is_ascii_digit() || *c == '_').collect::<String>())
            .map(|s| s.replace('_', "."))
            .filter(|s| !s.is_empty());
        return match versi {
            Some(v) => format!("{jenis} (iOS {v})"),
            None => jenis.to_string(),
        };
    }
    if let Some(i) = ua.find("Android") {
        let bagian: Vec<&str> = ua[i..].split(';').collect();
        let model = bagian
            .get(1)
            .map(|s| s.split(')').next().unwrap_or(s))
            .map(|s| s.split(" Build/").next().unwrap_or(s).trim().to_string())
            .filter(|s| !s.is_empty());
        return match model {
            Some(m) => format!("Android {m}"),
            None => "Android".to_string(),
        };
    }
    "Perangkat tidak dikenal".to_string()
}

fn ip_lan() -> Vec<Ipv4Addr> {
    let mut hasil: Vec<Ipv4Addr> = local_ip_address::list_afinet_netifas()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|(_, ip)| match ip {
            IpAddr::V4(v4) if !v4.is_loopback() && !v4.is_link_local() && v4.is_private() => Some(v4),
            _ => None,
        })
        .collect();
    // Alamat 192.168.x.x paling umum dipakai router rumah/toko, tampilkan lebih dulu.
    hasil.sort_by_key(|ip| if ip.octets()[0] == 192 { 0 } else { 1 });
    hasil.dedup();
    hasil
}

fn port_kosong() -> AppResult<u16> {
    for port in PORT_AWAL..PORT_AWAL + JUMLAH_PORT {
        if TcpListener::bind((Ipv4Addr::UNSPECIFIED, port)).is_ok() {
            return Ok(port);
        }
    }
    Err(AppError::Validasi("Tidak ada port kosong untuk server scanner".into()))
}

fn cert_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("gagal menentukan direktori data aplikasi")
        .join("scanner_cert");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// Sertifikat self-signed disimpan agar peramban HP tidak perlu meminta izin ulang
/// setiap kali; dibuat ulang hanya jika daftar IP LAN berubah.
fn siapkan_sertifikat(app: &AppHandle, ips: &[Ipv4Addr]) -> AppResult<(Vec<u8>, Vec<u8>)> {
    let dir = cert_dir(app);
    let cert_path = dir.join("cert.pem");
    let key_path = dir.join("key.pem");
    let sans_path = dir.join("sans.txt");

    let mut sans: Vec<String> = ips.iter().map(|ip| ip.to_string()).collect();
    sans.push("localhost".into());
    sans.sort();
    let sans_teks = sans.join(",");

    let cocok = std::fs::read_to_string(&sans_path).map(|s| s == sans_teks).unwrap_or(false);
    if cocok {
        if let (Ok(c), Ok(k)) = (std::fs::read(&cert_path), std::fs::read(&key_path)) {
            return Ok((c, k));
        }
    }

    let rcgen::CertifiedKey { cert, key_pair } = rcgen::generate_simple_self_signed(sans)
        .map_err(|e| AppError::Validasi(format!("Gagal membuat sertifikat: {e}")))?;
    let cert_pem = cert.pem().into_bytes();
    let key_pem = key_pair.serialize_pem().into_bytes();
    std::fs::write(&cert_path, &cert_pem)?;
    std::fs::write(&key_path, &key_pem)?;
    std::fs::write(&sans_path, sans_teks)?;
    Ok((cert_pem, key_pem))
}

pub async fn start(app: &AppHandle, pengguna_id: i64, admin: bool) -> AppResult<ScannerRuntime> {
    let ips = ip_lan();
    if ips.is_empty() {
        return Err(AppError::Validasi(
            "Komputer tidak terhubung ke jaringan WiFi/LAN. Sambungkan dulu ke jaringan yang sama dengan HP.".into(),
        ));
    }

    let (cert, key) = siapkan_sertifikat(app, &ips)?;
    let _ = rustls::crypto::ring::default_provider().install_default();
    let tls = RustlsConfig::from_pem(cert, key)
        .await
        .map_err(|e| AppError::Validasi(format!("Konfigurasi TLS gagal: {e}")))?;

    let port = port_kosong()?;
    let token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(24)
        .map(char::from)
        .collect();
    let klien: DaftarKlien = Arc::new(Mutex::new(Vec::new()));
    let shared = Shared { app: app.clone(), token: token.clone(), klien: klien.clone(), pengguna_id, admin };

    let router = Router::new()
        .route("/", get(halaman))
        .route("/zxing.min.js", get(zxing))
        .route("/zbar.min.js", get(zbar))
        .route("/beep.mp3", get(beep))
        .route("/ws", get(ws_handler))
        .with_state(shared);

    let handle = Handle::new();
    let addr = SocketAddr::from((Ipv4Addr::UNSPECIFIED, port));
    let handle_server = handle.clone();
    tauri::async_runtime::spawn(async move {
        let _ = axum_server::bind_rustls(addr, tls)
            .handle(handle_server)
            .serve(router.into_make_service_with_connect_info::<SocketAddr>())
            .await;
    });

    Ok(ScannerRuntime { handle, token, port, ips, klien })
}

async fn halaman() -> Html<&'static str> {
    Html(include_str!("../../scanner/index.html"))
}

async fn zxing() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/javascript; charset=utf-8")],
        include_str!("../../scanner/zxing.min.js"),
    )
}

async fn beep() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "audio/mpeg"), (header::CACHE_CONTROL, "public, max-age=86400")],
        include_bytes!("../../scanner/beep.mp3").as_slice(),
    )
}

async fn zbar() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/javascript; charset=utf-8")],
        include_str!("../../scanner/zbar.min.js"),
    )
}

/// UPC-A (12 digit) dan EAN-13 berawalan 0 adalah barcode yang sama; cocokkan keduanya.
fn varian_barcode(code: &str) -> Vec<String> {
    let mut v = vec![code.to_string()];
    if code.len() == 12 && code.chars().all(|c| c.is_ascii_digit()) {
        v.push(format!("0{code}"));
    } else if code.len() == 13 && code.starts_with('0') {
        v.push(code[1..].to_string());
    }
    v
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(q): Query<WsQuery>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    AxState(shared): AxState<Shared>,
) -> impl IntoResponse {
    let valid = q.token.as_deref() == Some(shared.token.as_str());
    let ua = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    ws.on_upgrade(move |socket| handle_socket(socket, shared, valid, addr.ip().to_string(), nama_perangkat(&ua)))
}

fn kirim_status(shared: &Shared) {
    let perangkat = daftar_perangkat(&shared.klien);
    let _ = shared
        .app
        .emit("hp-scanner-status", StatusEvent { terhubung: perangkat.len(), perangkat });
}

fn normalisasi_mode(mode: Option<&str>) -> String {
    if mode == Some("produk") {
        "produk".into()
    } else {
        "beli".into()
    }
}

fn kirim_teks(nilai: serde_json::Value) -> Message {
    Message::Text(nilai.to_string())
}

fn kategori_json(shared: &Shared) -> serde_json::Value {
    let state = shared.app.state::<AppState>();
    let conn = state.db.lock().unwrap();
    let daftar = services::produk::list_kategori(&conn).unwrap_or_default();
    serde_json::to_value(daftar).unwrap_or_default()
}

fn ubah_mode_klien(shared: &Shared, id: u64, mode: &str) {
    if let Some(k) = shared.klien.lock().unwrap().iter_mut().find(|k| k.id == id) {
        k.mode = mode.to_string();
    }
}

/// Menyimpan produk baru yang dikirim dari HP, memakai validasi yang sama dengan menu Produk desktop.
fn simpan_produk_dari_hp(shared: &Shared, data: Option<serde_json::Value>) -> serde_json::Value {
    let gagal = |pesan: String| serde_json::json!({ "type": "produk_tersimpan", "ok": false, "pesan": pesan });
    if !shared.admin {
        return gagal("Hanya admin yang dapat menambah produk".into());
    }
    let input: ProdukInput = match serde_json::from_value(data.unwrap_or_default()) {
        Ok(i) => i,
        Err(_) => return gagal("Data produk tidak valid".into()),
    };
    let nama = input.nama.trim().to_string();

    let hasil = {
        let state = shared.app.state::<AppState>();
        let conn = state.db.lock().unwrap();
        let r = services::produk::create(&conn, shared.pengguna_id, input);
        if r.is_ok() {
            let _ = services::log_aktivitas::catat(
                &conn,
                shared.pengguna_id,
                "tambah_produk",
                Some(format!("{nama} (via HP)")),
            );
        }
        r
    };

    match hasil {
        Ok(id) => {
            // Beri tahu layar desktop agar daftar produk langsung menampilkan produk baru.
            let _ = shared.app.emit("produk-berubah", id);
            serde_json::json!({ "type": "produk_tersimpan", "ok": true, "nama": nama })
        }
        Err(e) => gagal(e.to_string()),
    }
}

fn simpan_kategori_dari_hp(shared: &Shared, nama: Option<String>) -> serde_json::Value {
    let galat = |pesan: String| serde_json::json!({ "type": "error", "pesan": pesan });
    if !shared.admin {
        return galat("Hanya admin yang dapat menambah kategori".into());
    }
    let id = {
        let state = shared.app.state::<AppState>();
        let conn = state.db.lock().unwrap();
        services::produk::create_kategori(&conn, &nama.unwrap_or_default())
    };
    match id {
        Ok(id) => {
            let _ = shared.app.emit("produk-berubah", id);
            serde_json::json!({ "type": "kategori", "list": kategori_json(shared), "dipilih": id })
        }
        Err(e) => galat(e.to_string()),
    }
}

async fn handle_socket(mut socket: WebSocket, shared: Shared, valid: bool, ip: String, nama: String) {
    if !valid {
        let _ = socket.send(Message::Text(r#"{"type":"denied"}"#.into())).await;
        return;
    }

    let id = ID_KLIEN.fetch_add(1, Ordering::SeqCst);
    let (kirim_putus, mut terima_putus) = unbounded_channel::<()>();
    shared.klien.lock().unwrap().push(Klien {
        id,
        nama: nama.clone(),
        ip,
        sejak: chrono::Local::now().to_rfc3339(),
        jumlah_scan: 0,
        mode: "beli".into(),
        putuskan: kirim_putus,
    });
    kirim_status(&shared);

    // Beri tahu HP fitur apa yang tersedia dan daftar kategori untuk form produk.
    let hello = serde_json::json!({
        "type": "hello",
        "bisa_tambah_produk": shared.admin,
        "kategori": kategori_json(&shared),
    });
    let _ = socket.send(kirim_teks(hello)).await;

    loop {
        tokio::select! {
            _ = terima_putus.recv() => {
                let _ = socket.send(Message::Text(r#"{"type":"kicked"}"#.into())).await;
                break;
            }
            msg = socket.recv() => {
                let Some(Ok(msg)) = msg else { break };
                let Message::Text(teks) = msg else { continue };
                let Ok(pesan) = serde_json::from_str::<PesanMasuk>(&teks) else { continue };

                match pesan.tipe.as_str() {
                    "mode" => {
                        ubah_mode_klien(&shared, id, &normalisasi_mode(pesan.mode.as_deref()));
                        kirim_status(&shared);
                    }
                    "kategori_baru" => {
                        let balasan = simpan_kategori_dari_hp(&shared, pesan.nama);
                        let _ = socket.send(kirim_teks(balasan)).await;
                    }
                    "produk_baru" => {
                        let balasan = simpan_produk_dari_hp(&shared, pesan.data);
                        let _ = socket.send(kirim_teks(balasan)).await;
                    }
                    "scan" => {
                        let mode = normalisasi_mode(pesan.mode.as_deref());
                        if mode == "produk" && !shared.admin {
                            let galat = serde_json::json!({ "type": "error", "pesan": "Hanya admin yang dapat menambah produk" });
                            let _ = socket.send(kirim_teks(galat)).await;
                            continue;
                        }
                        let code = pesan.code.unwrap_or_default().trim().to_string();
                        if code.is_empty() {
                            continue;
                        }
                        ubah_mode_klien(&shared, id, &mode);

                        let produk = {
                            let state = shared.app.state::<AppState>();
                            let conn = state.db.lock().unwrap();
                            varian_barcode(&code)
                                .iter()
                                .find_map(|c| services::produk::get_by_barcode(&conn, c).ok().flatten())
                        };
                        // Pakai barcode yang tersimpan di database agar pencarian ulang di UI selalu cocok.
                        let code = produk.as_ref().and_then(|p| p.barcode.clone()).unwrap_or(code);
                        let nama_produk = produk.as_ref().map(|p| p.nama.clone()).unwrap_or_default();
                        let found = produk.is_some();

                        if let Some(k) = shared.klien.lock().unwrap().iter_mut().find(|k| k.id == id) {
                            k.jumlah_scan += 1;
                        }

                        let balasan = serde_json::json!({
                            "type": "result", "mode": mode, "found": found, "code": code, "nama": nama_produk
                        });
                        let _ = socket.send(kirim_teks(balasan)).await;
                        let _ = shared.app.emit(
                            "hp-scanner-scan",
                            ScanEvent { code, mode, found, nama: nama_produk, perangkat: nama.clone() },
                        );
                        kirim_status(&shared);
                    }
                    _ => {}
                }
            }
        }
    }

    shared.klien.lock().unwrap().retain(|k| k.id != id);
    kirim_status(&shared);
}
