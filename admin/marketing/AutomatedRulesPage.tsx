import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Zap,
  Play,
  Pause,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  X,
  ListFilter,
} from 'lucide-react';
import type {
  AutomationRule,
  RuleCondition,
  RuleAction,
  RuleMetric,
  RuleOperator,
  RuleActionType,
  RuleStatus,
  RuleFrequency,
  RuleExecutionLog,
  CreateAutomationRuleData,
  UpdateAutomationRuleData,
} from '@/shared/types/automationRule';
import {
  RULE_METRIC_LABELS,
  RULE_OPERATOR_LABELS,
  RULE_ACTION_LABELS,
  RULE_STATUS_LABELS,
  RULE_STATUS_COLORS,
  RULE_FREQUENCY_LABELS,
  RULE_TIME_WINDOW_LABELS,
  CONDITION_LOGIC_LABELS,
} from '@/shared/types/automationRule';
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRuleStatus,
  getRuleExecutionLogs,
} from '@/shared/services/automationRuleService';
import { getCampaigns } from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { useAuth } from '@/contexts/AuthContext';
import type { CampaignSummary } from '@/shared/types/marketing';

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

function formatCondition(condition: RuleCondition): string {
  const metric = RULE_METRIC_LABELS[condition.metric];
  const operator = RULE_OPERATOR_LABELS[condition.operator];
  const window = RULE_TIME_WINDOW_LABELS[condition.timeWindow];

  if (condition.operator === 'between') {
    return `${metric} ${condition.value} - ${condition.value2} arasinda (${window})`;
  }

  const displayValue =
    condition.metric === 'ctr' || condition.metric === 'roas'
      ? `%${condition.value}`
      : condition.metric === 'spend' || condition.metric === 'cpc' || condition.metric === 'cpa'
        ? `${condition.value.toLocaleString('tr-TR')} TL`
        : condition.value.toLocaleString('tr-TR');

  return `${metric} ${operator} ${displayValue} (${window})`;
}

function formatAction(action: RuleAction): string {
  const label = RULE_ACTION_LABELS[action.type];
  if (
    action.type === 'increase_budget' ||
    action.type === 'decrease_budget' ||
    action.type === 'change_bid'
  ) {
    return `${label} (%${action.value || 0})`;
  }
  if (action.type === 'send_alert' && action.notifyEmail) {
    return `${label} (${action.notifyEmail})`;
  }
  return label;
}

function formatTimestamp(ts: any): string {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createEmptyCondition(): RuleCondition {
  return {
    metric: 'ctr',
    operator: 'less_than',
    value: 0,
    timeWindow: 'last_7d',
  };
}

// ============================================
// KOSUL BUILDER SATIRI
// ============================================

interface ConditionRowProps {
  condition: RuleCondition;
  index: number;
  onChange: (index: number, condition: RuleCondition) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

const ConditionRow: React.FC<ConditionRowProps> = ({
  condition,
  index,
  onChange,
  onRemove,
  canRemove,
}) => {
  const updateField = (field: keyof RuleCondition, value: any) => {
    onChange(index, { ...condition, [field]: value });
  };

  return (
    <div className="flex items-start gap-2 p-3 border border-neutral-200 rounded-lg bg-neutral-50/50">
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Metrik */}
        <select
          value={condition.metric}
          onChange={(e) => updateField('metric', e.target.value as RuleMetric)}
          className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          {Object.entries(RULE_METRIC_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Operator */}
        <select
          value={condition.operator}
          onChange={(e) => updateField('operator', e.target.value as RuleOperator)}
          className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          {Object.entries(RULE_OPERATOR_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Deger */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={condition.value}
            onChange={(e) => updateField('value', Number(e.target.value))}
            placeholder="Deger"
            className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
          />
          {condition.operator === 'between' && (
            <>
              <span className="text-xs font-commons text-neutral-400">-</span>
              <input
                type="number"
                value={condition.value2 || 0}
                onChange={(e) => updateField('value2', Number(e.target.value))}
                placeholder="Deger 2"
                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
              />
            </>
          )}
        </div>

        {/* Zaman penceresi */}
        <select
          value={condition.timeWindow}
          onChange={(e) =>
            updateField('timeWindow', e.target.value as RuleCondition['timeWindow'])
          }
          className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          {Object.entries(RULE_TIME_WINDOW_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Kaldir */}
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="mt-1 p-1 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ============================================
// OLUSTUR / DUZENLE MODALI
// ============================================

interface RuleModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  campaigns: CampaignSummary[];
  projectId?: string;
  editingRule?: AutomationRule | null;
}

const RuleModal: React.FC<RuleModalProps> = ({
  open,
  onClose,
  onSaved,
  campaigns,
  projectId,
  editingRule,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [allCampaigns, setAllCampaigns] = useState(true);
  const [conditions, setConditions] = useState<RuleCondition[]>([createEmptyCondition()]);
  const [conditionLogic, setConditionLogic] = useState<'and' | 'or'>('and');
  const [actionType, setActionType] = useState<RuleActionType>('pause_adset');
  const [actionValue, setActionValue] = useState<number>(0);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [frequency, setFrequency] = useState<RuleFrequency>('daily');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!editingRule;

  // Duzenle modunda form alanlarini doldur
  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name);
      setDescription(editingRule.description || '');
      setSelectedCampaignIds(editingRule.campaignIds || []);
      setAllCampaigns(!editingRule.campaignIds?.length);
      setConditions(editingRule.conditions.length ? editingRule.conditions : [createEmptyCondition()]);
      setConditionLogic(editingRule.conditionLogic);
      setActionType(editingRule.action.type);
      setActionValue(editingRule.action.value || 0);
      setNotifyEmail(editingRule.action.notifyEmail || '');
      setFrequency(editingRule.frequency);
    } else {
      resetForm();
    }
  }, [editingRule]);

  const needsActionValue =
    actionType === 'increase_budget' ||
    actionType === 'decrease_budget' ||
    actionType === 'change_bid';

  const needsEmail = actionType === 'send_alert';

  const isValid =
    name.trim() &&
    conditions.length > 0 &&
    conditions.every((c) => c.value !== undefined);

  const addCondition = () => {
    setConditions((prev) => [...prev, createEmptyCondition()]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, condition: RuleCondition) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? condition : c)));
  };

  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!isValid || !user) return;
    setSubmitting(true);
    setError('');

    try {
      const action: RuleAction = {
        type: actionType,
        ...(needsActionValue && { value: actionValue }),
        ...(needsEmail && { notifyEmail: notifyEmail.trim() }),
      };

      if (isEditing && editingRule) {
        const updateData: UpdateAutomationRuleData = {
          name: name.trim(),
          description: description.trim() || undefined,
          campaignIds: allCampaigns ? [] : selectedCampaignIds,
          conditions,
          conditionLogic,
          action,
          frequency,
        };
        await updateRule(editingRule.id, updateData);
      } else {
        const createData: CreateAutomationRuleData = {
          projectId,
          name: name.trim(),
          description: description.trim() || undefined,
          campaignIds: allCampaigns ? [] : selectedCampaignIds,
          conditions,
          conditionLogic,
          action,
          frequency,
        };
        await createRule(createData, user.uid, user.displayName || 'Bilinmeyen');
      }

      onSaved();
      resetForm();
    } catch (err) {
      console.error('Failed to save rule:', err);
      setError('Kural kaydedilirken bir hata olustu.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedCampaignIds([]);
    setAllCampaigns(true);
    setConditions([createEmptyCondition()]);
    setConditionLogic('and');
    setActionType('pause_adset');
    setActionValue(0);
    setNotifyEmail('');
    setFrequency('daily');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-commons font-bold text-[#171717]">
            {isEditing ? 'Kurali Duzenle' : 'Yeni Otomasyon Kurali'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Kural Adi */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Kural Adi
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Orn: Dusuk CTR Otomatik Durdurma"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Aciklama */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Aciklama (Opsiyonel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Kural hakkinda kisa aciklama..."
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>

          {/* Kampanya Secimi */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Uygulanacak Kampanyalar
            </label>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allCampaigns}
                  onChange={(e) => {
                    setAllCampaigns(e.target.checked);
                    if (e.target.checked) setSelectedCampaignIds([]);
                  }}
                  className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-commons text-neutral-600">
                  Tum kampanyalar
                </span>
              </label>
            </div>
            {!allCampaigns && (
              <div className="max-h-32 overflow-y-auto border border-neutral-200 rounded-lg p-2 space-y-1">
                {campaigns.length === 0 ? (
                  <p className="text-xs font-commons text-neutral-400 px-2 py-1">
                    Henuz kampanya bulunmuyor
                  </p>
                ) : (
                  campaigns.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCampaignIds.includes(c.id)}
                        onChange={() => toggleCampaign(c.id)}
                        className="w-3.5 h-3.5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-commons text-neutral-700 truncate">
                        {c.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Kosullar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-commons font-medium text-[#171717]">
                Kosullar
              </label>
              <button
                type="button"
                onClick={addCondition}
                className="text-xs font-commons text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                + Kosul Ekle
              </button>
            </div>

            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <div className="flex justify-center">
                      <span className="px-2 py-0.5 rounded text-xs font-commons font-medium bg-indigo-50 text-indigo-600">
                        {conditionLogic === 'and' ? 'VE' : 'VEYA'}
                      </span>
                    </div>
                  )}
                  <ConditionRow
                    condition={condition}
                    index={index}
                    onChange={updateCondition}
                    onRemove={removeCondition}
                    canRemove={conditions.length > 1}
                  />
                </React.Fragment>
              ))}
            </div>

            {/* Mantik Secimi */}
            {conditions.length > 1 && (
              <div className="mt-2">
                <select
                  value={conditionLogic}
                  onChange={(e) => setConditionLogic(e.target.value as 'and' | 'or')}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-xs focus:outline-none focus:border-indigo-400"
                >
                  {Object.entries(CONDITION_LOGIC_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Aksiyon */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Yapilacak Islem
            </label>
            <div className="space-y-2">
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as RuleActionType)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
              >
                {Object.entries(RULE_ACTION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              {needsActionValue && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-commons text-neutral-500 whitespace-nowrap">
                    Degisiklik Orani (%)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={actionValue}
                    onChange={(e) => setActionValue(Number(e.target.value))}
                    className="w-24 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 text-center"
                  />
                </div>
              )}

              {needsEmail && (
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="bildirim@ornek.com"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
                />
              )}
            </div>
          </div>

          {/* Calistirma Sikligi */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Kontrol Sikligi
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RuleFrequency)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            >
              {Object.entries(RULE_FREQUENCY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm font-commons text-red-600">{error}</p>}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Iptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-commons text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? isEditing
                ? 'Kaydediliyor...'
                : 'Olusturuluyor...'
              : isEditing
                ? 'Kaydet'
                : 'Olustur'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CALISTIRMA LOG PANELI
// ============================================

interface ExecutionLogPanelProps {
  ruleId: string;
  ruleName: string;
}

const ExecutionLogPanel: React.FC<ExecutionLogPanelProps> = ({ ruleId, ruleName }) => {
  const [logs, setLogs] = useState<RuleExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        const result = await getRuleExecutionLogs(ruleId, 20);
        setLogs(result);
      } catch (err) {
        console.error('Failed to load execution logs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [ruleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-6 text-center">
        <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-commons text-neutral-400">
          Henuz calistirma logu bulunmuyor
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="px-3 py-2 text-xs font-commons font-semibold text-neutral-500 uppercase">
              Zaman
            </th>
            <th className="px-3 py-2 text-xs font-commons font-semibold text-neutral-500 uppercase">
              Kampanya
            </th>
            <th className="px-3 py-2 text-xs font-commons font-semibold text-neutral-500 uppercase">
              Tetiklendi
            </th>
            <th className="px-3 py-2 text-xs font-commons font-semibold text-neutral-500 uppercase">
              Kosul Sonuclari
            </th>
            <th className="px-3 py-2 text-xs font-commons font-semibold text-neutral-500 uppercase">
              Yapilan Islem
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className={`border-b border-neutral-100 ${
                log.error
                  ? 'bg-red-50/50'
                  : log.triggered
                    ? 'bg-green-50/50'
                    : 'bg-white'
              }`}
            >
              <td className="px-3 py-2.5 text-xs font-commons text-neutral-600 whitespace-nowrap">
                {formatTimestamp(log.executedAt)}
              </td>
              <td className="px-3 py-2.5 text-sm font-commons text-[#171717] max-w-[180px] truncate">
                {log.campaignName}
              </td>
              <td className="px-3 py-2.5">
                {log.error ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-commons bg-red-100 text-red-700">
                    <XCircle className="w-3 h-3" />
                    Hata
                  </span>
                ) : log.triggered ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-commons bg-green-100 text-green-700">
                    <CheckCircle2 className="w-3 h-3" />
                    Evet
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-commons bg-neutral-100 text-neutral-500">
                    <XCircle className="w-3 h-3" />
                    Hayir
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {log.conditionResults.map((cr, idx) => (
                    <span
                      key={idx}
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-commons ${
                        cr.passed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {cr.metric}: {typeof cr.actual === 'number' ? cr.actual.toLocaleString('tr-TR') : cr.actual}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2.5 text-xs font-commons text-neutral-600">
                {log.error ? (
                  <span className="text-red-600">{log.error}</span>
                ) : (
                  log.actionTaken || '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// KURAL KARTI
// ============================================

interface RuleCardProps {
  rule: AutomationRule;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: RuleStatus) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const [logsExpanded, setLogsExpanded] = useState(false);

  const isActive = rule.status === 'active';

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 hover:shadow-sm transition-all">
      {/* Kart Ust Kismi */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-commons font-semibold text-[#171717] truncate">
                {rule.name}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-commons ${RULE_STATUS_COLORS[rule.status]}`}
              >
                {RULE_STATUS_LABELS[rule.status]}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-commons bg-indigo-50 text-indigo-600">
                {RULE_FREQUENCY_LABELS[rule.frequency]}
              </span>
            </div>
            {rule.description && (
              <p className="text-sm font-commons text-neutral-500 mt-1">
                {rule.description}
              </p>
            )}
          </div>

          {/* Aksiyonlar */}
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {/* Aktif/Pasif Toggle */}
            {rule.status !== 'archived' && (
              <button
                onClick={() =>
                  onToggleStatus(rule.id, isActive ? 'paused' : 'active')
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-commons text-xs transition-colors ${
                  isActive
                    ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                {isActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Duraklat
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Etkinlestir
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => onEdit(rule)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 font-commons text-xs text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Duzenle
            </button>
            <button
              onClick={() => onDelete(rule.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 font-commons text-xs hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Kosullar */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ListFilter className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-xs font-commons font-medium text-neutral-500 uppercase">
              Kosullar ({rule.conditionLogic === 'and' ? 'VE' : 'VEYA'})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rule.conditions.map((condition, idx) => (
              <span
                key={idx}
                className="inline-block px-2.5 py-1 rounded-lg text-xs font-commons bg-neutral-100 text-neutral-700"
              >
                {formatCondition(condition)}
              </span>
            ))}
          </div>
        </div>

        {/* Aksiyon */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Zap className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-xs font-commons font-medium text-neutral-500 uppercase">
              Aksiyon
            </span>
          </div>
          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-commons bg-indigo-50 text-indigo-700">
            {formatAction(rule.action)}
          </span>
        </div>

        {/* Istatistikler */}
        <div className="flex items-center gap-4 text-xs font-commons text-neutral-500">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            {rule.totalExecutions.toLocaleString('tr-TR')} calistirma
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {rule.totalTriggered.toLocaleString('tr-TR')} tetikleme
          </span>
          {rule.lastRunAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Son: {formatTimestamp(rule.lastRunAt)}
            </span>
          )}
        </div>
      </div>

      {/* Calistirma Loglarini Goster/Gizle */}
      <div className="border-t border-neutral-100">
        <button
          onClick={() => setLogsExpanded(!logsExpanded)}
          className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 font-commons text-xs text-neutral-500 hover:bg-neutral-50 transition-colors"
        >
          {logsExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Calistirma Loglarini Gizle
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Calistirma Loglarini Goster
            </>
          )}
        </button>
        {logsExpanded && (
          <div className="border-t border-neutral-100 px-5 pb-4">
            <ExecutionLogPanel ruleId={rule.id} ruleName={rule.name} />
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// ANA SAYFA
// ============================================

const AutomatedRulesPage: React.FC = () => {
  const { projectId } = useProjectScope();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RuleStatus | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  // ============================================
  // VERI YUKLEME
  // ============================================

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRules(projectId);
      const filtered = statusFilter
        ? result.filter((r) => r.status === statusFilter)
        : result;
      setRules(filtered);
    } catch (err) {
      console.error('Failed to load automation rules:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  const loadCampaigns = useCallback(async () => {
    try {
      const filters = projectId ? { projectId } : undefined;
      const result = await getCampaigns(filters);
      setCampaigns(result.campaigns);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  }, [projectId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // ============================================
  // ISTATISTIKLER
  // ============================================

  const activeRulesCount = rules.filter((r) => r.status === 'active').length;
  const totalExecutionsToday = rules.reduce((sum, r) => sum + r.totalExecutions, 0);
  const totalTriggeredToday = rules.reduce((sum, r) => sum + r.totalTriggered, 0);

  // ============================================
  // ISLEM FONKSIYONLARI
  // ============================================

  const handleToggleStatus = async (id: string, status: RuleStatus) => {
    try {
      await toggleRuleStatus(id, status);
      loadRules();
    } catch (err) {
      console.error('Failed to toggle rule status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu otomasyon kuralini silmek istediginize emin misiniz?')) return;
    try {
      await deleteRule(id);
      loadRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingRule(null);
    loadRules();
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingRule(null);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">
            Otomasyon Kurallari
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Kampanyalariniz icin otomatik kurallar olusturun ve yonetin
          </p>
        </div>
        <button
          onClick={() => {
            setEditingRule(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
        >
          <Plus className="w-4 h-4" />
          Yeni Kural
        </button>
      </div>

      {/* Istatistik Cubugu */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-commons text-neutral-500 uppercase">Aktif Kurallar</p>
              <p className="text-xl font-commons font-bold text-[#171717]">
                {activeRulesCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-commons text-neutral-500 uppercase">Toplam Calistirma</p>
              <p className="text-xl font-commons font-bold text-[#171717]">
                {totalExecutionsToday.toLocaleString('tr-TR')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-commons text-neutral-500 uppercase">Toplam Tetikleme</p>
              <p className="text-xl font-commons font-bold text-[#171717]">
                {totalTriggeredToday.toLocaleString('tr-TR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RuleStatus | '')}
          className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="">Tum Durumlar</option>
          {Object.entries(RULE_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-xs font-commons text-neutral-400">
          {rules.length} kural listeleniyor
        </span>
      </div>

      {/* Kural Listesi */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <Zap className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="font-commons text-neutral-500 mb-1">
            Henuz otomasyon kurali bulunmuyor
          </p>
          <p className="text-sm font-commons text-neutral-400">
            Kampanyalarinizi otomatik yonetmek icin bir kural olusturun.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Olustur / Duzenle Modali */}
      <RuleModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        campaigns={campaigns}
        projectId={projectId}
        editingRule={editingRule}
      />
    </div>
  );
};

export default AutomatedRulesPage;
