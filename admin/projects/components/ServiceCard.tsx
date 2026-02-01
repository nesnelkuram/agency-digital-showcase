import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
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
}

const ServiceCard: React.FC<ServiceCardProps> = ({ category, status, projectId }) => {
  const config = SERVICE_MODULE_CONFIG[category];

  if (!config) return null;

  const Icon = config.icon;

  if (!config.isActive) {
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

  if (status === 'active' && config.route) {
    return (
      <Link to={`/admin/projects/${projectId}/${config.route}`}>
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
            <span
              className={`text-xs font-grotesk font-medium px-2.5 py-1 rounded-full ${PROJECT_SERVICE_STATUS_COLORS[status]}`}
            >
              {PROJECT_SERVICE_STATUS_LABELS[status]}
            </span>
          </div>
          <h3 className="font-grotesk font-semibold text-[#171717] text-sm mb-1">
            {config.label}
          </h3>
          <p className="font-grotesk text-xs text-neutral-500 line-clamp-2">
            {config.description}
          </p>
        </motion.div>
      </Link>
    );
  }

  return (
    <motion.div
      className={`rounded-xl border border-neutral-100 ${config.bgColor} p-5`}
      whileHover={{ y: -1 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color: config.color }} />
        </div>
        <span
          className={`text-xs font-grotesk font-medium px-2.5 py-1 rounded-full ${PROJECT_SERVICE_STATUS_COLORS[status]}`}
        >
          {PROJECT_SERVICE_STATUS_LABELS[status]}
        </span>
      </div>
      <h3 className="font-grotesk font-semibold text-[#171717] text-sm mb-1">
        {config.label}
      </h3>
      <p className="font-grotesk text-xs text-neutral-500 line-clamp-2">
        {config.description}
      </p>
      <p className="font-grotesk text-xs text-neutral-400 mt-2">
        {status === 'not_started'
          ? 'Bu hizmet henuz baslatilmadi'
          : status === 'paused'
          ? 'Bu hizmet duraklatildi'
          : status === 'completed'
          ? 'Bu hizmet tamamlandi'
          : ''}
      </p>
    </motion.div>
  );
};

export default ServiceCard;
