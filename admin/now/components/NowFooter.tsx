import React from 'react';
import type { UnifiedTaskItem } from '@/shared/types/task';

interface NowFooterProps {
  next: UnifiedTaskItem[];
  wipUsed: number;
  wipLimit: number;
  totalActive: number;
}

const NowFooter: React.FC<NowFooterProps> = ({ next, wipUsed, wipLimit, totalActive }) => {
  const topThree = next.slice(0, 3);
  const inboxCount = Math.max(0, totalActive - wipUsed);

  return (
    <div className="mt-12 w-full max-w-3xl px-6 text-center">
      <div className="h-px w-16 mx-auto bg-neutral-200 mb-6" />

      {topThree.length > 0 ? (
        <div className="space-y-1.5">
          <p className="font-commons text-[10px] uppercase tracking-[0.18em] text-neutral-400 mb-2">
            Bugünün sıradaki adımları
          </p>
          {topThree.map((item, idx) => (
            <p
              key={item.id}
              className="font-commons text-sm text-neutral-400 truncate max-w-2xl mx-auto"
            >
              <span className="font-mono text-[10px] text-neutral-300 mr-2 tabular-nums">
                {idx + 1}.
              </span>
              {item.title}
              {item.projectName && (
                <span className="text-neutral-300"> · {item.projectName}</span>
              )}
            </p>
          ))}
        </div>
      ) : (
        <p className="font-commons text-sm text-neutral-400">Sıradaki: yok</p>
      )}

      <p className="font-commons text-xs text-neutral-400 mt-5">
        Devam eden:{' '}
        <span className={wipUsed >= wipLimit ? 'text-rose-500 font-medium' : 'text-neutral-500'}>
          {wipUsed}/{wipLimit}
        </span>
        {' · '}
        Backlog: <span className="text-neutral-500">{inboxCount}</span>
      </p>
    </div>
  );
};

export default NowFooter;
