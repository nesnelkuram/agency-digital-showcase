import React from 'react';
import { Navigate } from 'react-router-dom';
import { Palette } from 'lucide-react';
import { useStudio } from '../StudioLayout';

export const LAST_PROJECT_KEY = 'studio.lastProjectId';

/** /studio → son çalışılan (yoksa ilk) markanın takvimi */
const StudioHomePage: React.FC = () => {
  const { projects } = useStudio();

  if (projects.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <Palette className="w-10 h-10 text-neutral-300 mx-auto" />
        <h1 className="font-grotesk text-lg font-semibold text-[#171717] mt-3">Henüz size atanmış bir marka yok</h1>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">Yöneticiniz size bir marka atadığında burada görünecek.</p>
      </div>
    );
  }

  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    // yok say
  }
  const target = projects.find((p) => p.id === last) || projects[0];
  return <Navigate to={`/studio/${target.id}`} replace />;
};

export default StudioHomePage;
