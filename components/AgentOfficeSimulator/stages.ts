import type { AgentConfig, StageConfig } from './types';

// ─── Agent Configurations ───────────────────────────────────────────────────

export const AGENT_CONFIGS: AgentConfig[] = [
  // Reception
  {
    id: 'guard',
    name: 'Guard',
    role: 'Resepsiyonist',
    color: '#00ff41',
    x: 90, y: 280,
    description: 'Müşteriyi karşılar, talebi alır ve teslim eder',
    spriteVariant: 1,
  },
  {
    id: 'customer',
    name: 'Müşteri',
    role: 'Ziyaretçi',
    color: '#ffffff',
    x: 90, y: 360,
    description: 'Marka stratejisi isteyen müşteri',
    spriteVariant: 0,
  },
  // Araştırma
  {
    id: 'nisan',
    name: 'Nisan',
    role: 'Data Normalizer',
    color: '#00cfff',
    x: 225, y: 175,
    description: 'Ham müşteri verisini normalize eder, eksikleri tamamlar',
    spriteVariant: 0,
  },
  {
    id: 'tarik',
    name: 'Tarık',
    role: 'Deep Researcher',
    color: '#ff6b35',
    x: 350, y: 175,
    description: 'Önce Gemini Deep Research (async, ~240s). Timeout/hata varsa Grounding fallback: rakip + pazar + trend sorguları paralel. Pipelinin en yavaş ajanı — bottleneck.',
    spriteVariant: 2,
  },
  {
    id: 'webfetcher',
    name: 'WebFetcher',
    role: 'Website Analyzer',
    color: '#a855f7',
    x: 280, y: 265,
    description: 'Müşterinin web sitesini parse eder ve analiz eder',
    spriteVariant: 0,
  },
  // Strateji
  {
    id: 'leyla',
    name: 'Leyla',
    role: 'Brand Strategist',
    color: '#f472b6',
    x: 525, y: 175,
    description: 'Marka kimliği, arketip ve konumlandırma stratejisi üretir',
    spriteVariant: 0,
  },
  {
    id: 'bora',
    name: 'Bora',
    role: 'Multi-Model Consensus',
    color: '#34d399',
    x: 650, y: 265,
    description: 'Perceptual map koordinatlarını çıkarır, multi-model konsensüs sağlar',
    spriteVariant: 2,
  },
  // Eleştiri Bay
  {
    id: 'emre',
    name: 'Emre',
    role: 'Brand Challenger',
    color: '#ef4444',
    x: 215, y: 365,
    description: 'Stratejiyi sorgular, zayıf noktaları belirler',
    spriteVariant: 1,
  },
  {
    id: 'pinar',
    name: 'Pınar',
    role: 'Blog Strategy Advisor',
    color: '#fb923c',
    x: 325, y: 365,
    description: 'İçerik ve blog stratejisi önerileri sunar',
    spriteVariant: 0,
  },
  {
    id: 'volkan',
    name: 'Volkan',
    role: 'Consumer Test',
    color: '#facc15',
    x: 435, y: 365,
    description: 'Tüketici perspektifinden stratejiyi değerlendirir',
    spriteVariant: 2,
  },
  {
    id: 'sinan',
    name: 'Sinan',
    role: 'Digital Presence Analyzer',
    color: '#38bdf8',
    x: 545, y: 365,
    description: 'Dijital varlık ve SEO durumunu analiz eder',
    spriteVariant: 0,
  },
  {
    id: 'cansu',
    name: 'Cansu',
    role: 'Competitor Discovery',
    color: '#c084fc',
    x: 655, y: 365,
    description: 'Rakip markaları keşfeder ve karşılaştırır',
    spriteVariant: 1,
  },
  // Revizyon
  {
    id: 'alp',
    name: 'Alp',
    role: 'Strategy Revision',
    color: '#4ade80',
    x: 795, y: 175,
    description: 'Eleştiriler ışığında stratejiyi revize eder',
    spriteVariant: 2,
  },
  {
    id: 'reza',
    name: 'Reza',
    role: 'Approval Gate',
    color: '#f87171',
    x: 795, y: 295,
    description: 'İnsan onayı bekler — kritik kontrol noktası',
    spriteVariant: 1,
  },
  // Sentez Süiti
  {
    id: 'hasan',
    name: 'Hasan',
    role: 'Strategy Synthesizer',
    color: '#818cf8',
    x: 950, y: 175,
    description: 'Tüm bulguları nihai strateji raporunda sentezler. Ayrıca brandClaim üretir: rekabetten ayrışan tek cümlelik marka iddiası, dil rehberi (kullan/kullanma + ton örnekleri) ve 6 kanal için gerçek kopya metinleri.',
    spriteVariant: 0,
  },
  {
    id: 'defne',
    name: 'Defne',
    role: 'Brand Value Maximizer',
    color: '#fb7185',
    x: 1070, y: 175,
    description: 'Marka değer önerisini maksimize eder',
    spriteVariant: 0,
  },
  {
    id: 'gul',
    name: 'Gül',
    role: 'Deliverable Enricher',
    color: '#a3e635',
    x: 1010, y: 265,
    description: 'Intiba yol haritası üretir, teslimatları zenginleştirir',
    spriteVariant: 2,
  },
  {
    id: 'nesrin',
    name: 'Nesrin',
    role: 'Evidence Builder',
    color: '#fbbf24',
    x: 950, y: 365,
    description: 'Blog RAG sorgusu yapar, veri kanıtları ve referansları derler',
    spriteVariant: 0,
  },
  {
    id: 'serkan',
    name: 'Serkan',
    role: 'Calibration',
    color: '#67e8f9',
    x: 1070, y: 365,
    description: 'Çıktıları kalibrasyon ve çapraz doğrulama ile denetler',
    spriteVariant: 1,
  },
];

// ─── Stage Definitions ───────────────────────────────────────────────────────

// Stages 1-2 run on Vercel. After research completes, pipeline delegates to Hetzner.
// Stages 5-17 run inside the Hetzner cluster (basement floor in the simulator).
export const STAGES: StageConfig[] = [
  {
    id: 'intake',
    label: 'Müşteri Kabulü',
    agentIds: ['guard', 'customer'],
    durationMs: 3000,
    required: true,
    outPackets: [
      { fromId: 'guard', toId: 'nisan', label: 'REQ' },
      { fromId: 'guard', toId: 'webfetcher', label: 'REQ' },
    ],
  },
  {
    id: 'hetzner_delegation',
    label: 'Hetzner\'e Devir',
    agentIds: ['nisan', 'tarik', 'webfetcher', 'leyla', 'bora', 'emre', 'pinar', 'volkan', 'sinan', 'cansu', 'alp', 'reza', 'hasan', 'defne', 'gul', 'nesrin', 'serkan'],
    durationMs: 3000,
    isHetznerDelegation: true,
    outPackets: [],
  },
  {
    id: 'data_collection',
    label: 'Ön Veri Toplama',
    agentIds: ['nisan', 'webfetcher'],
    durationMs: 5000,
    required: true,
    outPackets: [
      { fromId: 'nisan', toId: 'tarik', label: 'NORM' },
      { fromId: 'webfetcher', toId: 'tarik', label: 'WEB' },
    ],
  },
  {
    id: 'research_brief',
    label: 'Research Brief',
    agentIds: ['nisan'],
    durationMs: 1000,
    required: true,
    outPackets: [
      { fromId: 'nisan', toId: 'tarik', label: 'BRIEF' },
    ],
  },
  {
    id: 'deep_research',
    label: 'Deep Research',
    agentIds: ['tarik'],
    durationMs: 18000,
    required: true,
    outPackets: [
      { fromId: 'tarik', toId: 'leyla', label: 'RSCH' },
      { fromId: 'tarik', toId: 'cansu', label: 'RSCH' },
    ],
  },
  {
    id: 'competitor_discovery',
    label: 'Rakip Keşfi',
    agentIds: ['cansu'],
    durationMs: 5000,
    required: true,
    outPackets: [
      { fromId: 'cansu', toId: 'webfetcher', label: 'URLS' },
    ],
  },
  {
    id: 'competitor_scan',
    label: 'Rakip Site Tarama',
    agentIds: ['webfetcher'],
    durationMs: 6000,
    required: true,
    outPackets: [
      { fromId: 'webfetcher', toId: 'bora', label: 'SITES' },
    ],
  },
  {
    id: 'perceptual_map',
    label: 'Perceptual Map',
    agentIds: ['bora'],
    durationMs: 3000,
    required: true,
    outPackets: [
      { fromId: 'bora', toId: 'leyla', label: 'MAP' },
    ],
  },
  {
    id: 'blog_rag',
    label: 'Blog RAG Sorgusu',
    agentIds: ['nesrin'],
    durationMs: 3000,
    required: true,
    outPackets: [
      { fromId: 'nesrin', toId: 'leyla', label: 'RAG' },
    ],
  },
  {
    id: 'strategy',
    label: 'Marka Stratejisi',
    agentIds: ['leyla'],
    durationMs: 8000,
    required: true,
    outPackets: [
      { fromId: 'leyla', toId: 'bora', label: 'STRAT' },
    ],
  },
  {
    id: 'consensus',
    label: 'Multi-Model Konsensüs',
    agentIds: ['bora'],
    durationMs: 4000,
    required: true,
    outPackets: [
      { fromId: 'bora', toId: 'emre', label: 'CNS' },
      { fromId: 'bora', toId: 'pinar', label: 'CNS' },
      { fromId: 'bora', toId: 'volkan', label: 'CNS' },
      { fromId: 'bora', toId: 'sinan', label: 'CNS' },
      { fromId: 'bora', toId: 'cansu', label: 'CNS' },
    ],
  },
  {
    id: 'parallel_critique',
    label: 'Paralel Kritik Fazı',
    agentIds: ['emre', 'pinar', 'volkan', 'sinan', 'cansu'],
    durationMs: 6000,
    required: true,
    outPackets: [
      { fromId: 'emre', toId: 'alp', label: 'CRIT' },
      { fromId: 'pinar', toId: 'alp', label: 'BLOG' },
      { fromId: 'volkan', toId: 'alp', label: 'TEST' },
      { fromId: 'sinan', toId: 'alp', label: 'DIGI' },
      { fromId: 'cansu', toId: 'alp', label: 'COMP' },
    ],
  },
  {
    id: 'revision',
    label: 'Strateji Revizyonu',
    agentIds: ['alp'],
    durationMs: 5000,
    required: true,
    outPackets: [
      { fromId: 'alp', toId: 'reza', label: 'REV' },
    ],
  },
  {
    id: 'approval',
    label: 'İnsan Onayı',
    agentIds: ['reza'],
    durationMs: 99999,
    requiresApproval: true,
    outPackets: [
      { fromId: 'reza', toId: 'hasan', label: 'OK' },
      { fromId: 'reza', toId: 'defne', label: 'OK' },
    ],
  },
  {
    id: 'synthesis',
    label: 'Sentez',
    agentIds: ['hasan', 'defne'],
    durationMs: 10000,
    required: true,
    outPackets: [
      { fromId: 'hasan', toId: 'gul', label: 'SYN' },
      { fromId: 'defne', toId: 'serkan', label: 'VAL' },
    ],
  },
  {
    id: 'roadmap',
    label: 'Intiba Yol Haritası',
    agentIds: ['gul'],
    durationMs: 5000,
    required: true,
    outPackets: [
      { fromId: 'gul', toId: 'nesrin', label: 'ROAD' },
      { fromId: 'gul', toId: 'serkan', label: 'ROAD' },
    ],
  },
  {
    id: 'delivery',
    label: 'Kalite + Teslimat',
    agentIds: ['nesrin', 'serkan', 'guard', 'customer'],
    durationMs: 5000,
    required: true,
    outPackets: [],
  },
];

// ─── Section Zone Definitions ─────────────────────────────────────────────

export interface SectionZone {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export const SECTION_ZONES: SectionZone[] = [
  { label: 'RESEPSIYON', x: 14, y: 14, w: 148, h: 398, color: '#00ff4120' },
  { label: 'ARAŞTIRMA', x: 166, y: 14, w: 282, h: 240, color: '#00cfff18' },
  { label: 'STRATEJİ', x: 452, y: 14, w: 252, h: 200, color: '#f472b618' },
  { label: 'ELEŞTİRİ BAY', x: 166, y: 258, w: 538, h: 154, color: '#ef444418' },
  { label: 'REVİZYON', x: 752, y: 14, w: 120, h: 398, color: '#4ade8018' },
  { label: 'SENTEZ SÜİTİ', x: 876, y: 14, w: 312, h: 398, color: '#818cf818' },
];
