import React from 'react';
import { motion } from 'framer-motion';
import { Users, Globe, ExternalLink } from 'lucide-react';

interface Competitor {
  id: string;
  name: string;
  website?: string | null;
  sector?: string | null;
  platforms: string[];
  status: string;
  frequency: string;
  lastAnalyzedAt?: any;
}

interface CompetitorListCardProps {
  data: {
    competitors: Competitor[];
    totalCount: number;
  };
  onSendMessage?: (text: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-neutral-100 text-neutral-500',
};

const PLATFORM_COLORS: Record<string, string> = {
  meta: 'bg-blue-100 text-blue-700',
  google: 'bg-red-100 text-red-700',
  tiktok: 'bg-pink-100 text-pink-700',
  linkedin: 'bg-sky-100 text-sky-700',
};

function formatDate(val: any): string {
  if (!val) return 'Henuz yok';
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CompetitorListCard: React.FC<CompetitorListCardProps> = ({ data, onSendMessage }) => {
  const { competitors } = data;

  if (!competitors || competitors.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Henuz rakip eklenmemis.
      </div>
    );
  }

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Users className="w-3.5 h-3.5 text-rose-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Rakipler
          <span className="text-neutral-400 ml-1">({competitors.length})</span>
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
        {competitors.map((comp, i) => (
          <motion.button
            key={comp.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            onClick={() => onSendMessage?.(`${comp.name} rakibinin analizini goster`)}
            className="flex flex-col p-3 rounded-xl border border-neutral-150 bg-white hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer text-left"
          >
            {/* Name + Status */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-sm font-commons font-semibold text-[#171717] line-clamp-1">
                {comp.name}
              </p>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-commons font-medium flex-shrink-0 ${STATUS_COLORS[comp.status] || 'bg-neutral-100 text-neutral-500'}`}>
                {comp.status === 'active' ? 'Aktif' : comp.status === 'paused' ? 'Duraklatildi' : comp.status}
              </span>
            </div>

            {/* Website + Sector */}
            <div className="flex items-center gap-2 mb-1.5 text-xs font-commons text-neutral-500">
              {comp.website && (
                <span className="flex items-center gap-0.5 truncate">
                  <Globe className="w-3 h-3" />
                  {comp.website.replace(/^https?:\/\//, '')}
                </span>
              )}
              {comp.sector && <span>· {comp.sector}</span>}
            </div>

            {/* Platforms + Last Analysis */}
            <div className="flex items-center justify-between mt-auto">
              <div className="flex gap-1">
                {comp.platforms.map((p) => (
                  <span key={p} className={`px-1 py-0.5 rounded text-[9px] font-commons font-medium ${PLATFORM_COLORS[p] || 'bg-neutral-100 text-neutral-500'}`}>
                    {p}
                  </span>
                ))}
              </div>
              <span className="text-[10px] font-commons text-neutral-400">
                Son analiz: {formatDate(comp.lastAnalyzedAt)}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default CompetitorListCard;
