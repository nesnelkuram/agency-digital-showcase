import { useState } from 'react';
import { Send, Check, RotateCcw, SkipForward, MessageSquare } from 'lucide-react';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import type { PostStatus, ApprovalAction } from '@/shared/types/socialMedia';

interface PostApprovalActionsProps {
  postStatus: PostStatus;
  planRequiresInternalReview: boolean;
  onAction: (action: ApprovalAction, comment?: string) => Promise<void>;
  loading?: boolean;
}

export default function PostApprovalActions({
  postStatus,
  planRequiresInternalReview,
  onAction,
  loading = false,
}: PostApprovalActionsProps) {
  const { can, role } = usePermission();
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');

  const handleAction = async (action: ApprovalAction, requiresComment = false) => {
    if (requiresComment && !showComment) {
      setShowComment(true);
      return;
    }
    await onAction(action, comment || undefined);
    setComment('');
    setShowComment(false);
  };

  const actions = getAvailableActions(postStatus, planRequiresInternalReview, {
    canSubmit: can(PERMISSIONS.APPROVALS_SUBMIT),
    canInternalReview: can(PERMISSIONS.APPROVALS_INTERNAL_REVIEW),
    canSkipInternal: can(PERMISSIONS.APPROVALS_SKIP_INTERNAL),
    canApprove: can(PERMISSIONS.APPROVALS_APPROVE),
    role: role || '',
  });

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 font-grotesk">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.action}
            onClick={() => handleAction(action.action, action.requiresComment)}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${action.style}`}
          >
            <action.icon size={14} />
            {action.label}
          </button>
        ))}
      </div>

      {showComment && (
        <div className="flex gap-2 items-end">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Revizyon notunuzu yazin..."
            className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-grotesk resize-none focus:outline-none focus:ring-1 focus:ring-neutral-300"
            rows={2}
          />
          <button
            onClick={() => {
              const rejectAction = actions.find((a) => a.requiresComment);
              if (rejectAction) handleAction(rejectAction.action, false);
            }}
            disabled={loading || !comment.trim()}
            className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-red-100 transition-colors"
          >
            <MessageSquare size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

interface ActionConfig {
  action: ApprovalAction;
  label: string;
  icon: typeof Send;
  style: string;
  requiresComment: boolean;
}

interface Permissions {
  canSubmit: boolean;
  canInternalReview: boolean;
  canSkipInternal: boolean;
  canApprove: boolean;
  role: string;
}

function getAvailableActions(
  status: PostStatus,
  requiresInternal: boolean,
  perms: Permissions
): ActionConfig[] {
  const actions: ActionConfig[] = [];

  switch (status) {
    case 'draft':
      if (requiresInternal && perms.canSubmit) {
        actions.push({
          action: 'submit_for_review',
          label: 'Incelemeye Gonder',
          icon: Send,
          style: 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100',
          requiresComment: false,
        });
      }
      if (perms.canSkipInternal) {
        actions.push({
          action: 'submit_to_client',
          label: 'Musteriye Gonder',
          icon: SkipForward,
          style: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
          requiresComment: false,
        });
      }
      if (!requiresInternal && perms.canSubmit && !perms.canSkipInternal) {
        // Dahili inceleme yoksa, submit dogrudan musteriye gider
        actions.push({
          action: 'submit_to_client',
          label: 'Onaya Gonder',
          icon: Send,
          style: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
          requiresComment: false,
        });
      }
      break;

    case 'internal_review':
      if (perms.canInternalReview) {
        actions.push({
          action: 'internal_approve',
          label: 'Onayla',
          icon: Check,
          style: 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100',
          requiresComment: false,
        });
        actions.push({
          action: 'internal_reject',
          label: 'Revizyon Iste',
          icon: RotateCcw,
          style: 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100',
          requiresComment: true,
        });
      }
      break;

    case 'revision_requested_internal':
      if (perms.canSubmit) {
        actions.push({
          action: 'resubmit',
          label: 'Tekrar Gonder',
          icon: Send,
          style: 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100',
          requiresComment: false,
        });
      }
      break;

    case 'pending_approval':
      if (perms.canApprove) {
        actions.push({
          action: 'client_approve',
          label: 'Onayla',
          icon: Check,
          style: 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100',
          requiresComment: false,
        });
        actions.push({
          action: 'client_reject',
          label: 'Revizyon Iste',
          icon: RotateCcw,
          style: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
          requiresComment: true,
        });
      }
      break;

    case 'revision_requested':
      if (perms.canSubmit) {
        actions.push({
          action: 'resubmit',
          label: 'Tekrar Gonder',
          icon: Send,
          style: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
          requiresComment: false,
        });
      }
      break;
  }

  return actions;
}
