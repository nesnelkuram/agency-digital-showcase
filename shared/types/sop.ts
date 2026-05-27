import type { Timestamp } from 'firebase/firestore';

// ─── AgencySop — yeniden kullanılabilir iş kalıbı ────────────────────────────
// Örnek: "Video Çekimi", "Sosyal Medya Kampanyası", "Marka Dili Oluşturma"
export interface AgencySop {
  id: string;
  tenantId: string;

  // Kimlik
  name: string;                    // "Video Çekimi"
  description: string;             // 1 cümlelik açıklama
  matchKeywords: string[];         // ["video", "çekim", "tanıtım", "reklam filmi"] — semantik eşleşme için

  // İçerik
  steps: SopStep[];

  // Marka esnekliği
  applicableBrandIds?: string[];   // boş = tüm markalar; doluysa sadece belirtilenler
  brandOverrides?: Record<string, BrandOverride>;  // markaya özel ekleme/çıkarma

  // Telemetri (popülerite + kalite ölçütleri)
  usageCount: number;              // kaç görevde kullanıldı
  lastUsedAt?: Timestamp;
  averageMinutes?: number;         // gerçekleşen ortalama (Faz 3'te güncellenir)

  // Meta
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SopStep {
  title: string;                   // "Brief'i müşteriden al"
  estimatedMinutes: number;        // 15-240 arası gerçekçi tahmin
  assigneeRole?: string;           // 'videographer' | 'designer' | ...
  notes?: string;                  // serbest açıklama
  trainingResourceId?: string;     // bu checkpoint için eğitim videosu (training_resources/id)
}

export interface BrandOverride {
  extraSteps?: SopStep[];          // bu marka için EKSTRA adımlar
  skipStepIndices?: number[];      // bu marka için ATLA dilen adım index'leri
  noteAddenda?: string;            // markaya özel not (örn. "Dieci'de brief Selen'den alınır")
}
