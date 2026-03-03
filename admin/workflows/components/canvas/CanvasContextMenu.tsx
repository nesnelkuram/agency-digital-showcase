import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  CheckSquare,
  LayoutGrid,
  ClipboardPaste,
  Pencil,
  Copy,
  Clipboard,
  Trash2,
  Palette,
  StickyNote,
  Lock,
  Unlock,
  ChevronRight,
  ExternalLink,
  PlusCircle,
} from 'lucide-react';
import { PALETTE_ITEMS } from './nodeConstants';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';
import ColorPickerPopover from './ColorPickerPopover';
import NotesPopover from './NotesPopover';

interface Props {
  screenPos: { x: number; y: number };
  flowPos: { x: number; y: number };
  nodeId: string | null;
  edgeId?: string | null;
  onClose: () => void;
  onEditNode?: (nodeId: string) => void;
  onSubprocessNavigate?: (nodeId: string) => void;
}

const CanvasContextMenu: React.FC<Props> = ({ screenPos, flowPos, nodeId, edgeId, onClose, onEditNode, onSubprocessNavigate }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [showAddSubmenu, setShowAddSubmenu] = useState(false);
  const [colorPicker, setColorPicker] = useState<{ x: number; y: number } | null>(null);
  const [notesPopover, setNotesPopover] = useState<{ x: number; y: number } | null>(null);

  const {
    addNode,
    removeNode,
    removeEdge,
    updateNodeData,
    setSelectedNodeId,
    selectAllNodes,
    autoLayout,
    pasteNodes,
    clipboard,
    nodes,
  } = useWorkflowBuilderStore();

  const targetNode = nodeId ? nodes.find((n) => n.id === nodeId) : null;
  const isLocked = targetNode?.data?.locked;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // If a sub-popover is open, render it instead
  if (colorPicker && nodeId) {
    return (
      <ColorPickerPopover
        nodeId={nodeId}
        screenPos={colorPicker}
        onClose={onClose}
      />
    );
  }
  if (notesPopover && nodeId) {
    return (
      <NotesPopover
        nodeId={nodeId}
        screenPos={notesPopover}
        onClose={onClose}
      />
    );
  }

  const left = Math.min(screenPos.x, window.innerWidth - 220);
  const top = Math.min(screenPos.y, window.innerHeight - 350);

  // ── Menu item component ──
  const MenuItem: React.FC<{
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
    hasSubmenu?: boolean;
    onMouseEnter?: () => void;
  }> = ({ icon: Icon, label, onClick, disabled, danger, hasSubmenu, onMouseEnter }) => (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={onMouseEnter}
      disabled={disabled}
      className={`
        w-full flex items-center gap-2 px-3 py-1.5 text-left font-commons text-xs
        ${disabled ? 'text-neutral-300 cursor-not-allowed' : danger ? 'text-red-600 hover:bg-red-50' : 'text-neutral-700 hover:bg-neutral-50'}
        transition-colors rounded-md
      `}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
      {hasSubmenu && <ChevronRight className="w-3 h-3 text-neutral-400" />}
    </button>
  );

  // ── Edge mode ──
  if (edgeId && !nodeId) {
    return (
      <div
        ref={ref}
        className="fixed z-50 bg-white rounded-xl border border-neutral-200 shadow-xl py-1.5 px-1"
        style={{ left, top, minWidth: 160 }}
      >
        <MenuItem
          icon={Trash2}
          label="Baglantiyi Sil"
          onClick={() => { removeEdge(edgeId); onClose(); }}
          danger
        />
      </div>
    );
  }

  // ── Node mode ──
  if (nodeId && targetNode) {
    const handleDuplicate = () => {
      const store = useWorkflowBuilderStore.getState();
      store.setNodes(store.nodes.map((n) => ({ ...n, selected: n.id === nodeId })));
      store.copySelectedNodes();
      store.pasteNodes({ x: targetNode.position.x + 40, y: targetNode.position.y + 40 });
      onClose();
    };

    const handleCopy = () => {
      const store = useWorkflowBuilderStore.getState();
      store.setNodes(store.nodes.map((n) => ({ ...n, selected: n.id === nodeId })));
      store.copySelectedNodes();
      onClose();
    };

    const handleDelete = () => {
      removeNode(nodeId);
      onClose();
    };

    const handleToggleLock = () => {
      updateNodeData(nodeId, { locked: !isLocked });
      onClose();
    };

    return (
      <div
        ref={ref}
        className="fixed z-50 bg-white rounded-xl border border-neutral-200 shadow-xl py-1.5 px-1"
        style={{ left, top, minWidth: 180 }}
      >
        <MenuItem icon={Pencil} label="Duzenle" onClick={() => { setSelectedNodeId(nodeId); onEditNode?.(nodeId); onClose(); }} />
        {targetNode.data?.nodeType === 'subprocess' && (
          <MenuItem
            icon={targetNode.data?.subprocessConfig?.childTemplateId ? ExternalLink : PlusCircle}
            label={targetNode.data?.subprocessConfig?.childTemplateId ? 'Alt Surece Git' : 'Alt Surec Olustur'}
            onClick={() => { onSubprocessNavigate?.(nodeId); onClose(); }}
          />
        )}
        <MenuItem icon={Copy} label="Cogalt" onClick={handleDuplicate} />
        <MenuItem icon={Clipboard} label="Kopyala" onClick={handleCopy} />
        <div className="my-1 border-t border-neutral-100" />
        <MenuItem icon={Palette} label="Renk Degistir" onClick={() => setColorPicker(screenPos)} />
        <MenuItem
          icon={StickyNote}
          label={targetNode.data?.notes ? 'Notu Duzenle' : 'Not Ekle'}
          onClick={() => setNotesPopover(screenPos)}
        />
        <MenuItem
          icon={isLocked ? Unlock : Lock}
          label={isLocked ? 'Kilit Ac' : 'Kilitle'}
          onClick={handleToggleLock}
        />
        <div className="my-1 border-t border-neutral-100" />
        <MenuItem icon={Trash2} label="Sil" onClick={handleDelete} disabled={!!isLocked} danger />
      </div>
    );
  }

  // ── Canvas mode ──
  const handleAdd = (type: string) => {
    addNode(type, flowPos);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-xl border border-neutral-200 shadow-xl py-1.5 px-1"
      style={{ left, top, minWidth: 180 }}
    >
      {/* Add node with submenu */}
      <div className="relative" onMouseEnter={() => setShowAddSubmenu(true)} onMouseLeave={() => setShowAddSubmenu(false)}>
        <MenuItem icon={Plus} label="Dugum Ekle" onClick={() => setShowAddSubmenu(!showAddSubmenu)} hasSubmenu />
        {showAddSubmenu && (
          <div
            className="absolute left-full top-0 ml-1 bg-white rounded-xl border border-neutral-200 shadow-xl py-1.5 px-1 z-50"
            style={{ minWidth: 160 }}
          >
            {PALETTE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => handleAdd(item.type)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left font-commons text-xs text-neutral-700 hover:bg-neutral-50 transition-colors rounded-md"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="my-1 border-t border-neutral-100" />
      <MenuItem icon={CheckSquare} label="Tumunu Sec" onClick={() => { selectAllNodes(); onClose(); }} />
      <MenuItem icon={LayoutGrid} label="Otomatik Duzenle" onClick={() => { autoLayout(); onClose(); }} />
      <MenuItem
        icon={ClipboardPaste}
        label="Yapistir"
        onClick={() => { pasteNodes(flowPos); onClose(); }}
        disabled={!clipboard}
      />
    </div>
  );
};

export default CanvasContextMenu;
