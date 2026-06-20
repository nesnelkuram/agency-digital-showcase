import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let granted = false;

export async function ensureNotifyPermission(): Promise<boolean> {
  granted = await isPermissionGranted();
  if (!granted) {
    const res = await requestPermission();
    granted = res === "granted";
  }
  return granted;
}

export async function notify(title: string, body: string): Promise<void> {
  if (!granted) {
    granted = await ensureNotifyPermission();
  }
  if (!granted) return;
  try {
    sendNotification({ title, body });
  } catch (e) {
    console.error("[notify] hata:", e);
  }
}
