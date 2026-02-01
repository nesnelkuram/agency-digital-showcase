import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface ProjectBreadcrumbProps {
  projectId: string;
  projectName?: string;
  currentPage: string;
}

const ProjectBreadcrumb: React.FC<ProjectBreadcrumbProps> = ({
  projectId,
  projectName,
  currentPage,
}) => {
  const hasProject = projectId && projectId.length > 0;

  return (
    <nav className="flex items-center gap-1.5 text-sm font-grotesk text-neutral-500 mb-2">
      <Link
        to="/admin/projects"
        className="hover:text-[#171717] transition-colors"
      >
        Projeler
      </Link>
      {hasProject ? (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <Link
            to={`/admin/projects/${projectId}`}
            className="hover:text-[#171717] transition-colors truncate max-w-[200px]"
          >
            {projectName || 'Proje'}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-[#171717] font-medium">{currentPage}</span>
        </>
      ) : (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-[#171717] font-medium">{currentPage}</span>
        </>
      )}
    </nav>
  );
};

export default ProjectBreadcrumb;
