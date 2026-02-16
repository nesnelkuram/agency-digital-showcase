import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckSquare, Eye, ThumbsUp, ThumbsDown, Clock, Bot, Filter, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkflowInstances } from '@/shared/hooks/useWorkflowInstances';
import type { StepInstance, WorkflowInstance } from '@/shared/types/workflow';

type FilterType = 'all' | 'human' | 'ai';

interface ApprovalItem {
  instanceId: string;
  nodeId: string;
  step: StepInstance;
  projectName: string;
  clientName: string;
  templateName: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  awaiting_review: {
    label: 'Onay Bekliyor',
    className: 'bg-purple-50 text-purple-700 border border-purple-200',
  },
  ai_review: {
    label: 'AI Inceleme',
    className: 'bg-violet-50 text-violet-700 border border-violet-200',
  },
};

const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const { instances, loading, error } = useWorkflowInstances();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const approvalItems = useMemo(() => {
    const items: ApprovalItem[] = [];

    instances.forEach((instance) => {
      Object.entries(instance.steps).forEach(([nodeId, step]) => {
        if (step.status === 'awaiting_review' || step.status === 'ai_review') {
          items.push({
            instanceId: instance.id,
            nodeId,
            step,
            projectName: instance.projectName,
            clientName: instance.clientName,
            templateName: instance.templateName,
          });
        }
      });
    });

    return items;
  }, [instances]);

  const filteredItems = useMemo(() => {
    let items = approvalItems;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.projectName.toLowerCase().includes(query) ||
          item.clientName.toLowerCase().includes(query) ||
          item.nodeId.toLowerCase().includes(query)
      );
    }

    if (filterType === 'human') {
      items = items.filter((item) => item.step.status === 'awaiting_review');
    } else if (filterType === 'ai') {
      items = items.filter((item) => item.step.status === 'ai_review');
    }

    return items;
  }, [approvalItems, searchQuery, filterType]);

  const SkeletonCard = () => (
    <div className="bg-white rounded-xl border border-neutral-100 p-6 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-neutral-200 rounded w-3/4" />
          <div className="h-4 bg-neutral-100 rounded w-1/2" />
          <div className="h-4 bg-neutral-100 rounded w-1/3" />
        </div>
        <div className="h-6 w-24 bg-neutral-200 rounded-full" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
          Onaylar
        </h1>
        <p className="font-grotesk text-neutral-600 mt-1">
          Icerik onay sureclerini yonetin.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Proje veya musteri ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl font-grotesk text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-500" />
          <div className="flex bg-white border border-neutral-200 rounded-xl overflow-hidden">
            {([
              { value: 'all', label: 'Tumu' },
              { value: 'human', label: 'Insan Onay' },
              { value: 'ai', label: 'AI Inceleme' },
            ] as { value: FilterType; label: string }[]).map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterType(option.value)}
                className={`px-4 py-2.5 font-grotesk text-sm transition-colors ${
                  filterType === option.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="font-grotesk text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Approval Cards */}
      {!loading && !error && filteredItems.length > 0 && (
        <div className="space-y-4">
          {filteredItems.map((item, index) => (
            <motion.div
              key={`${item.instanceId}-${item.nodeId}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/admin/workflows/instance/${item.instanceId}`}
                className="block bg-white rounded-xl border border-neutral-100 p-6 hover:shadow-md hover:border-neutral-200 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-grotesk text-base font-semibold text-[#171717] truncate group-hover:text-indigo-600 transition-colors">
                        {item.nodeId}
                      </h3>
                      {item.step.status === 'ai_review' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-grotesk font-medium bg-violet-100 text-violet-700">
                          <Bot className="w-3 h-3" />
                          AI Ciktisi
                        </span>
                      )}
                    </div>
                    <p className="font-grotesk text-sm text-neutral-600">
                      {item.projectName}
                    </p>
                    <p className="font-grotesk text-xs text-neutral-400 mt-1">
                      {item.clientName} &middot; {item.templateName}
                    </p>
                    {item.step.assignment && (
                      <p className="font-grotesk text-xs text-neutral-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Atanan: {item.step.assignment.userName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-grotesk font-medium ${
                        statusConfig[item.step.status]?.className || 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {statusConfig[item.step.status]?.label || item.step.status}
                    </span>
                    <Eye className="w-4 h-4 text-neutral-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl p-12 text-center border border-neutral-100"
        >
          <CheckSquare className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="font-ramillas text-xl font-bold text-neutral-400 mb-2">
            Bekleyen onay yok
          </h3>
          <p className="font-grotesk text-neutral-400">
            {searchQuery || filterType !== 'all'
              ? 'Aramanizla eslesen onay bulunamadi. Filtreleri degistirmeyi deneyin.'
              : 'Tum onaylar tamamlandi. Harika is!'}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default ApprovalsPage;
