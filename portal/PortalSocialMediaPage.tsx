import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Share2, Loader2, CheckCircle, Clock, XCircle, ChevronRight } from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { matchPlanForClient } from '@/shared/services/contentPlanAccess';

type PlanStatus = 'draft' | 'pending_approval' | 'approved' | 'revision_requested' | 'published';

interface ContentPlanItem {
  id: string;
  title: string;
  platform: string;
  status: PlanStatus;
  shareToken: string;
  createdAt: Date;
  postCount: number;
}

const statusConfig: Record<PlanStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: 'Taslak',
    color: 'bg-neutral-100 text-neutral-600',
    icon: <Share2 className="w-3.5 h-3.5" />,
  },
  pending_approval: {
    label: 'Onay Bekliyor',
    color: 'bg-amber-100 text-amber-700',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  approved: {
    label: 'Onaylandı',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  revision_requested: {
    label: 'Revizyon İstendi',
    color: 'bg-red-100 text-red-600',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  published: {
    label: 'Yayınlandı',
    color: 'bg-blue-100 text-blue-700',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
};

const platformLabels: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'Twitter',
  facebook: 'Facebook',
};

const PortalSocialMediaPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [plans, setPlans] = useState<ContentPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PlanStatus | 'all'>('all');

  useEffect(() => {
    if (!db || !user?.uid || !tenantId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db!, 'content_plans'),
            where('tenantId', '==', tenantId),
            orderBy('createdAt', 'desc')
          )
        );
        const items: ContentPlanItem[] = [];
        const assignedProjectIds: string[] = (user?.profile as any)?.assignedProjectIds || [];
        const clientContext = {
          uid: user.uid,
          email: user.email || '',
          assignedProjectIds,
        };
        snap.forEach((doc) => {
          const d = doc.data();
          // Pure helper ile görünürlük kontrolü (single source of truth)
          const match = matchPlanForClient(
            {
              status: d.status,
              assignedClientId: d.assignedClientId,
              assignedClientEmail: d.assignedClientEmail,
              projectId: d.projectId,
            },
            clientContext
          );
          if (!match.visible) return;

          items.push({
            id: doc.id,
            title: d.title || 'İçerik Planı',
            platform: d.platform || '',
            status: d.status || 'draft',
            shareToken: d.shareToken || '',
            createdAt: d.createdAt?.toDate?.() || new Date(),
            postCount: d.postIds?.length || 0,
          });
        });
        setPlans(items);
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid, tenantId, user?.profile]);

  const filtered = filter === 'all' ? plans : plans.filter((p) => p.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">İçerik Planları</h1>
        <p className="font-grotesk text-neutral-500 text-sm mt-1">
          Sosyal medya içerik planlarınızı görüntüleyin ve onaylayın.
        </p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'Tümü'],
          ['pending_approval', 'Onay Bekliyor'],
          ['approved', 'Onaylandı'],
          ['revision_requested', 'Revizyon'],
          ['published', 'Yayınlandı'],
        ] as [PlanStatus | 'all', string][]).map(([value, label]) => {
          const count = value === 'all' ? plans.length : plans.filter((p) => p.status === value).length;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-colors ${
                filter === value
                  ? 'bg-[#171717] text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-100 p-12 text-center">
          <Share2 className="w-10 h-10 text-neutral-300 mx-auto" />
          <p className="font-grotesk text-neutral-500 mt-3">
            {filter === 'all' ? 'Henüz içerik planı yok.' : 'Bu kategoride plan yok.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((plan, i) => {
            const status = statusConfig[plan.status] || statusConfig.draft;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Link
                  to={`/portal/social-media/${plan.id}/review`}
                  className="flex items-center gap-4 bg-white rounded-xl border border-neutral-100 p-4 hover:border-neutral-200 hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Share2 className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-grotesk font-semibold text-[#171717] truncate">{plan.title}</p>
                    <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                      {plan.platform && `${platformLabels[plan.platform] || plan.platform} • `}
                      {plan.postCount} gönderi •{' '}
                      {plan.createdAt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-grotesk text-xs font-medium ${status.color}`}>
                      {status.icon}
                      {status.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalSocialMediaPage;
