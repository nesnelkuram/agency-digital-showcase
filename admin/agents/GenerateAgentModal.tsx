import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Globe, Bot, Loader2, AlertCircle, X } from 'lucide-react';
import { authenticatedFetch } from '@/lib/firebase/apiClient';

type Stage = 'idle' | 'researching' | 'generating' | 'error';

interface Props {
  onClose: () => void;
}

const GenerateAgentModal: React.FC<Props> = ({ onClose }) => {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isLoading = stage === 'researching' || stage === 'generating';

  const handleGenerate = async () => {
    if (description.trim().length < 10) {
      setErrorMsg('Açıklama en az 10 karakter olmalıdır.');
      return;
    }
    setErrorMsg('');
    setStage('researching');

    try {
      // Briefly show "researching" then transition to "generating" when fetch resolves
      const res = await authenticatedFetch('/api/agents/generate-agent', {
        method: 'POST',
        body: JSON.stringify({ description }),
      });

      setStage('generating');

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Hata: ${res.status}`);
      }

      const data = await res.json();
      navigate('/admin/agents/new', { state: { prePopulated: data.agent } });
    } catch (err: any) {
      setErrorMsg(err.message || 'Beklenmeyen bir hata oluştu.');
      setStage('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg font-commons">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-600" />
            </div>
            <h2 className="font-grotesk font-semibold text-[#171717]">AI ile Agent Oluştur</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-neutral-500">
            Ne yapmasını istediğinizi Türkçe açıklayın. AI, internet araştırması yaparak sizin için
            optimize edilmiş bir agent konfigürasyonu oluşturacak.
          </p>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Agent Açıklaması
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Örnek: Müşteri geri bildirimlerini analiz edip duygu skoru ve aksiyon önerileri çıkaran bir agent"
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:border-violet-400 transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              En az 10 karakter · Enter ile oluştur
            </p>
          </div>

          {/* Stage indicators */}
          {stage !== 'idle' && stage !== 'error' && (
            <div className="space-y-2">
              {/* Step 1: Researching */}
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  stage === 'researching'
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-green-200 bg-green-50'
                }`}
              >
                {stage === 'researching' ? (
                  <Loader2 className="w-4 h-4 text-violet-600 animate-spin shrink-0" />
                ) : (
                  <Globe className="w-4 h-4 text-green-600 shrink-0" />
                )}
                <div>
                  <p
                    className={`text-xs font-medium ${
                      stage === 'researching' ? 'text-violet-700' : 'text-green-700'
                    }`}
                  >
                    {stage === 'researching' ? 'İnternette araştırılıyor...' : 'Araştırma tamamlandı'}
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    En iyi prompt mühendisliği pratikleri
                  </p>
                </div>
              </div>

              {/* Step 2: Generating */}
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  stage === 'generating'
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-neutral-100 bg-neutral-50 opacity-50'
                }`}
              >
                {stage === 'generating' ? (
                  <Loader2 className="w-4 h-4 text-violet-600 animate-spin shrink-0" />
                ) : (
                  <Bot className="w-4 h-4 text-neutral-400 shrink-0" />
                )}
                <div>
                  <p
                    className={`text-xs font-medium ${
                      stage === 'generating' ? 'text-violet-700' : 'text-neutral-400'
                    }`}
                  >
                    Agent oluşturuluyor...
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    Konfigürasyon sentezleniyor
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {stage === 'error' && errorMsg && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* Inline validation error */}
          {stage === 'idle' && errorMsg && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-100">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            İptal
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || description.trim().length < 10}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isLoading ? 'Oluşturuluyor...' : 'Agent Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateAgentModal;
