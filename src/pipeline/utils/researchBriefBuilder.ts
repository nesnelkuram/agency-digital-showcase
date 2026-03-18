import type { PipelineInput, NormalizedData } from '../types';

export interface FetchedSite {
  url: string;
  title?: string;
  text: string;
  status: 'ok' | 'failed';
}

export interface ResearchBrief {
  markdown: string;
  knownCompetitorSites: FetchedSite[];
  missingAreas: string[];
}

export function buildResearchBrief(
  input: PipelineInput,
  normalizedData: NormalizedData,
  customerWebsiteData?: { url: string; text: string } | null,
  declaredCompetitorSites?: FetchedSite[],
): ResearchBrief {
  const lines: string[] = [];
  const knownCompetitorSites = declaredCompetitorSites ?? [];

  // Header
  lines.push(`# Research Brief — ${normalizedData.businessName}`);
  lines.push(`**Sektör:** ${normalizedData.sector}`);
  lines.push(`**Veri Kalitesi:** ${normalizedData.dataQualityScore}/100`);
  if (normalizedData.brandMaturity) {
    lines.push(`**Marka Olgunluğu:** ${normalizedData.brandMaturity.level} (${normalizedData.brandMaturity.score}/12)`);
  }
  lines.push('');

  // ─── SECTION 1: What we already know ────────────────────────────────────────
  lines.push('## BİLİNEN (Araştırma kapsamı dışı)');
  lines.push('');
  lines.push('> Bu veriler zaten elimizde. Tarık bunları yeniden araştırmamalı, vakit harcamamalı.');
  lines.push('');

  // Customer profile from normalizer
  lines.push('### Nisan\'ın Profil Özeti');
  lines.push(`- **İşletme:** ${normalizedData.businessName}`);
  lines.push(`- **Genel profil:** ${normalizedData.overallProfile}`);

  if (normalizedData.detectedPatterns.length > 0) {
    lines.push(`- **Tespit edilen örüntüler:** ${normalizedData.detectedPatterns.join(', ')}`);
  }
  if (normalizedData.contradictions.length > 0) {
    lines.push(`- **Çelişkiler:** ${normalizedData.contradictions.join('; ')}`);
  }

  // Business context summary
  const bc = input.businessContext;
  if (bc) {
    lines.push('');
    lines.push('### Müşteri Beyanları');
    if (bc.businessDescription) lines.push(`- **İşletme açıklaması:** ${bc.businessDescription}`);
    if (bc.brandWhy) lines.push(`- **Neden (WHY):** ${bc.brandWhy}`);
    if (bc.customerJob) lines.push(`- **Müşteri işi (JTBD):** ${bc.customerJob}`);
    if (bc.customerStruggle) lines.push(`- **Müşteri mücadelesi:** ${bc.customerStruggle}`);
    if (bc.brandEnemy) lines.push(`- **Marka düşmanı:** ${bc.brandEnemy}`);
    if (bc.futureVision) lines.push(`- **Vizyon:** ${bc.futureVision}`);
    if (bc.competitors) lines.push(`- **Beyan edilen rakipler:** ${bc.competitors}`);
    if (bc.geoScope) lines.push(`- **Coğrafi kapsam:** ${bc.geoScope}`);
    if (bc.monthlyBudget) lines.push(`- **Aylık bütçe:** ${bc.monthlyBudget}`);
  }

  // Customer website data
  if (customerWebsiteData && customerWebsiteData.text) {
    lines.push('');
    lines.push('### Müşteri Web Sitesi (Zaten Çekildi)');
    lines.push(`**URL:** ${customerWebsiteData.url}`);
    const preview = customerWebsiteData.text.slice(0, 500);
    lines.push('```');
    lines.push(preview + (customerWebsiteData.text.length > 500 ? '...' : ''));
    lines.push('```');
  }

  // Declared competitor sites
  if (knownCompetitorSites.length > 0) {
    lines.push('');
    lines.push('### Müşterinin Belirttiği Rakip Siteler (Zaten Çekildi)');
    for (const site of knownCompetitorSites) {
      if (site.status === 'ok') {
        lines.push(`**${site.url}** — ${site.title ?? 'Başlıksız'}`);
        const preview = site.text.slice(0, 400);
        lines.push('> ' + preview.replace(/\n/g, ' ') + (site.text.length > 400 ? '...' : ''));
      } else {
        lines.push(`**${site.url}** — ÇEKILEMEDI`);
      }
    }
  }

  lines.push('');

  // ─── SECTION 2: What needs research ─────────────────────────────────────────
  lines.push('## ARAŞTIRILACAK (Tarık\'ın Görevi)');
  lines.push('');
  lines.push('> Tarık bu bölümdeki boşlukları Deep Research ile doldurmalı.');
  lines.push('');

  // Missing areas from normalizer
  if (normalizedData.missingAreas.length > 0) {
    lines.push('### Eksik Bilgi Alanları (Normalizer\'ın Tespiti)');
    for (const area of normalizedData.missingAreas) {
      lines.push(`- [ ] ${area}`);
    }
    lines.push('');
  }

  // Competitor validation instructions
  lines.push('### Rakip Doğrulama Görevi');
  lines.push('');
  lines.push('Beyan edilen rakiplerin bağımsız doğrulaması gerekiyor:');
  if (bc?.competitors) {
    const competitorNames = bc.competitors
      .split(/[,;\/\n]/)
      .map((c) => c.trim())
      .filter(Boolean);
    for (const name of competitorNames) {
      lines.push(`- [ ] **${name}** — gerçek konumlandırma, fiyat aralığı, güçlü/zayıf yönler`);
    }
  } else {
    lines.push('- [ ] Sektörde öne çıkan rakipler tespit edilmeli');
  }
  lines.push('');

  // Undiscovered competitors
  lines.push('### Keşfedilmemiş Rakip Araştırması');
  lines.push(`- [ ] ${normalizedData.sector} sektöründe bilinmeyen/yeni rakipler`);
  lines.push(`- [ ] Alternatif kategoriler ve çapraz rakipler`);
  lines.push(`- [ ] Uluslararası rakipler (${bc?.geoScope ?? 'varsa'})`);
  lines.push('');

  // Market data needs
  lines.push('### Pazar Verisi İhtiyaçları');
  lines.push(`- [ ] ${normalizedData.sector} sektörü pazar büyüklüğü ve büyüme oranı`);
  lines.push(`- [ ] Güncel tüketici trendleri`);
  lines.push(`- [ ] Regülatif/yasal faktörler (varsa)`);
  lines.push(`- [ ] Mevsimsellik ve dönemsel etkiler`);

  const markdown = lines.join('\n');

  return {
    markdown,
    knownCompetitorSites,
    missingAreas: normalizedData.missingAreas,
  };
}
