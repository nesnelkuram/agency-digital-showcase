import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface VolumeInfo {
  id: string; // Volume UUID (yoksa mount yolu)
  label: string;
  mount_path: string;
  total_bytes: number;
  free_bytes: number;
  is_removable: boolean;
}

export type FileKind =
  | "folder"
  | "video"
  | "image"
  | "audio"
  | "doc"
  | "other";

export interface DirEntryInfo {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  kind: FileKind;
  modified_ms: number;
}

export const listVolumes = () => invoke<VolumeInfo[]>("list_volumes");

export const volumeConnected = (volumeId: string) =>
  invoke<boolean>("volume_connected", { volumeId });

export const listDir = (path: string) =>
  invoke<DirEntryInfo[]>("list_dir", { path });

// Standart proje iskeletini diskte oluştur (rel_dirs = göreli klasör yolları).
export const createScaffold = (mountPath: string, relDirs: string[]) =>
  invoke<number>("create_scaffold", { mountPath, relDirs });

export const revealInFinder = (path: string) =>
  invoke<void>("reveal_in_finder", { path });

export const openPath = (path: string) => invoke<void>("open_path", { path });

export const generatePreview = (path: string, size = 384) =>
  invoke<string | null>("generate_preview", { path, size });

// ── Offline indeks (sadece harici diskler) ──
export interface IndexEntry {
  rel_path: string;
  name: string;
  is_dir: boolean;
  size: number;
  kind: FileKind;
  modified_ms: number;
}
export interface IndexDoc {
  drive_id: string;
  mount_path: string;
  scanned_at_ms: number;
  entries: IndexEntry[];
}
export interface ScanResult {
  files: number;
  dirs: number;
  scanned_at_ms: number;
}

export const scanDrive = (mountPath: string, driveId: string) =>
  invoke<ScanResult>("scan_drive", { mountPath, driveId });

export const indexStatus = (driveId: string) =>
  invoke<number | null>("index_status", { driveId });

export const loadIndex = (driveId: string) =>
  invoke<IndexDoc>("load_index", { driveId });

// abs_path null ise sadece önbellekteki önizleme döner (offline).
export const getThumb = (
  driveId: string,
  relPath: string,
  absPath: string | null,
  size = 384
) => invoke<string | null>("get_thumb", { driveId, relPath, absPath, size });

// ── Kart aktarımı (ingest) ──
export interface CardFile {
  rel_path: string;
  name: string;
  size: number;
  kind: FileKind;
}
export interface CardInfo {
  is_card: boolean;
  brand: string | null; // "Sony" | "Canon" | "Panasonic" | null
  label: string;
  mount_path: string;
  markers: string[];
  clip_count: number;
  file_count: number;
  total_bytes: number;
  files: CardFile[];
}
export interface OffloadSummary {
  copied: number;
  verified: number;
  failed: number;
  total_bytes: number;
  elapsed_ms: number;
  dest_roots: string[];
  report_paths: string[];
  failures: string[];
}
export interface OffloadProgress {
  phase: "copy" | "verify" | "file_done" | "done";
  file_index: number;
  file_total: number;
  file_name: string;
  bytes_done: number;
  bytes_total: number;
  speed_bps: number;
}

export const detectCard = (mountPath: string) =>
  invoke<CardInfo>("detect_card", { mountPath });

export const offloadCard = (
  sourceMount: string,
  cardLabel: string,
  destinations: string[],
  verify = true
) =>
  invoke<OffloadSummary>("offload_card", {
    sourceMount,
    cardLabel,
    destinations,
    verify,
  });

// Aktarım ilerlemesini dinle; çağrı, aboneliği bırakan fonksiyonu (Promise) döner.
export const onOffloadProgress = (cb: (p: OffloadProgress) => void) =>
  listen<OffloadProgress>("offload-progress", (e) => cb(e.payload));

// ── Google Drive resumable yükleme ──
export interface DriveStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}
export interface DriveSummary {
  uploaded: number;
  verified: number;
  failed: number;
  skipped: number;
  total_bytes: number;
  elapsed_ms: number;
  failures: string[];
}
export interface DriveProgress {
  phase: "init" | "upload" | "verify" | "file_done" | "done";
  file_index: number;
  file_total: number;
  file_name: string;
  bytes_done: number;
  bytes_total: number;
  speed_bps: number;
  resumed: boolean;
}

export interface SharedDrive {
  id: string;
  name: string;
}
export interface DriveFolder {
  id: string;
  name: string;
}

export const driveStatus = () => invoke<DriveStatus>("drive_status");
export const driveSetCredentials = (clientId: string, clientSecret: string) =>
  invoke<void>("drive_set_credentials", { clientId, clientSecret });
export const driveConnect = () => invoke<string>("drive_connect");
export const driveDisconnect = () => invoke<void>("drive_disconnect");
export const driveListSharedDrives = () =>
  invoke<SharedDrive[]>("drive_list_shared_drives");
// driveId: null=My Drive; parentId: null=kök. O konumun alt klasörlerini döner.
export const driveListFolders = (
  driveId: string | null,
  parentId: string | null
) => invoke<DriveFolder[]>("drive_list_folders", { driveId, parentId });
export const driveUpload = (
  localPaths: string[],
  driveId: string | null,
  parentFolderId: string | null,
  destSubfolder: string | null,
  verify = true
) =>
  invoke<DriveSummary>("drive_upload", {
    localPaths,
    driveId,
    parentFolderId,
    destSubfolder,
    verify,
  });

export const onDriveProgress = (cb: (p: DriveProgress) => void) =>
  listen<DriveProgress>("drive-progress", (e) => cb(e.payload));

// ── biçimlendiriciler ──
export function formatBytes(b: number): string {
  if (b <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
