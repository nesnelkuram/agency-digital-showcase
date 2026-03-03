import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Check, Globe } from 'lucide-react';

interface GeoLocation {
  key: string;
  name: string;
  type: string;
  country_code?: string;
  country_name?: string;
  region?: string;
  region_id?: string;
}

interface GeoLocationResultsProps {
  data: {
    locations: GeoLocation[];
    query: string;
  };
  onSendMessage: (text: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  country: 'Ulke',
  region: 'Bolge',
  city: 'Sehir',
  zip: 'Posta Kodu',
  geo_market: 'Pazar',
  electoral_district: 'Secim Bolgesi',
};

const TYPE_COLORS: Record<string, string> = {
  country: 'bg-blue-100 text-blue-700',
  region: 'bg-violet-100 text-violet-700',
  city: 'bg-emerald-100 text-emerald-700',
  zip: 'bg-amber-100 text-amber-700',
  geo_market: 'bg-pink-100 text-pink-700',
};

const GeoLocationResults: React.FC<GeoLocationResultsProps> = ({ data, onSendMessage }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { locations, query } = data;

  if (!locations || locations.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Konum bulunamadi.
      </div>
    );
  }

  const toggleItem = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = () => {
    const items = locations.filter(l => selected.has(l.key));
    const formatted = items.map(l => `${l.key}:${l.name}`).join(', ');
    onSendMessage(`Su konumlari sectim: [${formatted}]`);
  };

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Globe className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Konumlar
          {query && <span className="text-neutral-400"> — "{query}"</span>}
          <span className="text-neutral-400 ml-1">({locations.length} sonuc)</span>
        </span>
      </div>

      {/* Location list */}
      <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-1">
        {locations.map((loc, i) => {
          const isSelected = selected.has(loc.key);
          const typeColor = TYPE_COLORS[loc.type] || 'bg-neutral-100 text-neutral-600';

          return (
            <motion.button
              key={loc.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
              onClick={() => toggleItem(loc.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-white border-neutral-150 hover:border-emerald-200 hover:bg-emerald-50/30'
              }`}
            >
              {isSelected ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-commons font-medium text-[#171717]">{loc.name}</span>
                {(loc.region || loc.country_name) && (
                  <span className="text-[10px] font-commons text-neutral-400 ml-1.5">
                    {[loc.region, loc.country_name].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-commons font-medium flex-shrink-0 ${typeColor}`}>
                {TYPE_LABELS[loc.type] || loc.type}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Submit */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2"
        >
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-commons font-medium hover:bg-emerald-700 transition-colors"
          >
            Secilenleri Kullan ({selected.size})
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default GeoLocationResults;
