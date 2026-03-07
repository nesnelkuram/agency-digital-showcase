import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { WorkflowTemplate } from '@/shared/types/workflow/template';
import type { WorkflowInstance } from '@/shared/types/workflow/instance';

interface RecurringWorkflowCardProps {
  template: WorkflowTemplate;
  latestInstance?: WorkflowInstance;
  projectId: string;
  category: string;
}

function humanizeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [min, hour, , , dow] = parts;

  const dayNames: Record<string, string> = {
    '0': 'Pazar', '1': 'Pazartesi', '2': 'Sali', '3': 'Carsamba',
    '4': 'Persembe', '5': 'Cuma', '6': 'Cumartesi',
  };

  const hourStr = hour !== '*' ? `${hour.padStart(2, '0')}:${(min || '00').padStart(2, '0')}` : '';

  if (dow !== '*' && dayNames[dow]) {
    return `Her ${dayNames[dow]}${hourStr ? ` saat ${hourStr}` : ''}`;
  }

  if (hour !== '*' && min !== '*') {
    return `Her gun saat ${hourStr}`;
  }

  return cron;
}

function formatDate(ts: any): string {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const RecurringWorkflowCard: React.FC<RecurringWorkflowCardProps> = ({
  template,
  latestInstance,
  projectId,
}) => {
  const rc = template.recurringConfig;
  if (!rc) return null;

  const instanceStatus = latestInstance?.status;
  const statusConfig = instanceStatus === 'completed'
    ? { color: 'bg-green-100 text-green-700', label: 'Tamamlandi' }
    : instanceStatus === 'active'
    ? { color: 'bg-amber-100 text-amber-700', label: 'Devam Ediyor' }
    : instanceStatus === 'cancelled'
    ? { color: 'bg-red-100 text-red-700', label: 'Iptal' }
    : { color: 'bg-neutral-100 text-neutral-500', label: 'Bekliyor' };

  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h4 className="font-grotesk text-sm font-semibold text-[#171717]">
              {template.name}
            </h4>
            <p className="font-grotesk text-[10px] text-neutral-400">
              {humanizeCron(rc.cronExpression)}
            </p>
          </div>
        </div>
        {latestInstance && (
          <span className={`text-[10px] font-grotesk font-medium px-2 py-0.5 rounded-full ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        )}
      </div>

      {template.description && (
        <p className="font-grotesk text-xs text-neutral-500 mb-3 line-clamp-2">
          {template.description}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-neutral-50 rounded-lg p-2.5">
          <p className="font-grotesk text-[10px] text-neutral-400 mb-0.5">Son Calisma</p>
          <div className="flex items-center gap-1">
            {latestInstance ? (
              <>
                {instanceStatus === 'completed' ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <Clock className="w-3 h-3 text-neutral-400" />
                )}
                <span className="font-grotesk text-xs font-medium text-[#171717]">
                  {formatDate(rc.lastRunAt)}
                </span>
              </>
            ) : (
              <span className="font-grotesk text-xs text-neutral-400">Henuz calismadi</span>
            )}
          </div>
        </div>
        <div className="bg-neutral-50 rounded-lg p-2.5">
          <p className="font-grotesk text-[10px] text-neutral-400 mb-0.5">Sonraki Calisma</p>
          <div className="flex items-center gap-1">
            {rc.nextRunAt ? (
              <>
                <Clock className="w-3 h-3 text-blue-500" />
                <span className="font-grotesk text-xs font-medium text-[#171717]">
                  {formatDate(rc.nextRunAt)}
                </span>
              </>
            ) : (
              <span className="font-grotesk text-xs text-neutral-400">Belirlenmedi</span>
            )}
          </div>
        </div>
      </div>

      {latestInstance && (
        <Link
          to={`/admin/projects/${projectId}/workflow/${latestInstance.id}`}
          className="inline-flex items-center gap-1.5 font-grotesk text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Son Calismayi Gor
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
};

export default RecurringWorkflowCard;
