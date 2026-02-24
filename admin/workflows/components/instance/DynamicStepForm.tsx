import React, { useState } from 'react';
import { Loader2, CheckCircle, Upload, Star } from 'lucide-react';
import type { WorkflowNodeTemplate } from '@/shared/types/workflow/template';
import { completeStep } from '@/shared/services/workflowEngineService';
import { useTenantId } from '@/shared/hooks/useTenant';

interface DynamicStepFormProps {
  instanceId: string;
  nodeId: string;
  node: WorkflowNodeTemplate;
  /** Existing form data to pre-populate (e.g. if step was previously started) */
  existingData?: Record<string, any>;
  onCompleted: () => void;
}

const DynamicStepForm: React.FC<DynamicStepFormProps> = ({
  instanceId,
  nodeId,
  node,
  existingData,
  onCompleted,
}) => {
  const tenantId = useTenantId();
  const [formData, setFormData] = useState<Record<string, any>>(existingData || {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = node.formSchema?.fields || [];

  const handleChange = (id: string, value: any) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    if (!tenantId) return;

    // Validate required fields
    const missing = fields.filter(
      (f) =>
        f.required &&
        (formData[f.id] === undefined || formData[f.id] === null || formData[f.id] === '')
    );
    if (missing.length > 0) {
      setError(`Zorunlu alanlar eksik: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await completeStep(tenantId, instanceId, nodeId, formData, undefined, formData);
      onCompleted();
    } catch (err: any) {
      setError(err.message || 'Form gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  if (fields.length === 0) return null;

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id}>
          <label className="font-commons text-xs font-medium text-neutral-700 mb-1 block">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>

          {field.type === 'text' && (
            <input
              type="text"
              value={formData[field.id] || ''}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            />
          )}

          {field.type === 'textarea' && (
            <textarea
              value={formData[field.id] || ''}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors resize-none"
            />
          )}

          {field.type === 'number' && (
            <input
              type="number"
              value={formData[field.id] ?? ''}
              onChange={(e) => handleChange(field.id, Number(e.target.value))}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            />
          )}

          {field.type === 'select' && (
            <select
              value={formData[field.id] || ''}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            >
              <option value="">Seçiniz...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {field.type === 'date' && (
            <input
              type="date"
              value={formData[field.id] || ''}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            />
          )}

          {field.type === 'checkbox' && (
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={!!formData[field.id]}
                onChange={(e) => handleChange(field.id, e.target.checked)}
                className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className="font-commons text-sm text-neutral-700">Evet</span>
            </label>
          )}

          {field.type === 'rating' && (
            <div className="flex gap-1.5 mt-1">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleChange(field.id, r)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-commons text-sm font-semibold transition-colors ${
                    formData[field.id] >= r
                      ? 'bg-indigo-600 text-white'
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  }`}
                >
                  <Star
                    className="w-4 h-4"
                    fill={formData[field.id] >= r ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
              {formData[field.id] > 0 && (
                <span className="ml-1 font-commons text-xs text-neutral-500 self-center">
                  {formData[field.id]}/5
                </span>
              )}
            </div>
          )}

          {field.type === 'file_upload' && (
            <div className="flex items-center gap-2 p-3 border border-dashed border-neutral-300 rounded-lg bg-neutral-50">
              <Upload className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <input
                type="url"
                value={formData[field.id] || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="flex-1 bg-transparent font-commons text-xs text-neutral-700 focus:outline-none"
                placeholder="Dosya URL'si (örn: https://drive.google.com/...)"
              />
            </div>
          )}
        </div>
      ))}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-commons text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-commons text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4" />
        )}
        Adımı Tamamla
      </button>
    </div>
  );
};

export default DynamicStepForm;
