import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';

const nodeTypeLabels: Record<string, string> = {
  start: 'Baslangic',
  task: 'Gorev',
  ai_task: 'AI Gorev',
  review: 'Review',
  approval: 'Onay',
  milestone: 'Milestone',
  condition: 'Kosul',
  notification: 'Bildirim',
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

const NodeConfigPanel: React.FC = () => {
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

        {/* Assignee Role - not for start/end */}
        {nodeType !== 'start' && nodeType !== 'end' && (
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

        {/* Estimated Duration - not for start/end */}
        {nodeType !== 'start' && nodeType !== 'end' && (
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
