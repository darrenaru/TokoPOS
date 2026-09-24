use rusqlite::Connection;
use std::sync::Mutex;
use tauri::AppHandle;

use crate::models::Pengguna;

pub struct AppState {
    pub db: Mutex<Connection>,
    /// Sesi login disimpan di memory (bukan localStorage).
    pub current_user: Mutex<Option<Pengguna>>,
    pub app_handle: AppHandle,
    pub phone_scanner: Mutex<Option<crate::services::phone_scanner::ScannerRuntime>>,
}
