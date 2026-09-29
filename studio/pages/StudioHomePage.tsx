import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Palette } from 'lucide-react';
import { useStudio } from '../StudioLayout';

/** Markalarım — tek marka varsa doğrudan ona açılır */
const StudioHomePage: React.FC = () => {
  const { projects } = useStudio();

  if (projects.length === 1) return <Navigate to={`/studio/${projects[0].id}`} replace />;

  if (projects.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <Palette className="w-10 h-10 text-neutral-300 mx-auto" />
        <h1 className="font-grotesk text-lg font-semibold text-[#171717] mt-3">Henüz size atanmış bir marka yok</h1>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">Yöneticiniz size bir marka atadığında burada görünecek.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Markalarım</h1>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">Çalışmak istediğiniz markayı seçin.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link
            key={p.id}
            to={`/studio/${p.id}`}
            className="group bg-white rounded-xl border border-neutral-200 p-4 hover:border-neutral-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-grotesk font-semibold text-[#171717]">{p.name}</span>
              <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-600" />
            </div>
            {p.clientName && <p className="font-grotesk text-xs text-neutral-500 mt-1">{p.clientName}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default StudioHomePage;
