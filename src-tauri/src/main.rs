// Prevent console window on Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use walkdir::WalkDir;
use mailparse::{parse_mail, MailHeaderMap};
use tauri::Manager;

#[derive(serde::Serialize)]
struct EmailResult {
    subject: String,
    sender: String,
    date: String,
    path: String,
}

fn get_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let db_path = app_dir.join("cache.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // Auto-heal: If it detects the complex multi-folder schema, wipe it cleanly to reset
    if conn.execute("SELECT location_path FROM emails LIMIT 1", []).is_ok() {
        let _ = conn.execute("DROP TABLE IF EXISTS emails", []);
        let _ = conn.execute("DROP TABLE IF EXISTS locations", []);
    }

    // Classic config table for a single folder path
    conn.execute(
        "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)",
        [],
    ).map_err(|e| e.to_string())?;

    // Classic FTS5 without UNINDEXED constraints
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS emails USING fts5(subject, sender, body, date, path)",
        [],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn)
}

#[tauri::command]
fn get_registered_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let conn = get_db(&app)?;
    let mut stmt = conn.prepare("SELECT value FROM config WHERE key = 'onedrive_path'").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        return Ok(Some(row.get(0).map_err(|e| e.to_string())?));
    }
    Ok(None)
}

#[tauri::command]
async fn index_folder(app: tauri::AppHandle, folder_path: String) -> Result<String, String> {
    let conn = get_db(&app)?;
    
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('onedrive_path', ?)",
        params![folder_path],
    ).map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM emails", []).map_err(|e| e.to_string())?;

    for entry in WalkDir::new(&folder_path).into_iter().filter_map(|e| e.ok()) {
        if entry.path().extension().and_then(|s| s.to_str()) == Some("eml") {
            if let Ok(content) = std::fs::read(entry.path()) {
                if let Ok(parsed) = parse_mail(&content) {
                    let subject = parsed.headers.get_first_value("Subject").unwrap_or_default();
                    let sender = parsed.headers.get_first_value("From").unwrap_or_default();
                    let raw_date = parsed.headers.get_first_value("Date").unwrap_or_default();
                    let formatted_date = mailparse::dateparse(&raw_date)
                        .ok()
                        .and_then(|ts| chrono::DateTime::from_timestamp(ts, 0))
                        .map(|dt| dt.format("%b %d, %Y %I:%M %p").to_string())
                        .unwrap_or(raw_date);
                    let body = parsed.get_body().unwrap_or_default();
                    let path = entry.path().to_str().unwrap_or_default();

                    conn.execute(
                        "INSERT INTO emails (subject, sender, body, date, path) VALUES (?, ?, ?, ?, ?)",
                        params![subject, sender, body, formatted_date, path],
                    ).ok();
                }
            }
        }
    }
    Ok("Folder Synced".into())
}

#[tauri::command]
fn search_emails(app: tauri::AppHandle, query: String) -> Result<Vec<EmailResult>, String> {
    let conn = get_db(&app)?;
    
    let (sql, params_vec) = if query.trim().is_empty() {
        ("SELECT subject, sender, date, path FROM emails ORDER BY rowid DESC LIMIT 100".to_string(), vec![])
    } else {
        ("SELECT subject, sender, date, path FROM emails WHERE emails MATCH ? ORDER BY rank LIMIT 100".to_string(), vec![format!("{}*", query.trim())])
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(rusqlite::params_from_iter(params_vec), |row| {
        Ok(EmailResult { 
            subject: row.get(0)?, 
            sender: row.get(1)?, 
            date: row.get(2)?, 
            path: row.get(3)? 
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows { if let Ok(res) = row { results.push(res); } }
    Ok(results)
}

#[tauri::command]
fn open_eml(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("open")
            .arg("-a")
            .arg("Microsoft Outlook")
            .arg(&path)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err("Failed to open Outlook.".into());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("cmd")
            .arg("/c")
            .arg("start")
            .arg("")
            .arg(&path)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err("Failed to open the EML file on Windows.".into());
        }
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            index_folder, 
            search_emails, 
            open_eml, 
            get_registered_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}