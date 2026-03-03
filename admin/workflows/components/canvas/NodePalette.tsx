import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { PALETTE_ITEMS } from './nodeConstants';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';
import { useTenantId } from '@/shared/hooks/useTenant';
import { getWorkflowTemplate } from '@/shared/services/workflowTemplateService';

// ── File Path Indicator ──────────────────────────────────

interface PathSegment {
  id: string;
  name: string;
}

const WorkflowFilePath: React.FC = () => {
  const { id: currentId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { templateName, parentTemplateId, saveSession } = useWorkflowBuilderStore();

  const [ancestors, setAncestors] = useState<PathSegment[]>([]);

  useEffect(() => {
    if (!tenantId || !parentTemplateId) {
      setAncestors([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const chain: PathSegment[] = [];
      let walkId: string | undefined = parentTemplateId;

      while (walkId) {
        const parent = await getWorkflowTemplate(tenantId, walkId);
        if (!parent || cancelled) break;
        chain.unshift({ id: parent.id, name: parent.name });
        walkId = parent.parentTemplateId || undefined;
      }

      if (!cancelled) setAncestors(chain);
    })();

    return () => { cancelled = true; };
  }, [tenantId, currentId, parentTemplateId]);

  const handleNavigate = useCallback((templateId: string) => {
    if (currentId) saveSession(currentId);
    navigate(`/admin/workflows/builder/${templateId}`);
  }, [currentId, saveSession, navigate]);

  const currentName = templateName || 'Isimsiz Sablon';

  return (
    <div className="mb-3 pb-2.5 border-b border-neutral-200">
      <div className="flex items-start gap-1.5">
        <FolderOpen className="w-3 h-3 shrink-0 mt-[3px] text-amber-500" />
        <p className="font-commons text-[11px] leading-relaxed text-neutral-500 min-w-0">
          {ancestors.map((a) => (
            <span key={a.id}>
              <button
                onClick={() => handleNavigate(a.id)}
                className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
              >
                {a.name}
              </button>
              <span className="mx-0.5 text-neutral-300">›</span>
            </span>
          ))}
          <span className="text-neutral-700 font-semibold">{currentName}</span>
        </p>
      </div>
    </div>
  );
};

// ── Main Palette ────────────────────────────────────────

const NodePalette: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-[200px] border-r border-neutral-200 bg-neutral-50 p-3 overflow-y-auto">
      {/* File path indicator — always visible */}
      <WorkflowFilePath />

      {/* Collapsible node types */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between mb-2 group"
      >
        <h3 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          Dugum Tipleri
        </h3>
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
        )}
      </button>

      {!collapsed && (
        <>
          <div className="space-y-1.5">
            {PALETTE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type)}
                  className={`
                    flex items-center gap-2 px-2.5 py-2 rounded-lg
                    ${item.bg} ${item.text}
                    font-commons text-xs font-medium
                    cursor-grab active:cursor-grabbing
                    hover:opacity-80 transition-opacity
                    select-none
                  `}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-200">
            <p className="font-commons text-[10px] text-neutral-400 leading-relaxed">
              Dugum tiplerini surukleyerek canvas uzerine birakin.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default NodePalette;
