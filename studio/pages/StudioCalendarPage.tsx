import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import CalendarView from '@/admin/social-media/components/calendar/CalendarView';
import { useStudio } from '../StudioLayout';
import { getProjectPosts } from '../studioData';

/** Takvim — markanın tüm içerikleri, durum renkleriyle (salt okunur; tıklayınca plana gider) */
const StudioCalendarPage: React.FC = () => {
  const { project, tenantId } = useStudio();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    getProjectPosts(tenantId, project.id)
      .then(setPosts)
      .catch((err) => console.error('[Studio] Takvim yüklenemedi:', err))
      .finally(() => setLoading(false));
  }, [project?.id, tenantId]);

  if (!project) return null;

  return (
    <div className="space-y-4">
      <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Takvim</h1>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <CalendarView
          posts={posts}
          readOnly
          onPostClick={(post) => post.contentPlanId && navigate(`/studio/${project.id}/planlar/${post.contentPlanId}`)}
        />
      )}
    </div>
  );
};

export default StudioCalendarPage;
