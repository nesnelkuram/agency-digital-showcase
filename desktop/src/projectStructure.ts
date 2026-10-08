// Ajans standart klasör mimarisi — tek kaynak (oluşturma + doğrulama + detay görünümü buradan beslenir).
// Netflix/BBC delivery mantığı: 5 makro kök + sabit proje şablonu + adlandırma protokolleri.

// MAKRO: sunucu/disk kökündeki 5 ana klasör.
export const MACRO_ROOTS = [
  "01_Clients", // aktif müşteri işleri
  "02_Internal", // ajansın kendi reel/sosyal
  "03_Library", // ortak ses/müzik/font/LUT/stock
  "04_Archive", // faturası kesilmiş bitmiş işler
  "05_Agency_Biz", // sözleşme/teklif/muhasebe/casting
] as const;

// MİKRO: her projenin taşıması gereken kovalar (göreli yollar).
export const PROJECT_BUCKETS = [
  "01_Docs",
  "02_Footage",
  "03_Audio/01_Sync",
  "03_Audio/02_Vo",
  "03_Audio/03_Music",
  "03_Audio/04_Sfx",
  "04_Assets/Logos",
  "04_Assets/Fonts",
  "04_Assets/Graphics",
  "05_Projects/Premiere",
  "05_Projects/After_Effects",
  "05_Projects/Davinci",
  "06_Exports/01_Drafts",
  "06_Exports/02_Deliverables",
  "07_Scratch",
] as const;

// Üst seviye kovalar (proje detayında gruplama için).
export const TOP_BUCKETS = [
  "01_Docs",
  "02_Footage",
  "03_Audio",
  "04_Assets",
  "05_Projects",
  "06_Exports",
  "07_Scratch",
] as const;

const TR_MAP: Record<string, string> = {
  ı: "i", İ: "I", ş: "s", Ş: "S", ç: "c", Ç: "C",
  ö: "o", Ö: "O", ü: "u", Ü: "U", ğ: "g", Ğ: "G",
};

// Protokol 1: Türkçe karakter + boşluk yasağı. Boşluk → alt tire, geçersiz → kaldır.
// Harf büyüklüğü: Title Case (her kelimenin sadece ilk harfi büyük) — kullanıcı tercihi.
export function sanitizeSeg(s: string): string {
  const out = s
    .split("")
    .map((c) => TR_MAP[c] ?? c)
    .join("")
    .replace(/[^A-Za-z0-9_-]+/g, "_") // boşluk + geçersiz → _
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  // her alfasayısal kelimenin ilk harfi büyük, gerisi küçük
  return out.replace(
    /[A-Za-z0-9]+/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
}

// YYYYMMDD (yerel).
export function dateStamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// Proje klasör adı: [YYYYMMDD]_[KISA]_[PROJE]  (KISA + PROJE büyük harf).
export function projectFolderName(
  short: string,
  project: string,
  date: Date = new Date()
): string {
  return `${dateStamp(date)}_${sanitizeSeg(short)}_${sanitizeSeg(project)}`;
}

// Bir projenin disk köküne göreli tam yolu.
export function projectRelPath(client: string, folderName: string): string {
  return `01_Clients/${sanitizeSeg(client)}/${folderName}`;
}

// Diskte oluşturulacak tüm klasörler (5 kök + müşteri + proje kovaları).
export function buildScaffoldDirs(client: string, folderName: string): string[] {
  const clientSeg = sanitizeSeg(client);
  const proj = `01_Clients/${clientSeg}/${folderName}`;
  return [
    ...MACRO_ROOTS,
    `01_Clients/${clientSeg}`,
    ...PROJECT_BUCKETS.map((b) => `${proj}/${b}`),
  ];
}

// Bir göreli yolun "01_CLIENTS/<Müşteri>/<YYYYMMDD>_<KISA>_<PROJE>" desenine uyup
// uymadığını çözer — otomatik atama için. Eşleşirse {client, folderName, date, ...}.
export interface ParsedProjectPath {
  client: string;
  folderName: string;
  date: string; // YYYYMMDD
  short: string;
  project: string;
  projectRel: string; // 01_CLIENTS/<client>/<folderName>
}
const PROJ_RE = /^(\d{8})_([^_/]+)_(.+)$/;
export function parseProjectPath(rel: string): ParsedProjectPath | null {
  const parts = rel.split("/").filter(Boolean);
  const ci = parts.findIndex((p) => p.toUpperCase() === "01_CLIENTS");
  if (ci === -1 || parts.length < ci + 3) return null;
  const client = parts[ci + 1];
  const folderName = parts[ci + 2];
  const m = folderName.match(PROJ_RE);
  if (!m) return null;
  return {
    client,
    folderName,
    date: m[1],
    short: m[2],
    project: m[3],
    projectRel: `${parts.slice(0, ci + 1).join("/")}/${client}/${folderName}`,
  };
}
