import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckSquare, ArrowRight, Loader2, Clock } from 'lucide-react';
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

interface PendingPlan {
  id: string;
  title: string;
  platform: string;
  shareToken: string;
  createdAt: Date;
  postApprovalSummary?: {
    total: number;
    approved: number;
    pendingApproval: number;
    revisionRequested: number;
  };
}

const PortalApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [plans, setPlans] = React.useState<PendingPlan[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
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
            where('status', 'in', ['pending_approval', 'partially_approved']),
            orderBy('createdAt', 'desc')
          )
        );
        const items: PendingPlan[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          items.push({
            id: doc.id,
            title: d.title || 'Icerik Plani',
            platform: d.platform || '',
            shareToken: d.shareToken || '',
            createdAt: d.createdAt?.toDate?.() || new Date(),
            postApprovalSummary: d.postApprovalSummary || undefined,
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
  }, [user?.uid, tenantId]);

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
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Onaylar</h1>
        <p className="font-grotesk text-neutral-500 text-sm mt-1">
          Onay bekleyen içerik planları
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-100 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-neutral-300 mx-auto" />
          <p className="font-grotesk font-semibold text-neutral-600 mt-3">Bekleyen onay yok</p>
          <p className="font-grotesk text-sm text-neutral-400 mt-1">
            Şu anda onayınızı bekleyen içerik planı bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            >
              <Link
                to={`/portal/social-media/${plan.id}`}
                className="flex items-center gap-4 bg-white rounded-xl border border-amber-200 p-4 hover:border-amber-300 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-grotesk font-semibold text-[#171717] truncate">{plan.title}</p>
                  <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                    {plan.platform && `${plan.platform} • `}
                    {plan.createdAt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {plan.postApprovalSummary && plan.postApprovalSummary.total > 0 ? (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-grotesk text-xs font-medium">
                      {plan.postApprovalSummary.approved}/{plan.postApprovalSummary.total} onaylandi
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-grotesk text-xs font-medium">
                      Onay Bekliyor
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-neutral-400" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalApprovalsPage;
