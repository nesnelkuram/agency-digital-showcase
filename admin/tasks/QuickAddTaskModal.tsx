import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Sparkles, Loader2, Calendar } from 'lucide-react';
import { createTask } from '@/shared/services/taskService';
import { Timestamp } from 'firebase/firestore';
import { useTenant } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';

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
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
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
      });

      // 2. Fire-and-forget AI analysis
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
