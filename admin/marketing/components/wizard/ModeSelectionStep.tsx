import React from 'react';
import { ClipboardList, Sparkles } from 'lucide-react';

interface ModeSelectionStepProps {
  selectedMode: 'manual' | 'ai' | null;
  onSelectMode: (mode: 'manual' | 'ai') => void;
}

export function ModeSelectionStep({
  selectedMode,
  onSelectMode,
}: ModeSelectionStepProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-commons font-bold text-[#171717] mb-2">
          Kampanya Oluşturma Yöntemini Seçin
        </h2>
        <p className="text-sm font-commons text-neutral-600">
          Kampanyanızı manuel olarak oluşturabilir veya AI desteği ile hızlıca başlayabilirsiniz
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manual Mode Card */}
        <button
          onClick={() => onSelectMode('manual')}
          className={`
            p-6 rounded-xl border-2 transition-all text-left
            ${
              selectedMode === 'manual'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-neutral-200 bg-white hover:border-neutral-300'
            }
          `}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`
                w-16 h-16 rounded-full flex items-center justify-center mb-4
                ${
                  selectedMode === 'manual'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                }
              `}
            >
              <ClipboardList className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-commons font-semibold text-[#171717] mb-2">
              Manuel Oluşturma
            </h3>

            <p className="text-sm font-commons text-neutral-600">
              Tüm alanları kendiniz doldurun. Hedefleme, bütçe ve reklamları adım adım yapılandırın.
            </p>
          </div>
        </button>

        {/* AI Mode Card */}
        <button
          onClick={() => onSelectMode('ai')}
          className={`
            p-6 rounded-xl border-2 transition-all text-left
            ${
              selectedMode === 'ai'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-neutral-200 bg-white hover:border-neutral-300'
            }
          `}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`
                w-16 h-16 rounded-full flex items-center justify-center mb-4
                ${
                  selectedMode === 'ai'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                }
              `}
            >
              <Sparkles className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-commons font-semibold text-[#171717] mb-2">
              AI Destekli
            </h3>

            <p className="text-sm font-commons text-neutral-600">
              Kısaca kampanya amacını anlatın, AI tüm detayları otomatik oluştursun. Sonra düzenleyin.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
