import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Briefcase, Loader2 } from 'lucide-react';
import { getProjects } from '@/shared/services/projectService';
import type { ProjectSummary } from '@/shared/types/project';
import { useTenantId } from '@/shared/hooks/useTenant';

interface ProjectMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const ProjectMultiSelect: React.FC<ProjectMultiSelectProps> = ({
  value,
  onChange,
  placeholder = 'Proje seç...',
  disabled = false,
}) => {
  const tenantId = useTenantId();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!tenantId) return;
      try {
        setLoading(true);
        const { projects } = await getProjects(tenantId, undefined, 100);
        if (!cancelled) setProjects(projects);
      } catch (e) {
        console.error('[ProjectMultiSelect] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const selected = useMemo(() => projects.filter((p) => value.includes(p.id)), [projects, value]);
  const filtered = useMemo(() => {
    const base = projects.filter((p) => !value.includes(p.id));
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        (p.clientCompany && p.clientCompany.toLowerCase().includes(q))
    );
  }, [projects, value, search]);

  const addProject = (id: string) => {
    onChange([...value, id]);
    setSearch('');
  };

  const removeProject = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-neutral-100 rounded-full text-xs font-grotesk"
            >
              <Briefcase className="w-3 h-3 text-neutral-500" />
              <span className="truncate max-w-[160px]">{p.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeProject(p.id)}
                className="p-0.5 hover:bg-neutral-200 rounded-full"
              >
                <X className="w-3 h-3 text-neutral-500" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-9 pr-3 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 animate-spin" />
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Briefcase className="w-5 h-5 text-neutral-300 mx-auto mb-1" />
              <p className="font-grotesk text-xs text-neutral-500">
                {loading ? 'Yükleniyor...' : 'Proje bulunamadı'}
              </p>
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addProject(p.id)}
                className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors"
              >
                <p className="font-grotesk text-sm text-[#171717] truncate">{p.name}</p>
                <p className="font-grotesk text-xs text-neutral-500 truncate">
                  {p.clientCompany || p.clientName}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectMultiSelect;
