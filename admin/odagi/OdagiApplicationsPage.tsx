import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Search, ChevronDown, ClipboardList } from 'lucide-react';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import { ODAGI_LABELS, odagiDisplay, type OdagiApplication } from '@/shared/types/odagi';

export default function OdagiApplicationsPage() {
  const [applications, setApplications] = useState<OdagiApplication[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setApplications([]); setCursor(null);
    authenticatedFetch('/api/odagi/applications', { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Başvurular yüklenemedi.');
        if (!controller.signal.aborted) { setApplications(body.applications); setCursor(body.nextCursor); }
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message || 'Bağlantı kurulamadı.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  async function more() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/odagi/applications?cursor=${encodeURIComponent(cursor)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Başvurular yüklenemedi.');
      setApplications(current => {
        const ids = new Set(current.map(item => item.id));
        return [...current, ...body.applications.filter((item: OdagiApplication) => !ids.has(item.id))];
      });
      setCursor(body.nextCursor);
    } catch (error) { setError(error instanceof Error ? error.message : 'İşlem tamamlanamadı.'); }
    finally { setLoadingMore(false); }
  }
  const term = search.toLocaleLowerCase('tr-TR').trim();
  const visible = applications.filter(item => [item.name, item.email, item.city, item.district, item.reference].join(' ').toLocaleLowerCase('tr-TR').includes(term));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-gray-900">Odağı Başvuruları</h1><p className="mt-1 text-sm text-gray-500">Site üzerinden tamamlanan oda başvuruları. Ayrıntıları görmek için kaydı açın.</p></div><a href="/odagi" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">Başvuru sayfası <ExternalLink size={16}/></a></div>
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4"><label className="flex min-w-0 flex-1 items-center gap-3"><Search size={18} className="text-gray-400"/><span className="sr-only">Yüklenen başvurularda ara</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Yüklenen kayıtlarda ad, e-posta, il veya numara ara" className="min-w-0 w-full bg-transparent text-sm outline-none"/></label><button onClick={() => setRefresh(value => value + 1)} disabled={loading || loadingMore} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Yenile</button></div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="py-10 text-center text-gray-500">Başvurular yükleniyor…</p> : <>
      <p className="text-sm text-gray-500">{applications.length} kayıt yüklendi{term ? ` · ${visible.length} eşleşme` : ''}{cursor ? ' · Daha fazla kayıt var' : ''}</p>
      {!visible.length && !error && <div className="rounded-xl border border-gray-200 bg-white p-12 text-center"><ClipboardList className="mx-auto mb-3 text-gray-400" size={32}/><p className="text-gray-600">{term ? 'Yüklenen başvurularda eşleşme bulunamadı.' : 'Henüz tamamlanmış başvuru yok.'}</p></div>}
      <div className="space-y-3">{visible.map(item => <details key={item.id} className="group rounded-xl border border-gray-200 bg-white">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 p-5"><div className="min-w-0 flex-1"><strong className="block break-words text-gray-900">{item.name}</strong><span className="mt-1 block break-all text-sm text-gray-500">{item.email}</span></div><div className="text-sm text-gray-600"><span className="block">{item.city} / {item.district}</span><strong className="text-gray-900">{item.area} m²</strong></div><div className="text-xs text-gray-500"><span className="block">{new Date(item.createdAt).toLocaleString('tr-TR')}</span><span>{item.reference}</span></div><ChevronDown size={18} className="text-gray-400 transition-transform group-open:rotate-180"/></summary>
        <div className="border-t border-gray-100 p-5"><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{Object.entries(ODAGI_LABELS).map(([key, label]) => <div key={key} className="min-w-0"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{odagiDisplay(item[key as keyof OdagiApplication])}</dd></div>)}</dl><p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500">Başvuru ve iletişim onayı: {item.applicationConsent ? 'Verildi' : 'Yok'} · Metin sürümü: {item.noticeVersion}. Bu onay pazarlama izni değildir.</p></div>
      </details>)}</div>
      {cursor && <button onClick={more} disabled={loadingMore} className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm text-gray-700 disabled:opacity-50">{loadingMore ? 'Yükleniyor…' : 'Daha fazla başvuru yükle'}</button>}
    </>}
  </div>;
}
