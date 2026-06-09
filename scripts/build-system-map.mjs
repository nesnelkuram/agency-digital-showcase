// build-system-map.mjs
//
// Sistem mimarisi haritasının VERİ KATMANI.
// Repo'yu tarar, "ne var, nasıl bağlı" graph'ını JSON olarak üretir.
// Kimse bu haritayı elle çizmez — koddan türer, böylece çürümez.
//
// Node tipleri:
//   feature    — admin/* alt klasörleri + portal  (insanın "modül" dediği şey)
//   api        — api/* alt grupları                (backend yetenekleri)
//   hook       — shared/hooks/*                    (ön yüz veri geçidi)
//   service    — shared/services/*                 (veri erişim katmanı)
//   collection — Firestore koleksiyonları          (verinin kendisi = bağ dokusu)
//
// Edge tipleri:
//   uses       feature -> service/hook  (import @/shared/services|hooks/X)
//   calls      feature -> api           (fetch('/api/<grup>/...'))
//   persists   service/hook -> collection  (COLLECTION = 'X' / collection(db,'X'))
//   accesses   api/feature -> collection   (transitif veri dokunuşu)
//
// Çalıştır:  node scripts/build-system-map.mjs
// Çıktı:     public/system-map.json  (admin/system/SystemMapPage fetch eder)

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'system-map.json')

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'dataconnect-generated', '.git', 'public',
  'videos', 'storyboard', '_bundles', '_list',
])
const CODE_EXT = new Set(['.ts', '.tsx'])

// ── repo yürüyüşü ────────────────────────────────────────────────────────────
async function walk(dir) {
  let out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      out = out.concat(await walk(full))
    } else if (CODE_EXT.has(path.extname(e.name))) {
      out.push(full)
    }
  }
  return out
}

// ── regex sinyalleri ─────────────────────────────────────────────────────────
const RE = {
  importPath: /from\s+['"]([^'"]+)['"]/g,
  // shared/services/taskService, @/shared/services/taskService, @shared/services/...
  service: /(?:@\/|@)?shared\/services\/([A-Za-z0-9_]+)/,
  hook: /(?:@\/|@)?shared\/hooks\/([A-Za-z0-9_]+)/,
  fetchApi: /fetch\(\s*[`'"]\/api\/([A-Za-z0-9_-]+)/g,
  collDecl: /COLLECTION(?:_NAME)?\s*[=:]\s*['"]([A-Za-z0-9_]+)['"]/g,
  collCall: /collection\(\s*[A-Za-z0-9_.]+\s*,\s*['"]([A-Za-z0-9_]+)['"]/g,
  collAdmin: /\.collection\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g,
}

function matchAll(re, text) {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  const out = []
  let m
  while ((m = r.exec(text)) !== null) out.push(m[1])
  return out
}

// ── graph birikimi ───────────────────────────────────────────────────────────
const nodes = new Map() // id -> node
const edgeSet = new Map() // key -> edge (ağırlıklı, tekilleştirilmiş)

function addNode(id, props) {
  if (!nodes.has(id)) nodes.set(id, { id, files: 0, loc: 0, ...props })
  return nodes.get(id)
}
function addEdge(source, target, type) {
  if (source === target) return
  const key = `${source}|${target}|${type}`
  if (edgeSet.has(key)) edgeSet.get(key).weight++
  else edgeSet.set(key, { source, target, type, weight: 1 })
}

// her node için ham bağımlılıklar (önce topla, sonra çöz)
const raw = new Map() // ownerId -> { services:Set, hooks:Set, apis:Set, colls:Set }
function rawOf(id) {
  if (!raw.has(id)) raw.set(id, { services: new Set(), hooks: new Set(), apis: new Set(), colls: new Set() })
  return raw.get(id)
}

function ownerOf(parts, rel) {
  if (parts[0] === 'admin' && parts.length > 2) return { id: `feature:${parts[1]}`, kind: 'feature', label: parts[1], layer: 'admin', dir: `admin/${parts[1]}` }
  if (parts[0] === 'portal') return { id: 'feature:portal', kind: 'feature', label: 'portal', layer: 'portal', dir: 'portal' }
  if (parts[0] === 'api' && parts.length > 2 && !parts[1].startsWith('_')) return { id: `api:${parts[1]}`, kind: 'api', label: parts[1], layer: 'api', dir: `api/${parts[1]}` }
  if (parts[0] === 'shared' && parts[1] === 'services') { const n = path.basename(rel, path.extname(rel)); return { id: `service:${n}`, kind: 'service', label: n, layer: 'service', dir: rel } }
  if (parts[0] === 'shared' && parts[1] === 'hooks') { const n = path.basename(rel, path.extname(rel)); return { id: `hook:${n}`, kind: 'hook', label: n, layer: 'hook', dir: rel } }
  return null
}

async function main() {
  const files = await walk(ROOT)

  // ── PASS 1: her dosyayı oku, sahibine ham bağımlılıkları yaz ────────────────
  for (const f of files) {
    const rel = path.relative(ROOT, f)
    const parts = rel.split(path.sep)
    const owner = ownerOf(parts, rel)
    let text
    try { text = await fs.readFile(f, 'utf8') } catch { continue }
    const loc = text.split('\n').length

    // koleksiyon node'ları her yerden toplanır
    const colls = [...matchAll(RE.collDecl, text), ...matchAll(RE.collCall, text), ...matchAll(RE.collAdmin, text)]
    for (const c of colls) addNode(`collection:${c}`, { kind: 'collection', label: c, layer: 'data' })

    if (!owner) continue
    const n = addNode(owner.id, owner); n.files++; n.loc += loc
    const r = rawOf(owner.id)

    for (const imp of matchAll(RE.importPath, text)) {
      const sm = imp.match(RE.service); if (sm) r.services.add(sm[1])
      const hm = imp.match(RE.hook); if (hm) r.hooks.add(hm[1])
    }
    for (const grp of matchAll(RE.fetchApi, text)) r.apis.add(grp)
    for (const c of colls) r.colls.add(c)
  }

  // ── service/hook -> collection çözümü (kendi dokunduğu koleksiyonlar) ───────
  const collsOf = (id) => rawOf(id).colls
  for (const [id, r] of raw) {
    if (id.startsWith('service:') || id.startsWith('hook:')) {
      for (const c of r.colls) addEdge(id, `collection:${c}`, 'persists')
    }
    if (id.startsWith('api:')) {
      for (const c of r.colls) addEdge(id, `collection:${c}`, 'accesses')
    }
    // hook -> service (hook'lar servis sarmalayabilir)
    if (id.startsWith('hook:')) for (const s of r.services) if (nodes.has(`service:${s}`)) addEdge(id, `service:${s}`, 'uses')
  }

  // ── PASS 2: feature/api kenarları + transitif koleksiyon dokunuşu ───────────
  const featureCollections = new Map() // featureId -> Set(collection)  (akrabalık)
  for (const [id, r] of raw) {
    if (!id.startsWith('feature:') && !id.startsWith('api:')) continue

    for (const s of r.services) if (nodes.has(`service:${s}`)) addEdge(id, `service:${s}`, 'uses')
    for (const h of r.hooks) if (nodes.has(`hook:${h}`)) addEdge(id, `hook:${h}`, 'uses')
    for (const a of r.apis) { addNode(`api:${a}`, { kind: 'api', label: a, layer: 'api' }); addEdge(id, `api:${a}`, 'calls') }

    if (id.startsWith('feature:')) {
      // doğrudan + servis üzerinden + hook üzerinden (1 sıçrama) koleksiyon ayak izi
      const reached = new Set(r.colls)
      for (const s of r.services) collsOf(`service:${s}`).forEach((c) => reached.add(c))
      for (const h of r.hooks) {
        collsOf(`hook:${h}`).forEach((c) => reached.add(c))
        rawOf(`hook:${h}`).services.forEach((s) => collsOf(`service:${s}`).forEach((c) => reached.add(c)))
      }
      if (reached.size) {
        featureCollections.set(id, reached)
        for (const c of reached) if (nodes.has(`collection:${c}`)) addEdge(id, `collection:${c}`, 'accesses')
      }
    }
  }

  // 4) türetilmiş sinyaller: derece, izole node'lar, hotspot koleksiyonlar
  const deg = new Map()
  for (const e of edgeSet.values()) {
    deg.set(e.source, (deg.get(e.source) || 0) + 1)
    deg.set(e.target, (deg.get(e.target) || 0) + 1)
  }
  for (const n of nodes.values()) n.degree = deg.get(n.id) || 0

  const nodeList = [...nodes.values()]
  const edgeList = [...edgeSet.values()]

  // izole feature/service: hiçbir şeye bağlı değil → şüpheli (ölü kod ya da kopuk)
  const isolated = nodeList
    .filter((n) => (n.kind === 'feature' || n.kind === 'service') && n.degree === 0)
    .map((n) => n.id)

  // hotspot koleksiyonlar: çok feature'ın dokunduğu veri = bağlantı/coupling sıcak noktası
  const collTouch = {}
  for (const [, set] of featureCollections) for (const c of set) collTouch[c] = (collTouch[c] || 0) + 1
  const hotspots = Object.entries(collTouch)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => ({ collection: c, touchedByFeatures: n }))

  // sprawl alarmı: ortak veri ayak izi çok benzeyen feature çiftleri (olası tekrar)
  const featEntries = [...featureCollections.entries()]
  const overlaps = []
  for (let i = 0; i < featEntries.length; i++) {
    for (let j = i + 1; j < featEntries.length; j++) {
      const [aId, aSet] = featEntries[i]
      const [bId, bSet] = featEntries[j]
      const inter = [...aSet].filter((x) => bSet.has(x))
      const union = new Set([...aSet, ...bSet])
      const jaccard = union.size ? inter.length / union.size : 0
      if (jaccard >= 0.5 && inter.length >= 2) {
        overlaps.push({ a: aId, b: bId, shared: inter, similarity: +jaccard.toFixed(2) })
      }
    }
  }
  overlaps.sort((a, b) => b.similarity - a.similarity)

  const graph = {
    generatedFrom: 'scripts/build-system-map.mjs',
    counts: {
      total: nodeList.length,
      feature: nodeList.filter((n) => n.kind === 'feature').length,
      api: nodeList.filter((n) => n.kind === 'api').length,
      hook: nodeList.filter((n) => n.kind === 'hook').length,
      service: nodeList.filter((n) => n.kind === 'service').length,
      collection: nodeList.filter((n) => n.kind === 'collection').length,
      edges: edgeList.length,
    },
    signals: { isolated, hotspots, overlaps: overlaps.slice(0, 15) },
    nodes: nodeList.sort((a, b) => b.degree - a.degree),
    edges: edgeList,
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(graph, null, 2))

  // konsol özeti — veri iyi mi diye gözle doğrula
  console.log('\n🗺  Sistem haritası üretildi →', path.relative(ROOT, OUT))
  console.log('   node:', graph.counts.total,
    `(feature ${graph.counts.feature}, api ${graph.counts.api}, hook ${graph.counts.hook}, service ${graph.counts.service}, collection ${graph.counts.collection})`)
  console.log('   edge:', graph.counts.edges)
  console.log('\n   En bağlı 8 node:')
  for (const n of nodeList.slice(0, 8)) console.log(`     ${String(n.degree).padStart(3)}  ${n.kind.padEnd(10)} ${n.label}`)
  if (isolated.length) console.log('\n   ⚠️  İzole (kopuk) node:', isolated.join(', '))
  if (hotspots.length) {
    console.log('\n   🔥 Hotspot koleksiyonlar (≥3 feature dokunuyor):')
    for (const h of hotspots) console.log(`     ${h.touchedByFeatures}×  ${h.collection}`)
  }
  if (overlaps.length) {
    console.log('\n   🟡 Sprawl alarmı (ayak izi örtüşen feature çiftleri):')
    for (const o of overlaps.slice(0, 8)) {
      console.log(`     ${o.similarity}  ${o.a.replace('feature:', '')} ↔ ${o.b.replace('feature:', '')}  [${o.shared.join(', ')}]`)
    }
  }
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) })
