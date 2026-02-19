import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  PlayCircle,
  FileText,
  CheckSquare,
  ExternalLink,
  Search,
  Filter,
  Plus,
  X,
  Loader2,
  Check,
  Trash2,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { usePermission } from '@/shared/hooks/usePermission';

// ─── Types ───────────────────────────────────────────────────────────────────

type ResourceType = 'video' | 'document' | 'checklist' | 'link';
type CategoryKey = 'sosyal_medya' | 'video_produksiyon' | 'fotograf' | 'web_gelistirme' | 'grafik_tasarim' | 'danismanlik' | 'diger';

interface TrainingResource {
  id: string;
  type: ResourceType;
  title: string;
  description: string;
  category: CategoryKey;
  isRequired: boolean;
  durationMinutes?: number;
  url: string;
  createdAt: Date;
  createdBy: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const categoryLabels: Record<CategoryKey, string> = {
  sosyal_medya: 'Sosyal Medya',
  video_produksiyon: 'Video Prodüksiyon',
  fotograf: 'Fotoğraf',
  web_gelistirme: 'Web Geliştirme',
  grafik_tasarim: 'Grafik Tasarım',
  danismanlik: 'Danışmanlık',
  diger: 'Diğer',
};

const categoryColors: Record<CategoryKey, string> = {
  sosyal_medya: 'bg-blue-50 text-blue-700 border-blue-200',
  video_produksiyon: 'bg-red-50 text-red-700 border-red-200',
  fotograf: 'bg-amber-50 text-amber-700 border-amber-200',
  web_gelistirme: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  grafik_tasarim: 'bg-purple-50 text-purple-700 border-purple-200',
  danismanlik: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  diger: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const typeIcons: Record<ResourceType, React.ReactNode> = {
  video: <PlayCircle className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
  checklist: <CheckSquare className="w-5 h-5" />,
  link: <ExternalLink className="w-5 h-5" />,
};

const typeLabels: Record<ResourceType, string> = {
  video: 'Video',
  document: 'Doküman',
  checklist: 'Kontrol Listesi',
  link: 'Harici Kaynak',
};

const typeColors: Record<ResourceType, string> = {
  video: 'bg-rose-50 text-rose-600',
  document: 'bg-sky-50 text-sky-600',
  checklist: 'bg-teal-50 text-teal-600',
  link: 'bg-orange-50 text-orange-600',
};

// ─── Add Resource Modal ───────────────────────────────────────────────────────

interface AddResourceModalProps {
  onClose: () => void;
  onSave: (data: Omit<TrainingResource, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
}

const AddResourceModal: React.FC<AddResourceModalProps> = ({ onClose, onSave }) => {
  const [form, setForm] = useState({
    type: 'video' as ResourceType,
    title: '',
    description: '',
    category: 'sosyal_medya' as CategoryKey,
    isRequired: false,
    durationMinutes: '',
    url: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      await onSave({
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        isRequired: form.isRequired,
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
        url: form.url.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-grotesk text-xl font-bold text-[#171717]">Yeni Materyal Ekle</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-grotesk text-sm text-neutral-700 mb-1">Tür</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ResourceType })}
                className="w-full px-3 py-2.5 border-2 border-neutral-200 rounded-lg font-grotesk text-sm bg-[#fffceb] focus:border-[#171717] focus:outline-none"
              >
                {(Object.keys(typeLabels) as ResourceType[]).map((t) => (
                  <option key={t} value={t}>{typeLabels[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-grotesk text-sm text-neutral-700 mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as CategoryKey })}
                className="w-full px-3 py-2.5 border-2 border-neutral-200 rounded-lg font-grotesk text-sm bg-[#fffceb] focus:border-[#171717] focus:outline-none"
              >
                {(Object.keys(categoryLabels) as CategoryKey[]).map((c) => (
                  <option key={c} value={c}>{categoryLabels[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-grotesk text-sm text-neutral-700 mb-1">Başlık *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Materyal başlığı"
              className="w-full px-3 py-2.5 border-2 border-neutral-200 rounded-lg font-grotesk text-sm bg-[#fffceb] focus:border-[#171717] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-grotesk text-sm text-neutral-700 mb-1">Açıklama</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Kısa açıklama..."
              rows={2}
              className="w-full px-3 py-2.5 border-2 border-neutral-200 rounded-lg font-grotesk text-sm bg-[#fffceb] focus:border-[#171717] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-grotesk text-sm text-neutral-700 mb-1">Link *</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border-2 border-neutral-200 rounded-lg font-grotesk text-sm bg-[#fffceb] focus:border-[#171717] focus:outline-none"
                required
              />
            </div>
            {form.type === 'video' && (
              <div>
                <label className="block font-grotesk text-sm text-neutral-700 mb-1">Süre (dk)</label>
                <input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                  placeholder="25"
                  min={1}
                  className="w-full px-3 py-2.5 border-2 border-neutral-200 rounded-lg font-grotesk text-sm bg-[#fffceb] focus:border-[#171717] focus:outline-none"
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="font-grotesk text-sm text-neutral-700">Zorunlu materyal</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-neutral-200 rounded-full font-grotesk font-medium hover:bg-neutral-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.url.trim()}
              className="flex-1 px-4 py-3 bg-[#171717] text-white rounded-full font-grotesk font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Kaydediliyor...' : 'Ekle'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const TrainingPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { isAdmin } = usePermission();

  const [resources, setResources] = useState<TrainingResource[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Load resources from Firestore
  useEffect(() => {
    if (!db || !tenantId) { setLoading(false); return; }

    const q = query(
      collection(db, 'training_resources'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: TrainingResource[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          type: data.type || 'document',
          title: data.title || '',
          description: data.description || '',
          category: data.category || 'diger',
          isRequired: data.isRequired ?? false,
          durationMinutes: data.durationMinutes,
          url: data.url || '#',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          createdBy: data.createdBy || '',
        });
      });
      setResources(items);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [tenantId]);

  // Load user completions
  useEffect(() => {
    if (!db || !user?.uid || !tenantId) return;

    const load = async () => {
      const snap = await getDocs(
        query(
          collection(db!, 'training_completions'),
          where('tenantId', '==', tenantId),
          where('userId', '==', user.uid)
        )
      );
      const ids = new Set<string>();
      snap.forEach((d) => ids.add(d.data().resourceId));
      setCompletedIds(ids);
    };
    load();
  }, [user?.uid, tenantId]);

  const handleAddResource = async (data: Omit<TrainingResource, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!db || !user?.uid) return;
    await addDoc(collection(db, 'training_resources'), {
      ...data,
      tenantId,
      createdBy: user.uid,
      createdByName: user.displayName || user.email,
      createdAt: serverTimestamp(),
    });
  };

  const handleDeleteResource = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'training_resources', id));
  };

  const handleToggleComplete = async (resourceId: string) => {
    if (!db || !user?.uid) return;
    const completionId = `${user.uid}_${resourceId}`;
    if (completedIds.has(resourceId)) {
      await deleteDoc(doc(db, 'training_completions', completionId));
      setCompletedIds((prev) => { const next = new Set(prev); next.delete(resourceId); return next; });
    } else {
      await setDoc(doc(db, 'training_completions', completionId), {
        tenantId,
        userId: user.uid,
        resourceId,
        completedAt: serverTimestamp(),
      });
      setCompletedIds((prev) => new Set(prev).add(resourceId));
    }
  };

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchesSearch = !searchQuery.trim() ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [resources, searchQuery, selectedCategory]);

  const groupedResources = useMemo(() => {
    const groups: Partial<Record<CategoryKey, TrainingResource[]>> = {};
    filteredResources.forEach((r) => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category]!.push(r);
    });
    return groups;
  }, [filteredResources]);

  const allCategories = Object.keys(categoryLabels) as CategoryKey[];
  const completionRate = resources.length > 0
    ? Math.round((completedIds.size / resources.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Eğitim Merkezi
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1">
            Standart çalışma prosedürlerini (SOP) inceleyin ve gelişin.
          </p>
        </div>
        {isAdmin() && (
          <motion.button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Materyal Ekle
          </motion.button>
        )}
      </div>

      {/* Progress bar */}
      {resources.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-grotesk text-sm font-medium text-[#171717]">İlerleme</p>
            <p className="font-grotesk text-sm font-bold text-[#171717]">
              {completedIds.size}/{resources.length} tamamlandı
            </p>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#171717] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <p className="font-grotesk text-xs text-neutral-400 mt-1">{completionRate}%</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Kaynak ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl font-grotesk text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-500" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as CategoryKey | 'all')}
            className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl font-grotesk text-sm text-[#171717] focus:outline-none focus:border-neutral-400 transition-colors"
          >
            <option value="all">Tüm Kategoriler</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>{categoryLabels[cat]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      )}

      {/* Resources */}
      {!loading && (
        <>
          {(selectedCategory === 'all' ? allCategories : [selectedCategory]).map((category, catIndex) => {
            const categoryResources = groupedResources[category];
            if (!categoryResources || categoryResources.length === 0) return null;

            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: catIndex * 0.05 }}
              >
                <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-4 flex items-center gap-2">
                  {categoryLabels[category]}
                  <span className="font-grotesk text-sm font-normal text-neutral-400">
                    ({categoryResources.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                  {categoryResources.map((resource, index) => {
                    const isCompleted = completedIds.has(resource.id);
                    return (
                      <motion.div
                        key={resource.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: catIndex * 0.05 + index * 0.04 }}
                        className={`group relative bg-white rounded-xl border transition-all ${
                          isCompleted ? 'border-green-200 bg-green-50/20' : 'border-neutral-100 hover:border-neutral-200 hover:shadow-sm'
                        }`}
                      >
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-5"
                        >
                          <div className="flex items-start gap-4">
                            <div className={`p-2.5 rounded-lg flex-shrink-0 ${typeColors[resource.type]}`}>
                              {typeIcons[resource.type]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-grotesk text-sm font-semibold text-[#171717] group-hover:text-indigo-600 transition-colors">
                                  {resource.title}
                                </h3>
                                {resource.isRequired && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-grotesk font-bold bg-red-50 text-red-600 border border-red-200 uppercase tracking-wide">
                                    Zorunlu
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-grotesk font-bold bg-green-50 text-green-600 border border-green-200">
                                    <Check className="w-2.5 h-2.5" />
                                    Tamamlandı
                                  </span>
                                )}
                              </div>
                              {resource.description && (
                                <p className="font-grotesk text-xs text-neutral-500 line-clamp-2 mb-2">
                                  {resource.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-grotesk font-medium border ${categoryColors[resource.category]}`}>
                                  {typeLabels[resource.type]}
                                </span>
                                {resource.type === 'video' && resource.durationMinutes && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-grotesk font-medium bg-neutral-100 text-neutral-600">
                                    <PlayCircle className="w-3 h-3" />
                                    {resource.durationMinutes} dk
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </a>

                        {/* Actions */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleComplete(resource.id); }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isCompleted
                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                : 'bg-neutral-100 text-neutral-500 hover:bg-green-100 hover:text-green-600'
                            }`}
                            title={isCompleted ? 'Tamamlanmamış işaretle' : 'Tamamlandı işaretle'}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin() && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteResource(resource.id); }}
                              className="p-1.5 bg-neutral-100 text-neutral-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          {filteredResources.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-xl p-12 text-center border border-neutral-100"
            >
              <GraduationCap className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="font-grotesk text-xl font-bold text-neutral-400 mb-2">
                {resources.length === 0 ? 'Henüz materyal yok' : 'Kaynak bulunamadı'}
              </h3>
              <p className="font-grotesk text-neutral-400">
                {resources.length === 0
                  ? isAdmin() ? '"Materyal Ekle" butonuyla ilk eğitim materyalini oluşturun.' : 'Admin henüz materyal eklememiş.'
                  : 'Aramanızla eşleşen eğitim kaynağı yok.'}
              </p>
            </motion.div>
          )}
        </>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddResourceModal
            onClose={() => setShowAddModal(false)}
            onSave={handleAddResource}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrainingPage;
