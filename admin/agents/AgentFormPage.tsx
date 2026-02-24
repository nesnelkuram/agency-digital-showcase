import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Plus, Trash2, ChevronLeft, Info, Sparkles } from 'lucide-react';
import { useAgent, useAgents } from '@/shared/hooks/useAgents';
import { useAuth } from '@/contexts/AuthContext';
import type { AIAgent, AIAgentType, AIAgentStatus } from '@/shared/types/agent';

type Pair = { key: string; value: string };

function pairsToRecord(pairs: Pair[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (key.trim()) result[key.trim()] = value;
  }
  return result;
}

function recordToPairs(record?: Record<string, string>): Pair[] {
  if (!record) return [{ key: '', value: '' }];
  const pairs = Object.entries(record).map(([key, value]) => ({ key, value }));
  return pairs.length > 0 ? pairs : [{ key: '', value: '' }];
}

const KeyValueEditor: React.FC<{
  pairs: Pair[];
  onChange: (pairs: Pair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}> = ({ pairs, onChange, keyPlaceholder = 'Anahtar', valuePlaceholder = 'Deger' }) => {
  const updatePair = (index: number, field: 'key' | 'value', val: string) => {
    const updated = pairs.map((p, i) => (i === index ? { ...p, [field]: val } : p));
    onChange(updated);
  };

  const addPair = () => onChange([...pairs, { key: '', value: '' }]);

  const removePair = (index: number) => {
    const updated = pairs.filter((_, i) => i !== index);
    onChange(updated.length > 0 ? updated : [{ key: '', value: '' }]);
  };

  return (
    <div className="space-y-2">
      {pairs.map((pair, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={pair.key}
            onChange={(e) => updatePair(i, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-xs focus:outline-none focus:border-indigo-400 transition-colors"
          />
          <input
            type="text"
            value={pair.value}
            onChange={(e) => updatePair(i, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-xs focus:outline-none focus:border-indigo-400 transition-colors"
          />
          <button
            onClick={() => removePair(i)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={addPair}
        className="flex items-center gap-1.5 text-xs font-commons text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Satir Ekle
      </button>
    </div>
  );
};

const SECTION = 'pt-4 border-t border-neutral-100 space-y-3';
const LABEL = 'font-commons text-xs font-medium text-neutral-600 mb-1 block';
const INPUT =
  'w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors';

const AgentFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const prePopulated = (location.state as any)?.prePopulated;
  const { user } = useAuth();
  const { agent, loading: loadingAgent } = useAgent(id);
  const { createAgent, updateAgent } = useAgents();

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentType, setAgentType] = useState<AIAgentType>('gemini_task');
  const [status, setStatus] = useState<AIAgentStatus>('draft');

  // Gemini fields
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState<'flash' | 'pro'>('flash');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [inputPairs, setInputPairs] = useState<Pair[]>([{ key: '', value: '' }]);
  const [outputPairs, setOutputPairs] = useState<Pair[]>([{ key: '', value: '' }]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);
  const [maxRetries, setMaxRetries] = useState(2);
  const [timeoutMs, setTimeoutMs] = useState(60000);
  const [requiresHumanReview, setRequiresHumanReview] = useState(false);

  // Canva fields
  const [brandTemplateId, setBrandTemplateId] = useState('');
  const [exportFormat, setExportFormat] = useState<'PNG' | 'PDF' | 'JPG'>('PNG');
  const [autofillPairs, setAutofillPairs] = useState<Pair[]>([{ key: '', value: '' }]);

  // Load existing agent for edit mode
  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description);
      setAgentType(agent.agentType);
      setStatus(agent.status);
      setSystemPrompt(agent.systemPrompt || '');
      setModel(agent.model || 'flash');
      setPromptTemplate(agent.promptTemplate || '');
      setInputPairs(recordToPairs(agent.inputMapping));
      setOutputPairs(recordToPairs(agent.outputMapping));
      setConfidenceThreshold(agent.confidenceThreshold ?? 0.8);
      setMaxRetries(agent.maxRetries ?? 2);
      setTimeoutMs(agent.timeoutMs ?? 60000);
      setRequiresHumanReview(agent.requiresHumanReview);
      if (agent.canvaConfig) {
        setBrandTemplateId(agent.canvaConfig.brandTemplateId);
        setExportFormat(agent.canvaConfig.exportFormat);
        setAutofillPairs(recordToPairs(agent.canvaConfig.autofillMapping));
      }
    }
  }, [agent]);

  // Pre-populate from AI generation (navigate state)
  useEffect(() => {
    if (!prePopulated || isEdit) return;
    if (prePopulated.name) setName(prePopulated.name);
    if (prePopulated.description) setDescription(prePopulated.description);
    if (prePopulated.agentType) setAgentType(prePopulated.agentType);
    if (prePopulated.systemPrompt) setSystemPrompt(prePopulated.systemPrompt);
    if (prePopulated.model) setModel(prePopulated.model);
    if (prePopulated.promptTemplate) setPromptTemplate(prePopulated.promptTemplate);
    if (prePopulated.inputMapping) setInputPairs(recordToPairs(prePopulated.inputMapping));
    if (prePopulated.outputMapping) setOutputPairs(recordToPairs(prePopulated.outputMapping));
    if (prePopulated.confidenceThreshold !== undefined) setConfidenceThreshold(prePopulated.confidenceThreshold);
    if (prePopulated.maxRetries !== undefined) setMaxRetries(prePopulated.maxRetries);
    if (prePopulated.timeoutMs !== undefined) setTimeoutMs(prePopulated.timeoutMs);
    if (prePopulated.requiresHumanReview !== undefined) setRequiresHumanReview(prePopulated.requiresHumanReview);
  }, [prePopulated, isEdit]);

  const isGemini = agentType === 'gemini_task' || agentType === 'gemini_vision';
  const isCanva = agentType === 'canva_autofill';

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Ajan adi zorunludur.');
      return;
    }

    setSaving(true);
    try {
      const data: Omit<AIAgent, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        description: description.trim(),
        agentType,
        status,
        requiresHumanReview,
        createdBy: user?.uid || '',
        createdByName: user?.displayName || user?.email || '',
        ...(isGemini && {
          systemPrompt: systemPrompt.trim() || undefined,
          model,
          promptTemplate: promptTemplate.trim() || undefined,
          inputMapping: pairsToRecord(inputPairs),
          outputMapping: pairsToRecord(outputPairs),
          confidenceThreshold,
          maxRetries,
          timeoutMs,
        }),
        ...(isCanva && {
          canvaConfig: {
            brandTemplateId: brandTemplateId.trim(),
            exportFormat,
            autofillMapping: pairsToRecord(autofillPairs),
          },
        }),
      };

      if (isEdit && id) {
        await updateAgent(id, data);
      } else {
        await createAgent(data);
      }

      navigate('/admin/agents');
    } catch (err) {
      console.error('Error saving agent:', err);
      alert('Kaydetme sirasinda bir hata olustu.');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingAgent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/agents')}
          className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-grotesk font-bold text-[#1a1a2e] flex items-center gap-2">
            <Bot className="w-6 h-6 text-violet-600" />
            {isEdit ? 'Ajan Duzenle' : 'Yeni Ajan'}
          </h1>
          <p className="font-commons text-neutral-500 text-sm mt-0.5">
            {isEdit ? 'Mevcut ajan konfigurasyonunu guncelleyin.' : 'Yeni bir AI ajan tanimlayin.'}
          </p>
        </div>
      </div>

      {prePopulated && !isEdit && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-violet-200 bg-violet-50">
          <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
          <p className="font-commons text-sm text-violet-700">
            Bu alan yapay zeka tarafından oluşturuldu. Kaydetmeden önce lütfen inceleyin.
          </p>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5"
      >
        {/* Section 1: Basics */}
        <div className="space-y-4">
          <h3 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Temel Bilgiler
          </h3>

          <div>
            <label className={LABEL}>Ajan Adi *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ornek: Sosyal Medya Icerik Olusturucu"
              className={INPUT}
            />
          </div>

          <div>
            <label className={LABEL}>Aciklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu ajanin ne yaptigini kisaca aciklayin"
              rows={2}
              className={`${INPUT} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Ajan Tipi</label>
              <select
                value={agentType}
                onChange={(e) => setAgentType(e.target.value as AIAgentType)}
                className={INPUT}
              >
                <option value="gemini_task">Gemini Gorev</option>
                <option value="gemini_vision">Gemini Vision</option>
                <option value="canva_autofill">Canva Otomatik Doldur</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AIAgentStatus)}
                className={INPUT}
              >
                <option value="draft">Taslak</option>
                <option value="active">Aktif</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Gemini config */}
        {isGemini && (
          <div className={SECTION}>
            <h3 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Gemini Ayarlari
            </h3>

            <div>
              <label className={LABEL}>
                Sistem Promptu
                <span className="ml-1 text-neutral-400 font-normal">(Ajan karakteri/rolu)</span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Sen bir sosyal medya uzmanisin. Her zaman ..."
                rows={3}
                className={`${INPUT} resize-none`}
              />
            </div>

            <div>
              <label className={LABEL}>Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as 'flash' | 'pro')}
                className={INPUT}
              >
                <option value="flash">Gemini Flash (Hizli)</option>
                <option value="pro">Gemini Pro (Guclu)</option>
              </select>
            </div>

            <div>
              <label className={LABEL}>
                Prompt Sablonu
                <span className="ml-1 text-neutral-400 font-normal">
                  — {'{{key}}'} placeholder kullanin
                </span>
              </label>
              <textarea
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                placeholder="{{clientName}} icin {{platform}} platformuna gore icerik olustur..."
                rows={5}
                className={`${INPUT} resize-none font-mono text-xs`}
              />
            </div>

            <div>
              <label className={LABEL}>Input Eslestirmesi</label>
              <p className="font-commons text-[10px] text-neutral-400 mb-2">
                Workflow context anahtari → Prompt placeholder
              </p>
              <KeyValueEditor
                pairs={inputPairs}
                onChange={setInputPairs}
                keyPlaceholder="Prompt anahtari"
                valuePlaceholder="Context anahtari"
              />
            </div>

            <div>
              <label className={LABEL}>Output Eslestirmesi</label>
              <p className="font-commons text-[10px] text-neutral-400 mb-2">
                Beklenen JSON cikti alanlari
              </p>
              <KeyValueEditor
                pairs={outputPairs}
                onChange={setOutputPairs}
                keyPlaceholder="Cikti alani"
                valuePlaceholder="Context anahtari"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Guven Esigi</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Maks. Deneme</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Number(e.target.value))}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Zaman Asimi (ms)</label>
                <input
                  type="number"
                  min={5000}
                  step={5000}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className={INPUT}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresHumanReview}
                onChange={(e) => setRequiresHumanReview(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-commons text-sm text-neutral-700">
                Insan incelemesi gerektirir
              </span>
            </label>
          </div>
        )}

        {/* Section 3: Canva config */}
        {isCanva && (
          <div className={SECTION}>
            <h3 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Canva Ayarlari
            </h3>

            {/* Faz 2b banner */}
            <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2.5">
              <Info className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
              <p className="font-commons text-xs text-purple-700">
                Canva OAuth entegrasyonu Faz 2b'de etkinlestirilecek. Simdilik ajan tanimini
                kaydedebilirsiniz.
              </p>
            </div>

            <div>
              <label className={LABEL}>Brand Template ID</label>
              <input
                type="text"
                value={brandTemplateId}
                onChange={(e) => setBrandTemplateId(e.target.value)}
                placeholder="Canva brand template ID"
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Export Formati</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'PNG' | 'PDF' | 'JPG')}
                className={INPUT}
              >
                <option value="PNG">PNG</option>
                <option value="JPG">JPG</option>
                <option value="PDF">PDF</option>
              </select>
            </div>

            <div>
              <label className={LABEL}>Autofill Eslestirmesi</label>
              <p className="font-commons text-[10px] text-neutral-400 mb-2">
                Workflow context anahtari → Canva field adi
              </p>
              <KeyValueEditor
                pairs={autofillPairs}
                onChange={setAutofillPairs}
                keyPlaceholder="Context anahtari"
                valuePlaceholder="Canva field"
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          onClick={() => navigate('/admin/agents')}
          className="px-4 py-2 rounded-xl border border-neutral-200 font-commons text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Iptal
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-[#171717] text-white font-commons text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Kaydediliyor...' : isEdit ? 'Guncelle' : 'Olustur'}
        </button>
      </div>
    </div>
  );
};

export default AgentFormPage;
