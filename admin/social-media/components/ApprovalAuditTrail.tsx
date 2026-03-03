import { useState, useEffect } from 'react';
import { Clock, Check, RotateCcw, Send, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { ApprovalEvent, ApprovalAction } from '@/shared/types/socialMedia';
import { getApprovalEvents } from '@/shared/services/contentPlanService';

interface ApprovalAuditTrailProps {
  planId: string;
  postId?: string;
  compact?: boolean;
}

const ACTION_CONFIG: Record<ApprovalAction, {
  label: string;
  icon: typeof Check;
  color: string;
}> = {
  submit_for_review: { label: 'Dahili incelemeye gonderdi', icon: Send, color: 'text-sky-600' },
  internal_approve: { label: 'Dahili incelemeyi onayladi', icon: Check, color: 'text-green-600' },
  internal_reject: { label: 'Dahili revizyon istedi', icon: RotateCcw, color: 'text-orange-600' },
  submit_to_client: { label: 'Musteriye gonderdi', icon: ArrowRight, color: 'text-amber-600' },
  client_approve: { label: 'Musteri onayladi', icon: Check, color: 'text-green-600' },
  client_reject: { label: 'Musteri revizyon istedi', icon: RotateCcw, color: 'text-red-600' },
  resubmit: { label: 'Tekrar gonderdi', icon: Send, color: 'text-blue-600' },
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  super_admin: 'Super Admin',
  account_manager: 'Account Manager',
  editor: 'Editor',
  client: 'Musteri',
  freelancer: 'Freelancer',
};

export default function ApprovalAuditTrail({ planId, postId, compact = false }: ApprovalAuditTrailProps) {
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getApprovalEvents(planId, postId);
        if (!cancelled) setEvents(result);
      } catch (err) {
        console.error('Onay gecmisi yuklenemedi:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [planId, postId]);

  if (loading) {
    return (
      <div className="py-4 text-center text-xs text-neutral-400 font-grotesk">
        Yukleniyor...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-neutral-400 font-grotesk">
        Henuz onay gecmisi yok
      </div>
    );
  }

  const displayEvents = compact && !expanded ? events.slice(0, 3) : events;

  return (
    <div className="font-grotesk">
      {compact && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 mb-2 transition-colors"
        >
          <Clock size={12} />
          <span>Onay Gecmisi ({events.length})</span>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-neutral-200" />

        <div className="space-y-3">
          {displayEvents.map((event) => {
            const config = ACTION_CONFIG[event.action] || {
              label: event.action,
              icon: Clock,
              color: 'text-neutral-500',
            };
            const Icon = config.icon;

            return (
              <div key={event.id} className="flex gap-3 relative">
                <div className={`w-6 h-6 rounded-full bg-white border-2 border-neutral-200 flex items-center justify-center flex-shrink-0 z-10 ${config.color}`}>
                  <Icon size={12} />
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-[#171717]">
                      {event.performedByName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
                      {ROLE_LABELS[event.performedByRole] || event.performedByRole}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${config.color}`}>
                    {config.label}
                  </p>
                  {event.comment && (
                    <p className="text-xs text-neutral-500 mt-1 bg-neutral-50 rounded px-2 py-1 border border-neutral-100">
                      "{event.comment}"
                    </p>
                  )}
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {formatTimestamp(event.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {compact && !expanded && events.length > 3 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-neutral-500 hover:text-neutral-700 mt-2 transition-colors"
        >
          +{events.length - 3} daha fazla
        </button>
      )}
    </div>
  );
}

function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
