// scanner — native disk/dosya erişimi.
//   • list_volumes      : bağlı diskleri UUID + boş alan ile listele
//   • volume_connected  : bir disk (UUID) şu an bağlı mı?
//   • list_dir          : bir klasörün içeriğini gez (lazy browse)
//   • reveal_in_finder  : Finder'da göster
//   • open_path         : dosyayı/klasörü aç
//   • generate_preview  : QuickLook ile küçük önizleme (data URL döner)
//                         (XAVC/MXF için FFmpeg fallback bir sonraki adımda)

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use tauri::Manager;
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct VolumeInfo {
    pub id: String, // Volume UUID (yoksa mount yolu)
    pub label: String,
    pub mount_path: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub is_removable: bool,
}

// macOS: diskutil ile bir mount yolunun Volume UUID'sini al (rename'e dayanıklı kimlik).
#[cfg(target_os = "macos")]
fn volume_uuid(mount_path: &str) -> Option<String> {
    let out = Command::new("diskutil")
        .args(["info", mount_path])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        let l = line.trim();
        if let Some(rest) = l.strip_prefix("Volume UUID:") {
            return Some(rest.trim().to_string());
        }
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn volume_uuid(_mount_path: &str) -> Option<String> {
    None
}

#[tauri::command]
pub fn list_volumes() -> Vec<VolumeInfo> {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    let mut out = Vec::new();
    for d in &disks {
        let mount = d.mount_point().to_string_lossy().to_string();
        // Sadece dahili kök ("/") ve harici diskleri ("/Volumes/*") göster.
        // Sistem yardımcı bölümlerini (Preboot, VM, Recovery, Data…) ele.
        let is_root = mount == "/";
        let is_external = mount.starts_with("/Volumes/");
        if !is_root && !is_external {
            continue;
        }
        let label = if is_root {
            "Macintosh HD".to_string()
        } else {
            let l = d.name().to_string_lossy().to_string();
            if l.is_empty() {
                Path::new(&mount)
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| mount.clone())
            } else {
                l
            }
        };
        let id = volume_uuid(&mount).unwrap_or_else(|| mount.clone());
        out.push(VolumeInfo {
            id,
            label,
            mount_path: mount,
            total_bytes: d.total_space(),
            free_bytes: d.available_space(),
            is_removable: d.is_removable(),
        });
    }
    out
}

#[tauri::command]
pub fn volume_connected(volume_id: String) -> bool {
    list_volumes().iter().any(|v| v.id == volume_id)
}

#[derive(Serialize)]
pub struct DirEntryInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub kind: String,
    pub modified_ms: u64,
}

fn classify(name: &str, is_dir: bool) -> String {
    if is_dir {
        return "folder".into();
    }
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    let video = [
        "mov", "mp4", "m4v", "mxf", "avi", "mkv", "mts", "m2ts", "xavc", "braw", "r3d", "webm",
    ];
    let image = [
        "jpg", "jpeg", "png", "heic", "heif", "tif", "tiff", "gif", "webp", "bmp", "psd", "ai",
        "dng", "arw", "cr2", "cr3", "nef", "raf", "orf", "rw2",
    ];
    let audio = ["wav", "mp3", "aac", "aiff", "aif", "m4a", "flac", "ogg"];
    let doc = ["pdf", "doc", "docx", "txt", "rtf", "key", "pages", "xlsx", "csv", "ppt", "pptx"];
    if video.contains(&ext.as_str()) {
        "video".into()
    } else if image.contains(&ext.as_str()) {
        "image".into()
    } else if audio.contains(&ext.as_str()) {
        "audio".into()
    } else if doc.contains(&ext.as_str()) {
        "doc".into()
    } else {
        "other".into()
    }
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntryInfo>, String> {
    let rd = fs::read_dir(&path).map_err(|e| format!("{path}: {e}"))?;
    let mut out = Vec::new();
    for entry in rd.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue; // gizli dosyaları atla
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let is_dir = meta.is_dir();
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        out.push(DirEntryInfo {
            path: entry.path().to_string_lossy().to_string(),
            name: name.clone(),
            is_dir,
            size: if is_dir { 0 } else { meta.len() },
            kind: classify(&name, is_dir),
            modified_ms,
        });
    }
    // Klasörler önce, sonra ada göre
    out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(out)
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// QuickLook ile bir karenin PNG baytlarını üret (XAVC/MXF FFmpeg fallback sonraki adım).
fn ql_png_bytes(path: &str, size: u32) -> Option<Vec<u8>> {
    let src = Path::new(path);
    if !src.exists() {
        return None;
    }
    let tmp = std::env::temp_dir().join("intiba-ql");
    let _ = fs::create_dir_all(&tmp);
    let out = Command::new("qlmanage")
        .args([
            "-t",
            "-s",
            &size.to_string(),
            "-o",
            tmp.to_string_lossy().as_ref(),
            path,
        ])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let fname = src.file_name()?.to_string_lossy().to_string();
    let produced = tmp.join(format!("{fname}.png"));
    let bytes = fs::read(&produced).ok()?;
    let _ = fs::remove_file(&produced);
    Some(bytes)
}

fn to_data_url(bytes: &[u8]) -> String {
    format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )
}

// Canlı (önbelleksiz) önizleme — dahili disk gibi indekslenmeyen yerler için.
#[tauri::command]
pub fn generate_preview(path: String, size: Option<u32>) -> Result<Option<String>, String> {
    Ok(ql_png_bytes(&path, size.unwrap_or(384)).map(|b| to_data_url(&b)))
}

// ───────────────────────── OFFLINE İNDEKS (sadece harici diskler) ──────────

fn djb2(s: &str) -> String {
    let mut h: u64 = 5381;
    for b in s.bytes() {
        h = h.wrapping_mul(33).wrapping_add(b as u64);
    }
    format!("{h:x}")
}

fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect()
}

fn data_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok()
}
fn index_file(app: &tauri::AppHandle, drive_id: &str) -> Option<PathBuf> {
    data_dir(app).map(|d| d.join("index").join(format!("{}.json", sanitize(drive_id))))
}
fn thumb_file(app: &tauri::AppHandle, drive_id: &str, rel_path: &str) -> Option<PathBuf> {
    data_dir(app).map(|d| {
        d.join("thumbs")
            .join(sanitize(drive_id))
            .join(format!("{}.png", djb2(rel_path)))
    })
}
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Serialize, Deserialize)]
pub struct IndexEntry {
    pub rel_path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub kind: String,
    pub modified_ms: u64,
}

#[derive(Serialize, Deserialize)]
pub struct IndexDoc {
    pub drive_id: String,
    pub mount_path: String,
    pub scanned_at_ms: u64,
    pub entries: Vec<IndexEntry>,
}

#[derive(Serialize)]
pub struct ScanResult {
    pub files: u64,
    pub dirs: u64,
    pub scanned_at_ms: u64,
}

// Bir harici diski recursive tara → indeks JSON'unu app data'ya yaz.
// Dahili disk ("/") reddedilir (sadece harici). Dosya KOPYALANMAZ; sadece
// metadata (yol, ad, boyut, tür) saklanır. Önizlemeler tembel önbelleklenir.
#[tauri::command]
pub fn scan_drive(
    app: tauri::AppHandle,
    mount_path: String,
    drive_id: String,
) -> Result<ScanResult, String> {
    if mount_path == "/" || !mount_path.starts_with("/Volumes/") {
        return Err("Sadece harici diskler indekslenir".into());
    }
    let mount = PathBuf::from(&mount_path);
    if !mount.exists() {
        return Err("Disk bağlı değil".into());
    }
    let mut entries: Vec<IndexEntry> = Vec::new();
    let (mut files, mut dirs) = (0u64, 0u64);

    for e in WalkDir::new(&mount)
        .into_iter()
        .filter_entry(|e| {
            // gizli dosya/klasörleri (.) atla, kökü tut
            e.depth() == 0
                || e.file_name()
                    .to_str()
                    .map(|s| !s.starts_with('.'))
                    .unwrap_or(false)
        })
        .flatten()
    {
        if e.depth() == 0 {
            continue;
        }
        let p = e.path();
        let name = e.file_name().to_string_lossy().to_string();
        let rel = p
            .strip_prefix(&mount)
            .unwrap_or(p)
            .to_string_lossy()
            .to_string();
        let meta = match e.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let is_dir = meta.is_dir();
        if is_dir {
            dirs += 1;
        } else {
            files += 1;
        }
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        entries.push(IndexEntry {
            rel_path: rel,
            name: name.clone(),
            is_dir,
            size: if is_dir { 0 } else { meta.len() },
            kind: classify(&name, is_dir),
            modified_ms,
        });
    }

    let scanned_at_ms = now_ms();
    let doc = IndexDoc {
        drive_id: drive_id.clone(),
        mount_path,
        scanned_at_ms,
        entries,
    };
    let path = index_file(&app, &drive_id).ok_or("app data dizini yok")?;
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string(&doc).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(ScanResult {
        files,
        dirs,
        scanned_at_ms,
    })
}

// İndeks var mı? → varsa tarama zamanı (ms), yoksa None.
#[tauri::command]
pub fn index_status(app: tauri::AppHandle, drive_id: String) -> Option<u64> {
    let path = index_file(&app, &drive_id)?;
    let meta = fs::metadata(&path).ok()?;
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

// Kayıtlı indeksi oku (offline gezinme için).
#[tauri::command]
pub fn load_index(app: tauri::AppHandle, drive_id: String) -> Result<IndexDoc, String> {
    let path = index_file(&app, &drive_id).ok_or("app data dizini yok")?;
    let raw = fs::read_to_string(&path).map_err(|_| "İndeks bulunamadı".to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

// Önizleme: önce önbellek; yoksa abs_path verilmişse üret+önbelleğe yaz (online).
// Offline'da (abs_path yok) sadece önbellekteki döner.
#[tauri::command]
pub fn get_thumb(
    app: tauri::AppHandle,
    drive_id: String,
    rel_path: String,
    abs_path: Option<String>,
    size: Option<u32>,
) -> Option<String> {
    let cache = thumb_file(&app, &drive_id, &rel_path)?;
    if let Ok(bytes) = fs::read(&cache) {
        return Some(to_data_url(&bytes));
    }
    let ap = abs_path?;
    let png = ql_png_bytes(&ap, size.unwrap_or(384))?;
    if let Some(parent) = cache.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&cache, &png);
    Some(to_data_url(&png))
}
