import { invoke } from "@tauri-apps/api/core";

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
