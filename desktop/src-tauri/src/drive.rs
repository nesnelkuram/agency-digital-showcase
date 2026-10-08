// drive — Google Drive'a KALDIĞI YERDEN DEVAM EDEN (resumable) yükleme.
//   Sorun: web'den yüklerken HDD çıkar/bağlantı kopar → yükleme baştan başlar.
//   Çözüm: Drive'ın resumable upload protokolü. Her dosya için bir oturum URI'si
//   açılır; kopma olursa sunucuya "kaç bayt aldın?" sorulur ve O BAYTTAN devam edilir.
//   Oturum URI'si + toplam boyut diske kaydedilir → uygulama kapanıp açılsa, HDD
//   çıkıp tekrar takılsa bile yükleme sıfırlanmaz. Bitince Drive'ın md5'i ile doğrulanır.
//
//   ÖN KOŞUL (kullanıcı): Google Cloud Console'da bir "Desktop app" OAuth istemcisi +
//   Drive API etkin. client_id/secret uygulamaya bir kez girilir (drive_set_credentials).

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

// Tam drive kapsamı — ortak (shared) sürücüleri listeleyip içindeki mevcut
// klasörleri ada göre bulabilmek için gerekir. Testing modunda + test user
// olduğunuz için Google doğrulaması GEREKMEZ.
const SCOPE: &str = "https://www.googleapis.com/auth/drive";
const CHUNK: u64 = 16 * 1024 * 1024; // 16 MiB (256 KiB katı olmalı)
const FOLDER_MIME: &str = "application/vnd.google-apps.folder";

// ───────────────────────── depolama yardımcıları ─────────────────────────

fn drive_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let d = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("drive");
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

#[derive(Serialize, Deserialize, Clone)]
struct Creds {
    client_id: String,
    client_secret: String,
}

fn load_creds(app: &tauri::AppHandle) -> Option<Creds> {
    let p = drive_dir(app).ok()?.join("credentials.json");
    let raw = fs::read_to_string(p).ok()?;
    serde_json::from_str(&raw).ok()
}

#[derive(Serialize, Deserialize, Clone)]
struct Token {
    access_token: String,
    refresh_token: String,
    expires_at: u64, // epoch saniye
    email: Option<String>,
}

fn load_token(app: &tauri::AppHandle) -> Option<Token> {
    let p = drive_dir(app).ok()?.join("token.json");
    let raw = fs::read_to_string(p).ok()?;
    serde_json::from_str(&raw).ok()
}
fn save_token(app: &tauri::AppHandle, t: &Token) -> Result<(), String> {
    let p = drive_dir(app)?.join("token.json");
    fs::write(p, serde_json::to_string(t).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn hash_key(s: &str) -> String {
    let mut h: u64 = 5381;
    for b in s.bytes() {
        h = h.wrapping_mul(33).wrapping_add(b as u64);
    }
    format!("{h:x}")
}

// ───────────────────────── OAuth ─────────────────────────

#[derive(Serialize)]
pub struct DriveStatus {
    pub configured: bool, // client_id/secret girilmiş mi
    pub connected: bool,  // geçerli refresh_token var mı
    pub email: Option<String>,
}

#[tauri::command]
pub fn drive_status(app: tauri::AppHandle) -> DriveStatus {
    let configured = load_creds(&app).is_some();
    let token = load_token(&app);
    DriveStatus {
        configured,
        connected: token.is_some(),
        email: token.and_then(|t| t.email),
    }
}

#[tauri::command]
pub fn drive_set_credentials(
    app: tauri::AppHandle,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    let c = Creds {
        client_id: client_id.trim().to_string(),
        client_secret: client_secret.trim().to_string(),
    };
    let p = drive_dir(&app)?.join("credentials.json");
    fs::write(p, serde_json::to_string(&c).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn drive_disconnect(app: tauri::AppHandle) -> Result<(), String> {
    let p = drive_dir(&app)?.join("token.json");
    let _ = fs::remove_file(p);
    Ok(())
}

// Tarayıcıyı aç → loopback ile auth code yakala → token al. Email döner.
#[tauri::command]
pub async fn drive_connect(app: tauri::AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || connect_blocking(app))
        .await
        .map_err(|e| e.to_string())?
}

fn connect_blocking(app: tauri::AppHandle) -> Result<String, String> {
    use std::net::TcpListener;

    let creds = load_creds(&app).ok_or("Önce Google OAuth bilgilerini gir")?;

    // Loopback sunucusu — rastgele port.
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect = format!("http://127.0.0.1:{port}");

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        urlencode(&creds.client_id),
        urlencode(&redirect),
        urlencode(SCOPE),
    );
    // Tarayıcıda aç (open ile).
    let _ = std::process::Command::new("open").arg(&auth_url).spawn();

    // Yönlendirmeyi bekle (en çok 5 dk).
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + std::time::Duration::from_secs(300);
    let code = loop {
        if Instant::now() > deadline {
            return Err("Giriş zaman aşımına uğradı".into());
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]);
                let first = req.lines().next().unwrap_or("");
                // "GET /?code=XYZ&scope=... HTTP/1.1"
                let code = first
                    .split_whitespace()
                    .nth(1)
                    .and_then(|p| p.split("code=").nth(1))
                    .map(|c| c.split('&').next().unwrap_or("").to_string());
                let body = "<html><body style='font-family:-apple-system;padding:40px;text-align:center'><h2>intiba — Google bağlandı ✓</h2><p>Bu sekmeyi kapatabilirsiniz.</p></body></html>";
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                use std::io::Write;
                let _ = stream.write_all(resp.as_bytes());
                match code {
                    Some(c) if !c.is_empty() => break c,
                    _ => return Err("Yetki kodu alınamadı".into()),
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(std::time::Duration::from_millis(120));
                continue;
            }
            Err(e) => return Err(e.to_string()),
        }
    };

    // code → token
    let resp = ureq::post("https://oauth2.googleapis.com/token")
        .send_form(&[
            ("code", code.as_str()),
            ("client_id", creds.client_id.as_str()),
            ("client_secret", creds.client_secret.as_str()),
            ("redirect_uri", redirect.as_str()),
            ("grant_type", "authorization_code"),
        ])
        .map_err(|e| format!("token alınamadı: {e}"))?;
    let v: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    let access_token = v["access_token"].as_str().unwrap_or("").to_string();
    let refresh_token = v["refresh_token"].as_str().unwrap_or("").to_string();
    let expires_in = v["expires_in"].as_u64().unwrap_or(3600);
    if access_token.is_empty() || refresh_token.is_empty() {
        return Err("Geçersiz token yanıtı".into());
    }

    let email = fetch_email(&access_token);
    let token = Token {
        access_token,
        refresh_token,
        expires_at: now_secs() + expires_in - 60,
        email: email.clone(),
    };
    save_token(&app, &token)?;
    Ok(email.unwrap_or_else(|| "bağlandı".into()))
}

fn fetch_email(access_token: &str) -> Option<String> {
    let resp = ureq::get("https://www.googleapis.com/drive/v3/about")
        .query("fields", "user")
        .set("Authorization", &format!("Bearer {access_token}"))
        .call()
        .ok()?;
    let v: serde_json::Value = resp.into_json().ok()?;
    v["user"]["emailAddress"].as_str().map(|s| s.to_string())
}

// Geçerli access token döndür (gerekirse refresh et).
fn valid_access_token(app: &tauri::AppHandle) -> Result<String, String> {
    let mut token = load_token(app).ok_or("Drive bağlı değil")?;
    if now_secs() < token.expires_at {
        return Ok(token.access_token);
    }
    let creds = load_creds(app).ok_or("OAuth bilgisi yok")?;
    let resp = ureq::post("https://oauth2.googleapis.com/token")
        .send_form(&[
            ("client_id", creds.client_id.as_str()),
            ("client_secret", creds.client_secret.as_str()),
            ("refresh_token", token.refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .map_err(|e| format!("token yenilenemedi: {e}"))?;
    let v: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    let at = v["access_token"].as_str().unwrap_or("").to_string();
    if at.is_empty() {
        return Err("token yenileme başarısız".into());
    }
    token.access_token = at.clone();
    token.expires_at = now_secs() + v["expires_in"].as_u64().unwrap_or(3600) - 60;
    save_token(app, &token)?;
    Ok(at)
}

// ───────────────────────── ortak sürücüler ─────────────────────────

#[derive(Serialize)]
pub struct SharedDrive {
    pub id: String,
    pub name: String,
}

// Kullanıcının erişebildiği ortak (shared) sürücüleri listele.
#[tauri::command]
pub fn drive_list_shared_drives(app: tauri::AppHandle) -> Result<Vec<SharedDrive>, String> {
    let access = valid_access_token(&app)?;
    let r = ureq::get("https://www.googleapis.com/drive/v3/drives")
        .query("fields", "drives(id,name)")
        .query("pageSize", "100")
        .set("Authorization", &format!("Bearer {access}"))
        .call()
        .map_err(|e| format!("ortak sürücüler alınamadı: {e}"))?;
    let v: serde_json::Value = r.into_json().map_err(|e| e.to_string())?;
    let out = v["drives"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|d| {
                    Some(SharedDrive {
                        id: d["id"].as_str()?.to_string(),
                        name: d["name"].as_str().unwrap_or("Ortak sürücü").to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(out)
}

#[derive(Serialize)]
pub struct DriveFolder {
    pub id: String,
    pub name: String,
}

// Bir klasörün (veya sürücü kökünün) alt klasörlerini listele — gezinerek hedef seçmek için.
// drive_id: Some → ortak sürücü; parent_id: Some → o klasörün içi, None → kök.
#[tauri::command]
pub fn drive_list_folders(
    app: tauri::AppHandle,
    drive_id: Option<String>,
    parent_id: Option<String>,
) -> Result<Vec<DriveFolder>, String> {
    let access = valid_access_token(&app)?;
    let shared = drive_id.as_deref();
    let parent = parent_id.as_deref().or(shared).unwrap_or("root");
    let q = format!(
        "'{}' in parents and mimeType = '{}' and trashed = false",
        parent, FOLDER_MIME
    );
    let mut req = ureq::get("https://www.googleapis.com/drive/v3/files")
        .query("q", &q)
        .query("fields", "files(id,name)")
        .query("orderBy", "name")
        .query("pageSize", "200")
        .query("spaces", "drive")
        .query("supportsAllDrives", "true")
        .set("Authorization", &format!("Bearer {access}"));
    if let Some(did) = shared {
        req = req
            .query("corpora", "drive")
            .query("driveId", did)
            .query("includeItemsFromAllDrives", "true");
    }
    let r = req.call().map_err(|e| format!("klasörler alınamadı: {e}"))?;
    let v: serde_json::Value = r.into_json().map_err(|e| e.to_string())?;
    let out = v["files"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|f| {
                    Some(DriveFolder {
                        id: f["id"].as_str()?.to_string(),
                        name: f["name"].as_str().unwrap_or("Klasör").to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(out)
}

// ───────────────────────── klasör çözümü ─────────────────────────

// İsimle klasör bul; yoksa oluştur. parent = somut id (driveId / klasör id / "root").
// shared_drive = Some(driveId) → ortak sürücüde arama/yazma parametreleri eklenir.
fn find_or_create_folder(
    access_token: &str,
    name: &str,
    parent: &str,
    shared_drive: Option<&str>,
) -> Result<String, String> {
    let q = format!(
        "name = '{}' and mimeType = '{}' and trashed = false and '{}' in parents",
        name.replace('\'', "\\'"),
        FOLDER_MIME,
        parent
    );
    let mut req = ureq::get("https://www.googleapis.com/drive/v3/files")
        .query("q", &q)
        .query("fields", "files(id,name)")
        .query("spaces", "drive")
        .query("supportsAllDrives", "true")
        .set("Authorization", &format!("Bearer {access_token}"));
    if let Some(did) = shared_drive {
        req = req
            .query("corpora", "drive")
            .query("driveId", did)
            .query("includeItemsFromAllDrives", "true");
    }
    if let Ok(r) = req.call() {
        if let Ok(v) = r.into_json::<serde_json::Value>() {
            if let Some(id) = v["files"].get(0).and_then(|f| f["id"].as_str()) {
                return Ok(id.to_string());
            }
        }
    }
    // oluştur
    let body = serde_json::json!({
        "name": name,
        "mimeType": FOLDER_MIME,
        "parents": [parent],
    });
    let r = ureq::post("https://www.googleapis.com/drive/v3/files")
        .query("fields", "id")
        .query("supportsAllDrives", "true")
        .set("Authorization", &format!("Bearer {access_token}"))
        .send_json(body)
        .map_err(|e| format!("klasör oluşturulamadı: {e}"))?;
    let v: serde_json::Value = r.into_json().map_err(|e| e.to_string())?;
    v["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "klasör id yok".into())
}

// ───────────────────────── yükleme ─────────────────────────

#[derive(Serialize, Clone)]
struct DriveProgress {
    phase: String, // "init" | "upload" | "verify" | "file_done" | "done"
    file_index: usize,
    file_total: usize,
    file_name: String,
    bytes_done: u64,
    bytes_total: u64,
    speed_bps: u64,
    resumed: bool,
}

#[derive(Serialize)]
pub struct DriveSummary {
    pub uploaded: u64,
    pub verified: u64,
    pub failed: u64,
    pub skipped: u64,
    pub total_bytes: u64,
    pub elapsed_ms: u64,
    pub failures: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct Session {
    uri: String,
    total: u64,
}

fn session_path(app: &tauri::AppHandle, local: &str, size: u64) -> Result<PathBuf, String> {
    Ok(drive_dir(app)?
        .join("sessions")
        .join(format!("{}.json", hash_key(&format!("{local}:{size}")))))
}

// local_paths: dosya/klasör yolları.
// drive_id: None → My Drive; Some → ortak (shared) sürücü.
// parent_folder_id: gezinerek seçilen hedef klasör (None → sürücü kökü).
// dest_subfolder: opsiyonel — hedef klasör içinde oluşturulacak yeni alt klasör adı.
#[tauri::command]
pub async fn drive_upload(
    app: tauri::AppHandle,
    local_paths: Vec<String>,
    drive_id: Option<String>,
    parent_folder_id: Option<String>,
    dest_subfolder: Option<String>,
    verify: bool,
) -> Result<DriveSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        upload_blocking(app, local_paths, drive_id, parent_folder_id, dest_subfolder, verify)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn upload_blocking(
    app: tauri::AppHandle,
    local_paths: Vec<String>,
    drive_id: Option<String>,
    parent_folder_id: Option<String>,
    dest_subfolder: Option<String>,
    verify: bool,
) -> Result<DriveSummary, String> {
    use std::collections::HashMap;
    use walkdir::WalkDir;

    let access = valid_access_token(&app)?;
    let shared = drive_id.as_deref();
    // Taban klasör: seçilen klasör → yoksa ortak sürücü kökü → yoksa My Drive kökü.
    let base = parent_folder_id.as_deref().or(shared).unwrap_or("root");
    // Opsiyonel yeni alt klasör; verilmezse doğrudan seçilen klasöre yükle.
    let root_folder = match dest_subfolder.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        Some(name) => find_or_create_folder(&access, name, base, shared)?,
        None => base.to_string(),
    };

    // İş listesi: (yerel yol, Drive göreli klasör yolu, dosya adı, boyut)
    struct Item {
        local: String,
        rel_dir: String, // Drive'da root_folder altındaki alt klasör (boş=doğrudan)
        name: String,
        size: u64,
    }
    let mut work: Vec<Item> = Vec::new();
    for p in &local_paths {
        let pb = PathBuf::from(p);
        if pb.is_dir() {
            let base = pb.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
            for e in WalkDir::new(&pb)
                .into_iter()
                .filter_entry(|e| {
                    e.depth() == 0
                        || e.file_name().to_str().map(|s| !s.starts_with('.')).unwrap_or(false)
                })
                .flatten()
            {
                if e.file_type().is_dir() {
                    continue;
                }
                let rel = e.path().strip_prefix(&pb).unwrap_or(e.path());
                let rel_dir_inner = rel
                    .parent()
                    .map(|d| d.to_string_lossy().to_string())
                    .unwrap_or_default();
                let rel_dir = if rel_dir_inner.is_empty() {
                    base.clone()
                } else {
                    format!("{base}/{rel_dir_inner}")
                };
                let size = e.metadata().map(|m| m.len()).unwrap_or(0);
                work.push(Item {
                    local: e.path().to_string_lossy().to_string(),
                    rel_dir,
                    name: e.file_name().to_string_lossy().to_string(),
                    size,
                });
            }
        } else if pb.is_file() {
            let size = pb.metadata().map(|m| m.len()).unwrap_or(0);
            work.push(Item {
                local: p.clone(),
                rel_dir: String::new(),
                name: pb.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default(),
                size,
            });
        }
    }

    let file_total = work.len();
    let total_bytes: u64 = work.iter().map(|i| i.size).sum();
    let started = Instant::now();
    let mut bytes_done = 0u64;
    let (mut uploaded, mut verified, mut failed, mut skipped) = (0u64, 0u64, 0u64, 0u64);
    let mut failures: Vec<String> = Vec::new();
    let mut folder_cache: HashMap<String, String> = HashMap::new();
    folder_cache.insert(String::new(), root_folder.clone());

    let emit = |app: &tauri::AppHandle, p: DriveProgress| {
        let _ = app.emit("drive-progress", p);
    };

    for (idx, item) in work.iter().enumerate() {
        if item.size == 0 {
            skipped += 1;
            continue;
        }
        // Token tazeliği (uzun yüklemede süresi dolabilir).
        let access = match valid_access_token(&app) {
            Ok(a) => a,
            Err(e) => {
                failed += 1;
                failures.push(format!("token: {e}"));
                continue;
            }
        };

        // Drive klasör zincirini çöz (önbellekli).
        let parent = match ensure_folder_chain(
            &access,
            &item.rel_dir,
            &root_folder,
            &mut folder_cache,
            shared,
        ) {
            Ok(id) => id,
            Err(e) => {
                failed += 1;
                failures.push(format!("klasör: {} — {e}", item.rel_dir));
                continue;
            }
        };

        emit(
            &app,
            DriveProgress {
                phase: "upload".into(),
                file_index: idx + 1,
                file_total,
                file_name: item.name.clone(),
                bytes_done,
                bytes_total: total_bytes,
                speed_bps: bps(bytes_done, started),
                resumed: false,
            },
        );

        match upload_one(
            &app,
            &access,
            item.local.as_str(),
            &item.name,
            item.size,
            &parent,
            shared,
            verify,
        ) {
            Ok(ok_verified) => {
                bytes_done += item.size;
                uploaded += 1;
                if ok_verified {
                    verified += 1;
                }
                emit(
                    &app,
                    DriveProgress {
                        phase: "file_done".into(),
                        file_index: idx + 1,
                        file_total,
                        file_name: item.name.clone(),
                        bytes_done,
                        bytes_total: total_bytes,
                        speed_bps: bps(bytes_done, started),
                        resumed: false,
                    },
                );
            }
            Err(e) => {
                failed += 1;
                failures.push(format!("{}: {e}", item.name));
            }
        }
    }

    emit(
        &app,
        DriveProgress {
            phase: "done".into(),
            file_index: file_total,
            file_total,
            file_name: String::new(),
            bytes_done,
            bytes_total: total_bytes,
            speed_bps: bps(bytes_done, started),
            resumed: false,
        },
    );

    Ok(DriveSummary {
        uploaded,
        verified,
        failed,
        skipped,
        total_bytes,
        elapsed_ms: started.elapsed().as_millis() as u64,
        failures,
    })
}

fn ensure_folder_chain(
    access: &str,
    rel_dir: &str,
    root: &str,
    cache: &mut std::collections::HashMap<String, String>,
    shared_drive: Option<&str>,
) -> Result<String, String> {
    if let Some(id) = cache.get(rel_dir) {
        return Ok(id.clone());
    }
    let mut parent = root.to_string();
    let mut acc = String::new();
    for seg in rel_dir.split('/').filter(|s| !s.is_empty()) {
        acc = if acc.is_empty() {
            seg.to_string()
        } else {
            format!("{acc}/{seg}")
        };
        if let Some(id) = cache.get(&acc) {
            parent = id.clone();
            continue;
        }
        let id = find_or_create_folder(access, seg, &parent, shared_drive)?;
        cache.insert(acc.clone(), id.clone());
        parent = id;
    }
    Ok(parent)
}

// Tek dosyayı resumable yükle. Oturum diske kaydedilir → kopmada devam.
// Dönüş: doğrulandı mı (verify=false ise daima false).
fn upload_one(
    app: &tauri::AppHandle,
    access: &str,
    local: &str,
    name: &str,
    total: u64,
    parent: &str,
    shared_drive: Option<&str>,
    verify: bool,
) -> Result<bool, String> {
    let spath = session_path(app, local, total)?;
    if let Some(p) = spath.parent() {
        let _ = fs::create_dir_all(p);
    }

    // Var olan oturumu yükle veya yeni başlat.
    let mut uploaded: u64 = 0;
    let session_uri: String = if let Some(s) = fs::read_to_string(&spath)
        .ok()
        .and_then(|r| serde_json::from_str::<Session>(&r).ok())
    {
        // Oturumun ne kadar aldığını sor.
        match query_session(&s.uri, total)? {
            UploadState::Incomplete(off) => {
                uploaded = off;
                s.uri
            }
            UploadState::Complete(md5) => {
                let _ = fs::remove_file(&spath);
                return Ok(verify_md5(local, &md5, verify));
            }
        }
    } else {
        let uri = start_session(access, name, total, parent, shared_drive)?;
        let _ = fs::write(
            &spath,
            serde_json::to_string(&Session {
                uri: uri.clone(),
                total,
            })
            .unwrap_or_default(),
        );
        uri
    };

    // Parçaları gönder.
    let mut f = fs::File::open(local).map_err(|e| e.to_string())?;
    while uploaded < total {
        let end = (uploaded + CHUNK).min(total) - 1; // dahil
        let len = (end - uploaded + 1) as usize;
        f.seek(SeekFrom::Start(uploaded)).map_err(|e| e.to_string())?;
        let mut chunk = vec![0u8; len];
        f.read_exact(&mut chunk).map_err(|e| e.to_string())?;
        let range = format!("bytes {}-{}/{}", uploaded, end, total);

        let res = ureq::put(&session_uri)
            .set("Content-Range", &range)
            .send_bytes(&chunk);
        match res {
            Ok(r) => {
                // 200/201 → tamam.
                let md5 = r
                    .into_json::<serde_json::Value>()
                    .ok()
                    .and_then(|v| v["md5Checksum"].as_str().map(|s| s.to_string()))
                    .unwrap_or_default();
                let _ = fs::remove_file(&spath);
                return Ok(verify_md5(local, &md5, verify));
            }
            Err(ureq::Error::Status(308, r)) => {
                // Devam — sunucunun aldığı son baytı oku.
                uploaded = parse_range_end(r.header("range")).map(|n| n + 1).unwrap_or(end + 1);
            }
            Err(e) => {
                // Oturum diskte duruyor; sonra devam edilebilir.
                return Err(format!("yükleme kesildi (devam edilebilir): {e}"));
            }
        }
    }
    // total'a ulaştıysak ama 200 görmediysek durum sorgula.
    match query_session(&session_uri, total)? {
        UploadState::Complete(md5) => {
            let _ = fs::remove_file(&spath);
            Ok(verify_md5(local, &md5, verify))
        }
        UploadState::Incomplete(_) => Err("yükleme tamamlanmadı".into()),
    }
}

fn start_session(
    access: &str,
    name: &str,
    total: u64,
    parent: &str,
    _shared_drive: Option<&str>,
) -> Result<String, String> {
    let meta = serde_json::json!({ "name": name, "parents": [parent] });
    let r = ureq::post("https://www.googleapis.com/upload/drive/v3/files")
        .query("uploadType", "resumable")
        .query("fields", "id,md5Checksum,name,size")
        .query("supportsAllDrives", "true")
        .set("Authorization", &format!("Bearer {access}"))
        .set("X-Upload-Content-Length", &total.to_string())
        .send_json(meta)
        .map_err(|e| format!("oturum açılamadı: {e}"))?;
    r.header("location")
        .map(|s| s.to_string())
        .ok_or_else(|| "oturum URI'si yok".into())
}

enum UploadState {
    Incomplete(u64), // sunucudaki bayt sayısı (offset)
    Complete(String), // md5
}

fn query_session(uri: &str, total: u64) -> Result<UploadState, String> {
    let res = ureq::put(uri)
        .set("Content-Range", &format!("bytes */{total}"))
        .send_bytes(&[]);
    match res {
        Ok(r) => {
            let md5 = r
                .into_json::<serde_json::Value>()
                .ok()
                .and_then(|v| v["md5Checksum"].as_str().map(|s| s.to_string()))
                .unwrap_or_default();
            Ok(UploadState::Complete(md5))
        }
        Err(ureq::Error::Status(308, r)) => {
            let off = parse_range_end(r.header("range")).map(|n| n + 1).unwrap_or(0);
            Ok(UploadState::Incomplete(off))
        }
        Err(ureq::Error::Status(404, _)) => Err("oturum süresi doldu — baştan".into()),
        Err(e) => Err(format!("durum sorgulanamadı: {e}")),
    }
}

// "bytes=0-1234" → 1234
fn parse_range_end(h: Option<&str>) -> Option<u64> {
    h?.rsplit('-').next()?.trim().parse::<u64>().ok()
}

fn verify_md5(local: &str, remote_md5: &str, verify: bool) -> bool {
    if !verify || remote_md5.is_empty() {
        return false;
    }
    md5_file(local).map(|m| m == remote_md5).unwrap_or(false)
}

fn md5_file(path: &str) -> Result<String, String> {
    use md5::{Digest, Md5};
    let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Md5::new();
    let mut buf = vec![0u8; 4 * 1024 * 1024];
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

fn bps(bytes: u64, since: Instant) -> u64 {
    let s = since.elapsed().as_secs_f64();
    if s <= 0.0 {
        0
    } else {
        (bytes as f64 / s) as u64
    }
}

// Minimal percent-encode (OAuth URL'leri için).
fn urlencode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
