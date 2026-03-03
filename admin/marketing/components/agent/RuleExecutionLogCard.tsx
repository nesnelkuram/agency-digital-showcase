import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface LogEntry {
  id: string;
  executedAt: any;
  triggered: boolean;
  conditionResults?: Array<{ metric: string; currentValue: number; passed: boolean }>;
  actionTaken?: string;
  campaignId?: string;
  campaignName?: string;
  error?: string;
}

interface RuleExecutionLogCardProps {
  data: {
    ruleName?: string;
    logs: LogEntry[];
    totalCount: number;
  };
}

function formatTimestamp(val: any): string {
  if (!val) return '';
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const RuleExecutionLogCard: React.FC<RuleExecutionLogCardProps> = ({ data }) => {
  const { ruleName, logs } = data;

  if (!logs || logs.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Henuz calisma gecmisi bulunmuyor.
      </div>
    );
  }

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Clock className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Calisma Gecmisi
          {ruleName && <span className="text-neutral-400 ml-1">— {ruleName}</span>}
          <span className="text-neutral-400 ml-1">({logs.length})</span>
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
        {logs.map((log, i) => (
          <motion.div
            key={log.id || i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.4) }}
            className="flex items-start gap-2.5 p-2.5 rounded-lg border border-neutral-100 bg-white"
          >
            {/* Status icon */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              log.error
                ? 'bg-red-100'
                : log.triggered
                ? 'bg-emerald-100'
                : 'bg-neutral-100'
            }`}>
              {log.error ? (
                <AlertTriangle className="w-3 h-3 text-red-500" />
              ) : log.triggered ? (
                <CheckCircle className="w-3 h-3 text-emerald-500" />
              ) : (
                <XCircle className="w-3 h-3 text-neutral-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Timestamp + campaign */}
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-commons text-neutral-400">
                  {formatTimestamp(log.executedAt)}
                </span>
                {log.campaignName && (
                  <span className="text-[10px] font-commons text-neutral-500 truncate">
                    {log.campaignName}
                  </span>
                )}
              </div>

              {/* Result */}
              <p className="text-xs font-commons text-[#171717]">
                {log.error
                  ? <span className="text-red-600">Hata: {log.error}</span>
                  : log.triggered
                  ? <span className="text-emerald-700">Tetiklendi — {log.actionTaken || 'Aksiyon uygulandi'}</span>
                  : <span className="text-neutral-500">Kosullar saglanmadi</span>
                }
              </p>

              {/* Condition results */}
              {log.conditionResults && log.conditionResults.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {log.conditionResults.map((cr, j) => (
                    <span
                      key={j}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-commons ${
                        cr.passed
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-neutral-50 text-neutral-400'
                      }`}
                    >
                      {cr.metric}: {cr.currentValue}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RuleExecutionLogCard;
