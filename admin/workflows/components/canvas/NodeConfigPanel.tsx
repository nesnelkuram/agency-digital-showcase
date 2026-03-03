import React, { useState } from 'react';
import { X, Trash2, ExternalLink, Bot, Plus, Database, ArrowRight, Network } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';
import { useAgents } from '@/shared/hooks/useAgents';
import { AI_AGENT_TYPE_LABELS, AI_AGENT_TYPE_COLORS } from '@/shared/types/agent';

const nodeTypeLabels: Record<string, string> = {
  start: 'Baslangic',
  task: 'Gorev',
  ai_task: 'AI Gorev',
  review: 'Review',
  approval: 'Onay',
  milestone: 'Milestone',
  condition: 'Kosul',
  notification: 'Bildirim',
  subprocess: 'Alt Surec',
  end: 'Bitis',
};

const roleOptions = [
  { value: '', label: 'Secilmedi' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Personel' },
  { value: 'client', label: 'Musteri' },
  { value: 'freelancer', label: 'Freelancer' },
];

const recipientOptions = [
  { value: 'assignee', label: 'Atanan Kisi' },
  { value: 'project_owner', label: 'Proje Sahibi' },
  { value: 'client', label: 'Musteri' },
  { value: 'admin', label: 'Admin' },
];

const channelOptions = [
  { value: 'email', label: 'E-posta' },
  { value: 'in_app', label: 'Uygulama Ici' },
];

const operatorOptions = [
  { value: 'equals', label: 'Esittir' },
  { value: 'not_equals', label: 'Esit Degildir' },
  { value: 'greater_than', label: 'Buyuktur' },
  { value: 'less_than', label: 'Kucuktur' },
  { value: 'contains', label: 'Icerir' },
  { value: 'exists', label: 'Mevcut' },
];

const AITaskAgentSection: React.FC<{
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  onNestedChange: (configKey: string, field: string, value: any) => void;
}> = ({ data, onChange, onNestedChange }) => {
  const { agents, loading } = useAgents({ status: 'active' });

  const selectedAgentId = data.agentId as string | undefined;
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleAgentSelect = (agentId: string) => {
    if (!agentId) {
      onChange('agentId', undefined);
      onChange('agentName', undefined);
      return;
    }
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    onChange('agentId', agent.id);
    onChange('agentName', agent.name);

    // Auto-fill aiAgentConfig from agent definition
    onNestedChange('aiAgentConfig', 'agentType', agent.agentType);
    onNestedChange('aiAgentConfig', 'model', agent.model || 'flash');
    onNestedChange('aiAgentConfig', 'promptTemplate', agent.promptTemplate || '');
    onNestedChange('aiAgentConfig', 'inputMapping', agent.inputMapping || {});
    onNestedChange('aiAgentConfig', 'outputMapping', agent.outputMapping || {});
    onNestedChange('aiAgentConfig', 'maxRetries', agent.maxRetries ?? 2);
    onNestedChange('aiAgentConfig', 'timeoutMs', agent.timeoutMs ?? 60000);
    onNestedChange('aiAgentConfig', 'requiresHumanReview', agent.requiresHumanReview);
    onNestedChange('aiAgentConfig', 'confidenceThreshold', agent.confidenceThreshold ?? 0.8);
  };

  return (
    <div className="space-y-3 pt-2 border-t border-neutral-100">
      <h4 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
        <Bot className="w-3.5 h-3.5" />
        AI Ajan Ayarlari
      </h4>

      {/* Agent selector */}
      <div>
        <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
          Ajan Sec
        </label>
        {loading ? (
          <div className="text-xs font-commons text-neutral-400">Ajanlar yukleniyor...</div>
        ) : (
          <select
            value={selectedAgentId || ''}
            onChange={(e) => handleAgentSelect(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
          >
            <option value="">Manuel Yapilandirma</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Selected agent summary */}
      {selectedAgent && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full font-commons text-[10px] font-medium ${
                AI_AGENT_TYPE_COLORS[selectedAgent.agentType]
              }`}
            >
              {AI_AGENT_TYPE_LABELS[selectedAgent.agentType]}
            </span>
            <span className="font-commons text-[10px] text-neutral-500">
              {selectedAgent.model === 'pro' ? 'Gemini Pro' : 'Gemini Flash'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-commons text-[10px] text-violet-700">
              {selectedAgent.requiresHumanReview ? 'Insan incelemesi gerektirir' : 'Otomatik onay'}
            </span>
            <Link
              to={`/admin/agents/${selectedAgent.id}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-commons text-[10px] text-violet-600 hover:text-violet-800 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Ajanı Duzenle
            </Link>
          </div>
        </div>
      )}

      {/* Manual fallback: prompt template */}
      {!selectedAgentId && (
        <div>
          <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
            Prompt Sablonu
          </label>
          <textarea
            value={data.aiAgentConfig?.promptTemplate || ''}
            onChange={(e) => onNestedChange('aiAgentConfig', 'promptTemplate', e.target.value)}
            rows={3}
            className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-xs focus:outline-none focus:border-indigo-400 transition-colors resize-none"
            placeholder="{{key}} placeholder kullanin..."
          />
        </div>
      )}

      {/* requiresHumanReview toggle (always visible) */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={data.aiAgentConfig?.requiresHumanReview ?? true}
          onChange={(e) =>
            onNestedChange('aiAgentConfig', 'requiresHumanReview', e.target.checked)
          }
          className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
        />
        <span className="font-commons text-xs text-neutral-700">Insan incelemesi gerektirir</span>
      </label>
    </div>
  );
};

const IO_FIELD_TYPES = [
  { value: 'string',   label: 'Metin' },
  { value: 'number',   label: 'Sayı' },
  { value: 'url',      label: 'URL' },
  { value: 'file_url', label: 'Dosya URL' },
  { value: 'json',     label: 'JSON' },
  { value: 'boolean',  label: 'Evet/Hayır' },
];

interface IOSchemaField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  sourceNodeId?: string;
}

const IOSchemaEditor: React.FC<{
  title: string;
  icon: React.ReactNode;
  fields: IOSchemaField[];
  showRequired?: boolean;
  showSourceNode?: boolean;
  onChange: (fields: IOSchemaField[]) => void;
}> = ({ title, icon, fields, showRequired, showSourceNode, onChange }) => {
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('string');

  const addField = () => {
    if (!newKey.trim()) return;
    onChange([...fields, { key: newKey.trim(), label: newLabel.trim() || newKey.trim(), type: newType }]);
    setNewKey('');
    setNewLabel('');
    setNewType('string');
  };

  const removeField = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, patch: Partial<IOSchemaField>) => {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  return (
    <div className="space-y-2.5 pt-2 border-t border-neutral-100">
      <h4 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
      </h4>

      {fields.length > 0 && (
        <div className="space-y-1.5">
          {fields.map((f, idx) => (
            <div key={idx} className="p-2 rounded-lg bg-neutral-50 border border-neutral-200 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={f.key}
                  onChange={(e) => updateField(idx, { key: e.target.value })}
                  placeholder="context_key"
                  className="flex-1 px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400 font-mono bg-white"
                />
                <select
                  value={f.type}
                  onChange={(e) => updateField(idx, { type: e.target.value })}
                  className="px-1.5 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none bg-white"
                >
                  {IO_FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeField(idx)}
                  className="p-1 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={f.label}
                onChange={(e) => updateField(idx, { label: e.target.value })}
                placeholder="Kullanıcıya gösterilecek etiket"
                className="w-full px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400 bg-white"
              />
              {showRequired && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    onChange={(e) => updateField(idx, { required: e.target.checked })}
                    className="rounded border-neutral-300 text-indigo-600 w-3 h-3"
                  />
                  <span className="font-commons text-[10px] text-neutral-600">Zorunlu</span>
                </label>
              )}
              {showSourceNode && (
                <input
                  type="text"
                  value={f.sourceNodeId || ''}
                  onChange={(e) => updateField(idx, { sourceNodeId: e.target.value || undefined })}
                  placeholder="Kaynak adım ID (opsiyonel)"
                  className="w-full px-2 py-1 rounded border border-neutral-200 font-commons text-[10px] focus:outline-none focus:border-indigo-400 bg-white font-mono"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new field */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addField()}
          placeholder="yeni_key"
          className="flex-1 px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400 font-mono bg-white"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="px-1.5 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none bg-white"
        >
          {IO_FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={addField}
          className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="font-commons text-[10px] text-neutral-400">
        Enter tuşu veya + butonu ile ekle
      </p>
    </div>
  );
};

const NodeConfigPanel: React.FC<{ onSubprocessNavigate?: (nodeId: string) => void }> = ({ onSubprocessNavigate }) => {
  const { nodes, selectedNodeId, setSelectedNodeId, updateNodeData, removeNode } =
    useWorkflowBuilderStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div className="w-[320px] border-l border-neutral-200 bg-white p-4">
        <h3 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Ozellikler
        </h3>
        <p className="font-commons text-sm text-neutral-400">
          Bir dugum secin veya olusturun.
        </p>
      </div>
    );
  }

  const data = selectedNode.data as Record<string, any>;
  const nodeType = data.nodeType as string;

  const handleChange = (field: string, value: any) => {
    updateNodeData(selectedNode.id, { [field]: value });
  };

  const handleNestedChange = (configKey: string, field: string, value: any) => {
    const current = data[configKey] || {};
    updateNodeData(selectedNode.id, {
      [configKey]: { ...current, [field]: value },
    });
  };

  const handleCheckboxList = (configKey: string, field: string, value: string, checked: boolean) => {
    const current = data[configKey] || {};
    const list: string[] = current[field] || [];
    const updated = checked ? [...list, value] : list.filter((v: string) => v !== value);
    updateNodeData(selectedNode.id, {
      [configKey]: { ...current, [field]: updated },
    });
  };

  return (
    <div className="w-[320px] border-l border-neutral-200 bg-white overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-100">
        <div>
          <h3 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Dugum Ozellikleri
          </h3>
          <span className="font-commons text-[10px] text-neutral-400">
            {nodeTypeLabels[nodeType] || nodeType}
          </span>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded hover:bg-neutral-100 text-neutral-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
            Etiket
          </label>
          <input
            type="text"
            value={(data.label as string) || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            placeholder="Dugum etiketi"
          />
        </div>

        {/* Description */}
        <div>
          <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
            Aciklama
          </label>
          <textarea
            value={(data.description as string) || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors resize-none"
            placeholder="Dugum aciklamasi"
          />
        </div>

        {/* Subprocess Config */}
        {nodeType === 'subprocess' && (
          <div className="space-y-3 pt-2 border-t border-neutral-100">
            <h4 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Alt Surec Ayarlari
            </h4>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Alt Sablon ID
              </label>
              <input
                type="text"
                value={data.subprocessConfig?.childTemplateId || ''}
                onChange={(e) => handleNestedChange('subprocessConfig', 'childTemplateId', e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                placeholder="Firestore template ID"
              />
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Alt Sablon Adi
              </label>
              <input
                type="text"
                value={data.subprocessConfig?.childTemplateName || ''}
                onChange={(e) => handleNestedChange('subprocessConfig', 'childTemplateName', e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                placeholder="Alt sablon adi"
              />
            </div>
            <button
              onClick={() => onSubprocessNavigate?.(selectedNode.id)}
              className={`flex items-center gap-1.5 w-full px-3 py-2 rounded-lg font-commons text-xs font-medium transition-colors ${
                data.subprocessConfig?.childTemplateId
                  ? 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200'
                  : 'text-white bg-cyan-600 hover:bg-cyan-700'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              {data.subprocessConfig?.childTemplateId ? 'Alt Workflow\'u Ac' : 'Alt Surec Olustur'}
            </button>
          </div>
        )}

        {/* Assignee Role - not for start/end/subprocess */}
        {nodeType !== 'start' && nodeType !== 'end' && nodeType !== 'subprocess' && (
          <div>
            <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
              Atanan Rol
            </label>
            <select
              value={(data.assigneeRole as string) || ''}
              onChange={(e) => handleChange('assigneeRole', e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Estimated Duration - not for start/end/subprocess */}
        {nodeType !== 'start' && nodeType !== 'end' && nodeType !== 'subprocess' && (
          <div>
            <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
              Tahmini Sure (saat)
            </label>
            <input
              type="number"
              min={0}
              value={(data.estimatedDurationHours as number) || 0}
              onChange={(e) => handleChange('estimatedDurationHours', Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            />
          </div>
        )}

        {/* Review Config */}
        {nodeType === 'review' && (
          <div className="space-y-3 pt-2 border-t border-neutral-100">
            <h4 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Review Ayarlari
            </h4>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Reviewer Rolu
              </label>
              <select
                value={data.reviewConfig?.reviewerRole || 'admin'}
                onChange={(e) => handleNestedChange('reviewConfig', 'reviewerRole', e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
              >
                {roleOptions.filter((o) => o.value).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Maks. Red Sayisi
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={data.reviewConfig?.maxRejections || 3}
                onChange={(e) =>
                  handleNestedChange('reviewConfig', 'maxRejections', Number(e.target.value))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Condition Config */}
        {nodeType === 'condition' && (
          <div className="space-y-3 pt-2 border-t border-neutral-100">
            <h4 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Kosul Ayarlari
            </h4>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Alan
              </label>
              <input
                type="text"
                value={data.conditionConfig?.field || ''}
                onChange={(e) => handleNestedChange('conditionConfig', 'field', e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                placeholder="ornek: status"
              />
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Operator
              </label>
              <select
                value={data.conditionConfig?.operator || 'equals'}
                onChange={(e) => handleNestedChange('conditionConfig', 'operator', e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
              >
                {operatorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Deger
              </label>
              <input
                type="text"
                value={data.conditionConfig?.value || ''}
                onChange={(e) => handleNestedChange('conditionConfig', 'value', e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                placeholder="Karsilastirilacak deger"
              />
            </div>
          </div>
        )}

        {/* Notification Config */}
        {nodeType === 'notification' && (
          <div className="space-y-3 pt-2 border-t border-neutral-100">
            <h4 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Bildirim Ayarlari
            </h4>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1.5 block">
                Alicilar
              </label>
              <div className="space-y-1.5">
                {recipientOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(data.notificationConfig?.recipients || []).includes(opt.value)}
                      onChange={(e) =>
                        handleCheckboxList(
                          'notificationConfig',
                          'recipients',
                          opt.value,
                          e.target.checked
                        )
                      }
                      className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span className="font-commons text-xs text-neutral-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1.5 block">
                Kanal
              </label>
              <div className="space-y-1.5">
                {channelOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(data.notificationConfig?.channel || []).includes(opt.value)}
                      onChange={(e) =>
                        handleCheckboxList(
                          'notificationConfig',
                          'channel',
                          opt.value,
                          e.target.checked
                        )
                      }
                      className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span className="font-commons text-xs text-neutral-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Task Agent Config */}
        {nodeType === 'ai_task' && (
          <AITaskAgentSection
            data={data}
            onChange={handleChange}
            onNestedChange={handleNestedChange}
          />
        )}

        {/* IO Schema — for task and ai_task nodes */}
        {(nodeType === 'task' || nodeType === 'ai_task') && (
          <>
            <IOSchemaEditor
              title="Gelen Veriler (Input)"
              icon={<Database className="w-3.5 h-3.5" />}
              fields={(data.inputSchema as IOSchemaField[]) || []}
              showRequired
              showSourceNode
              onChange={(fields) => handleChange('inputSchema', fields.length > 0 ? fields : undefined)}
            />
            <IOSchemaEditor
              title="Çıkan Veriler (Output)"
              icon={<ArrowRight className="w-3.5 h-3.5" />}
              fields={(data.outputSchema as IOSchemaField[]) || []}
              onChange={(fields) => handleChange('outputSchema', fields.length > 0 ? fields : undefined)}
            />
          </>
        )}

        {/* Delete Node */}
        <div className="pt-3 border-t border-neutral-100">
          <button
            onClick={() => {
              removeNode(selectedNode.id);
            }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-commons text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Dugumu Sil
          </button>
        </div>
      </div>
    </div>
  );
};

export default NodeConfigPanel;
