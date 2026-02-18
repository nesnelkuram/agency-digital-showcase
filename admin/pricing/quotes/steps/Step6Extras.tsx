import React from 'react';
import { Car, Hotel, Music, MoreHorizontal } from 'lucide-react';
import { ExtrasData } from '@/shared/types/pricing';

interface Step6ExtrasProps {
  extras: ExtrasData;
  onChange: (extras: ExtrasData) => void;
  formatCurrency: (amount: number) => string;
}

const Step6Extras: React.FC<Step6ExtrasProps> = ({
  extras,
  onChange,
  formatCurrency,
}) => {
  const handleChange = (field: keyof ExtrasData, value: number | string) => {
    if (field === 'otherDescription') {
      onChange({ ...extras, [field]: value as string });
    } else {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      onChange({ ...extras, [field]: numValue });
    }
  };

  const total = extras.travel + extras.accommodation + extras.stock + extras.other;

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="font-grotesk text-2xl font-bold text-[#171717] mb-2">
          Ek Masraflar
        </h2>
        <p className="font-grotesk text-neutral-500">
          Yol, konaklama ve diger harcamalari ekleyin
        </p>
      </div>

      <div className="space-y-4">
        {/* Travel */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-grotesk font-medium text-[#171717]">Yol / Ulasim</h3>
              <p className="font-grotesk text-xs text-neutral-500">Arac, yakıt, taksi vb.</p>
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              value={extras.travel || ''}
              onChange={(e) => handleChange('travel', e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 pr-12 bg-neutral-50 border border-neutral-200 rounded-lg font-grotesk text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-grotesk text-sm">
              TL
            </span>
          </div>
        </div>

        {/* Accommodation */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Hotel className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-grotesk font-medium text-[#171717]">Konaklama</h3>
              <p className="font-grotesk text-xs text-neutral-500">Otel, apart vb.</p>
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              value={extras.accommodation || ''}
              onChange={(e) => handleChange('accommodation', e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 pr-12 bg-neutral-50 border border-neutral-200 rounded-lg font-grotesk text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-grotesk text-sm">
              TL
            </span>
          </div>
        </div>

        {/* Stock (Music, Video, Images) */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Music className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-grotesk font-medium text-[#171717]">Stok Materyal</h3>
              <p className="font-grotesk text-xs text-neutral-500">Muzik, video, gorsel lisansi</p>
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              value={extras.stock || ''}
              onChange={(e) => handleChange('stock', e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 pr-12 bg-neutral-50 border border-neutral-200 rounded-lg font-grotesk text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-grotesk text-sm">
              TL
            </span>
          </div>
        </div>

        {/* Other */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <MoreHorizontal className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-grotesk font-medium text-[#171717]">Diger</h3>
              <p className="font-grotesk text-xs text-neutral-500">Kategorize edilemeyen masraflar</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <input
                type="number"
                value={extras.other || ''}
                onChange={(e) => handleChange('other', e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 pr-12 bg-neutral-50 border border-neutral-200 rounded-lg font-grotesk text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-grotesk text-sm">
                TL
              </span>
            </div>
            {extras.other > 0 && (
              <input
                type="text"
                value={extras.otherDescription || ''}
                onChange={(e) => handleChange('otherDescription', e.target.value)}
                placeholder="Aciklama (opsiyonel)"
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg font-grotesk text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
              />
            )}
          </div>
        </div>
      </div>

      {/* Total */}
      {total > 0 && (
        <div className="mt-6 p-4 bg-neutral-100 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="font-grotesk text-neutral-600">Toplam Ek Masraf:</span>
            <span className="font-grotesk text-xl font-bold text-[#171717]">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      )}

      {/* Helper */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl">
        <p className="font-grotesk text-sm text-blue-700">
          <strong>Not:</strong> Bu masraflar dogrudan maliyete eklenir ve kar marjindan etkilenmez.
          Musteriye birebir yansitilacaktir.
        </p>
      </div>
    </div>
  );
};

export default Step6Extras;
