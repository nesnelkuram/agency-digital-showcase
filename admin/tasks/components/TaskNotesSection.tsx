/**
 * TaskNotesSection — göreve ait zaman damgalı not akışı.
 * Her not ayrı bir giriş: kim yazdı + ne zaman. Görevde birden fazla kişi
 * çalışabildiği için yorum/günlük gibi alt alta birikir.
 * Bir notu yalnızca yazarı düzenleyip silebilir.
 */
import React, { useState } from 'react';
import { Loader2, Send, Trash2, Pencil, Check, X } from 'lucide-react';
import type { Task, TaskNote } from '@/shared/types/task';
import { addTaskNote, updateTaskNote, deleteTaskNote } from '@/shared/services/taskService';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';

interface TaskNotesSectionProps {
  task: Task;
}

function formatWhen(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Bugün · ${time}`;
  const date = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return `${date} · ${time}`;
}

const AVATAR_BG = [
  'bg-rose-200 text-rose-700',
  'bg-amber-200 text-amber-700',
  'bg-emerald-200 text-emerald-700',
  'bg-sky-200 text-sky-700',
  'bg-violet-200 text-violet-700',
  'bg-pink-200 text-pink-700',
];
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}

const TaskNotesSection: React.FC<TaskNotesSectionProps> = ({ task }) => {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const myUid = user?.uid;
  const myName = user?.displayName || user?.email || 'Bilinmeyen';

  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // En yeni en altta (akış/günlük hissi)
  const notes: TaskNote[] = [...(task.notes || [])].sort((a, b) => a.createdAt - b.createdAt);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !myUid || adding) return;
    setAdding(true);
    try {
      await addTaskNote(tenantId, task.id, { text, authorId: myUid, authorName: myName });
      setDraft('');
    } catch (err) {
      console.error('[TaskNotesSection] add failed:', err);
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (noteId: string) => {
    const text = editText.trim();
    if (!text) return;
    setBusyId(noteId);
    try {
      await updateTaskNote(tenantId, task.id, noteId, text);
      setEditingId(null);
      setEditText('');
    } catch (err) {
      console.error('[TaskNotesSection] edit failed:', err);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (noteId: string) => {
    if (!window.confirm('Bu notu silmek istediğine emin misin?')) return;
    setBusyId(noteId);
    try {
      await deleteTaskNote(tenantId, task.id, noteId);
    } catch (err) {
      console.error('[TaskNotesSection] delete failed:', err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3 text-left">
      {/* Not listesi */}
      {notes.length === 0 ? (
        <p className="font-commons text-[11px] text-neutral-400 italic">
          Henüz not yok. Aşağıdan ilk notu ekle — kim ve ne zaman yazdı kaydedilir.
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto -mx-1 px-1">
          {notes.map((n) => {
            const mine = n.authorId === myUid;
            const initial = (n.authorName || '?').trim().charAt(0).toUpperCase();
            const isEditing = editingId === n.id;
            return (
              <div key={n.id} className="flex gap-2">
                <span
                  title={n.authorName}
                  className={`mt-0.5 shrink-0 inline-flex items-center justify-center rounded-full font-commons font-semibold ${colorFor(
                    n.authorId || n.authorName
                  )}`}
                  style={{ width: 22, height: 22, fontSize: 10 }}
                >
                  {initial}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-commons text-[11px] font-medium text-neutral-700 truncate">
                      {n.authorName}
                    </span>
                    <span className="font-mono text-[9px] text-neutral-400 shrink-0">
                      {formatWhen(n.createdAt)}
                      {n.updatedAt ? ' · düzenlendi' : ''}
                    </span>
                    {mine && !isEditing && (
                      <span className="ml-auto flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditText(n.text);
                          }}
                          className="p-1 rounded text-neutral-300 hover:text-neutral-600 transition-colors"
                          title="Düzenle"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(n.id)}
                          disabled={busyId === n.id}
                          className="p-1 rounded text-neutral-300 hover:text-rose-500 transition-colors disabled:opacity-50"
                          title="Sil"
                        >
                          {busyId === n.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </span>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        autoFocus
                        className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 text-[13px] font-commons text-[#171717] focus:outline-none focus:border-neutral-400 resize-y"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditText('');
                          }}
                          className="px-2.5 py-1 rounded-md font-commons text-[11px] text-neutral-500 hover:bg-neutral-100 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(n.id)}
                          disabled={busyId === n.id || !editText.trim()}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#171717] text-white font-commons text-[11px] hover:bg-neutral-800 disabled:opacity-40 transition-all"
                        >
                          {busyId === n.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Kaydet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="font-commons text-[13px] text-neutral-700 leading-snug whitespace-pre-wrap break-words">
                      {n.text}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ekleme kutusu */}
      <div className="flex items-end gap-2 pt-1 border-t border-neutral-100">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter ile gönder
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Not ekle… (⌘/Ctrl+Enter gönderir)"
          disabled={adding}
          className="flex-1 mt-2 px-2.5 py-1.5 rounded-md border border-neutral-200 text-[13px] font-commons text-[#171717] placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400 resize-y disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={adding || !draft.trim()}
          className="mb-0.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#171717] text-white font-commons text-xs font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Notu ekle"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Ekle
        </button>
      </div>
    </div>
  );
};

export default TaskNotesSection;
