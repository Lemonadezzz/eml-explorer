// Prevent console window on Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use walkdir::WalkDir;
use mailparse::{parse_mail, MailHeaderMap, ParsedMail};
use tauri::Manager;
use chrono::{DateTime, Utc, FixedOffset};

#[derive(serde::Serialize)]
struct EmailResult {
    subject: String,
    sender: String,
    recipient: String,
    date: String,
    body: String,
    path: String,
    has_attachments: bool,
}

#[derive(serde::Serialize)]
struct UserInfo {
    username: String,
    full_name: String,
}

#[derive(serde::Serialize)]
struct FileNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<FileNode>,
}

fn find_body(part: &ParsedMail) -> Option<String> {
    let content_type = part.headers.get_first_value("Content-Type").unwrap_or_default().to_lowercase();
    if content_type.contains("text/plain") {
        return part.get_body().ok();
    }
    for subpart in &part.subparts {
        if let Some(body) = find_body(subpart) {
            return Some(body);
        }
    }
    if content_type.contains("multipart/") {
        for subpart in &part.subparts {
            let sub_ct = subpart.headers.get_first_value("Content-Type").unwrap_or_default().to_lowercase();
            if sub_ct.contains("text/html") {
                return subpart.get_body().ok();
            }
        }
    }
    if part.subparts.is_empty() {
        return part.get_body().ok();
    }
    None
}

fn get_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let db_path = app_dir.join("cache.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // Check if the current table matches exactly what we need (recipient and has_attachments)
    let has_recipient = conn.prepare("SELECT recipient FROM emails LIMIT 0").is_ok();
    let has_attachments = conn.prepare("SELECT has_attachments FROM emails LIMIT 0").is_ok();

    if !has_recipient || !has_attachments {
        let _ = conn.execute("DROP TABLE IF EXISTS emails", []);
        let _ = conn.execute("DROP TABLE IF EXISTS locations", []);
    }

    conn.execute("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)", []).map_err(|e| e.to_string())?;
    conn.execute("CREATE VIRTUAL TABLE IF NOT EXISTS emails USING fts5(subject, sender, recipient, body, date, path, has_attachments UNINDEXED)", []).map_err(|e| e.to_string())?;
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
    conn.execute("INSERT OR REPLACE INTO config (key, value) VALUES ('onedrive_path', ?)", params![folder_path]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM emails", []).map_err(|e| e.to_string())?;

    let offset = FixedOffset::east_opt(8 * 3600).unwrap();

    for entry in WalkDir::new(&folder_path).into_iter().filter_map(|e| e.ok()) {
        if entry.path().extension().and_then(|s| s.to_str()) == Some("eml") {
            if let Ok(content) = std::fs::read(entry.path()) {
                if let Ok(parsed) = parse_mail(&content) {
                    let subject = parsed.headers.get_first_value("Subject").unwrap_or_default();
                    let sender = parsed.headers.get_first_value("From").unwrap_or_default();
                    let recipient = parsed.headers.get_first_value("To").unwrap_or_default();
                    let raw_date = parsed.headers.get_first_value("Date").unwrap_or_default();
                    
                    let iso_date = mailparse::dateparse(&raw_date)
                        .ok()
                        .and_then(|ts| DateTime::<Utc>::from_timestamp(ts, 0))
                        .map(|dt| dt.with_timezone(&offset).to_rfc3339())
                        .unwrap_or_else(|| raw_date.clone());
                    
                    let body = find_body(&parsed).unwrap_or_default();
                    let path = entry.path().to_str().unwrap_or_default();
                    let has_attachments = parsed.subparts.iter().any(|p| {
                        p.headers.get_first_value("Content-Disposition")
                            .map(|cd| cd.to_lowercase().contains("attachment"))
                            .unwrap_or(false)
                    });

                    conn.execute(
                        "INSERT INTO emails (subject, sender, recipient, body, date, path, has_attachments) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        params![subject, sender, recipient, body, iso_date, path, if has_attachments { 1 } else { 0 }],
                    ).ok();
                }
            }
        }
    }
    Ok("Folder Synced".into())
}

#[tauri::command]
fn get_file_tree(root_path: String) -> Result<FileNode, String> {
    fn build_tree(path: &std::path::Path) -> Result<FileNode, String> {
        let name = path.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_string();
        let mut children = Vec::new();

        if path.is_dir() {
            let entries = std::fs::read_dir(path).map_err(|e| e.to_string())?;
            for entry in entries {
                let entry = entry.map_err(|e| e.to_string())?;
                let p = entry.path();
                if p.is_dir() {
                    if let Ok(child) = build_tree(&p) {
                        children.push(child);
                    }
                }
            }
            // Sort alphabetical
            children.sort_by(|a, b| {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            });
        }

        Ok(FileNode {
            name,
            path: path.to_str().unwrap_or_default().to_string(),
            is_dir: path.is_dir(),
            children,
        })
    }

    build_tree(std::path::Path::new(&root_path))
}

#[tauri::command]
fn search_emails(app: tauri::AppHandle, query: String, path_filter: Option<String>) -> Result<Vec<EmailResult>, String> {
    let conn = get_db(&app)?;
    let mut params_vec: Vec<String> = Vec::new();
    
    let mut sql = "SELECT subject, sender, recipient, date, body, path, has_attachments FROM emails".to_string();
    let mut conditions = Vec::new();

    if !query.trim().is_empty() {
        conditions.push("emails MATCH ?".to_string());
        params_vec.push(format!("{}*", query.trim()));
    }

    if let Some(ref filter) = path_filter {
        conditions.push("path LIKE ?".to_string());
        params_vec.push(format!("{}%", filter));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }

    if query.trim().is_empty() {
        sql.push_str(" ORDER BY date DESC");
    } else {
        sql.push_str(" ORDER BY rank");
    }
    
    // user requested all emails to be loaded without arbitrary limits
    // sql.push_str(" LIMIT 100"); 

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(rusqlite::params_from_iter(params_vec), |row| {
        Ok(EmailResult { 
            subject: row.get::<_, String>(0)?, 
            sender: row.get::<_, String>(1)?, 
            recipient: row.get::<_, String>(2)?,
            date: row.get::<_, String>(3)?, 
            body: row.get::<_, String>(4)?,
            path: row.get::<_, String>(5)?,
            has_attachments: row.get::<_, i32>(6)? == 1
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
        let _ = std::process::Command::new("open").arg("-a").arg("Microsoft Outlook").arg(&path).output();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").arg("/c").arg("start").arg("").arg(&path).output();
    }
    Ok(())
}

#[tauri::command]
fn get_user_info() -> Result<UserInfo, String> {
    let username = std::env::var("USER").unwrap_or_else(|_| "User".to_string());
    let full_name = std::process::Command::new("id")
        .arg("-F")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| username.clone());
    
    Ok(UserInfo { username, full_name })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![index_folder, search_emails, open_eml, get_registered_path, get_user_info, get_file_tree])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}