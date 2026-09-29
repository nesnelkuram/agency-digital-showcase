import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useStudio } from '../StudioLayout';
import { getBrandKit, type BrandKit } from '../studioData';

const List: React.FC<{ title: string; items?: string[] }> = ({ title, items }) =>
  items && items.length > 0 ? (
    <div>
      <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className="px-2 py-0.5 bg-neutral-100 rounded-full font-grotesk text-xs text-neutral-700">
            {it}
          </span>
        ))}
      </div>
    </div>
  ) : null;

/** Marka Kiti — marka sesi ve kimlik özeti (salt okunur; AI üretimi de bunu kullanır) */
const StudioBrandKitPage: React.FC = () => {
  const { project } = useStudio();
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setKit(null);
    getBrandKit(project.id)
      .then(setKit)
      .catch((err) => setError(err.message));
  }, [project?.id]);

  if (!project) return null;
  if (error) return <p className="font-grotesk text-sm text-red-600">{error}</p>;
  if (!kit) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const f = kit.brand?.sourceFields || {};
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Marka Kiti</h1>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">{kit.project.name}</p>
      </div>

      {!kit.brand || !kit.brand.hasAnalysis ? (
        <p className="font-grotesk text-sm text-neutral-500 bg-white border border-neutral-200 rounded-xl p-6">
          Bu marka için henüz marka analizi yok. Analiz tamamlandığında marka sesi burada görünecek.
        </p>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <div>
            <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">Marka sesi</p>
            <p className="font-grotesk text-sm text-[#171717]">{kit.brand.voiceSummary}</p>
          </div>
          {f.oneLinePromise && (
            <div>
              <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">Tek cümlelik vaat</p>
              <p className="font-grotesk text-sm text-neutral-700">{f.oneLinePromise}</p>
            </div>
          )}
          {f.targetAudience && (
            <div>
              <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">Hedef kitle</p>
              <p className="font-grotesk text-sm text-neutral-700">{f.targetAudience}</p>
            </div>
          )}
          <List title="Kişilik" items={f.traits} />
          <List title="Biz buyuz" items={f.weAreThis} />
          <List title="Biz bu değiliz" items={f.weAreNotThis} />
          <List title="Duygu / ton anahtar kelimeleri" items={f.moodKeywords} />
          {Array.isArray(f.behaviors) && f.behaviors.length > 0 && (
            <div>
              <p className="font-grotesk text-xs font-medium text-neutral-500 mb-2">Yapılacaklar / yapılmayacaklar</p>
              <div className="space-y-2">
                {f.behaviors.map((b: any, i: number) => (
                  <div key={i} className="bg-neutral-50 rounded-lg p-3">
                    <p className="font-grotesk text-xs font-semibold text-[#171717]">{b.value}</p>
                    <p className="font-grotesk text-xs text-green-700 mt-1">✓ {b.do}</p>
                    <p className="font-grotesk text-xs text-red-600">✕ {b.dont}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudioBrandKitPage;
