import React from 'react';
import { AlertTriangle, CircleHelp, CheckCircle2 } from 'lucide-react';
import type { MediaItem, PostType } from '@/shared/types/socialMedia';
import { INSTAGRAM_SPEC_SOURCE, checkInstagramReadiness, type ReadinessResult } from '@/shared/social/instagramReadiness';

export function readinessFor(postType: PostType, media: MediaItem[]): ReadinessResult {
  return checkInstagramReadiness(postType, [...media].sort((a, b) => a.order - b.order));
}

/** Instagram ön kontrol sonucu — bloklamaz; yalnız bilgilendirir */
const ReadinessNotice: React.FC<{ result: ReadinessResult }> = ({ result }) => {
  if (result.status === 'ready') {
    return (
      <p className="flex items-center gap-1.5 font-grotesk text-xs text-green-700">
        <CheckCircle2 className="w-3.5 h-3.5" /> Instagram ön kontrolü: ölçülen değerler uygun.
      </p>
    );
  }
  const problems = result.issues.filter((i) => i.level !== 'unverified');
  const unverified = result.issues.filter((i) => i.level === 'unverified');
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 space-y-1" data-testid="readiness-notice">
      <p className="font-grotesk text-xs font-semibold text-amber-800">
        {result.status === 'issues' ? 'Instagram ön kontrolü: düzeltilmesi gerekenler var' : 'Instagram ön kontrolü: bazı şartlar doğrulanamadı'}
      </p>
      {problems.map((i, k) => (
        <p key={`p${k}`} className={`flex items-start gap-1 font-grotesk text-xs ${i.level === 'error' ? 'text-red-700' : 'text-amber-800'}`}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {i.message}
        </p>
      ))}
      {unverified.map((i, k) => (
        <p key={`u${k}`} className="flex items-start gap-1 font-grotesk text-xs text-neutral-600">
          <CircleHelp className="w-3.5 h-3.5 shrink-0 mt-px" /> {i.message}
        </p>
      ))}
      <p className="font-grotesk text-[10px] text-neutral-500">
        Kaynak: Meta Instagram Platform belgesi ({INSTAGRAM_SPEC_SOURCE.checkedOn} itibarıyla). Panelin 1 GB yükleme sınırı Instagram kabul sınırı değildir.
      </p>
    </div>
  );
};

export default ReadinessNotice;
