import React from 'react';
import { Search, Globe, TrendingUp, Shield, AlertTriangle, BarChart3 } from 'lucide-react';
import type { AIAnalysis } from '@/shared/types/brandLead';

interface Props {
  research: NonNullable<AIAnalysis['sectorResearch']>;
}

const ResearchFindings: React.FC<Props> = ({ research }) => {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-emerald-600" />
        <h4 className="font-ramillas text-lg font-bold text-[#171717]">
          Sektor Arastirmasi
        </h4>
        <span className="ml-auto font-grotesk text-xs text-neutral-400">
          {research.sourcesUsed} kaynak
        </span>
      </div>

      <div className="space-y-4">
        {/* Competitors */}
        {research.competitors && research.competitors.length > 0 && (
          <div className="bg-emerald-50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-emerald-600" />
              <p className="font-grotesk text-xs text-emerald-600 uppercase tracking-wider font-medium">
                Rakip Analizi
              </p>
            </div>
            <div className="space-y-3">
              {research.competitors.map((competitor, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-emerald-100">
                  <p className="font-grotesk text-sm font-semibold text-[#171717] mb-1">
                    {competitor.name}
                  </p>
                  <p className="font-grotesk text-xs text-neutral-600 mb-2">
                    {competitor.positioning}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-grotesk text-[10px] text-green-600 uppercase mb-1">Guclu</p>
                      <ul className="space-y-0.5">
                        {competitor.strengths.map((s, j) => (
                          <li key={j} className="font-grotesk text-xs text-neutral-600">+ {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-grotesk text-[10px] text-red-500 uppercase mb-1">Zayif</p>
                      <ul className="space-y-0.5">
                        {competitor.weaknesses.map((w, j) => (
                          <li key={j} className="font-grotesk text-xs text-neutral-600">- {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Trends & Benchmarks */}
        <div className="grid grid-cols-2 gap-4">
          {research.marketTrends && research.marketTrends.length > 0 && (
            <div className="bg-sky-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-sky-600" />
                <p className="font-grotesk text-xs text-sky-600 uppercase tracking-wider font-medium">
                  Pazar Trendleri
                </p>
              </div>
              <ul className="space-y-1">
                {research.marketTrends.map((trend, i) => (
                  <li key={i} className="font-grotesk text-xs text-neutral-700 flex items-start gap-1.5">
                    <span className="text-sky-400 mt-0.5 flex-shrink-0">&#8226;</span>
                    {trend}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {research.sectorBenchmarks && research.sectorBenchmarks.length > 0 && (
            <div className="bg-indigo-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <p className="font-grotesk text-xs text-indigo-600 uppercase tracking-wider font-medium">
                  Sektor Olcutleri
                </p>
              </div>
              <ul className="space-y-1">
                {research.sectorBenchmarks.map((benchmark, i) => (
                  <li key={i} className="font-grotesk text-xs text-neutral-700 flex items-start gap-1.5">
                    <span className="text-indigo-400 mt-0.5 flex-shrink-0">&#8226;</span>
                    {benchmark}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Search Queries (collapsed) */}
        {research.searchQueries && research.searchQueries.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer font-grotesk text-xs text-neutral-400 hover:text-neutral-600">
              Arama sorgulari ({research.searchQueries.length})
            </summary>
            <div className="mt-2 space-y-1">
              {research.searchQueries.map((q, i) => (
                <p key={i} className="font-grotesk text-xs text-neutral-500 bg-neutral-50 px-2 py-1 rounded">
                  {q}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default ResearchFindings;
