import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FolderKanban, Loader2, Calendar, ChevronRight } from 'lucide-react';
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

interface ProjectItem {
  id: string;
  name: string;
  status: string;
  clientName: string;
  startDate?: Date;
  endDate?: Date;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Aktif', color: 'bg-green-100 text-green-700' },
  in_progress: { label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-700' },
  review: { label: 'İncelemede', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Tamamlandı', color: 'bg-neutral-100 text-neutral-600' },
  paused: { label: 'Duraklatıldı', color: 'bg-red-100 text-red-600' },
};

const PortalProjectsPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !user?.uid || !tenantId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db!, 'projects'),
            where('tenantId', '==', tenantId),
            where('clientId', '==', user.uid),
            orderBy('createdAt', 'desc')
          )
        );
        const items: ProjectItem[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          items.push({
            id: doc.id,
            name: d.name || 'Proje',
            status: d.status || 'active',
            clientName: d.clientName || '',
            startDate: d.startDate?.toDate?.(),
            endDate: d.endDate?.toDate?.(),
          });
        });
        setProjects(items);
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
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Projelerim</h1>
        <p className="font-grotesk text-neutral-500 text-sm mt-1">
          Tüm projelerinizin durumu
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-100 p-12 text-center">
          <FolderKanban className="w-10 h-10 text-neutral-300 mx-auto" />
          <p className="font-grotesk text-neutral-500 mt-3">Henüz proje bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project, i) => {
            const status = statusConfig[project.status] || { label: project.status, color: 'bg-neutral-100 text-neutral-600' };
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Link
                  to={`/portal/projects/${project.id}`}
                  className="block bg-white rounded-xl border border-neutral-100 p-4 hover:border-neutral-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <FolderKanban className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-grotesk font-semibold text-[#171717] truncate">{project.name}</p>
                        {(project.startDate || project.endDate) && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-neutral-400" />
                            <p className="font-grotesk text-xs text-neutral-400">
                              {project.startDate?.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                              {project.endDate && ` — ${project.endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-full font-grotesk text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    </div>
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

export default PortalProjectsPage;
