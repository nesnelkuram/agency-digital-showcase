import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";

export function currentLabel(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
}

async function showWindow(label: string): Promise<void> {
  try {
    const w = await WebviewWindow.getByLabel(label);
    if (w) {
      await w.show();
      await w.unminimize();
      await w.setFocus();
    }
  } catch (e) {
    console.error(`[window] ${label} açılamadı:`, e);
  }
}

// Ana pencereyi öne getirip ilgili sekmeyi seç. Pencere yeni açılmışsa
// React/listen birkaç ms sonra hazır olabileceğinden olayı bir kez de
// gecikmeli gönderiyoruz.
async function openMainTab(tab: "pano" | "files"): Promise<void> {
  await showWindow("main");
  await emit("open-tab", tab);
  setTimeout(() => {
    emit("open-tab", tab).catch(() => {});
  }, 250);
}

// Tam uygulamayı (main) Pano sekmesinde öne getir.
export const openDashboard = () => openMainTab("pano");

// Ana pencereyi Diskler & Dosyalar sekmesinde öne getir.
export const openFiles = () => openMainTab("files");

// İçinde bulunulan pencereyi gizle (popover için).
export async function hideSelf(): Promise<void> {
  try {
    await getCurrentWindow().hide();
  } catch {
    /* ignore */
  }
}
