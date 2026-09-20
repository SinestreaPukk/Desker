// Suppress the extra console window Windows opens for a GUI binary in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

/// Where the desktop shell points its webview.
///
/// The Desker server is a normal Next.js app, so the desktop build is a native
/// window onto a running instance rather than a second frontend. Point it at a
/// local server for the offline single-user demo, or at a deployed URL to give
/// the team a desktop client.
///
/// Resolution order:
///   1. the `DESKER_URL` environment variable
///   2. the `DESKER_URL` baked in at compile time
///   3. http://localhost:3000
fn server_url() -> String {
    if let Ok(url) = std::env::var("DESKER_URL") {
        if !url.trim().is_empty() {
            return url.trim().trim_end_matches('/').to_string();
        }
    }
    option_env!("DESKER_URL")
        .unwrap_or("http://localhost:3000")
        .trim_end_matches('/')
        .to_string()
}

#[tauri::command]
fn desker_server_url() -> String {
    server_url()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![desker_server_url])
        .setup(|app| {
            // The bundled shell/index.html is a connection screen. It probes the
            // server and, once healthy, navigates the window to the real app -
            // so a demo that forgets to start the server gets an explanation
            // instead of a blank white window.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(&format!("Desker — {}", server_url()));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Desker desktop shell");
}
