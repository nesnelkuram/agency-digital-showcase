import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * Legacy route - redirects to the calendar page which now has
 * the CreatePostPanel drawer built in.
 */
const CreatePostPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/admin/projects/${projectId}/social-media`, { replace: true });
  }, [navigate, projectId]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default CreatePostPage;
