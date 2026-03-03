import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Send } from 'lucide-react';
import type { StrategyQuestionnaireData } from '@/shared/types/marketing';

interface StrategyQuestionnaireProps {
  data: StrategyQuestionnaireData;
  onSendMessage: (text: string) => void;
}

const StrategyQuestionnaire: React.FC<StrategyQuestionnaireProps> = ({ data, onSendMessage }) => {
  const [selectedSingle, setSelectedSingle] = useState<string | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [textValue, setTextValue] = useState('');
  const [sentValue, setSentValue] = useState<string | null>(null);

  const handleSingleSelect = (optionId: string, optionLabel: string) => {
    setSelectedSingle(optionId);
    const message = `${data.step}: ${optionLabel}`;
    setSentValue(optionLabel);
    onSendMessage(message);
  };

  const handleMultiSubmit = () => {
    if (selectedMulti.length === 0) return;
    const labels = (data.options || [])
      .filter((o) => selectedMulti.includes(o.id))
      .map((o) => o.label);
    const message = `${data.step}: ${labels.join(', ')}`;
    setSentValue(labels.join(', '));
    onSendMessage(message);
  };

  const toggleMulti = (optionId: string) => {
    setSelectedMulti((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    );
  };

  const handleCombinedSubmit = () => {
    const parts = (data.fields || []).map((f) => `${f.id}=${fieldValues[f.id] || ''}`);
    const message = `${data.step}: ${parts.join(', ')}`;
    setSentValue(parts.join(', '));
    onSendMessage(message);
  };

  const handleSimpleSubmit = () => {
    if (!textValue.trim()) return;
    const message = `${data.step}: ${textValue.trim()}`;
    setSentValue(textValue.trim());
    onSendMessage(message);
  };

  const updateField = (fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const renderOptionCard = (
    option: NonNullable<StrategyQuestionnaireData['options']>[number],
    isSelected: boolean,
    onClick: () => void,
    index: number
  ) => {
    const selectedClass = isSelected
      ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
      : 'border-neutral-200 hover:border-indigo-300 hover:shadow-sm';

    return (
      <motion.button
        key={option.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        onClick={onClick}
        className={`relative p-3 rounded-xl border cursor-pointer transition-all text-left ${selectedClass}`}
      >
        {option.recommended && (
          <span className="absolute -top-2 right-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-commons font-medium bg-indigo-100 text-indigo-700">
            Önerilen
          </span>
        )}
        {isSelected && (
          <span className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600">
            <Check className="w-3 h-3 text-white" />
          </span>
        )}
        <div className="flex items-start gap-2">
          {option.icon && <span className="text-base leading-none mt-0.5">{option.icon}</span>}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-commons font-semibold text-[#171717]">{option.label}</p>
            {option.description && (
              <p className="text-xs font-commons text-neutral-500 mt-0.5">{option.description}</p>
            )}
          </div>
        </div>
      </motion.button>
    );
  };

  const renderSingleSelect = () => (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {(data.options || []).map((option, i) =>
        renderOptionCard(option, selectedSingle === option.id, () => handleSingleSelect(option.id, option.label), i)
      )}
    </div>
  );

  const renderMultiSelect = () => (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(data.options || []).map((option, i) =>
          renderOptionCard(option, selectedMulti.includes(option.id), () => toggleMulti(option.id), i)
        )}
      </div>
      <div className="flex items-center justify-between pt-1">
        {selectedMulti.length > 0 && (
          <span className="text-xs font-commons text-neutral-500">
            {selectedMulti.length} seçildi
          </span>
        )}
        <button
          onClick={handleMultiSubmit}
          disabled={selectedMulti.length === 0}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-commons text-sm hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
        >
          Devam Et
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const renderCombined = () => (
    <div className="mt-2 space-y-3">
      {(data.fields || []).map((field) => (
        <div key={field.id}>
          <label className="block text-xs font-commons font-medium text-neutral-600 mb-1">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              placeholder={field.placeholder}
              value={fieldValues[field.id] || ''}
              onChange={(e) => updateField(field.id, e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm font-commons text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 resize-none"
              rows={3}
            />
          ) : field.type === 'select' ? (
            <select
              value={fieldValues[field.id] || ''}
              onChange={(e) => updateField(field.id, e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm font-commons text-[#171717] focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 bg-white"
            >
              <option value="">{field.placeholder || 'Seçiniz...'}</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              placeholder={field.placeholder}
              value={fieldValues[field.id] || ''}
              onChange={(e) => updateField(field.id, e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm font-commons text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
            />
          )}
        </div>
      ))}
      <div className="flex items-center justify-end pt-1">
        <button
          onClick={handleCombinedSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-commons text-sm hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
        >
          Gönder
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const renderSimpleInput = () => {
    const isNumber = data.inputType === 'number_input';
    return (
      <div className="mt-2 flex items-center gap-2">
        <input
          type={isNumber ? 'number' : 'text'}
          placeholder={data.description || (isNumber ? 'Bir sayı girin...' : 'Yanıtınızı yazın...')}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSimpleSubmit();
          }}
          className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm font-commons text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
        />
        <button
          onClick={handleSimpleSubmit}
          disabled={!textValue.trim()}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderContent = () => {
    switch (data.inputType) {
      case 'single_select':
        return renderSingleSelect();
      case 'multi_select':
        return renderMultiSelect();
      case 'combined':
        return renderCombined();
      case 'text_input':
      case 'number_input':
        return renderSimpleInput();
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2"
    >
      <h4 className="font-grotesk text-sm font-semibold text-[#171717]">{data.question}</h4>
      {data.description && data.inputType !== 'text_input' && data.inputType !== 'number_input' && (
        <p className="text-xs font-commons text-neutral-500 mt-0.5">{data.description}</p>
      )}

      {renderContent()}

      {sentValue && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-commons text-indigo-700"
        >
          <Check className="w-3 h-3" />
          {sentValue}
        </motion.div>
      )}
    </motion.div>
  );
};

export default StrategyQuestionnaire;
