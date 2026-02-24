import React from 'react';

interface AIPriorityBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

const AIPriorityBadge: React.FC<AIPriorityBadgeProps> = ({ score, size = 'sm' }) => {
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));

  let colorClass: string;
  if (clampedScore >= 80) {
    colorClass = 'bg-red-100 text-red-700 ring-1 ring-red-200';
  } else if (clampedScore >= 50) {
    colorClass = 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
  } else {
    colorClass = 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
  }

  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-commons font-semibold ${sizeClass} ${colorClass}`}
      title={`AI Öncelik Skoru: ${clampedScore}/100`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {clampedScore}
    </span>
  );
};

export default AIPriorityBadge;
