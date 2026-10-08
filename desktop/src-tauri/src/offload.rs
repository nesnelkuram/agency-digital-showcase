// offload — kamera kartı aktarımı (ingest) + doğrulanmış kopya.
//   • detect_card  : bağlı bir diskin kamera kartı olup olmadığını anla (marka tahmini + medya dökümü)
//   • offload_card : kartı bir veya birden çok hedefe DOĞRULANMIŞ kopyala (xxHash64)
//                    her klip kopya sonrası kaynak↔hedef hash'i ile karşılaştırılır.
//                    İlerleme "offload-progress" event'i ile UI'ya akar; bitince MHL + JSON rapor yazılır.
//
// Tasarım notu: kopyalama/doğrulama markadan BAĞIMSIZDIR. Markaya özel olan tek şey
// kartı tanımak (detect_card). O yüzden motor üç markada da (Canon/Sony/Panasonic) ve
// tanımadığı kameralarda da aynı çalışır.

use serde::Serialize;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{Instant, UNIX_EPOCH};
use tauri::Emitter;
use walkdir::WalkDir;
use xxhash_rust::xxh64::Xxh64;

use crate::scanner::classify;

const CHUNK: usize = 4 * 1024 * 1024; // 4 MiB akış bloğu

// macOS sistem çöpü — kart aktarımında asla kopyalanmaz.
fn is_junk(name: &str) -> bool {
    name.starts_with('.')
        || name == "System Volume Information"
        || name == "$RECYCLE.BIN"
}

fn sanitize_seg(s: &str) -> String {
    let t: String = s
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let t = t.trim_matches('_').to_string();
    if t.is_empty() {
        "KART".into()
    } else {
        t
    }
}

// ───────────────────────── Kart algılama ─────────────────────────

#[derive(Serialize)]
pub struct CardFile {
    pub rel_path: String, // kart köküne göreli
    pub name: String,
    pub size: u64,
    pub kind: String,
}

#[derive(Serialize)]
pub struct CardInfo {
    pub is_card: bool,
    pub brand: Option<String>, // "Sony" | "Canon" | "Panasonic" | null (jenerik)
    pub label: String,
    pub mount_path: String,
    pub markers: Vec<String>, // bulunan işaret klasörleri (DCIM, PRIVATE, …)
    pub clip_count: u64,      // video dosyası sayısı
    pub file_count: u64,      // kopyalanacak toplam dosya
    pub total_bytes: u64,
    pub files: Vec<CardFile>,
}

#[tauri::command]
pub async fn detect_card(mount_path: String) -> Result<CardInfo, String> {
    tauri::async_runtime::spawn_blocking(move || detect_blocking(mount_path))
        .await
        .map_err(|e| e.to_string())?
}

fn detect_blocking(mount_path: String) -> Result<CardInfo, String> {
    let mount = PathBuf::from(&mount_path);
    if !mount.exists() {
        return Err("Disk bağlı değil".into());
    }

    // Üst seviye işaret klasörleri.
    const MARKER_DIRS: &[&str] = &[
        "DCIM", "PRIVATE", "CONTENTS", "XDROOT", "CLIP", "CLIPS", "AVCHD", "MISC", "DJI_001",
    ];
    let mut markers: Vec<String> = Vec::new();
    if let Ok(rd) = fs::read_dir(&mount) {
        for e in rd.flatten() {
            if let Ok(ft) = e.file_type() {
                if ft.is_dir() {
                    let n = e.file_name().to_string_lossy().to_uppercase();
                    if MARKER_DIRS.contains(&n.as_str()) {
                        markers.push(e.file_name().to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // Medya dökümü + marka sezgisi (yol/uzantı işaretlerinden).
    let mut files: Vec<CardFile> = Vec::new();
    let (mut clip_count, mut total_bytes) = (0u64, 0u64);
    let (mut media_files, mut all_files) = (0u64, 0u64);
    let (mut sony, mut canon, mut pana) = (0u32, 0u32, 0u32);

    for e in WalkDir::new(&mount)
        .into_iter()
        .filter_entry(|e| {
            e.depth() == 0
                || e.file_name()
                    .to_str()
                    .map(|s| !is_junk(s))
                    .unwrap_or(false)
        })
        .flatten()
    {
        if e.depth() == 0 || e.file_type().is_dir() {
            continue;
        }
        let name = e.file_name().to_string_lossy().to_string();
        let rel = e
            .path()
            .strip_prefix(&mount)
            .unwrap_or(e.path())
            .to_string_lossy()
            .to_string();
        let meta = match e.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let kind = classify(&name, false);
        let size = meta.len();
        all_files += 1;
        total_bytes += size;

        // Marka sezgisi
        let rel_up = rel.to_uppercase();
        let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
        if rel_up.contains("M4ROOT") || rel_up.contains("XDROOT") {
            sony += 1;
        }
        if rel_up.contains("CONTENTS/VIDEO") || ext == "rw2" || rel_up.contains("100_PANA") {
            pana += 1;
        }
        if rel_up.contains("CONTENTS/CLIPS") || ext == "crm" || ext == "cr3" || rel_up.contains("CANON") {
            canon += 1;
        }

        if kind == "video" {
            clip_count += 1;
        }
        if kind == "video" || kind == "image" || kind == "audio" {
            media_files += 1;
        }
        files.push(CardFile {
            rel_path: rel,
            name,
            size,
            kind,
        });
    }

    let brand = if sony >= canon && sony >= pana && sony > 0 {
        Some("Sony".to_string())
    } else if canon >= pana && canon > 0 {
        Some("Canon".to_string())
    } else if pana > 0 {
        Some("Panasonic".to_string())
    } else {
        None
    };

    // Kart kararı: işaret klasörü var, VEYA dosyaların çoğu medya.
    let media_ratio = if all_files > 0 {
        media_files as f64 / all_files as f64
    } else {
        0.0
    };
    let is_card = !markers.is_empty() || (all_files > 0 && media_ratio >= 0.6);

    let label = mount
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| mount_path.clone());

    Ok(CardInfo {
        is_card,
        brand,
        label,
        mount_path,
        markers,
        clip_count,
        file_count: all_files,
        total_bytes,
        files,
    })
}

// ───────────────────────── Doğrulanmış kopya ─────────────────────────

#[derive(Serialize, Clone)]
struct OffloadProgress {
    phase: String, // "copy" | "verify" | "file_done" | "done"
    file_index: usize,
    file_total: usize,
    file_name: String,
    bytes_done: u64,  // tüm aktarımda işlenen
    bytes_total: u64, // tüm aktarım toplamı
    speed_bps: u64,
}

#[derive(Serialize)]
pub struct OffloadSummary {
    pub copied: u64,
    pub verified: u64,
    pub failed: u64,
    pub total_bytes: u64,
    pub elapsed_ms: u64,
    pub dest_roots: Vec<String>,
    pub report_paths: Vec<String>,
    pub failures: Vec<String>,
}

struct HashedFile {
    rel: String,
    size: u64,
    hash: u64,
}

#[tauri::command]
pub async fn offload_card(
    app: tauri::AppHandle,
    source_mount: String,
    card_label: String,
    destinations: Vec<String>,
    verify: bool,
) -> Result<OffloadSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        offload_blocking(app, source_mount, card_label, destinations, verify)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn offload_blocking(
    app: tauri::AppHandle,
    source_mount: String,
    card_label: String,
    destinations: Vec<String>,
    verify: bool,
) -> Result<OffloadSummary, String> {
    let mount = PathBuf::from(&source_mount);
    if !mount.exists() {
        return Err("Kart bağlı değil".into());
    }
    if destinations.is_empty() {
        return Err("En az bir hedef seçilmeli".into());
    }

    // Aktarımı kendi alt klasörüne yaz: <hedef>/<KART>_<YYYYMMDD>/...
    let stamp = yyyymmdd(now_secs());
    let folder = format!("{}_{}", sanitize_seg(&card_label), stamp);
    let dest_roots: Vec<PathBuf> = destinations
        .iter()
        .map(|d| PathBuf::from(d).join(&folder))
        .collect();
    for r in &dest_roots {
        fs::create_dir_all(r).map_err(|e| format!("{}: {e}", r.display()))?;
    }

    // Kopyalanacak dosyaları topla (çöp hariç).
    let mut work: Vec<(String, PathBuf, u64)> = Vec::new();
    let mut total_bytes = 0u64;
    for e in WalkDir::new(&mount)
        .into_iter()
        .filter_entry(|e| {
            e.depth() == 0
                || e.file_name()
                    .to_str()
                    .map(|s| !is_junk(s))
                    .unwrap_or(false)
        })
        .flatten()
    {
        if e.depth() == 0 || e.file_type().is_dir() {
            continue;
        }
        let rel = e
            .path()
            .strip_prefix(&mount)
            .unwrap_or(e.path())
            .to_string_lossy()
            .to_string();
        let size = e.metadata().map(|m| m.len()).unwrap_or(0);
        total_bytes += size;
        work.push((rel, e.path().to_path_buf(), size));
    }

    let file_total = work.len();
    let started = Instant::now();
    let mut last_emit = Instant::now();
    let mut bytes_done = 0u64;
    let (mut copied, mut verified, mut failed) = (0u64, 0u64, 0u64);
    let mut failures: Vec<String> = Vec::new();
    let mut manifest: Vec<HashedFile> = Vec::new();

    let emit = |app: &tauri::AppHandle, p: OffloadProgress| {
        let _ = app.emit("offload-progress", p);
    };

    for (idx, (rel, src, size)) in work.iter().enumerate() {
        emit(
            &app,
            OffloadProgress {
                phase: "copy".into(),
                file_index: idx + 1,
                file_total,
                file_name: rel.clone(),
                bytes_done,
                bytes_total: total_bytes,
                speed_bps: bps(bytes_done, started),
            },
        );

        // 1) Kaynağı oku → tüm hedeflere yaz → kaynak hash'ini hesapla.
        let dests: Vec<PathBuf> = dest_roots.iter().map(|r| r.join(rel)).collect();
        match copy_one(src, &dests) {
            Ok(src_hash) => {
                bytes_done += size;
                copied += 1;

                // 2) Doğrula: her hedefi diskten geri oku, hash'i karşılaştır.
                let mut ok = true;
                if verify {
                    emit(
                        &app,
                        OffloadProgress {
                            phase: "verify".into(),
                            file_index: idx + 1,
                            file_total,
                            file_name: rel.clone(),
                            bytes_done,
                            bytes_total: total_bytes,
                            speed_bps: bps(bytes_done, started),
                        },
                    );
                    for d in &dests {
                        match hash_file(d) {
                            Ok(h) if h == src_hash => {}
                            Ok(_) => {
                                ok = false;
                                failures.push(format!("DOĞRULAMA HATASI (hash uyuşmadı): {rel}"));
                            }
                            Err(e) => {
                                ok = false;
                                failures.push(format!("doğrulama okunamadı: {rel} — {e}"));
                            }
                        }
                    }
                    if ok {
                        verified += 1;
                    } else {
                        failed += 1;
                    }
                }
                manifest.push(HashedFile {
                    rel: rel.clone(),
                    size: *size,
                    hash: src_hash,
                });
            }
            Err(e) => {
                failed += 1;
                failures.push(format!("kopyalanamadı: {rel} — {e}"));
            }
        }

        // İlerlemeyi en çok ~120ms'de bir gönder (UI'ı boğmadan).
        if last_emit.elapsed().as_millis() >= 120 || idx + 1 == file_total {
            emit(
                &app,
                OffloadProgress {
                    phase: "file_done".into(),
                    file_index: idx + 1,
                    file_total,
                    file_name: rel.clone(),
                    bytes_done,
                    bytes_total: total_bytes,
                    speed_bps: bps(bytes_done, started),
                },
            );
            last_emit = Instant::now();
        }
    }

    // MHL + JSON rapor (her hedefe yaz — sigortadır).
    let elapsed_ms = started.elapsed().as_millis() as u64;
    let mut report_paths = Vec::new();
    for r in &dest_roots {
        if let Ok(p) = write_reports(r, &card_label, &manifest, &source_mount, elapsed_ms) {
            report_paths.push(p);
        }
    }

    emit(
        &app,
        OffloadProgress {
            phase: "done".into(),
            file_index: file_total,
            file_total,
            file_name: String::new(),
            bytes_done,
            bytes_total: total_bytes,
            speed_bps: bps(bytes_done, started),
        },
    );

    Ok(OffloadSummary {
        copied,
        verified,
        failed,
        total_bytes,
        elapsed_ms,
        dest_roots: dest_roots
            .iter()
            .map(|r| r.to_string_lossy().to_string())
            .collect(),
        report_paths,
        failures,
    })
}

// Bir dosyayı oku → tüm hedeflere aynı anda yaz → kaynak xxHash64'ünü döndür.
// Yazımdan sonra her hedefte sync_all (diske gerçekten insin ki doğrulama anlamlı olsun).
fn copy_one(src: &Path, dests: &[PathBuf]) -> Result<u64, String> {
    for d in dests {
        if let Some(parent) = d.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
        }
    }
    let mut reader = fs::File::open(src).map_err(|e| e.to_string())?;
    let mut writers: Vec<fs::File> = dests
        .iter()
        .map(|d| fs::File::create(d).map_err(|e| format!("{}: {e}", d.display())))
        .collect::<Result<_, _>>()?;

    let mut hasher = Xxh64::new(0);
    let mut buf = vec![0u8; CHUNK];
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        for w in writers.iter_mut() {
            w.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        }
    }
    for w in writers.iter_mut() {
        w.flush().map_err(|e| e.to_string())?;
        w.sync_all().map_err(|e| e.to_string())?;
    }
    Ok(hasher.digest())
}

fn hash_file(path: &Path) -> Result<u64, String> {
    let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Xxh64::new(0);
    let mut buf = vec![0u8; CHUNK];
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.digest())
}

fn bps(bytes: u64, since: Instant) -> u64 {
    let s = since.elapsed().as_secs_f64();
    if s <= 0.0 {
        0
    } else {
        (bytes as f64 / s) as u64
    }
}

// ───────────────────────── Rapor (MHL + JSON) ─────────────────────────

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn write_reports(
    root: &Path,
    card_label: &str,
    manifest: &[HashedFile],
    source_mount: &str,
    elapsed_ms: u64,
) -> Result<String, String> {
    let now = now_secs();
    let iso = iso8601(now);

    // Klasik MHL 1.1 (xxhash64be) — endüstri standardı hash listesi.
    let mut mhl = String::new();
    mhl.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    mhl.push_str("<hashlist version=\"1.1\">\n");
    mhl.push_str("  <creatorinfo>\n");
    mhl.push_str("    <name>intiba companion</name>\n");
    mhl.push_str("    <tool>intiba 0.1</tool>\n");
    mhl.push_str(&format!("    <startdate>{iso}</startdate>\n"));
    mhl.push_str(&format!("    <finishdate>{iso}</finishdate>\n"));
    mhl.push_str(&format!(
        "    <comment>Kart: {} — kaynak: {}</comment>\n",
        xml_escape(card_label),
        xml_escape(source_mount)
    ));
    mhl.push_str("  </creatorinfo>\n");
    for f in manifest {
        mhl.push_str("  <hash>\n");
        mhl.push_str(&format!("    <file>{}</file>\n", xml_escape(&f.rel)));
        mhl.push_str(&format!("    <size>{}</size>\n", f.size));
        mhl.push_str(&format!("    <xxhash64be>{:016x}</xxhash64be>\n", f.hash));
        mhl.push_str(&format!("    <hashdate>{iso}</hashdate>\n"));
        mhl.push_str("  </hash>\n");
    }
    mhl.push_str("</hashlist>\n");
    let mhl_path = root.join("_intiba_ingest.mhl");
    fs::write(&mhl_path, mhl).map_err(|e| e.to_string())?;

    // İnsan/katalog için JSON özet.
    let json = serde_json::json!({
        "card_label": card_label,
        "source_mount": source_mount,
        "ingested_at_ms": now * 1000,
        "elapsed_ms": elapsed_ms,
        "file_count": manifest.len(),
        "total_bytes": manifest.iter().map(|f| f.size).sum::<u64>(),
        "files": manifest.iter().map(|f| serde_json::json!({
            "rel_path": f.rel,
            "size": f.size,
            "xxhash64": format!("{:016x}", f.hash),
        })).collect::<Vec<_>>(),
    });
    let json_path = root.join("_intiba_ingest.json");
    fs::write(&json_path, serde_json::to_string_pretty(&json).unwrap_or_default())
        .map_err(|e| e.to_string())?;

    Ok(json_path.to_string_lossy().to_string())
}

// ───────────────────────── Zaman yardımcıları ─────────────────────────

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

// epoch saniye (UTC) → "YYYY-MM-DDTHH:MM:SSZ" (Howard Hinnant civil_from_days).
fn iso8601(epoch_secs: u64) -> String {
    let (y, m, d, h, mi, s) = civil(epoch_secs);
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}
fn yyyymmdd(epoch_secs: u64) -> String {
    let (y, m, d, _, _, _) = civil(epoch_secs);
    format!("{y:04}{m:02}{d:02}")
}
fn civil(epoch_secs: u64) -> (i64, i64, i64, u64, u64, u64) {
    let days = (epoch_secs / 86400) as i64;
    let sod = epoch_secs % 86400;
    let (h, mi, s) = (sod / 3600, (sod % 3600) / 60, sod % 60);
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d, h, mi, s)
}
