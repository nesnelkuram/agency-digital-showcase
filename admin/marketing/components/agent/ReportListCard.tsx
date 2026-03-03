import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Clock } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  type: string;
  status: string;
  dateRange?: { startDate: string; endDate: string };
  createdAt?: any;
}

interface ReportListCardProps {
  data: {
    reports: Report[];
    totalCount: number;
  };
  onSendMessage?: (text: string) => void;
}

const TYPE_BADGES: Record<string, string> = {
  performance: 'bg-indigo-100 text-indigo-700',
  budget: 'bg-emerald-100 text-emerald-700',
  campaign: 'bg-violet-100 text-violet-700',
};

const STATUS_BADGES: Record<string, { color: string; label: string }> = {
  ready: { color: 'bg-emerald-100 text-emerald-700', label: 'Hazir' },
  generating: { color: 'bg-blue-100 text-blue-700', label: 'Olusturuluyor' },
  failed: { color: 'bg-red-100 text-red-700', label: 'Basarisiz' },
};

function formatDate(val: any): string {
  if (!val) return '';
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ReportListCard: React.FC<ReportListCardProps> = ({ data, onSendMessage }) => {
  const { reports } = data;

  if (!reports || reports.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Henuz rapor bulunmuyor.
      </div>
    );
  }

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <FileText className="w-3.5 h-3.5 text-orange-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Raporlar
          <span className="text-neutral-400 ml-1">({reports.length})</span>
        </span>
      </div>

      {/* List */}
      <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
        {reports.map((report, i) => {
          const statusInfo = STATUS_BADGES[report.status] || STATUS_BADGES.ready;
          const typeBadge = TYPE_BADGES[report.type] || 'bg-neutral-100 text-neutral-600';

          return (
            <motion.button
              key={report.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.4) }}
              onClick={() => onSendMessage?.(`${report.title} raporunun detaylarini goster`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-150 bg-white hover:border-indigo-300 hover:shadow-sm transition-all text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-commons font-medium text-[#171717] line-clamp-1">
                  {report.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-commons font-medium ${typeBadge}`}>
                    {report.type}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-commons font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  {report.createdAt && (
                    <span className="flex items-center gap-0.5 text-[10px] font-commons text-neutral-400">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDate(report.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default ReportListCard;
