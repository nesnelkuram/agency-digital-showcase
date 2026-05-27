import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Search, X, PlayCircle, FileText, CheckSquare, ExternalLink, ChevronDown } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { useTenantId } from '@/shared/hooks/useTenant';

interface TrainingResource {
  id: string;
  type: 'video' | 'document' | 'checklist' | 'link';
  title: string;
  category?: string;
}

interface TrainingResourcePickerProps {
  value?: string;            // mevcut seçili resourceId
  onChange: (resourceId: string | undefined) => void;
}

const iconFor = (t: TrainingResource['type']) => {
  switch (t) {
    case 'video': return <PlayCircle className="w-3.5 h-3.5 text-rose-500" />;
    case 'document': return <FileText className="w-3.5 h-3.5 text-sky-500" />;
    case 'checklist': return <CheckSquare className="w-3.5 h-3.5 text-teal-500" />;
    case 'link': return <ExternalLink className="w-3.5 h-3.5 text-orange-500" />;
  }
};

const TrainingResourcePicker: React.FC<TrainingResourcePickerProps> = ({ value, onChange }) => {
  const tenantId = useTenantId();
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState<TrainingResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!db || !tenantId) return;
    setLoading(true);
    getDocs(
      query(collection(db, 'training_resources'), where('tenantId', '==', tenantId))
    )
      .then((snap) => {
        setResources(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TrainingResource[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  const selected = useMemo(() => resources.find((r) => r.id === value), [resources, value]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return resources;
    return resources.filter((r) => r.title.toLowerCase().includes(s));
  }, [resources, search]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-2 py-1 rounded-md border text-left font-commons text-xs transition-colors ${
          selected
            ? 'border-rose-200 bg-rose-50/40 text-[#171717]'
            : 'border-neutral-200 bg-white text-neutral-400 hover:border-neutral-300'
        }`}
      >
        {selected ? iconFor(selected.type) : <PlayCircle className="w-3.5 h-3.5 text-neutral-300" />}
        <span className="flex-1 min-w-0 truncate">
          {selected?.title || 'Eğitim videosu bağla…'}
        </span>
        {selected && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="p-0.5 rounded hover:bg-rose-100 text-rose-500"
          >
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-neutral-400 flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-72 bg-white rounded-lg border border-neutral-200 shadow-lg overflow-hidden">
            <div className="px-2.5 py-1.5 border-b border-neutral-100 flex items-center gap-1.5">
              <Search className="w-3 h-3 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Eğitim kaynağı ara…"
                className="flex-1 bg-transparent font-commons text-xs text-[#171717] focus:outline-none placeholder:text-neutral-400"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <p className="text-center font-commons text-xs text-neutral-400 py-4">Yükleniyor…</p>
              ) : filtered.length === 0 ? (
                <p className="text-center font-commons text-xs text-neutral-400 py-4">
                  {resources.length === 0 ? 'Henüz eğitim kaynağı yok' : 'Eşleşen bulunamadı'}
                </p>
              ) : (
                filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onChange(r.id);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-50 transition-colors text-left ${
                      r.id === value ? 'bg-rose-50/40' : ''
                    }`}
                  >
                    {iconFor(r.type)}
                    <span className="flex-1 min-w-0 truncate font-commons text-xs text-[#171717]">
                      {r.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TrainingResourcePicker;
