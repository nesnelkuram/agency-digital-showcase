import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { createTask, getTask, saveBreakdown } from '@/shared/services/taskService';
import { createSop, incrementUsage } from '@/shared/services/sopService';
import { useTenant } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import NowBreakdownPreview, {
  type BreakdownStepDraft,
  type BreakdownAcceptPayload,
  type MatchedSopInfo,
} from './NowBreakdownPreview';

interface NowQuickAddProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (taskId: string) => void;
}

async function getAuthToken(): Promise<string> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

interface BreakdownState {
  taskId: string;
  taskTitle: string;
  reason: string;
  steps: BreakdownStepDraft[];
  matchedSop: MatchedSopInfo | null;
  isNewPattern: boolean;
}

const NowQuickAdd: React.FC<NowQuickAddProps> = ({ open, onClose, onCreated }) => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownState | null>(null);
  const [breakdownSaving, setBreakdownSaving] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const fireAnalyze = (taskId: string, token: string) => {
    fetch('/api/tasks/analyze-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ taskId }),
    }).catch((err) => console.warn('[NowQuickAdd] analyze-task failed:', err));
  };

  const tryBreakdown = async (
    taskId: string,
    taskTitle: string,
    token: string
  ): Promise<BreakdownState | null> => {
    try {
      const res = await fetch('/api/tasks/breakdown-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) return null;
      const data: {
        shouldBreakdown: boolean;
        reason: string;
        steps: BreakdownStepDraft[];
        matchedSop?: MatchedSopInfo | null;
        isNewPattern?: boolean;
      } = await res.json();
      // Match varsa 2+ adımla yetiniyoruz; generic'te 3+ şartını backend zaten uyguladı
      const min = data.matchedSop ? 2 : 3;
      if (data.shouldBreakdown && data.steps.length >= min) {
        return {
          taskId,
          taskTitle,
          reason: data.reason || '',
          steps: data.steps,
          matchedSop: data.matchedSop || null,
          isNewPattern: Boolean(data.isNewPattern),
        };
      }
    } catch (err) {
      console.warn('[NowQuickAdd] breakdown-task failed:', err);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    if (!tenantId) {
      setError('Hesap bilgileri yükleniyor, bir saniye…');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const taskId = await createTask(tenantId, {
        title: trimmed,
        status: 'open',
        priority: 'medium',
        aiPriorityScore: 50,
        aiRiskLevel: 'none',
        aiAnalyzed: false,
        createdBy: user?.uid || '',
        createdByName: user?.displayName || user?.email || '',
      });

      const token = await getAuthToken();
      fireAnalyze(taskId, token);

      // Breakdown'u senkron bekle — varsa preview aç, yoksa direkt kapat
      const proposal = await tryBreakdown(taskId, trimmed, token);
      onCreated?.(taskId);
      setSaving(false);
      if (proposal) {
        setBreakdown(proposal);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Görev eklenemedi');
      setSaving(false);
    }
  };

  const handleBreakdownAccept = async (payload: BreakdownAcceptPayload) => {
    if (!breakdown || !tenantId) return;
    setBreakdownSaving(true);
    setBreakdownError(null);
    try {
      const parent = await getTask(tenantId, breakdown.taskId);

      let sopId: string | undefined = breakdown.matchedSop?.id;
      let sopName: string | undefined = breakdown.matchedSop?.name;

      // Yeni desen + kullanıcı "kalıp olarak kaydet" işaretledi → SOP oluştur
      if (payload.saveAsNewSop && payload.newSopName && !breakdown.matchedSop) {
        try {
          const keywords = extractKeywords(breakdown.taskTitle, payload.newSopName);
          sopId = await createSop({
            tenantId,
            name: payload.newSopName,
            description: `${breakdown.taskTitle} işinden öğrenildi`,
            matchKeywords: keywords,
            // SOP olarak kaydederken `alreadyDone` taşınmaz — bu çalışma anına özgü
            steps: payload.steps.map((s) => ({
              title: s.title,
              estimatedMinutes: s.estimatedMinutes,
              ...(s.trainingResourceId ? { trainingResourceId: s.trainingResourceId } : {}),
            })),
            createdBy: user?.uid || '',
            createdByName: user?.displayName || user?.email || '',
          });
          sopName = payload.newSopName;
        } catch (err) {
          console.warn('[NowQuickAdd] SOP kaydetme başarısız (görev yine kaydedildi):', err);
        }
      } else if (breakdown.matchedSop) {
        // Mevcut SOP kullanıldı → popülerite +1
        incrementUsage(breakdown.matchedSop.id).catch(() => {});
      }

      await saveBreakdown(
        tenantId,
        breakdown.taskId,
        payload.steps.map((s) => ({
          title: s.title,
          estimatedMinutes: s.estimatedMinutes,
          alreadyDone: s.alreadyDone,
          trainingResourceId: s.trainingResourceId,
        })),
        {
          createdBy: user?.uid || '',
          createdByName: user?.displayName || user?.email || '',
          inheritedProjectId: parent?.projectId,
          inheritedProjectName: parent?.projectName,
          inheritedCategory: parent?.category,
          parentPriorityScore: parent?.aiPriorityScore ?? 50,
          sopId,
          sopName,
        }
      );
      setBreakdown(null);
      onClose();
    } catch (err: any) {
      setBreakdownError(err?.message || 'Kaydedilemedi');
      setBreakdownSaving(false);
    }
  };

  // Title + SOP adından basit anahtar kelimeler çıkar (matcher için)
  function extractKeywords(title: string, sopName: string): string[] {
    const stopwords = new Set(['için', 'bir', 'bu', 'şu', 'çekilecek', 'yapılacak', 'olacak', 've', 'ile', 'da', 'de']);
    const words = `${title} ${sopName}`
      .toLowerCase()
      .replace(/[^\wçğıöşüâî\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopwords.has(w));
    return Array.from(new Set(words)).slice(0, 8);
  }

  const handleBreakdownCancel = () => {
    // Parent task olduğu gibi kalsın — child oluşturma
    setBreakdown(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !breakdown) onClose();
  };

  return (
    <>
      <AnimatePresence>
        {open && !breakdown && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            onKeyDown={handleKeyDown}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={saving ? undefined : onClose}
            />

            <motion.form
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
                placeholder="Yeni görev… (Enter ekle, Esc kapat)"
                className="w-full px-6 py-5 font-commons text-lg text-[#171717] placeholder:text-neutral-300 focus:outline-none disabled:opacity-50"
              />

              <div className="flex items-center justify-between px-6 py-2.5 border-t border-neutral-100 bg-neutral-50/60">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <Sparkles className="w-3 h-3" />
                  <span className="font-commons text-[11px]">
                    {saving
                      ? 'AI düşünüyor — karmaşık iş ise alt adımları önerecek…'
                      : 'Marka, tarih, öncelik ve gerekirse alt adımları AI çıkaracak'}
                  </span>
                </div>
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin" />
                ) : (
                  <span className="font-mono text-[10px] text-neutral-400 tracking-wide">
                    ENTER
                  </span>
                )}
              </div>

              {error && (
                <p className="px-6 py-2 font-commons text-xs text-rose-600 bg-rose-50">
                  {error}
                </p>
              )}
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <NowBreakdownPreview
        open={!!breakdown}
        taskTitle={breakdown?.taskTitle || ''}
        reason={breakdown?.reason}
        initialSteps={breakdown?.steps || []}
        matchedSop={breakdown?.matchedSop || null}
        isNewPattern={breakdown?.isNewPattern || false}
        saving={breakdownSaving}
        error={breakdownError}
        onCancel={handleBreakdownCancel}
        onAccept={handleBreakdownAccept}
      />
    </>
  );
};

export default NowQuickAdd;
