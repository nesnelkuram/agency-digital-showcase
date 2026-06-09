import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { useNavigate } from 'react-router-dom';

// ── türler ───────────────────────────────────────────────────────────────────
type Kind = 'feature' | 'api' | 'hook' | 'service' | 'collection';
interface GNode { id: string; kind: Kind; label: string; layer?: string; dir?: string; degree: number; files?: number; loc?: number }
interface GEdge { source: string; target: string; type: string; weight: number }
interface SystemMap {
  counts: Record<string, number>;
  signals: {
    isolated: string[];
    hotspots: { collection: string; touchedByFeatures: number }[];
    overlaps: { a: string; b: string; shared: string[]; similarity: number }[];
  };
  nodes: GNode[];
  edges: GEdge[];
}
interface Scenario { title: string; steps: string[] }
interface Domain { id: string; name: string; purpose: string; color: string; featureIds: string[]; walkthrough?: Scenario[] }
interface Relation { from: string; to: string; label: string; detail?: string; steps?: string[] }
interface Semantic { domains: Domain[]; relations: Relation[]; featurePurposes: Record<string, string>; featureWalkthroughs?: Record<string, Scenario[]> }

// ── görsel sözlük ────────────────────────────────────────────────────────────
const KIND: Record<Kind, { label: string; bg: string; border: string }> = {
  feature: { label: 'Feature', bg: '#4f46e5', border: '#818cf8' },
  api: { label: 'API', bg: '#b45309', border: '#fbbf24' },
  hook: { label: 'Hook', bg: '#0f766e', border: '#2dd4bf' },
  service: { label: 'Servis', bg: '#0369a1', border: '#38bdf8' },
  collection: { label: 'Koleksiyon', bg: '#9f1239', border: '#fb7185' },
};
const EDGE_LABEL: Record<string, string> = { uses: 'kullanır', calls: 'çağırır', persists: 'yazar', accesses: 'dokunur' };

const elk = new ELK();
const nodeW = (n: { label: string }) => Math.max(96, Math.min(240, n.label.length * 8 + 28));

// alan kapsayıcı düğümü — içine modülleri alır, üstte alan adı
function DomainGroupNode({ data }: { data: { domain: Domain } }) {
  const d = data.domain;
  const h = { width: 1, height: 1, minWidth: 0, minHeight: 0, opacity: 0, border: 'none', background: 'transparent' } as React.CSSProperties;
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 16, border: `2px solid ${d.color}`, background: `${d.color}14` }}>
      <Handle type="target" position={Position.Left} style={{ ...h, top: '50%' }} />
      <Handle type="target" position={Position.Top} id="t" style={{ ...h, left: '50%' }} />
      <Handle type="source" position={Position.Right} style={{ ...h, top: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ ...h, left: '50%' }} />
      <div style={{ position: 'absolute', top: 7, left: 12, right: 10, fontSize: 11, lineHeight: 1.15, fontWeight: 700, color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {d.name} <span style={{ opacity: 0.55, fontWeight: 400 }}>· {d.featureIds.length}</span>
      </div>
    </div>
  );
}
const NODE_TYPES = { domainGroup: DomainGroupNode };

export default function SystemMapPage() {
  return <ReactFlowProvider><SystemMapInner /></ReactFlowProvider>;
}

function SystemMapInner() {
  const [map, setMap] = useState<SystemMap | null>(null);
  const [sem, setSem] = useState<Semantic | null>(null);
  const [semMissing, setSemMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'anlam' | 'yapi'>('anlam');
  const showModules = true; // modüller her zaman görünür (opsiyonel değil)
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<Set<Kind>>(new Set(['feature', 'api', 'collection']));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [selRel, setSelRel] = useState<Relation | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [laying, setLaying] = useState(false);
  const { fitView } = useReactFlow();
  const refit = useCallback(() => { setTimeout(() => fitView({ padding: 0.14, duration: 300 }), 60); }, [fitView]);

  useEffect(() => {
    fetch('/system-map.json')
      .then((r) => { if (!r.ok || (r.headers.get('content-type') || '').includes('html')) throw new Error('x'); return r.json(); })
      .then(setMap).catch(() => setError('not_generated'));
    fetch('/system-map-semantic.json')
      .then((r) => { if (!r.ok || (r.headers.get('content-type') || '').includes('html')) throw new Error('x'); return r.json(); })
      .then(setSem).catch(() => setSemMissing(true));
  }, []);

  // anlam dosyası KESİN yoksa (yükleme bitti ve başarısız) yapı moduna düş
  useEffect(() => { if (semMissing) setMode('yapi'); }, [semMissing]);

  const isolated = useMemo(() => new Set(map?.signals.isolated ?? []), [map]);
  const hotspot = useMemo(() => new Set((map?.signals.hotspots ?? []).map((h) => `collection:${h.collection}`)), [map]);
  const domainOf = useMemo(() => {
    const m = new Map<string, Domain>();
    sem?.domains.forEach((d) => d.featureIds.forEach((f) => m.set(f, d)));
    return m;
  }, [sem]);

  // ── ANLAM modu: domain düğümleri (+ istenirse içlerindeki modüller) ────────
  useEffect(() => {
    if (mode !== 'anlam' || !sem || !map) return;
    let cancelled = false;
    setSelected(null); setLaying(true);

    const relEdges = (): Edge[] => sem.relations.map((r, i) => ({
      id: `r${i}`, source: r.from, target: r.to, label: r.label, animated: true,
      data: { rel: r },
      style: { stroke: '#71717a', strokeWidth: 2, cursor: 'pointer' },
      labelStyle: { fill: '#e4e4e7', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
      labelBgStyle: { fill: '#27272a', fillOpacity: 0.95 }, labelBgPadding: [6, 3] as [number, number], labelBgBorderRadius: 5,
    }));
    const elkRel = sem.relations.map((r, i) => ({ id: `r${i}`, sources: [r.from], targets: [r.to] }));

    if (!showModules) {
      // sade görünüm: sadece alanlar
      const children = sem.domains.map((d) => ({ id: d.id, width: Math.max(150, d.name.length * 9 + 40), height: 60 }));
      elk.layout({ id: 'root', layoutOptions: { 'elk.algorithm': 'stress', 'elk.stress.desiredEdgeLength': '240' }, children, edges: elkRel } as any)
        .then((res: any) => {
          if (cancelled) return;
          const pos = new Map<string, { x: number; y: number }>();
          for (const c of res.children ?? []) pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
          setNodes(sem.domains.map((d) => ({
            id: d.id, position: pos.get(d.id) ?? { x: 0, y: 0 },
            data: { label: `${d.name}  ·  ${d.featureIds.length}`, domain: d } as any,
            style: { background: d.color, color: '#fff', border: '2px solid #ffffff33', borderRadius: 14, fontSize: 13, fontWeight: 700, padding: '10px 14px', width: Math.max(150, d.name.length * 9 + 40) },
          })));
          setEdges(relEdges());
          setLaying(false); refit();
        }).catch(() => setLaying(false));
    } else {
      // hiyerarşik görünüm: alanlar = içine modülleri alan kutular
      const children = sem.domains.map((d) => ({
        id: d.id,
        layoutOptions: { 'elk.padding': '[top=46,left=14,bottom=14,right=14]', 'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.spacing.nodeNode': '12', 'elk.layered.spacing.nodeNodeBetweenLayers': '14', 'elk.nodeSize.minimum': '(160,0)', 'elk.nodeSize.constraints': 'MINIMUM_SIZE' },
        children: d.featureIds.map((f) => {
          const node = map.nodes.find((n) => n.id === f);
          const label = node?.label ?? f.replace('feature:', '');
          return { id: f, width: Math.max(120, label.length * 7 + 22), height: 30 };
        }),
      }));
      elk.layout({
        id: 'root',
        layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.spacing.nodeNode': '40', 'elk.layered.spacing.nodeNodeBetweenLayers': '110' },
        children, edges: elkRel,
      } as any).then((res: any) => {
        if (cancelled) return;
        const rf: Node[] = [];
        // önce kapsayıcılar (parent'lar çocuklardan önce gelmeli)
        for (const c of res.children ?? []) {
          const d = sem.domains.find((x) => x.id === c.id)!;
          rf.push({ id: c.id, type: 'domainGroup', position: { x: c.x ?? 0, y: c.y ?? 0 }, data: { domain: d } as any,
            style: { width: c.width ?? 200, height: c.height ?? 120, background: 'transparent', border: 'none' } });
        }
        // sonra modül çocukları
        for (const c of res.children ?? []) {
          const d = sem.domains.find((x) => x.id === c.id)!;
          for (const ch of c.children ?? []) {
            const node = map.nodes.find((n) => n.id === ch.id);
            rf.push({ id: ch.id, parentId: c.id, extent: 'parent', draggable: false,
              position: { x: ch.x ?? 0, y: ch.y ?? 0 },
              data: { label: node?.label ?? ch.id.replace('feature:', ''), gnode: node } as any,
              style: { background: d.color, color: '#fff', border: '1px solid #ffffff40', borderRadius: 6, fontSize: 11, fontWeight: 600, padding: '4px 8px', width: ch.width ?? 100 } });
          }
        }
        setNodes(rf);
        setEdges(relEdges());
        setLaying(false); refit();
      }).catch(() => setLaying(false));
    }
    return () => { cancelled = true; };
  }, [mode, sem, map, showModules]);

  // ── YAPI modu: yapısal alt-graph (tip filtresi + arama) ────────────────────
  const visible = useMemo(() => {
    if (!map) return { nodes: [] as GNode[], edges: [] as GEdge[] };
    const q = search.trim().toLowerCase();
    let ids = new Set(map.nodes.filter((n) => enabled.has(n.kind)).map((n) => n.id));
    if (q) {
      const hit = new Set(map.nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id));
      const keep = new Set(hit);
      for (const e of map.edges) { if (hit.has(e.source)) keep.add(e.target); if (hit.has(e.target)) keep.add(e.source); }
      ids = new Set([...ids].filter((id) => keep.has(id)));
    }
    return { nodes: map.nodes.filter((n) => ids.has(n.id)), edges: map.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
  }, [map, enabled, search]);

  useEffect(() => {
    if (mode !== 'yapi' || !map) return;
    if (visible.nodes.length === 0) { setNodes([]); setEdges([]); return; }
    let cancelled = false;
    setLaying(true);
    const graph = {
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.layered.spacing.nodeNodeBetweenLayers': '110', 'elk.spacing.nodeNode': '34' },
      children: visible.nodes.map((n) => ({ id: n.id, width: nodeW(n), height: 40 })),
      edges: visible.edges.map((e, i) => ({ id: `e${i}`, sources: [e.source], targets: [e.target] })),
    };
    elk.layout(graph as any).then((res: any) => {
      if (cancelled) return;
      const pos = new Map<string, { x: number; y: number }>();
      for (const c of res.children ?? []) pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
      setNodes(visible.nodes.map((n) => ({
        id: n.id, position: pos.get(n.id) ?? { x: 0, y: 0 },
        data: { label: n.label, gnode: n }, style: baseStyle(n, isolated.has(n.id), hotspot.has(n.id)), width: nodeW(n), height: 40,
      })));
      setEdges(visible.edges.map((e, i) => ({ id: `e${i}`, source: e.source, target: e.target, style: { stroke: '#3f3f46', strokeWidth: 1 } })));
      setLaying(false); refit();
    }).catch(() => setLaying(false));
    return () => { cancelled = true; };
  }, [mode, visible, map, isolated, hotspot]);

  // ok'a tıkla → ilişki detayı (anlam modu)
  const onEdgeClick = useCallback((_: unknown, edge: Edge) => {
    const rel = (edge.data as any)?.rel as Relation | undefined;
    if (rel) { setSelRel(rel); setSelected(null); }
  }, []);

  // tıkla → odak (yapı modu)
  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelRel(null);
    setSelected(node.id);
    if (mode !== 'yapi' || !map) return;
    const nbr = new Set<string>([node.id]);
    for (const e of map.edges) { if (e.source === node.id) nbr.add(e.target); if (e.target === node.id) nbr.add(e.source); }
    setNodes((ns) => ns.map((n) => ({ ...n, style: { ...(n.style as object), opacity: nbr.has(n.id) ? 1 : 0.15 } })));
    setEdges((es) => es.map((e) => {
      const on = e.source === node.id || e.target === node.id;
      return { ...e, style: { stroke: on ? '#a5b4fc' : '#27272a', strokeWidth: on ? 2 : 1 }, animated: on };
    }));
  }, [mode, map]);

  const clearFocus = useCallback(() => {
    setSelected(null);
    setSelRel(null);
    if (mode === 'yapi') {
      setNodes((ns) => ns.map((n) => ({ ...n, style: { ...(n.style as object), opacity: 1 } })));
      setEdges((es) => es.map((e) => ({ ...e, style: { stroke: '#3f3f46', strokeWidth: 1 }, animated: false })));
    }
  }, [mode]);

  const onNodesChange = useCallback((ch: NodeChange[]) => setNodes((ns) => applyNodeChanges(ch, ns)), []);

  if (error === 'not_generated') return <NotGenerated />;
  if (!map) return <div className="flex h-full items-center justify-center text-gray-400">Harita yükleniyor…</div>;

  const selDomain = selected ? sem?.domains.find((d) => d.id === selected) ?? null : null;
  const selNode = selected && !selDomain ? map.nodes.find((n) => n.id === selected) ?? null : null;

  return (
    <div className="fixed inset-0 z-[100] flex h-screen flex-col bg-gray-950 text-gray-200">
      {/* üst bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-800 px-4 py-3">
        <button onClick={() => navigate('/admin')} title="Çıkış"
          className="rounded-md border border-gray-700 px-2.5 py-1.5 text-sm text-gray-400 transition hover:text-white">← Çıkış</button>
        <div>
          <h1 className="text-lg font-semibold text-white">Sistem Haritası</h1>
          <p className="text-xs text-gray-500">
            {map.counts.total} node · {map.counts.edges} bağ · koddan türetildi
          </p>
        </div>
        {/* mod anahtarı */}
        <div className="ml-2 flex rounded-lg border border-gray-700 p-0.5 text-sm">
          {(['anlam', 'yapi'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setSelected(null); }} disabled={m === 'anlam' && !sem}
              className={`rounded-md px-3 py-1 transition ${mode === m ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'} ${m === 'anlam' && !sem ? 'cursor-not-allowed opacity-40' : ''}`}>
              {m === 'anlam' ? 'Anlam' : 'Yapı'}
            </button>
          ))}
        </div>
        {mode === 'yapi' && (
          <div className="ml-auto flex items-center gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara… (marketing, tasks, projects)"
              className="w-56 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500" />
          </div>
        )}
        {mode === 'anlam' && (
          <p className="ml-auto text-xs text-gray-500">Bir alana tıkla → süreç nasıl işliyor, adım adım oku</p>
        )}
        {mode === 'yapi' && (
          <div className="flex w-full flex-wrap gap-1.5">
            {(Object.keys(KIND) as Kind[]).map((k) => {
              const on = enabled.has(k);
              return (
                <button key={k} onClick={() => setEnabled((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
                  style={{ borderColor: on ? KIND[k].border : '#3f3f46', background: on ? KIND[k].bg : 'transparent', color: on ? '#fff' : '#71717a' }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: KIND[k].border }} />
                  {KIND[k].label} <span className="opacity-60">{map.counts[k] ?? 0}</span>
                </button>
              );
            })}
            <span className="ml-2 self-center text-[11px] text-gray-600">(hook + servis kapalı = sadece modüller ve paylaştıkları veri)</span>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {laying && <div className="absolute right-3 top-3 z-10 rounded bg-gray-800/80 px-2 py-1 text-xs text-gray-400">diziliyor…</div>}
          <ReactFlow nodeTypes={NODE_TYPES} nodes={nodes} edges={edges} onNodesChange={onNodesChange} onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={clearFocus}
            nodesConnectable={false} elementsSelectable fitView minZoom={0.1} proOptions={{ hideAttribution: true }}>
            <Background color="#27272a" gap={20} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable maskColor="rgba(2,6,23,0.7)"
              nodeColor={(n) => mode === 'anlam' ? ((n.data as any)?.domain?.color ?? '#52525b') : (KIND[(n.data as any)?.gnode?.kind as Kind]?.bg ?? '#52525b')} />
          </ReactFlow>
        </div>

        <aside className="w-96 shrink-0 overflow-y-auto border-l border-gray-800 bg-gray-900 p-4">
          {selRel && sem ? <RelationDetail rel={selRel} sem={sem} onClose={() => setSelRel(null)} />
            : selDomain ? <DomainDetail domain={selDomain} sem={sem!} map={map} onClose={() => setSelected(null)} />
            : selNode ? <NodeDetail node={selNode} map={map} sem={sem} onClose={clearFocus}
              onPick={(id) => onNodeClick(null, { id } as Node)} isolated={isolated.has(selNode.id)} domain={domainOf.get(selNode.id)} />
            : mode === 'anlam' ? <AnlamIntro sem={sem} /> : <Signals map={map} />}
        </aside>
      </div>
    </div>
  );
}

function baseStyle(n: GNode, iso: boolean, hot: boolean): React.CSSProperties {
  const k = KIND[n.kind];
  return {
    background: k.bg, color: '#fff', border: `2px solid ${hot ? '#fde047' : k.border}`,
    borderRadius: n.kind === 'collection' ? 14 : 6, fontSize: 12, fontWeight: n.degree >= 12 ? 700 : 500,
    padding: '6px 10px', width: nodeW(n), opacity: iso ? 0.45 : 1, boxShadow: hot ? '0 0 0 4px rgba(253,224,71,0.18)' : 'none',
  };
}

function AnlamIntro({ sem }: { sem: Semantic | null }) {
  if (!sem) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Sistemin {sem.domains.length} iş alanı. Renkli kutular alanlar, oklar aralarındaki gerçek iş akışı. Bir alana tıkla → detay.</p>
      <ul className="space-y-2">
        {sem.domains.map((d) => (
          <li key={d.id} className="rounded-lg border border-gray-800 p-2.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: d.color }} />
              <span className="text-sm font-semibold text-white">{d.name}</span>
              <span className="ml-auto text-[10px] text-gray-500">{d.featureIds.length} modül</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-gray-400">{d.purpose}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RelationDetail({ rel, sem, onClose }: { rel: Relation; sem: Semantic; onClose: () => void }) {
  const from = sem.domains.find((d) => d.id === rel.from);
  const to = sem.domains.find((d) => d.id === rel.to);
  const dot = (c?: string) => <span className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: c ?? '#52525b' }} />;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold text-white">İlişki</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
      </div>
      <div className="flex items-center gap-2 text-sm text-white">
        {dot(from?.color)} <span>{from?.name ?? rel.from}</span>
        <span className="text-gray-500">→</span>
        {dot(to?.color)} <span>{to?.name ?? rel.to}</span>
      </div>
      <p className="rounded-lg border p-3 text-sm font-medium leading-relaxed text-white" style={{ borderColor: (from?.color ?? '#52525b') + '66' }}>{rel.label}</p>
      {rel.detail && <p className="text-[13px] leading-relaxed text-gray-300">{rel.detail}</p>}
      {rel.steps && rel.steps.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: from?.color ?? '#818cf8' }}>Akış nasıl ilerler?</h3>
          <ScenarioList scenarios={[{ title: '', steps: rel.steps }]} color={from?.color ?? '#6366f1'} />
        </div>
      )}
      <div className="space-y-1 border-t border-gray-800 pt-3">
        {from && <div className="text-[11px] text-gray-500"><span style={{ color: from.color }}>{from.name}</span>: {from.purpose}</div>}
        {to && <div className="text-[11px] text-gray-500"><span style={{ color: to.color }}>{to.name}</span>: {to.purpose}</div>}
      </div>
    </div>
  );
}

function ScenarioList({ scenarios, color }: { scenarios: Scenario[]; color: string }) {
  return (
    <div className="space-y-4">
      {scenarios.map((sc, i) => (
        <div key={i} className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
          {sc.title && <div className="mb-2 text-sm font-semibold text-white">{sc.title}</div>}
          <ol className="space-y-2">
            {sc.steps.map((st, j) => (
              <li key={j} className="flex gap-2.5 text-[12px] leading-relaxed text-gray-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>{j + 1}</span>
                <span>{st}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function DomainDetail({ domain, sem, map, onClose }: { domain: Domain; sem: Semantic; map: SystemMap; onClose: () => void }) {
  const walkthrough = domain.walkthrough ?? [];
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full" style={{ background: domain.color }} />
          <h2 className="text-base font-semibold text-white">{domain.name}</h2>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
      </div>
      <p className="text-sm leading-snug text-gray-300">{domain.purpose}</p>

      {/* SÜREÇ NASIL İŞLER — senaryo senaryo, adım adım */}
      {walkthrough.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: domain.color }}>Bu süreç nasıl işler?</h3>
          <ScenarioList scenarios={walkthrough} color={domain.color} />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">İçindeki modüller ({domain.featureIds.length})</h3>
        <ul className="space-y-2">
          {domain.featureIds.map((fid) => {
            const node = map.nodes.find((n) => n.id === fid);
            return (
              <li key={fid} className="rounded-lg bg-gray-800/50 p-2.5">
                <div className="text-sm font-medium text-white">{node?.label ?? fid.replace('feature:', '')}</div>
                <p className="mt-0.5 text-[11px] leading-snug text-gray-400">{sem.featurePurposes[fid] ?? '—'}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function NodeDetail({ node, map, sem, onClose, onPick, isolated, domain }: {
  node: GNode; map: SystemMap; sem: Semantic | null; onClose: () => void; onPick: (id: string) => void; isolated: boolean; domain?: Domain;
}) {
  const out = map.edges.filter((e) => e.source === node.id);
  const inc = map.edges.filter((e) => e.target === node.id);
  const k = KIND[node.kind];
  const purpose = sem?.featurePurposes[node.id];
  const walkthrough = sem?.featureWalkthroughs?.[node.id] ?? [];
  const accent = domain?.color ?? '#6366f1';
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: k.bg, color: '#fff' }}>{k.label}</span>
          <h2 className="mt-1 text-base font-semibold text-white">{node.label}</h2>
          {node.dir && <code className="text-[11px] text-gray-500">{node.dir}</code>}
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
      </div>
      {purpose && <p className="rounded bg-indigo-950/40 p-2 text-xs leading-snug text-indigo-200">{purpose}</p>}
      {domain && <p className="text-[11px] text-gray-500">Alan: <span style={{ color: domain.color }}>{domain.name}</span></p>}
      {walkthrough.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>Bu modül nasıl çalışır?</h3>
          <ScenarioList scenarios={walkthrough} color={accent} />
        </div>
      )}
      <div className="flex gap-3 text-xs text-gray-400">
        <span>derece <b className="text-white">{node.degree}</b></span>
        {node.files ? <span>dosya <b className="text-white">{node.files}</b></span> : null}
        {node.loc ? <span>satır <b className="text-white">{node.loc}</b></span> : null}
      </div>
      {isolated && <div className="rounded border border-amber-700/50 bg-amber-950/40 p-2 text-xs text-amber-300">⚠️ İzole — sisteme bağlı değil. Ölü kod ya da yarım kalmış olabilir.</div>}
      <NeighborList title={`Bağlandıkları (${out.length})`} edges={out} dir="out" onPick={onPick} map={map} />
      <NeighborList title={`Bağlananlar (${inc.length})`} edges={inc} dir="in" onPick={onPick} map={map} />
    </div>
  );
}

function NeighborList({ title, edges, dir, onPick, map }: { title: string; edges: GEdge[]; dir: 'in' | 'out'; onPick: (id: string) => void; map: SystemMap }) {
  if (!edges.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <ul className="space-y-1">
        {edges.map((e, i) => {
          const otherId = dir === 'out' ? e.target : e.source;
          const other = map.nodes.find((n) => n.id === otherId);
          if (!other) return null;
          return (
            <li key={i}>
              <button onClick={() => onPick(otherId)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-gray-800">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: KIND[other.kind].border }} />
                <span className="truncate text-gray-200">{other.label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-gray-500">{EDGE_LABEL[e.type] ?? e.type}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Signals({ map }: { map: SystemMap }) {
  const { isolated, hotspots, overlaps } = map.signals;
  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">Bir node'a tıkla → bağlantılarını gör. Aşağıda haritanın otomatik sinyalleri:</p>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-400">🔥 Hotspot Koleksiyonlar</h3>
        <p className="mb-2 text-[11px] text-gray-500">Çok feature'ın dokunduğu veri = değiştirince çok yeri kırar.</p>
        <ul className="space-y-1">
          {hotspots.map((h) => (
            <li key={h.collection} className="flex items-center justify-between rounded bg-gray-800/60 px-2 py-1 text-xs">
              <span className="text-gray-200">{h.collection}</span>
              <span className="rounded-full bg-rose-900 px-2 text-[10px] text-rose-200">{h.touchedByFeatures} feature</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400">🟡 Sprawl Alarmı</h3>
        <p className="mb-2 text-[11px] text-gray-500">Ayak izi örtüşen feature çiftleri = olası tekrar. "Bunu zaten yaptın mı?"</p>
        <ul className="space-y-1.5">
          {overlaps.map((o, i) => (
            <li key={i} className="rounded bg-gray-800/60 px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-200">{o.a.replace('feature:', '')} ↔ {o.b.replace('feature:', '')}</span>
                <span className="text-amber-400">%{Math.round(o.similarity * 100)}</span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-gray-500">{o.shared.join(', ')}</div>
            </li>
          ))}
        </ul>
      </div>
      {isolated.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">⚠️ İzole Node'lar</h3>
          <div className="flex flex-wrap gap-1">
            {isolated.map((id) => <span key={id} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">{id.replace(/^.*:/, '')}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

function NotGenerated() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-400">
      <p className="text-lg">Harita henüz üretilmemiş</p>
      <p className="text-sm">Terminalde çalıştır:</p>
      <code className="rounded bg-gray-800 px-3 py-1.5 text-sm text-indigo-300">node scripts/build-system-map.mjs</code>
      <code className="rounded bg-gray-800 px-3 py-1.5 text-sm text-indigo-300">node scripts/enrich-system-map.mjs</code>
    </div>
  );
}
