import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Pause,
  Play,
  Trash2,
  DollarSign,
  Upload,
  Target,
  Plus,
  Layers,
  Image,
  Edit3,
  Settings,
  Pencil,
  Calendar,
  GitBranch,
  Copy,
  FileText,
  Zap,
  UserPlus,
  Search,
} from 'lucide-react';
import type { PendingPlatformAction } from '@/shared/types/marketing';

interface ApprovalCardProps {
  action: PendingPlatformAction;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  executing?: boolean;
}

const ACTION_ICONS: Record<string, React.FC<{ className?: string }>> = {
  pause_campaign: Pause,
  resume_campaign: Play,
  delete_campaign: Trash2,
  update_budget: DollarSign,
  publish_plan: Upload,
  create_meta_ad: Target,
  // Faz 2B
  create_campaign_v2: Plus,
  create_adset_v2: Layers,
  create_ad_v2: Image,
  update_campaign_v2: Edit3,
  update_adset_v2: Settings,
  update_ad_v2: Pencil,
  create_budget_schedule: Calendar,
  // Faz 3
  create_ab_test: GitBranch,
  duplicate_adset: Copy,
  // Faz 4
  generate_report: FileText,
  // Faz 5
  create_automation_rule: Zap,
  update_automation_rule: Settings,
  delete_automation_rule: Trash2,
  // Faz 6
  add_competitor: UserPlus,
  analyze_competitor: Search,
};

const ACTION_LABELS: Record<string, string> = {
  pause_campaign: 'Kampanya Duraklat',
  resume_campaign: 'Kampanya Devam',
  delete_campaign: 'Kampanya Sil',
  update_budget: 'Butce Guncelle',
  publish_plan: 'Plan Yayinla',
  create_meta_ad: 'Reklam Olustur',
  // Faz 2B
  create_campaign_v2: 'Kampanya Olustur',
  create_adset_v2: 'Reklam Seti Olustur',
  create_ad_v2: 'Reklam Olustur',
  update_campaign_v2: 'Kampanya Guncelle',
  update_adset_v2: 'Reklam Seti Guncelle',
  update_ad_v2: 'Reklam Guncelle',
  create_budget_schedule: 'Butce Plani Olustur',
  // Faz 3
  create_ab_test: 'A/B Testi Olustur',
  duplicate_adset: 'Reklam Seti Kopyala',
  // Faz 4
  generate_report: 'Rapor Olustur',
  // Faz 5
  create_automation_rule: 'Kural Olustur',
  update_automation_rule: 'Kural Guncelle',
  delete_automation_rule: 'Kural Sil',
  // Faz 6
  add_competitor: 'Rakip Ekle',
  analyze_competitor: 'Rakip Analizi',
};

const ApprovalCard: React.FC<ApprovalCardProps> = ({ action, onApprove, onReject, executing }) => {
  const Icon = ACTION_ICONS[action.type] || AlertTriangle;
  const isResolved = action.status !== 'pending_approval';

  const bgColor = action.status === 'completed'
    ? 'bg-green-50 border-green-200'
    : action.status === 'failed'
    ? 'bg-red-50 border-red-200'
    : action.status === 'rejected'
    ? 'bg-neutral-50 border-neutral-200'
    : action.status === 'executing'
    ? 'bg-blue-50 border-blue-200'
    : 'bg-amber-50 border-amber-200';

  const iconBg = action.status === 'completed'
    ? 'bg-green-100'
    : action.status === 'failed'
    ? 'bg-red-100'
    : 'bg-amber-100';

  const iconColor = action.status === 'completed'
    ? 'text-green-600'
    : action.status === 'failed'
    ? 'text-red-600'
    : 'text-amber-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`my-2 rounded-xl border p-3 ${bgColor}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-commons font-semibold uppercase tracking-wide text-amber-600">
              {ACTION_LABELS[action.type] || action.type}
            </span>
            {action.status === 'completed' && (
              <span className="flex items-center gap-1 text-xs font-commons text-green-600">
                <CheckCircle className="w-3 h-3" /> Tamamlandi
              </span>
            )}
            {action.status === 'failed' && (
              <span className="flex items-center gap-1 text-xs font-commons text-red-600">
                <XCircle className="w-3 h-3" /> Basarisiz
              </span>
            )}
            {action.status === 'rejected' && (
              <span className="flex items-center gap-1 text-xs font-commons text-neutral-500">
                <XCircle className="w-3 h-3" /> Reddedildi
              </span>
            )}
            {action.status === 'executing' && (
              <span className="flex items-center gap-1 text-xs font-commons text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" /> Yurutuluyor
              </span>
            )}
          </div>
          {action.description && (
            <p className="text-sm font-commons text-[#171717] mb-1">{action.description}</p>
          )}
          {action.impact && (
            <p className="text-xs font-commons text-neutral-500 mb-2">{action.impact}</p>
          )}
          {!isResolved && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onApprove(action.id)}
                disabled={executing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white text-xs font-commons font-medium transition-colors"
              >
                {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Onayla
              </button>
              <button
                onClick={() => onReject(action.id)}
                disabled={executing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 text-neutral-600 text-xs font-commons font-medium transition-colors"
              >
                Reddet
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ApprovalCard;
