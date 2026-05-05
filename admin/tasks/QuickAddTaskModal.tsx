import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Sparkles, Loader2, Calendar, Briefcase, Settings2, User as UserIcon } from 'lucide-react';
import { createTask } from '@/shared/services/taskService';
import { Timestamp } from 'firebase/firestore';
import { useTenant } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProjects } from '@/shared/hooks/useActiveProjects';
import type { TaskCategory } from '@/shared/types/task';

type CategoryChoice = 'auto' | TaskCategory;

const CATEGORY_PILLS: Array<{ id: CategoryChoice; label: string; icon: React.ComponentType<{ className?: string }> | null }> = [
  { id: 'auto',     label: 'AI Karar',      icon: Sparkles },
  { id: 'brand',    label: 'Markalarımız',  icon: Briefcase },
  { id: 'admin',    label: 'İdari',         icon: Settings2 },
  { id: 'personal', label: 'Kişisel',       icon: UserIcon },
];

interface QuickAddTaskModalProps {
  onClose: () => void;
  onTaskCreated: (taskId: string) => void;
}

async function getAuthToken(): Promise<string> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

const QuickAddTaskModal: React.FC<QuickAddTaskModalProps> = ({ onClose, onTaskCreated }) => {
  const { tenantId } = useTenant(); // raw value — null while loading
  const { user } = useAuth();
  const { projects } = useActiveProjects();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [categoryChoice, setCategoryChoice] = useState<CategoryChoice>('auto');
  const [brandId, setBrandId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    if (!tenantId) {
      setError('Hesap bilgileri henüz yüklenmedi, lütfen bir saniye bekleyin.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Manual category overrides — passed straight into Firestore
      const manualFields: Record<string, any> = {};
      if (categoryChoice !== 'auto') {
        manualFields.category = categoryChoice;
        manualFields.categorySource = 'manual';
        manualFields.categoryConfidence = 1;
        if (categoryChoice === 'brand' && brandId) {
          const brand = projects.find((p) => p.id === brandId);
          if (brand) {
            manualFields.projectId = brand.id;
            manualFields.projectName = brand.name;
          }
        }
      }

      // 1. Create task instantly in Firestore
      const taskId = await createTask(tenantId, {
        title: trimmed,
        status: 'open',
        priority: 'medium',
        aiPriorityScore: 50,
        aiRiskLevel: 'none',
        aiAnalyzed: false,
        createdBy: user?.uid || '',
        createdByName: user?.displayName || user?.email || '',
        ...(dueDate ? { dueDate: Timestamp.fromDate(new Date(dueDate)) } : {}),
        ...manualFields,
      });

      // 2. Fire-and-forget AI analysis
      // (analyze-task respects categorySource='manual' and won't overwrite the user's choice)
      getAuthToken()
        .then((token) =>
          fetch('/api/tasks/analyze-task', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ taskId }),
          })
        )
        .catch((err) => console.warn('[QuickAdd] analyze-task failed:', err));

      onTaskCreated(taskId);
    } catch (err: any) {
      setError(err.message || 'Görev oluşturulamadı');
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ type: 'spring', damping: 28, stiffness: 360 }}
          className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <h2 className="font-commons text-sm font-semibold text-[#171717]">Hızlı Görev Ekle</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* AI badge */}
          <div className="px-5 pt-4 pb-1">
            <div className="flex items-center gap-1.5 text-indigo-500">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-commons text-xs">
                Kaydettikten sonra AI öncelik, atama ve kategori belirleyecek
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 pt-3 space-y-3">
            <div>
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ne yapılmalı? (örn: Rakle için story hazırla, cuma bitirilecek)"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 font-commons text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:border-indigo-300 focus:bg-white transition-all"
              />
              <p className="font-commons text-[10px] text-neutral-400 mt-1.5 px-1">
                İpucu: Proje adı, müşteri veya tarih yazarsan AI otomatik çıkarır.
              </p>
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-commons text-sm text-neutral-600 focus:outline-none focus:border-indigo-300 focus:bg-white transition-all"
              />
            </div>

            {/* Category pills */}
            <div className="space-y-1.5">
              <label className="font-commons text-[10px] font-medium text-neutral-500 uppercase tracking-wide px-1">
                Kategori
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CATEGORY_PILLS.map((pill) => {
                  const Icon = pill.icon;
                  const active = categoryChoice === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => {
                        setCategoryChoice(pill.id);
                        if (pill.id !== 'brand') setBrandId('');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-commons text-xs font-medium transition-all ${
                        active
                          ? 'bg-[#171717] text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      {Icon && <Icon className="w-3 h-3" />}
                      {pill.label}
                    </button>
                  );
                })}
              </div>
              {categoryChoice === 'brand' && (
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-commons text-sm text-neutral-700 focus:outline-none focus:border-indigo-300 focus:bg-white"
                >
                  <option value="">Marka seç (boş bırakırsan AI önerir)...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.clientName ? ` — ${p.clientName}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error && (
              <p className="font-commons text-xs text-red-600 px-1">{error}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={!title.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-[#171717] text-white font-commons text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {saving ? 'Ekleniyor...' : 'Ekle'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default QuickAddTaskModal;
