import type { EvidenceBasis } from '../../shared/planner/copyContract';
import type { CandidateVisual } from '../../shared/planner/visualDecision';

/** Instagram feed + Story planlama çalışma alanı: ortak tipler (yalnız yerel inceleme). */

export type FormatId = 'feed-1x1' | 'feed-4x5' | 'reels-cover' | 'story';

export const FORMATS: Record<FormatId, { label: string; w: number; h: number; lane: 'feed' | 'reels' | 'story' }> = {
  'feed-1x1': { label: 'Post 1:1', w: 1, h: 1, lane: 'feed' },
  'feed-4x5': { label: 'Post 4:5', w: 4, h: 5, lane: 'feed' },
  'reels-cover': { label: 'Reels kapağı 9:16', w: 9, h: 16, lane: 'reels' },
  story: { label: 'Story 9:16', w: 9, h: 16, lane: 'story' },
};

export interface Dims {
  w: number;
  h: number;
}

/** Piksellerden ölçülen alanlar (deterministik). `measured: false` ise değerler yoktur. */
export interface Aesthetics {
  measured: boolean;
  palette: string[];
  /** 0..1 ortalama parlaklık */
  brightness: number;
  /** -1..1 ortalama (kırmızı − mavi); pozitif = sıcak */
  warmth: number;
  /** 0..1 parlaklık standart sapması */
  contrast: number;
  /** 0..1 ortalama kenar yoğunluğu */
  density: number;
  /** 0..1 boş (düz) blok oranı */
  negativeSpace: number;
  negativeZone: 'üst' | 'orta' | 'alt' | 'dağınık';
  /** Üst/orta/alt üçte birin ortalama parlaklığı (0..1); metin rengi seçimi için. Eski kayıtlarda olmayabilir. */
  zoneBrightness?: [number, number, number];
}

/** Nottan güvenli çıkarım (ölçüm değil). Bilinmiyorsa 'bilinmiyor' yazılır; tahmin uydurulmaz. */
export interface Semantic {
  shotScale: 'yakın' | 'orta' | 'geniş' | 'bilinmiyor';
  subjectPos: 'merkez' | 'sol' | 'sağ' | 'üst' | 'alt' | 'bilinmiyor';
  /** nottan: yerel metin notu; katalog: Studio medya kataloğu (AI + insan düzeltmesi); bilinmiyor */
  source: 'nottan' | 'katalog' | 'bilinmiyor';
}

export interface Candidate {
  id: string;
  /** Yalnız sunucu allowlist anahtarı; dosya yolu değildir */
  imageKey: string;
  brand: string;
  kind: 'photo' | 'video_cover';
  /** studio: gerçek brand_media kaydı (Studio orijinali). canva/downloads/history: yerel inceleme fixture'ı */
  origin: 'canva' | 'downloads' | 'history' | 'studio';
  provenance: string;
  /** Yayımlanmış geçmiş öğesi mi (arşiv; yeni taslak havuzuna girmez) */
  published: boolean;
  date?: string;
  dims: Dims;
  dimsSource: 'kaynak' | 'önizleme';
  group: string;
  note: string;
  aiMark: 'yok' | 'belirsiz' | 'olası';
  humanPresence: 'evet' | 'hayır' | 'bilinmiyor';
  semantic: Semantic;
  aesthetics?: Aesthetics;
  /** Yalnız gerçek medyada: güvenilen host/bucket ilkesi gerçek isConsistentAsset ile doğrulandı mı. false/yok = DOĞRULANMADI */
  storageVerified?: boolean;
  /** Yalnız gerçek medyada: mevcut Instagram hazırlık denetimi sonucu (planSuggest.readinessFor ile aynı mantık) */
  readiness?: Partial<Record<'static' | 'carousel' | 'story' | 'reels', 'ok' | 'warning' | 'error'>>;
  /** Yalnız gerçek medyada: kayıtlı post kullanımı (planSuggest envanteriyle aynı sayaçlar) */
  usage?: { usedInPostCount: number; approvedUseCount: number; pendingUseCount: number; lastUsedAt: number | null };
  /** copy: özgün plan metni (TR, değişmez). seriesKey: planın KENDİ açık seri adı (gün değil). */
  weekFrame?: { day: string; frame: number; copy: string; seriesKey?: string };
  /** Gerçek ürün kimliği (insan doğrulamalı); Story serisi kimliği kaynağı. Yok/null = seri yok. */
  productId?: string | null;
  /**
   * Kayıtlı kompozisyon kararı (model gözlemi + kutu tahmini; kapsam/sürüm doğrulamalı). Yok = BİLİNMİYOR: puanlamaya girmez,
   * uydurulmaz. Plan motoru bunu kullanır; plan üretimi görsele yeniden model çağrısı yapmaz.
   */
  visual?: CandidateVisual;
  /** Kayıtlı kullanım önerileri (feed/carousel/story/reels_kapak…) ve KAYNAĞI: human = insan düzeltmesi, ai = model gözlemi. Yok = bilinmiyor. */
  useTags?: { values: string[]; source: 'human' | 'ai' };
}

export type VoiceSource = 'approved_bundle' | 'approved_guide' | 'temporary_tone';

/** Öneri metni rolü: feed caption'ı; Story'de başlık yalnız serinin ilk karesinde, devamı küçük açıklama veya metinsiz. */
export type TextRole = 'caption' | 'headline' | 'body' | 'none';

/** Tek sürümlü öneri metni. Görselle birlikte atomik değişir. */
export interface SlotText {
  headline?: string;
  body?: string;
  caption?: string;
  /** plan: haftalık plan kaydı; model: gerçek model hattı (sunucu doğrulamalı); template: YALNIZ test/QA; suggestion: saklanmış plan-suggest önerisi */
  source: 'plan' | 'manual' | 'template' | 'suggestion' | 'model';
  /** unknown: dil doğrulanamadı (canlı sunucu dili denetlemez) */
  lang: 'tr' | 'en' | 'unknown';
  templateId?: string;
  register?: string;
  /** Yalnız model kaynaklı metinde: sunucunun doğruladığı kanıt temeli, içerik hash'i ve yanıt kimliği */
  evidenceBasis?: EvidenceBasis;
  /** Yalnız model metninde: hangi ses kaynağı kullanıldı. temporary_tone = onaylı rehber YOK, geçici ton taslağı (kalıcı marka hafızası değil). */
  voiceSource?: VoiceSource;
  /** Yalnız geçici ton taslağında: varsayımlar (gösterim için; kalıcı saklanmaz) */
  assumptions?: string[];
  contentHash?: string;
  responseId?: string;
  promptVersion?: string;
}
