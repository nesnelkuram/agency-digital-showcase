// enrich-system-map.mjs
//
// Sistem haritasının ANLAM KATMANI.
// build-system-map.mjs YAPIYI verir (ne neye bağlı). Bu script ANLAMI ekler:
// kod yapısı + MEMORY.md (insan dili) → Gemini → domain'ler, amaç cümleleri,
// anlamlı ilişkiler. Harita böylece "şema gibi" değil "cümle gibi" okunur.
//
// Çalıştır:  node scripts/enrich-system-map.mjs
// Girdi:     public/system-map.json   (+ MEMORY.md + repo .md dokümanları)
// Çıktı:     public/system-map-semantic.json

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { GoogleGenAI } from '@google/genai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const STRUCT = join(ROOT, 'public', 'system-map.json')
const OUT = join(ROOT, 'public', 'system-map-semantic.json')
const OVERRIDES = join(ROOT, 'shared', 'data', 'system-map-overrides.json') // insanın son sözü
const MODEL_ID = 'gemini-2.0-flash'

// ── .env.local'dan GEMINI_API_KEY ────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  const envPath = join(ROOT, '.env.local')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i === -1) continue
      const k = t.slice(0, i).trim()
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) { console.error('ERROR: GEMINI_API_KEY yok (.env.local).'); process.exit(1) }
const ai = new GoogleGenAI({ apiKey })

// ── insan-dili bağlam: MEMORY.md (index + konu dosyaları) + repo dokümanları ──
function readCapped(path, cap = 7000) {
  try { return readFileSync(path, 'utf-8').slice(0, cap) } catch { return '' }
}
function loadHumanContext() {
  const memDir = join(homedir(), '.claude', 'projects', '-Users-intiba-Documents-AIprojects-agency-digital-showcase', 'memory')
  const parts = []
  const mem = readCapped(join(memDir, 'MEMORY.md'), 12000)
  if (mem) parts.push('## MEMORY.md (sistemin insan-dili özeti)\n' + mem)
  for (const doc of ['MASTER-PLAN.md', 'ARCHITECTURE.md']) {
    const c = readCapped(join(ROOT, doc), 5000)
    if (c) parts.push(`## ${doc}\n` + c)
  }
  return parts.join('\n\n')
}

// ── yapısal graph'tan feature özeti çıkar ────────────────────────────────────
function digest(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const features = graph.nodes.filter((n) => n.kind === 'feature')
  const lines = features.map((f) => {
    const out = graph.edges.filter((e) => e.source === f.id)
    const colls = out.filter((e) => e.target.startsWith('collection:')).map((e) => e.target.replace('collection:', ''))
    const apis = out.filter((e) => e.target.startsWith('api:')).map((e) => e.target.replace('api:', ''))
    return `- ${f.id}  (dizin: ${f.dir || '?'}, derece: ${f.degree})\n    dokunduğu veri: ${colls.slice(0, 8).join(', ') || '—'}\n    çağırdığı api: ${apis.slice(0, 6).join(', ') || '—'}`
  })
  const hotspots = (graph.signals?.hotspots || []).map((h) => `${h.collection} (${h.touchedByFeatures} feature)`)
  return {
    featureIds: features.map((f) => f.id),
    text: `### Feature'lar (${features.length})\n${lines.join('\n')}\n\n### En paylaşılan koleksiyonlar\n${hotspots.join(', ')}`,
    byId,
  }
}

function parseJSON(text) {
  try { return JSON.parse(text) }
  catch { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('Gemini JSON parse edilemedi: ' + text.slice(0, 300)); return JSON.parse(m[0]) }
}

// ── MOD A: alanlar insan tarafından sabit — AI sadece amaç + ilişki yazar ─────
async function enrichProse(graph, fixedDomains) {
  const d = digest(graph)
  const human = loadHumanContext()
  const domList = fixedDomains.map((dm) => `- ${dm.id} ("${dm.name}"): ${dm.featureIds.map((f) => f.replace('feature:', '')).join(', ')}`).join('\n')
  const prompt = `Sen bir yazılım mimarisi ANLATICISISIN. Bir reklam/sosyal medya ajansını yöneten yazılımın yapısı veriliyor. ALANLAR (domain) İNSAN TARAFINDAN SABİTLENDİ — gruplama YAPMA, alan ekleme/çıkarma YAPMA. Sadece sade Türkçe iş diliyle ANLAM yaz.

# YAPISAL VERİ (koddan)
${d.text}

# İNSAN-DİLİ BAĞLAM (modüller GERÇEKTE ne yapar)
${human || '(not yok)'}

# SABİT ALANLAR (bunları AYNEN kullan)
${domList}

# GÖREV — sadece şu JSON:
1. "featurePurposes": yukarıdaki HER feature için mühendis olmayan birine TEK cümle, sade Türkçe ne işe yaradığı. Anahtar = "feature:x".
2. "relations": SABİT alanlar ARASINDA 8-14 ANLAMLI ilişki. Mekanik değil ("kullanır"), gerçek iş/veri akışı ("onaylanan teklifler proje oluşturur"). from/to = yukarıdaki alan id'leri (birebir), label = kısa Türkçe cümle.

SADECE geçerli JSON (markdown yok):
{ "featurePurposes": {"feature:x":""}, "relations": [{"from":"","to":"","label":""}] }`
  const result = await ai.models.generateContent({ model: MODEL_ID, contents: prompt, config: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' } })
  return parseJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
}

// ── MOD B: AI gruplar (overrides yoksa / kısmiyse) ────────────────────────────
async function enrich(graph) {
  const d = digest(graph)
  const human = loadHumanContext()

  const prompt = `Sen bir yazılım mimarisi ANLATICISISIN. Sana bir reklam/sosyal medya ajansını yöneten yazılımın YAPISAL haritası (hangi modül hangi veriye ve API'ye bağlı) ve insan-dili notları veriliyor. Görevin bunu, mühendis olmayan birinin bile bir bakışta anlayacağı ANLAMSAL bir haritaya çevirmek.

# YAPISAL VERİ (koddan türetildi)
${d.text}

# İNSAN-DİLİ BAĞLAM (notlar — modüllerin GERÇEKTE ne işe yaradığını buradan anla)
${human || '(not yok)'}

# GÖREV
Aşağıdaki JSON'u üret. Türkçe, sade, iş diliyle yaz — kod ismi değil, ANLAM yaz.

1. "domains": Feature'ları 6-9 anlamlı ALANA grupla. Her alan bir iş amacını temsil etsin. HER feature TAM OLARAK BİR alana ait olmalı; hiçbiri boşta kalmasın.
   ÖNEMLİ AYRIM KURALLARI (yanlış gruplama yapma):
   - Finans/teklif/fiyatlandırma modülleri (ör. pricing) pazarlamadan AYRI bir "Teklif & Finans" alanıdır — reklam yönetimiyle karıştırma.
   - Müşteri-tarafı / müşteri portalı (ör. portal) ekip-tarafı modüllerden AYRIDIR; "Müşteri Portalı / İşbirliği" gibi kendi alanı olur.
   - GERÇEK altyapı (auth, contexts, components, notifications) ile İŞ ÖZELLİKLERİNİ karıştırma. Örn. persona = "AI Danışman" bir iş özelliğidir, altyapı değildir; agents = "AI Ajan" yönetimi.
   - "Diğer / Sistem ve Bileşenler" gibi anlamsız ÇÖP-ÇEKMECESİ alan YARATMA. Her modülü gerçek amacına göre yerleştir.
   - id: kısa ingilizce slug (ads, clients, work, content, ...)
   - name: Türkçe alan adı
   - purpose: bu alan ne işe yarar — TEK cümle, sade Türkçe
   - color: hex renk (alanlar birbirinden ayrılsın)
   - featureIds: bu alana ait feature id'leri (yukarıdaki listeden, birebir)

2. "featurePurposes": HER feature için, mühendis olmayan birine TEK cümleyle ne işe yaradığını anlat (teknik değil). Anahtar = feature id.

3. "relations": Alanlar ARASINDA 8-15 ANLAMLI ilişki. "kullanır/bağlıdır" gibi mekanik değil; gerçek iş/veri akışını anlatan Türkçe fiil cümlesi yaz (örn. "içerik planları müşteri onayına gider", "tamamlanan görevler iş gücü motorunu besler").
   - from: alan id
   - to: alan id
   - label: kısa Türkçe ilişki cümlesi

SADECE şu şekilde geçerli JSON döndür (markdown yok):
{
  "domains": [{"id":"","name":"","purpose":"","color":"#","featureIds":[""]}],
  "featurePurposes": {"feature:x":""},
  "relations": [{"from":"","to":"","label":""}]
}`

  const result = await ai.models.generateContent({
    model: MODEL_ID,
    contents: prompt,
    config: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' },
  })
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  let parsed
  try { parsed = JSON.parse(text) }
  catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Gemini JSON parse edilemedi: ' + text.slice(0, 300))
    parsed = JSON.parse(m[0])
  }
  return { parsed, featureIds: d.featureIds }
}

// ── doğrula + boşlukları kapat ────────────────────────────────────────────────
function validate(sem, featureIds) {
  const featSet = new Set(featureIds)
  const domains = Array.isArray(sem.domains) ? sem.domains : []
  const assigned = new Set()
  for (const dom of domains) {
    dom.featureIds = (dom.featureIds || []).filter((f) => featSet.has(f))
    dom.featureIds.forEach((f) => assigned.add(f))
    if (!dom.color) dom.color = '#6366f1'
  }
  // atanmamış feature'ları "diğer" alanına topla
  const orphans = featureIds.filter((f) => !assigned.has(f))
  if (orphans.length) {
    domains.push({ id: 'misc', name: 'Diğer', purpose: 'Henüz bir alana atanmamış modüller.', color: '#52525b', featureIds: orphans })
  }
  const domIds = new Set(domains.map((dm) => dm.id))
  const relations = (sem.relations || []).filter((r) => domIds.has(r.from) && domIds.has(r.to) && r.from !== r.to)
  const featurePurposes = sem.featurePurposes || {}
  return { domains, relations, featurePurposes }
}

// ── insan override'ları: AI'nin kararını deterministik ez ─────────────────────
// Dosya formatı (shared/data/system-map-overrides.json):
// {
//   "domains": { "finance": { "name": "Teklif & Finans", "purpose": "...", "color": "#0ea5e9" } },
//   "assignments": { "feature:pricing": "finance", "feature:portal": "clients" }
// }
function loadOverrides() {
  if (!existsSync(OVERRIDES)) return { domains: {}, assignments: {} }
  try {
    const o = JSON.parse(readFileSync(OVERRIDES, 'utf-8'))
    return { domains: o.domains || {}, assignments: o.assignments || {} }
  } catch (e) { console.warn('⚠️  overrides okunamadı, atlanıyor:', e.message); return { domains: {}, assignments: {} } }
}

function applyOverrides(sem, ov) {
  const assignments = ov.assignments || {}
  if (!Object.keys(assignments).length && !Object.keys(ov.domains || {}).length) return sem
  const domById = new Map(sem.domains.map((d) => [d.id, d]))
  // override'lanan domain'leri (yoksa) oluştur
  for (const [domId, meta] of Object.entries(ov.domains || {})) {
    if (!domById.has(domId)) {
      const dom = { id: domId, name: meta.name || domId, purpose: meta.purpose || '', color: meta.color || '#6366f1', featureIds: [] }
      sem.domains.push(dom); domById.set(domId, dom)
    } else {
      // meta verildiyse güncelle
      const dom = domById.get(domId)
      if (meta.name) dom.name = meta.name
      if (meta.purpose) dom.purpose = meta.purpose
      if (meta.color) dom.color = meta.color
    }
  }
  // feature'ları taşı: her yerden çıkar, hedefe ekle
  for (const [featureId, targetDom] of Object.entries(assignments)) {
    if (!domById.has(targetDom)) {
      const dom = { id: targetDom, name: targetDom, purpose: '', color: '#6366f1', featureIds: [] }
      sem.domains.push(dom); domById.set(targetDom, dom)
    }
    for (const d of sem.domains) d.featureIds = d.featureIds.filter((f) => f !== featureId)
    domById.get(targetDom).featureIds.push(featureId)
  }
  // boşalan alanları at
  sem.domains = sem.domains.filter((d) => d.featureIds.length > 0)
  // silinen alanlara asılı kalan ilişkileri süz
  const liveIds = new Set(sem.domains.map((d) => d.id))
  sem.relations = (sem.relations || []).filter((r) => liveIds.has(r.from) && liveIds.has(r.to))
  return sem
}

// overrides TÜM feature'ları kapsıyorsa → tam taksonomi (insan sahipli) modu
function isFullTaxonomy(ov, featureIds) {
  const a = ov.assignments || {}
  return featureIds.length > 0 && featureIds.every((f) => a[f])
}

// overrides'tan alanları kur (sıra: domains meta'sındaki sıra korunur)
function buildDomainsFromOverrides(ov, featureIds) {
  const order = Object.keys(ov.domains || {})
  const byId = new Map()
  const ensure = (id) => {
    if (!byId.has(id)) {
      const meta = (ov.domains || {})[id] || {}
      byId.set(id, { id, name: meta.name || id, purpose: meta.purpose || '', color: meta.color || '#6366f1', featureIds: [] })
    }
    return byId.get(id)
  }
  order.forEach(ensure)
  for (const f of featureIds) ensure(ov.assignments[f]).featureIds.push(f)
  return [...byId.values()].filter((d) => d.featureIds.length > 0)
}

// ── alanın gerçek kod ayak izi (somut anlatım için) ──────────────────────────
function domainFootprint(graph, domain, featurePurposes) {
  return domain.featureIds.map((fid) => {
    const node = graph.nodes.find((n) => n.id === fid)
    const label = node?.label ?? fid.replace('feature:', '')
    const out = graph.edges.filter((e) => e.source === fid)
    const colls = out.filter((e) => e.target.startsWith('collection:')).map((e) => e.target.replace('collection:', '')).slice(0, 8)
    const apis = out.filter((e) => e.target.startsWith('api:')).map((e) => e.target.replace('api:', '')).slice(0, 6)
    return `- ${label}: ${featurePurposes[fid] || ''}\n    veri: ${colls.join(', ') || '—'} | api: ${apis.join(', ') || '—'}`
  }).join('\n')
}

// ── alanın "nasıl çalışır" senaryolarını üret (koddan beslenir, uydurmaz) ─────
async function generateWalkthrough(graph, domain, featurePurposes, human) {
  const fp = domainFootprint(graph, domain, featurePurposes)
  const prompt = `Bir reklam ajansı yazılımının "${domain.name}" alanını, bu alanı HİÇ BİLMEYEN birine TANE TANE, sade Türkçe anlat. Kişi okuyunca süreci, hangi araçlara bağlı olduğunu ve ne zaman ne olduğunu anlamalı.

# ALAN: ${domain.name}
${domain.purpose}

# MODÜLLER VE GERÇEK KOD BAĞLANTILARI (somut ol, bunları kullan, uydurma)
${fp}

# BAĞLAM (modüllerin gerçekte ne yaptığı)
${human ? human.slice(0, 4500) : '(yok)'}

# GÖREV
2-4 SENARYO yaz. Her senaryo gerçek bir akışı anlatsın — ör. "Bir görev nasıl oluşturulur?", "Bildirim ne zaman ve kime gider?", "Hangi modüllerle/araçlarla bağlanır?", "Müşteri sürece nasıl dahil olur?". Her senaryoda 2-5 ADIM; her adım kısa, somut, sıralı bir cümle. Gerçek modül/veri adlarını sade dille kullan, teknik jargon yok.

SADECE JSON (markdown yok):
{ "walkthrough": [ { "title": "", "steps": ["", ""] } ] }`
  try {
    const result = await ai.models.generateContent({ model: MODEL_ID, contents: prompt, config: { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json' } })
    const p = parseJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    return Array.isArray(p.walkthrough) ? p.walkthrough.filter((w) => w && w.title && Array.isArray(w.steps)) : []
  } catch (e) { console.warn(`   ⚠️  ${domain.name} anlatımı üretilemedi:`, e.message); return [] }
}

// ── alanın HER MODÜLÜ için kısa "nasıl çalışır" — tek çağrıda (verimli) ───────
async function generateModuleWalkthroughs(graph, domain, featurePurposes, human) {
  const fp = domainFootprint(graph, domain, featurePurposes)
  const ids = domain.featureIds.join(', ')
  const prompt = `Bir reklam ajansı yazılımının "${domain.name}" alanındaki HER MODÜL için, o modülü bilmeyen birine KISA bir "nasıl çalışır" anlatımı yaz.

# MODÜLLER VE GERÇEK KOD BAĞLANTILARI (somut ol, uydurma)
${fp}

# BAĞLAM
${human ? human.slice(0, 3500) : '(yok)'}

# GÖREV
Listelenen HER feature id için (${ids}) 1-2 SENARYO yaz; her senaryo 2-4 ADIM, her adım kısa somut bir cümle. Gerçek modül/veri/api adlarını sade dille kullan.

SADECE JSON (anahtarlar tam olarak feature id'leri):
{ "modules": { "feature:x": [ { "title": "", "steps": ["", ""] } ] } }`
  try {
    const result = await ai.models.generateContent({ model: MODEL_ID, contents: prompt, config: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' } })
    const p = parseJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    const mods = p.modules || {}
    const out = {}
    for (const fid of domain.featureIds) {
      const arr = mods[fid]
      if (Array.isArray(arr)) out[fid] = arr.filter((w) => w && w.title && Array.isArray(w.steps))
    }
    return out
  } catch (e) { console.warn(`   ⚠️  ${domain.name} modül anlatımları üretilemedi:`, e.message); return {} }
}

// ── alanlar arası ilişkilerin "pratikte nasıl işler" detayı (tek çağrı) ───────
async function generateRelationDetails(sem, human) {
  if (!sem.relations.length) return
  const domSummary = sem.domains.map((d) => `- ${d.id} ("${d.name}"): ${d.featureIds.map((f) => f.replace('feature:', '')).join(', ')}`).join('\n')
  const relList = sem.relations.map((r, i) => `[${i}] ${r.from} → ${r.to}: ${r.label}`).join('\n')
  const prompt = `Bir reklam ajansı yazılımında alanlar ve aralarındaki ilişkiler var. HER ilişki için, bu iş akışının PRATİKTE nasıl işlediğini bilmeyen birine somut anlat.

# ALANLAR VE MODÜLLERİ
${domSummary}

# İLİŞKİLER
${relList}

# BAĞLAM
${human ? human.slice(0, 3500) : '(yok)'}

# GÖREV
HER ilişki (index ile) için:
- "detail": 1-2 cümle — bu akış ne zaman, hangi modüller/veri üzerinden gerçekleşir (somut, sade).
- "steps": 2-3 adım — akışın sırayla nasıl ilerlediği.

SADECE JSON: { "details": [ { "i": 0, "detail": "", "steps": ["", ""] } ] }`
  try {
    const result = await ai.models.generateContent({ model: MODEL_ID, contents: prompt, config: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' } })
    const p = parseJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    for (const d of p.details || []) {
      if (typeof d.i === 'number' && sem.relations[d.i]) {
        if (d.detail) sem.relations[d.i].detail = d.detail
        if (Array.isArray(d.steps)) sem.relations[d.i].steps = d.steps
      }
    }
  } catch (e) { console.warn('   ⚠️  ilişki detayları üretilemedi:', e.message) }
}

async function main() {
  if (!existsSync(STRUCT)) { console.error('Önce: node scripts/build-system-map.mjs'); process.exit(1) }
  const graph = JSON.parse(readFileSync(STRUCT, 'utf-8'))
  const ov = loadOverrides()
  const featureIds = graph.nodes.filter((n) => n.kind === 'feature').map((n) => n.id)
  let sem

  if (isFullTaxonomy(ov, featureIds)) {
    // MOD A: gruplama insan sahipli, AI sadece amaç + ilişki yazar
    const domains = buildDomainsFromOverrides(ov, featureIds)
    console.log(`🧠 Anlam (sabit taksonomi: ${domains.length} alan, insan sahipli) — Gemini ${MODEL_ID}…`)
    const parsed = await enrichProse(graph, domains)
    const liveIds = new Set(domains.map((d) => d.id))
    sem = {
      domains,
      featurePurposes: parsed.featurePurposes || {},
      relations: (parsed.relations || []).filter((r) => liveIds.has(r.from) && liveIds.has(r.to) && r.from !== r.to),
    }
  } else {
    // MOD B: AI gruplar, kısmi override'lar yamar
    console.log('🧠 Anlam (AI gruplama) — Gemini ' + MODEL_ID + '…')
    const { parsed } = await enrich(graph)
    sem = validate(parsed, featureIds)
    const ovCount = Object.keys(ov.assignments).length
    if (ovCount) { sem = applyOverrides(sem, ov); console.log(`   (${ovCount} kısmi override uygulandı)`) }
  }

  // her alan + her modül için "nasıl çalışır" senaryolarını üret (paralel)
  console.log(`   süreç anlatımları üretiliyor (${sem.domains.length} alan + modüller)…`)
  const human = loadHumanContext()
  const featureWalkthroughs = {}
  await Promise.all(sem.domains.map(async (dom) => {
    const [wt, mw] = await Promise.all([
      generateWalkthrough(graph, dom, sem.featurePurposes, human),
      generateModuleWalkthroughs(graph, dom, sem.featurePurposes, human),
    ])
    dom.walkthrough = wt
    Object.assign(featureWalkthroughs, mw)
  }))
  await generateRelationDetails(sem, human)

  const payload = {
    generatedFrom: 'scripts/enrich-system-map.mjs',
    model: MODEL_ID,
    domains: sem.domains,
    relations: sem.relations,
    featurePurposes: sem.featurePurposes,
    featureWalkthroughs,
  }
  writeFileSync(OUT, JSON.stringify(payload, null, 2))

  // konsol özeti — anlam iyi mi diye gözle doğrula
  console.log('\n✅ →', OUT.replace(ROOT + '/', ''))
  console.log('\n   ALANLAR:')
  for (const dm of sem.domains) {
    console.log(`\n   ▸ ${dm.name}  (${dm.featureIds.length} modül)`)
    console.log(`     ${dm.purpose}`)
    console.log(`     ${dm.featureIds.map((f) => f.replace('feature:', '')).join(', ')}`)
  }
  console.log('\n   ANLAMLI İLİŞKİLER:')
  for (const r of sem.relations) {
    const nm = (id) => sem.domains.find((dm) => dm.id === id)?.name || id
    console.log(`     ${nm(r.from)} → ${nm(r.to)}: ${r.label}`)
  }
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) })
