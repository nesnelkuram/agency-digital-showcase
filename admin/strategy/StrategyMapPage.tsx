import { useState, useEffect } from 'react';

interface StrategyPattern {
  id: string;
  sector: string;
  brandMaturity: string;
  approach: string;
  insight: string;
  successPattern?: string;
  avoidPattern?: string;
  sourceArticles: Array<{ slug: string; title: string }>;
  confidence: number;
}

interface StrategyMap {
  meta: { generatedAt: string; totalArticles: number; totalPatterns: number };
  patterns: StrategyPattern[];
}

const MATURITY_LABELS: Record<string, string> = {
  pre_brand: 'Ön Marka',
  emerging: 'Gelişen',
  developing: 'Büyüyen',
  mature: 'Olgun',
  any: 'Evrensel',
};

const MATURITY_COLORS: Record<string, string> = {
  pre_brand: 'bg-gray-700 text-gray-300',
  emerging: 'bg-emerald-900 text-emerald-300',
  developing: 'bg-blue-900 text-blue-300',
  mature: 'bg-purple-900 text-purple-300',
  any: 'bg-slate-700 text-slate-300',
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.7 ? 'bg-emerald-500' : value >= 0.4 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{pct}%</span>
    </div>
  );
}

export default function StrategyMapPage() {
  const [data, setData] = useState<StrategyMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedMaturity, setSelectedMaturity] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/makaleler/strategy_map.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<StrategyMap>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Derived filter options
  const sectors = data
    ? ['all', ...Array.from(new Set(data.patterns.map((p) => p.sector))).sort()]
    : ['all'];

  const maturities = data
    ? ['all', ...Array.from(new Set(data.patterns.map((p) => p.brandMaturity))).sort()]
    : ['all'];

  // Filtered patterns
  const filtered = (data?.patterns ?? []).filter((p) => {
    if (selectedSector !== 'all' && p.sector !== selectedSector) return false;
    if (selectedMaturity !== 'all' && p.brandMaturity !== selectedMaturity) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const inText = [p.approach, p.insight, p.successPattern, p.avoidPattern, p.sector]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!inText.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Strateji Haritası</h1>
        {data && (
          <p className="text-gray-400 mt-1 text-sm">
            {data.meta.totalPatterns} örüntü &middot; {data.meta.totalArticles} makale kaynak &middot;{' '}
            {new Date(data.meta.generatedAt).toLocaleDateString('tr-TR')} tarihinde oluşturuldu
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
            <span>Strateji haritası yükleniyor...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-6 text-red-300">
          <p className="font-medium">Yükleme hatası</p>
          <p className="text-sm mt-1 text-red-400">{error}</p>
          <p className="text-xs mt-2 text-red-500">
            Strateji haritasını oluşturmak için{' '}
            <code className="font-mono">node scripts/build-strategy-map.mjs</code> komutunu çalıştırın.
          </p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Filters */}
          <div className="mb-6 space-y-4">
            {/* Search */}
            <input
              type="text"
              placeholder="Arama: sektör, yaklaşım, çıkarım..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />

            {/* Sector chips */}
            <div>
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Sektör</p>
              <div className="flex flex-wrap gap-2">
                {sectors.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSector(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedSector === s
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                  >
                    {s === 'all' ? 'Tümü' : s}
                  </button>
                ))}
              </div>
            </div>

            {/* Maturity chips */}
            <div>
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Marka Olgunluğu</p>
              <div className="flex flex-wrap gap-2">
                {maturities.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMaturity(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedMaturity === m
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                  >
                    {m === 'all' ? 'Tümü' : (MATURITY_LABELS[m] ?? m)}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-sm text-gray-500">{filtered.length} örüntü gösteriliyor</p>
          </div>

          {/* Pattern grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">Filtreyle eşleşen örüntü bulunamadı.</p>
              <p className="text-sm mt-1">Farklı sektör veya olgunluk seviyesi dene.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((pattern) => (
                <div
                  key={pattern.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-600 transition-colors"
                >
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold bg-blue-900 text-blue-300 px-2.5 py-0.5 rounded-full">
                      {pattern.sector}
                    </span>
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        MATURITY_COLORS[pattern.brandMaturity] ?? 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {MATURITY_LABELS[pattern.brandMaturity] ?? pattern.brandMaturity}
                    </span>
                    <span className="text-xs text-gray-600 ml-auto font-mono">{pattern.id}</span>
                  </div>

                  {/* Approach */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Yaklaşım</p>
                    <p className="text-sm text-gray-200 leading-relaxed">{pattern.approach}</p>
                  </div>

                  {/* Insight */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Çıkarım</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{pattern.insight}</p>
                  </div>

                  {/* Success + Avoid */}
                  {(pattern.successPattern || pattern.avoidPattern) && (
                    <div className="space-y-2 border-t border-gray-800 pt-3">
                      {pattern.successPattern && (
                        <div className="flex gap-2 text-sm">
                          <span className="text-emerald-500 flex-shrink-0">+</span>
                          <p className="text-emerald-300 leading-snug">{pattern.successPattern}</p>
                        </div>
                      )}
                      {pattern.avoidPattern && (
                        <div className="flex gap-2 text-sm">
                          <span className="text-red-500 flex-shrink-0">-</span>
                          <p className="text-red-300 leading-snug">{pattern.avoidPattern}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-auto pt-3 border-t border-gray-800 space-y-2">
                    <ConfidenceBar value={pattern.confidence} />
                    <p className="text-xs text-gray-600">
                      {pattern.sourceArticles.length} makale kaynağı
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
