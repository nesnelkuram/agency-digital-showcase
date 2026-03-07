import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, GitBranch } from 'lucide-react';
import { SERVICE_MODULE_CONFIG } from '@/admin/projects/constants';
import type { ServiceCategory } from '@/shared/types/pricing/services';
import type { ProjectServiceStatus } from '@/shared/types/project';
import {
  PROJECT_SERVICE_STATUS_LABELS,
  PROJECT_SERVICE_STATUS_COLORS,
} from '@/shared/types/project';

interface ServiceCardProps {
  category: ServiceCategory;
  status: ProjectServiceStatus;
  projectId: string;
  onStartWorkflow?: (category: ServiceCategory) => void;
  workflowCount?: number;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  category,
  status,
  projectId,
  onStartWorkflow,
  workflowCount,
}) => {
  const config = SERVICE_MODULE_CONFIG[category];

  if (!config) return null;

  const Icon = config.icon;

  // Inactive service without workflow support — locked card (not clickable)
  if (!config.isActive && !config.supportsWorkflow) {
    return (
      <div
        className={`relative rounded-xl border border-neutral-100 ${config.bgColor} p-5 opacity-60`}
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${config.color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>
          <span className="text-xs font-grotesk font-medium px-2.5 py-1 rounded-full bg-neutral-200 text-neutral-500">
            Yakinda
          </span>
        </div>
        <h3 className="font-grotesk font-semibold text-[#171717] text-sm mb-1">
          {config.label}
        </h3>
        <p className="font-grotesk text-xs text-neutral-500 line-clamp-2">
          {config.description}
        </p>
        <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-white/30">
          <Lock className="w-5 h-5 text-neutral-400" />
        </div>
      </div>
    );
  }

  // All active/workflow services → Link to ServiceDetailPage
  return (
    <Link to={`/admin/projects/${projectId}/service/${category}`}>
      <motion.div
        className={`rounded-xl border border-neutral-100 ${config.bgColor} p-5 hover:shadow-md transition-shadow cursor-pointer`}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>
          <div className="flex items-center gap-2">
            {workflowCount !== undefined && workflowCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-grotesk font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                <GitBranch className="w-3 h-3" />
                {workflowCount}
              </span>
            )}
            <span
              className={`text-xs font-grotesk font-medium px-2.5 py-1 rounded-full ${PROJECT_SERVICE_STATUS_COLORS[status]}`}
            >
              {PROJECT_SERVICE_STATUS_LABELS[status]}
            </span>
          </div>
        </div>
        <h3 className="font-grotesk font-semibold text-[#171717] text-sm mb-1">
          {config.label}
        </h3>
        <p className="font-grotesk text-xs text-neutral-500 line-clamp-2">
          {config.description}
        </p>
        {onStartWorkflow && config.supportsWorkflow && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartWorkflow(category);
            }}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 bg-white text-neutral-700 font-grotesk text-xs font-medium hover:bg-neutral-50 transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5" />
            Sureci Baslat
          </motion.button>
        )}
      </motion.div>
    </Link>
  );
};

export default ServiceCard;
