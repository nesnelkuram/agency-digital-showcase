import React from 'react';
import { FileCheck, ExternalLink, Shield } from 'lucide-react';
import type { AIAnalysis } from '@/shared/types/brandLead';

interface Props {
  evidenceSummary: NonNullable<AIAnalysis['evidenceSummary']>;
}

const EvidenceSummary: React.FC<Props> = ({ evidenceSummary }) => {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <FileCheck className="w-5 h-5 text-slate-600" />
        <h4 className="font-grotesk text-lg font-bold text-[#171717]">
          Kanit ve Kaynaklar
        </h4>
      </div>

      <div className="bg-slate-50 rounded-xl p-5 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
            <p className="font-grotesk text-2xl font-bold text-[#171717]">{evidenceSummary.sourcesConsulted}</p>
            <p className="font-grotesk text-[10px] text-neutral-400 uppercase">Kaynak</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
            <p className="font-grotesk text-xs font-medium text-[#171717]">{evidenceSummary.dataFreshness}</p>
            <p className="font-grotesk text-[10px] text-neutral-400 uppercase">Veri Guncellik</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
            <div className="flex items-center justify-center gap-1">
              <Shield className="w-3 h-3 text-slate-500" />
              <p className="font-grotesk text-xs font-medium text-[#171717]">{evidenceSummary.confidenceLevel}</p>
            </div>
            <p className="font-grotesk text-[10px] text-neutral-400 uppercase">Guven Seviyesi</p>
          </div>
        </div>

        {/* Source URLs */}
        {evidenceSummary.keySourceUrls && evidenceSummary.keySourceUrls.length > 0 && (
          <div>
            <p className="font-grotesk text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">
              Temel Kaynaklar
            </p>
            <div className="space-y-1">
              {evidenceSummary.keySourceUrls.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-grotesk text-xs text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 truncate"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  {source.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvidenceSummary;
