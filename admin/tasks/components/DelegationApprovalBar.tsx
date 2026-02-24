import React, { useState } from 'react';
import { CheckCircle, UserCheck, ChevronDown } from 'lucide-react';
import type { Task } from '@/shared/types/task';

interface DelegationApprovalBarProps {
  task: Task;
  onApprove: () => Promise<void>;
  onReassign?: () => void;
}

const DelegationApprovalBar: React.FC<DelegationApprovalBarProps> = ({
  task,
  onApprove,
  onReassign,
}) => {
  const [approving, setApproving] = useState(false);

  if (!task.suggestedAssigneeId || task.delegationApproved) return null;

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserCheck className="w-4 h-4 text-indigo-600" />
        <span className="font-commons text-sm font-semibold text-indigo-800">
          AI Delegasyon Önerisi
        </span>
      </div>

      <p className="font-commons text-sm text-indigo-700 mb-3">
        Bu görev için{' '}
        <span className="font-semibold">
          {task.suggestedAssigneeName || task.suggestedAssigneeRole}
        </span>{' '}
        rolünde birinin atanması öneriliyor.
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={handleApprove}
          disabled={approving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-commons text-sm font-medium transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          {approving ? 'Onaylanıyor...' : 'Kabul Et'}
        </button>
        {onReassign && (
          <button
            onClick={onReassign}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 font-commons text-sm transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            Değiştir
          </button>
        )}
      </div>
    </div>
  );
};

export default DelegationApprovalBar;
