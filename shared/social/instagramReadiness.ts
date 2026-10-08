/**
 * Instagram yayına uygunluk ön kontrolü — yalnız kayıttaki metadata ile (MIME, boyut, en/boy, süre).
 * Bloklamaz; Studio'da anlaşılır uyarı olarak gösterilir. Panel yükleme sınırı (1 GB) ile ilgisi yoktur.
 *
 * Kaynak (birincil): Meta for Developers — Instagram Platform, IG User Media (POST /<IG_ID>/media)
 *   https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
 *   Okunma: 2026-10-08. Sayfada "son güncelleme" tarihi yok.
 * Belgede "MB" ondalık/ikili belirtilmiyor; temkinli olarak ondalık (1 MB = 1_000_000 bayt) kullanılır.
 * Belgede carousel içindeki VİDEO için şart verilmiyor → "doğrulanamadı" uyarısı.
 * Codec, kare hızı, ses ve moov atom konumu metadata'dan ölçülemez → videolar hiçbir zaman "uygun" sayılmaz,
 * en iyi durum "ölçülebilen değerler uygun, kalanı doğrulanmadı" olur.
 */

import type { MediaItem, PostType } from '../types/socialMedia';

export const INSTAGRAM_SPEC_SOURCE = {
  url: 'https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media',
  checkedOn: '2026-10-08',
};

const MB = 1_000_000;

export const INSTAGRAM_SPECS = {
  feedImage: { mime: ['image/jpeg'], maxBytes: 8 * MB, minRatio: 4 / 5, maxRatio: 1.91, minWidth: 320, maxWidth: 1440 },
  storyImage: { mime: ['image/jpeg'], maxBytes: 8 * MB },
  reels: { mime: ['video/mp4', 'video/quicktime'], maxBytes: 300 * MB, minSeconds: 3, maxSeconds: 15 * 60, minRatio: 0.01, maxRatio: 10 },
  storyVideo: { mime: ['video/mp4', 'video/quicktime'], maxBytes: 100 * MB, minSeconds: 3, maxSeconds: 60, minRatio: 0.1, maxRatio: 10 },
  carouselMaxItems: 10,
} as const;

export type ReadinessLevel = 'error' | 'warning' | 'unverified';

export interface ReadinessIssue {
  level: ReadinessLevel;
  message: string;
  mediaIndex?: number;
}

export interface ReadinessResult {
  /**
   * ready: ölçülen her şey uygun ve doğrulanamayan kalem yok (yalnız fotoğraflarda mümkün)
   * partial: hata/uyarı yok ama doğrulanamayan kalem var (ör. video codec'i, eksik metadata)
   * issues: en az bir hata veya uyarı
   */
  status: 'ready' | 'partial' | 'issues';
  issues: ReadinessIssue[];
}

type MediaLike = Pick<MediaItem, 'type' | 'mimeType' | 'size' | 'width' | 'height' | 'duration'>;

const known = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const ratioText = (r: number) => r.toFixed(2).replace('.', ',');
const mbText = (bytes: number) => `${Math.round(bytes / MB)} MB`;

function checkImage(m: MediaLike, i: number, kind: 'feed' | 'story', out: ReadinessIssue[]) {
  const spec = kind === 'feed' ? INSTAGRAM_SPECS.feedImage : INSTAGRAM_SPECS.storyImage;
  const label = `${i + 1}. medya`;
  if (!(spec.mime as readonly string[]).includes(m.mimeType)) {
    out.push({ level: 'warning', mediaIndex: i, message: `${label}: Instagram yayın API'si görsellerde yalnız JPEG kabul ediyor (dosya: ${m.mimeType || 'bilinmiyor'}).` });
  }
  if (!known(m.size)) out.push({ level: 'unverified', mediaIndex: i, message: `${label}: dosya boyutu bilinmiyor.` });
  else if (m.size > spec.maxBytes) out.push({ level: 'error', mediaIndex: i, message: `${label}: görsel ${mbText(spec.maxBytes)} sınırını aşıyor.` });

  if (kind === 'feed') {
    const f = INSTAGRAM_SPECS.feedImage;
    if (!known(m.width) || !known(m.height)) {
      out.push({ level: 'unverified', mediaIndex: i, message: `${label}: en/boy bilgisi yok; oran kontrol edilemedi.` });
    } else {
      const r = m.width / m.height;
      if (r < f.minRatio - 0.005 || r > f.maxRatio + 0.005) {
        out.push({ level: 'error', mediaIndex: i, message: `${label}: en/boy oranı ${ratioText(r)}; akış görseli 4:5 ile 1,91:1 arasında olmalı.` });
      }
      if (m.width < f.minWidth || m.width > f.maxWidth) {
        out.push({ level: 'warning', mediaIndex: i, message: `${label}: genişlik ${m.width}px; Instagram 320–1440px dışını yeniden ölçekler.` });
      }
    }
  }
}

function checkVideo(m: MediaLike, i: number, kind: 'reels' | 'story', out: ReadinessIssue[]) {
  const spec = kind === 'reels' ? INSTAGRAM_SPECS.reels : INSTAGRAM_SPECS.storyVideo;
  const label = `${i + 1}. medya`;
  const name = kind === 'reels' ? 'Reels' : 'Hikâye videosu';
  if (!(spec.mime as readonly string[]).includes(m.mimeType)) {
    out.push({ level: 'warning', mediaIndex: i, message: `${label}: ${name} için MP4 veya MOV gerekir (dosya: ${m.mimeType || 'bilinmiyor'}).` });
  }
  if (!known(m.size)) out.push({ level: 'unverified', mediaIndex: i, message: `${label}: dosya boyutu bilinmiyor.` });
  else if (m.size > spec.maxBytes) out.push({ level: 'error', mediaIndex: i, message: `${label}: ${name} ${mbText(spec.maxBytes)} sınırını aşıyor.` });

  if (!known(m.duration)) out.push({ level: 'unverified', mediaIndex: i, message: `${label}: video süresi bilinmiyor; süre kontrol edilemedi.` });
  else if (m.duration < spec.minSeconds || m.duration > spec.maxSeconds) {
    const max = spec.maxSeconds >= 60 && spec.maxSeconds % 60 === 0 ? `${spec.maxSeconds / 60} dk` : `${spec.maxSeconds} sn`;
    out.push({ level: 'error', mediaIndex: i, message: `${label}: süre ${Math.round(m.duration)} sn; ${name} ${spec.minSeconds} sn ile ${max} arasında olmalı.` });
  }

  if (!known(m.width) || !known(m.height)) out.push({ level: 'unverified', mediaIndex: i, message: `${label}: video en/boy bilgisi yok.` });
  else {
    const r = m.width / m.height;
    if (r < spec.minRatio || r > spec.maxRatio) out.push({ level: 'error', mediaIndex: i, message: `${label}: en/boy oranı ${ratioText(r)} desteklenen aralığın dışında.` });
    else if (Math.abs(r - 9 / 16) > 0.02) out.push({ level: 'warning', mediaIndex: i, message: `${label}: Meta 9:16 öneriyor; bu oranda kırpma veya boşluk olabilir.` });
  }
  out.push({ level: 'unverified', mediaIndex: i, message: `${label}: codec, kare hızı (23–60 FPS) ve ses biçimi burada ölçülemez; dışa aktarım ayarlarından kontrol edin.` });
}

/** Post türü + medya için Instagram ön kontrolü */
export function checkInstagramReadiness(postType: PostType, media: MediaLike[]): ReadinessResult {
  const issues: ReadinessIssue[] = [];

  if (postType === 'text') issues.push({ level: 'error', message: 'Instagram metin-yalnız paylaşımı desteklemez; medya gerekli.' });
  else if (postType === 'video') issues.push({ level: 'warning', message: 'Instagram akış videoları Reels olarak paylaşılır; içerik türünü Reels seçin.' });
  else if (media.length === 0) issues.push({ level: 'error', message: 'Medya yok.' });

  if (postType === 'static') {
    if (media.length > 1) issues.push({ level: 'error', message: 'Tekli gönderide bir medya olmalı; birden fazlası için Carousel seçin.' });
    media.forEach((m, i) => (m.type === 'image' ? checkImage(m, i, 'feed', issues) : issues.push({ level: 'error', mediaIndex: i, message: `${i + 1}. medya video; tekli video için Reels seçin.` })));
  } else if (postType === 'carousel') {
    if (media.length > INSTAGRAM_SPECS.carouselMaxItems) issues.push({ level: 'error', message: `Carousel en fazla ${INSTAGRAM_SPECS.carouselMaxItems} öğe içerebilir (${media.length}).` });
    if (media.length === 1) issues.push({ level: 'warning', message: 'Carousel tek öğe içeriyor; tekli gönderi olarak paylaşmayı düşünün.' });
    media.forEach((m, i) =>
      m.type === 'image'
        ? checkImage(m, i, 'feed', issues)
        : issues.push({ level: 'unverified', mediaIndex: i, message: `${i + 1}. medya: carousel videoları için Meta belgesi ayrı süre/boyut şartı vermiyor; doğrulanamadı.` })
    );
  } else if (postType === 'reels') {
    if (media.length !== 1) issues.push({ level: 'error', message: 'Reels tek bir video olmalı.' });
    media.forEach((m, i) => (m.type === 'video' ? checkVideo(m, i, 'reels', issues) : issues.push({ level: 'error', mediaIndex: i, message: `${i + 1}. medya görsel; Reels video gerektirir.` })));
  } else if (postType === 'story') {
    if (media.length > 1) issues.push({ level: 'warning', message: 'Her hikâye karesi ayrı paylaşılır.' });
    media.forEach((m, i) => (m.type === 'video' ? checkVideo(m, i, 'story', issues) : checkImage(m, i, 'story', issues)));
  }

  const hasProblem = issues.some((x) => x.level === 'error' || x.level === 'warning');
  const hasUnverified = issues.some((x) => x.level === 'unverified');
  return { status: hasProblem ? 'issues' : hasUnverified ? 'partial' : 'ready', issues };
}
