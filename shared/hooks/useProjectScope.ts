import { useParams } from 'react-router-dom';

/**
 * Hook for dual-routing marketing pages.
 * When accessed from /admin/projects/:projectId/marketing/*, returns projectId and project-scoped basePath.
 * When accessed from /admin/marketing/*, returns no projectId and global basePath.
 */
export function useProjectScope() {
  const { projectId } = useParams<{ projectId: string }>();

  const basePath = projectId
    ? `/admin/projects/${projectId}/marketing`
    : '/admin/marketing';

  return {
    projectId: projectId || undefined,
    basePath,
    isProjectScoped: !!projectId,
  };
}
