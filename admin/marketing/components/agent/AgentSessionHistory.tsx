import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Plus, ChevronLeft, MessageSquare } from 'lucide-react';
import type { SessionSummary } from '@/shared/hooks/useAgentSessions';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Az once';
  if (mins < 60) return `${mins}dk once`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}s once`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g once`;
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

interface Props {
  currentSessionId: string | null;
  onSelectSession: (session: SessionSummary) => void;
  onNewSession: () => void;
  sessions: SessionSummary[];
  loading: boolean;
}

const AgentSessionHistory: React.FC<Props> = ({
  currentSessionId,
  onSelectSession,
  onNewSession,
  sessions,
  loading,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={false}
      animate={{ width: open ? 240 : 44 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex-shrink-0 h-full bg-white/60 border border-white/50 rounded-2xl overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-3 border-b border-neutral-100">
        <button
          onClick={() => setOpen(!open)}
          className="w-7 h-7 rounded-lg hover:bg-neutral-100 flex items-center justify-center text-neutral-500 transition-colors flex-shrink-0"
          title={open ? 'Kapat' : 'Gecmis'}
        >
          {open ? <ChevronLeft className="w-4 h-4" /> : <History className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between flex-1 min-w-0"
            >
              <span className="font-commons text-xs font-semibold text-neutral-700 truncate">
                Gecmis
              </span>
              <button
                onClick={onNewSession}
                className="w-6 h-6 rounded-md hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors flex-shrink-0"
                title="Yeni Oturum"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session list — only visible when open */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5"
          >
            {loading && (
              <div className="flex items-center justify-center py-6">
                <div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <p className="text-center text-xs text-neutral-400 py-6 font-commons">
                Henuz oturum yok
              </p>
            )}

            {sessions.map((s) => {
              const isActive = s.id === currentSessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectSession(s)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg transition-all text-xs font-commons group ${
                    isActive
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'hover:bg-neutral-50 border border-transparent'
                  }`}
                >
                  <p className={`truncate font-medium ${
                    isActive ? 'text-indigo-700' : 'text-neutral-700'
                  }`}>
                    {s.title || 'Isimsiz oturum'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-neutral-400">
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="w-2.5 h-2.5" />
                      {s.messageCount}
                    </span>
                    <span>{relativeTime(s.updatedAt)}</span>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed: vertical icon strip for new session */}
      {!open && (
        <div className="flex-1 flex flex-col items-center pt-2 gap-2">
          <button
            onClick={onNewSession}
            className="w-7 h-7 rounded-lg hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors"
            title="Yeni Oturum"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default AgentSessionHistory;
