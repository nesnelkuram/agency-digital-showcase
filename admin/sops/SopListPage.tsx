import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookMarked, Plus, Search, Clock, Layers, TrendingUp, Trash2, AlertCircle } from 'lucide-react';
import { listSops, deleteSop } from '@/shared/services/sopService';
import { useTenantId } from '@/shared/hooks/useTenant';
import type { AgencySop } from '@/shared/types/sop';

const SopListPage: React.FC = () => {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [sops, setSops] = useState<AgencySop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listSops(tenantId)
      .then(setSops)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return sops;
    return sops.filter(
      (sop) =>
        sop.name.toLowerCase().includes(s) ||
        sop.description.toLowerCase().includes(s) ||
        sop.matchKeywords.some((k) => k.toLowerCase().includes(s))
    );
  }, [sops, search]);

  const handleDelete = async (id: string) => {
    try {
      await deleteSop(id);
      setConfirmDeleteId(null);
      load();
    } catch (err) {
      console.error('[SopListPage] delete failed:', err);
    }
  };

  const totalMinutes = (sop: AgencySop) =>
    sop.steps.reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-grotesk font-bold text-[#171717] flex items-center gap-2">
            <BookMarked className="w-6 h-6 text-emerald-600" />
            İş Kalıpları (SOP)
          </h1>
          <p className="font-commons text-sm text-neutral-500 mt-0.5">
            Tekrarlayan iş süreçlerinin standartları — AI yeni görevde otomatik kullanır
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/sops/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white hover:bg-neutral-800 transition-colors font-commons text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Yeni Kalıp
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <Layers className="w-5 h-5 text-emerald-600 mb-2" />
          <p className="font-grotesk text-2xl font-bold text-[#171717]">{sops.length}</p>
          <p className="font-commons text-xs text-neutral-500">Toplam kalıp</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <TrendingUp className="w-5 h-5 text-indigo-600 mb-2" />
          <p className="font-grotesk text-2xl font-bold text-[#171717]">
            {sops.reduce((s, x) => s + (x.usageCount || 0), 0)}
          </p>
          <p className="font-commons text-xs text-neutral-500">Toplam kullanım</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <Clock className="w-5 h-5 text-amber-600 mb-2" />
          <p className="font-grotesk text-2xl font-bold text-[#171717]">
            {sops.reduce((s, x) => s + x.steps.length, 0)}
          </p>
          <p className="font-commons text-xs text-neutral-500">Toplam adım</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kalıp adı, açıklama veya etiket ara…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-commons text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:border-indigo-300"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-100">
          <BookMarked className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-grotesk text-lg font-semibold text-neutral-700">
            {sops.length === 0 ? 'Henüz kalıp yok' : 'Aramanızla eşleşen kalıp yok'}
          </p>
          <p className="font-commons text-sm text-neutral-400 mt-1 max-w-md mx-auto">
            {sops.length === 0
              ? 'Yeni bir görev oluştururken AI sana kalıp kaydetmeyi önerecek. Veya elle yeni kalıp ekleyebilirsin.'
              : 'Farklı bir arama dene veya yeni bir kalıp ekle.'}
          </p>
          {sops.length === 0 && (
            <button
              onClick={() => navigate('/admin/sops/new')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white font-commons text-sm hover:bg-neutral-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              İlk Kalıbı Oluştur
            </button>
          )}
        </div>
      )}

      {/* List */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((sop) => {
            const totalMin = totalMinutes(sop);
            const totalHours = Math.round((totalMin / 60) * 10) / 10;
            const hasTraining = sop.steps.some((s) => s.trainingResourceId);

            return (
              <Link
                key={sop.id}
                to={`/admin/sops/${sop.id}`}
                className="block bg-white rounded-xl border border-neutral-100 p-4 hover:border-emerald-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-commons text-sm font-semibold text-[#171717] truncate">
                      {sop.name}
                    </h3>
                    {sop.description && (
                      <p className="font-commons text-xs text-neutral-500 mt-1 line-clamp-2">
                        {sop.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setConfirmDeleteId(sop.id);
                    }}
                    className="p-1 rounded text-neutral-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-commons text-[10px]">
                    <Layers className="w-2.5 h-2.5" />
                    {sop.steps.length} adım
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 font-commons text-[10px]">
                    <Clock className="w-2.5 h-2.5" />
                    ~{totalHours}sa
                  </span>
                  {(sop.usageCount || 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-commons text-[10px]">
                      <TrendingUp className="w-2.5 h-2.5" />
                      {sop.usageCount}× kullanıldı
                    </span>
                  )}
                  {hasTraining && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-commons text-[10px]">
                      🎥 Eğitim bağlı
                    </span>
                  )}
                </div>

                {sop.matchKeywords.length > 0 && (
                  <p className="font-commons text-[10px] text-neutral-400 mt-2 truncate">
                    {sop.matchKeywords.slice(0, 5).join(' · ')}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-commons text-sm font-semibold text-[#171717]">
                  Kalıbı sil?
                </h3>
                <p className="font-commons text-xs text-neutral-500 mt-1">
                  Bu kalıp silinecek. Mevcut görevler etkilenmez, sadece sonraki görevlerde AI bu kalıbı önermeyecek.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-1.5 rounded-lg font-commons text-xs text-neutral-600 hover:bg-neutral-100"
              >
                Vazgeç
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-commons text-xs font-medium hover:bg-rose-700"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SopListPage;
