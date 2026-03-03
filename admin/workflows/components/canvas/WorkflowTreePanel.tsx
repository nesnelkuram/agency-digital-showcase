import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FolderOpen, Network, ChevronDown, ChevronRight, Loader2, GitBranch } from 'lucide-react';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';
import { useTenantId } from '@/shared/hooks/useTenant';
import { getWorkflowTemplate, getChildTemplates } from '@/shared/services/workflowTemplateService';

interface TreeNode {
  id: string;
  name: string;
  depth: number;
  children: TreeNode[];
  isSubprocess?: boolean;
}

function findNode(tree: TreeNode, id: string): TreeNode | null {
  if (tree.id === id) return tree;
  for (const child of tree.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

const TreeItem: React.FC<{
  node: TreeNode;
  currentId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
  level: number;
}> = ({ node, currentId, expanded, onToggle, onNavigate, level }) => {
  const isCurrent = node.id === currentId;
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) onToggle(node.id);
          if (!isCurrent) onNavigate(node.id);
        }}
        className={`
          w-full flex items-center gap-1 px-1.5 py-1 rounded-md text-left transition-colors
          ${isCurrent
            ? 'bg-indigo-100/80 text-indigo-700'
            : 'text-neutral-600 hover:bg-white/60'
          }
        `}
        style={{ paddingLeft: `${level * 14 + 4}px` }}
      >
        {hasChildren ? (
          isExpanded
            ? <ChevronDown className="w-3 h-3 shrink-0 text-neutral-400" />
            : <ChevronRight className="w-3 h-3 shrink-0 text-neutral-400" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {node.isSubprocess || node.depth > 0 ? (
          <Network className="w-3 h-3 shrink-0 text-cyan-500" />
        ) : (
          <FolderOpen className="w-3 h-3 shrink-0 text-amber-500" />
        )}
        <span className={`font-commons text-[11px] truncate ${isCurrent ? 'font-semibold' : 'font-medium'}`}>
          {node.name}
        </span>
      </button>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              currentId={currentId}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const WorkflowTreePanel: React.FC = () => {
  const { id: currentId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { templateName, parentTemplateId, depth, nodes, saveSession } = useWorkflowBuilderStore();

  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(true);

  const buildTree = useCallback(async () => {
    if (!tenantId || !currentId) return;
    setLoading(true);

    try {
      // 1. Walk up to root
      const ancestors: { id: string; name: string; depth: number }[] = [];
      let walkId: string | undefined = parentTemplateId || undefined;

      while (walkId) {
        const parent = await getWorkflowTemplate(tenantId, walkId);
        if (!parent) break;
        ancestors.unshift({ id: parent.id, name: parent.name, depth: parent.depth });
        walkId = parent.parentTemplateId || undefined;
      }

      // 2. Current node
      const currentNode: TreeNode = {
        id: currentId,
        name: templateName || 'Mevcut Sablon',
        depth,
        children: [],
      };

      // 3. Subprocess children from canvas nodes
      const subprocessNodes = nodes.filter(
        (n) => n.data?.nodeType === 'subprocess' && (n.data?.subprocessConfig as any)?.childTemplateId
      );
      for (const sp of subprocessNodes) {
        const config = sp.data?.subprocessConfig as any;
        currentNode.children.push({
          id: config.childTemplateId,
          name: config.childTemplateName || (sp.data?.label as string) || 'Alt Surec',
          depth: depth + 1,
          children: [],
          isSubprocess: true,
        });
      }

      // 4. Build tree from ancestors
      let root: TreeNode;

      if (ancestors.length > 0) {
        root = {
          id: ancestors[0].id,
          name: ancestors[0].name,
          depth: ancestors[0].depth,
          children: [],
        };

        const rootChildren = await getChildTemplates(tenantId, root.id);

        let parentNode = root;
        for (let i = 1; i < ancestors.length; i++) {
          const ancestor = ancestors[i];
          parentNode.children = rootChildren
            .filter((c) => c.parentTemplateId === parentNode.id)
            .map((c) => ({
              id: c.id,
              name: c.name,
              depth: c.depth,
              children: [],
              isSubprocess: true,
            }));

          let found = parentNode.children.find((c) => c.id === ancestor.id);
          if (!found) {
            found = {
              id: ancestor.id,
              name: ancestor.name,
              depth: ancestor.depth,
              children: [],
              isSubprocess: true,
            };
            parentNode.children.push(found);
          }
          parentNode = found;

          const nextChildren = await getChildTemplates(tenantId, ancestor.id);
          parentNode.children = nextChildren.map((c) => ({
            id: c.id,
            name: c.name,
            depth: c.depth,
            children: [],
            isSubprocess: true,
          }));
        }

        const lastParent = ancestors.length > 1
          ? findNode(root, ancestors[ancestors.length - 1].id)
          : root;

        if (lastParent) {
          const idx = lastParent.children.findIndex((c) => c.id === currentId);
          if (idx >= 0) {
            lastParent.children[idx] = currentNode;
          } else {
            lastParent.children.push(currentNode);
          }
        }
      } else {
        root = currentNode;
      }

      setTree(root);

      const expandIds = new Set<string>();
      ancestors.forEach((a) => expandIds.add(a.id));
      expandIds.add(currentId);
      setExpanded(expandIds);
    } catch (err) {
      console.error('Tree build error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, currentId, parentTemplateId, depth, templateName, nodes]);

  useEffect(() => {
    buildTree();
  }, [currentId, parentTemplateId]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavigate = useCallback((templateId: string) => {
    if (currentId) saveSession(currentId);
    navigate(`/admin/workflows/builder/${templateId}`);
  }, [currentId, saveSession, navigate]);

  if (!currentId) return null;

  // Only show if there's actual hierarchy (has parent or has subprocess children)
  const hasHierarchy = !!parentTemplateId || nodes.some(
    (n) => n.data?.nodeType === 'subprocess' && (n.data?.subprocessConfig as any)?.childTemplateId
  );
  if (!hasHierarchy && !loading) return null;

  return (
    <div
      className="bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-lg shadow-sm overflow-hidden"
      style={{ minWidth: 180, maxWidth: 260 }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-neutral-50 transition-colors"
      >
        <GitBranch className="w-3 h-3 text-indigo-500 shrink-0" />
        <span className="font-commons text-[11px] font-semibold text-neutral-600 flex-1 text-left">
          Surec Yapisi
        </span>
        {panelOpen ? (
          <ChevronDown className="w-3 h-3 text-neutral-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-neutral-400" />
        )}
      </button>

      {/* Tree body */}
      {panelOpen && (
        <div className="px-1 pb-1.5 max-h-[240px] overflow-y-auto">
          {loading ? (
            <div className="px-2 py-2 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
              <span className="font-commons text-[10px] text-neutral-400">Yukleniyor...</span>
            </div>
          ) : tree ? (
            <TreeItem
              node={tree}
              currentId={currentId}
              expanded={expanded}
              onToggle={toggleExpand}
              onNavigate={handleNavigate}
              level={0}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default WorkflowTreePanel;
