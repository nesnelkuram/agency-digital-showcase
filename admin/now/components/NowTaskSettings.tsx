/**
 * NowTaskSettings — odaklı görev altında inline chip-row.
 * Üç chip: Deadline · Hatırlatma · Üyeler. Her chip'e tıklayınca altında inline editör açılır.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Bell, Users, X } from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
  deleteField,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { UnifiedTaskItem } from '@/shared/types/task';

interface TenantUser {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function dateToLocalInputValue(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  tenantId: string;
  item: UnifiedTaskItem;
}

type OpenView = null | 'deadline' | 'reminder' | 'members';

const NowTaskSettings: React.FC<Props> = ({ tenantId, item }) => {
  const [open, setOpen] = useState<OpenView>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);

  // Sadece standalone task'lar için settings — workflow step'lerde anlamı yok
  if (item.source !== 'standalone' || !item.task) return null;

  const task = item.task;
  const taskId = item.id;

  const currentDue: Date | null = task.dueDate
    ? (task.dueDate as any).toDate
      ? (task.dueDate as any).toDate()
      : new Date(task.dueDate as any)
    : null;
  const reminderConfig = task.reminderConfig as
    | { enabled?: boolean; channels?: string[]; sentLeadTimes?: number[] }
    | undefined;
  // Default: enabled (sadece açıkça false ise kapalı)
  const enabled = reminderConfig?.enabled !== false;
  const channels: string[] = reminderConfig?.channels ?? ['telegram', 'email'];

  // Tenant kullanıcıları (üye ekle için)
  useEffect(() => {
    if (open !== 'members' || !db || !tenantId || users.length > 0) return;
    let cancelled = false;
    getDocs(query(collection(db, 'users'), where('tenantId', '==', tenantId)))
      .then((snap) => {
        if (cancelled) return;
        setUsers(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              uid: d.id,
              displayName: data.displayName,
              email: data.email,
              photoURL: data.photoURL,
            };
          })
        );
      })
      .catch((err) => console.warn('[NowTaskSettings] users load failed:', err));
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, users.length]);

  const memberIds: string[] = useMemo(() => {
    const ids: string[] = [];
    if (task.assigneeId) ids.push(task.assigneeId);
    (task.collaboratorIds || []).forEach((id: string) => {
      if (!ids.includes(id)) ids.push(id);
    });
    return ids;
  }, [task.assigneeId, task.collaboratorIds]);
  const pickable = users.filter((u) => !memberIds.includes(u.uid));

  // ─── Save helpers ────────────────────────────────────────────────────────
  const saveDueDate = async (value: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        dueDate: value ? Timestamp.fromDate(new Date(value)) : deleteField(),
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('[NowTaskSettings] dueDate save failed:', err);
    }
  };

  const saveReminder = async (next: { enabled?: boolean; channels?: string[] }) => {
    if (!db) return;
    const mergedEnabled = next.enabled ?? enabled;
    const mergedChannels = next.channels ?? channels;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        reminderConfig: {
          enabled: mergedEnabled,
          channels: mergedChannels,
          sentLeadTimes: reminderConfig?.sentLeadTimes || [],
        },
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('[NowTaskSettings] reminder save failed:', err);
    }
  };

  const toggleChannel = (ch: 'telegram' | 'email') => {
    const next = channels.includes(ch)
      ? channels.filter((c) => c !== ch)
      : [...channels, ch];
    if (next.length === 0) return;
    saveReminder({ channels: next });
  };

  const addCollab = async (uid: string) => {
    if (!db) return;
    const u = users.find((x) => x.uid === uid);
    if (!u) return;
    try {
      const entry: Record<string, any> = { id: uid, name: u.displayName || u.email || 'Üye' };
      if (u.photoURL) entry.avatarUrl = u.photoURL;
      await updateDoc(doc(db, 'tasks', taskId), {
        collaboratorIds: arrayUnion(uid),
        collaborators: arrayUnion(entry),
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('[NowTaskSettings] addCollab failed:', err);
    }
  };

  const removeCollab = async (uid: string) => {
    if (!db || uid === task.assigneeId) return;
    try {
      const cached = (task.collaborators || []).find((c: any) => c.id === uid);
      const upd: Record<string, any> = {
        collaboratorIds: arrayRemove(uid),
        updatedAt: new Date(),
      };
      if (cached) upd.collaborators = arrayRemove(cached);
      await updateDoc(doc(db, 'tasks', taskId), upd);
    } catch (err) {
      console.error('[NowTaskSettings] removeCollab failed:', err);
    }
  };

  // ─── Display labels ──────────────────────────────────────────────────────
  const dueLabel = currentDue
    ? currentDue.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) +
      (currentDue.getHours() || currentDue.getMinutes()
        ? ` · ${pad(currentDue.getHours())}:${pad(currentDue.getMinutes())}`
        : '')
    : 'Deadline yok';
  const reminderLabel = enabled
    ? currentDue
      ? 'Hatırlatma açık'
      : 'Deadline yok'
    : 'Hatırlatma kapalı';
  const memberCount = memberIds.length;
  const memberLabel = memberCount === 0 ? 'Üye ekle' : `${memberCount} üye`;

  // Chip aktif (değer atanmışsa) renkleri
  const chipBase =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-commons text-xs transition-all border';
  const chipActive = 'border-neutral-300 bg-white text-[#171717] shadow-sm';
  const chipInactive = 'border-neutral-200 bg-white/60 text-neutral-500 hover:text-neutral-700 hover:bg-white';

  return (
    <div className="mt-8 w-full max-w-3xl mx-auto px-6">
      {/* Chip row */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((v) => (v === 'deadline' ? null : 'deadline'))}
          className={`${chipBase} ${currentDue ? chipActive : chipInactive} ${open === 'deadline' ? 'ring-2 ring-neutral-200' : ''}`}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          {dueLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => (v === 'reminder' ? null : 'reminder'))}
          className={`${chipBase} ${enabled && currentDue ? chipActive : chipInactive} ${open === 'reminder' ? 'ring-2 ring-neutral-200' : ''}`}
        >
          <Bell className="w-3.5 h-3.5" />
          {reminderLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => (v === 'members' ? null : 'members'))}
          className={`${chipBase} ${memberCount > 0 ? chipActive : chipInactive} ${open === 'members' ? 'ring-2 ring-neutral-200' : ''}`}
        >
          <Users className="w-3.5 h-3.5" />
          {memberLabel}
        </button>
      </div>

      {/* Inline editor */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key={open}
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-3 mx-auto max-w-sm bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
              {open === 'deadline' && (
                <div className="space-y-2">
                  <label className="font-commons text-[10px] uppercase tracking-wider text-neutral-500 block">
                    Deadline tarihi ve saati
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={dateToLocalInputValue(currentDue)}
                      onChange={(e) => saveDueDate(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-md border border-neutral-200 text-sm font-commons focus:outline-none focus:border-neutral-400"
                    />
                    {currentDue && (
                      <button
                        type="button"
                        onClick={() => saveDueDate('')}
                        className="p-1.5 text-neutral-400 hover:text-rose-500 transition-colors"
                        title="Deadline'ı sil"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {open === 'reminder' && (
                <div className="space-y-3">
                  {/* Açıklama */}
                  <p className="font-commons text-[11px] text-neutral-500 leading-relaxed">
                    Deadline'a 2 gün · 1 gün · 12 saat · 6 saat · 3 saat · 1 saat kala otomatik hatırlatma gönderilir.
                  </p>

                  {/* Toggle */}
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="font-commons text-sm text-[#171717]">
                      Hatırlatma {enabled ? 'açık' : 'kapalı'}
                    </span>
                    <button
                      type="button"
                      onClick={() => saveReminder({ enabled: !enabled })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        enabled ? 'bg-emerald-500' : 'bg-neutral-200'
                      }`}
                      aria-label="Hatırlatma aç/kapat"
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                          enabled ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Kanallar */}
                  {enabled && (
                    <div className="space-y-1.5">
                      <label className="font-commons text-[10px] uppercase tracking-wider text-neutral-500 block">
                        Kanallar
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleChannel('telegram')}
                          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-commons border transition-colors ${
                            channels.includes('telegram')
                              ? 'border-sky-300 bg-sky-50 text-sky-700'
                              : 'border-neutral-200 bg-white text-neutral-400 hover:text-neutral-600'
                          }`}
                        >
                          Telegram
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleChannel('email')}
                          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-commons border transition-colors ${
                            channels.includes('email')
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-neutral-200 bg-white text-neutral-400 hover:text-neutral-600'
                          }`}
                        >
                          E-posta
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Deadline yoksa uyarı */}
                  {enabled && !currentDue && (
                    <p className="font-commons text-[11px] text-amber-600 bg-amber-50 px-2 py-1.5 rounded-md">
                      Hatırlatma için bir deadline ekle. Aksi takdirde tetiklenecek bir tarih yok.
                    </p>
                  )}
                </div>
              )}

              {open === 'members' && (
                <div className="space-y-3">
                  {memberIds.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="font-commons text-[10px] uppercase tracking-wider text-neutral-500 block">
                        Atanmışlar
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {memberIds.map((id) => {
                          const cached = (task.collaborators || []).find((c: any) => c.id === id);
                          const u = users.find((x) => x.uid === id);
                          const name =
                            cached?.name ||
                            u?.displayName ||
                            u?.email ||
                            (id === task.assigneeId ? task.assigneeName : null) ||
                            'Üye';
                          const isAssignee = id === task.assigneeId;
                          return (
                            <span
                              key={id}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                isAssignee
                                  ? 'bg-violet-50 text-violet-700 border border-violet-100'
                                  : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {name}
                              {!isAssignee && (
                                <button
                                  type="button"
                                  onClick={() => removeCollab(id)}
                                  className="hover:text-rose-500"
                                  title="Kaldır"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="font-commons text-[10px] uppercase tracking-wider text-neutral-500 block">
                      Eklenebilir
                    </label>
                    {pickable.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic px-1">Eklenecek kullanıcı yok</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto -mx-1">
                        {pickable.map((u) => (
                          <button
                            key={u.uid}
                            type="button"
                            onClick={() => addCollab(u.uid)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-neutral-50 text-left"
                          >
                            <span className="font-commons text-sm text-[#171717] truncate">
                              {u.displayName || u.email}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NowTaskSettings;
