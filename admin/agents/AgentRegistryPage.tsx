import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Plus, Trash2, Edit3, Sparkles, Eye } from 'lucide-react';
import { useAgents } from '@/shared/hooks/useAgents';
import type { AIAgentType } from '@/shared/types/agent';
import { AI_AGENT_TYPE_LABELS, AI_AGENT_TYPE_COLORS } from '@/shared/types/agent';
import GenerateAgentModal from './GenerateAgentModal';

const typeFilters: { value: AIAgentType | ''; label: string }[] = [
  { value: '', label: 'Tumu' },
  { value: 'gemini_task', label: 'Gemini Gorev' },
  { value: 'canva_autofill', label: 'Canva Otofill' },
  { value: 'gemini_vision', label: 'Gemini Vision' },
];

const AgentRegistryPage: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<AIAgentType | ''>('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const { agents, loading, error, deleteAgent } = useAgents(
    typeFilter ? { agentType: typeFilter } : undefined
  );

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" ajanini silmek istediginizden emin misiniz?`)) return;
    await deleteAgent(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e] flex items-center gap-3">
            <Bot className="w-8 h-8 text-violet-600" />
            AI Ajanlar
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1">
            Workflow adimlarinda kullanilacak yeniden kullanilabilir AI agentlari tanimlayin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl font-commons text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            AI ile Oluştur
          </button>
          <Link
            to="/admin/agents/new"
            className="flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-xl font-commons text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Ajan
          </Link>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {typeFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value as AIAgentType | '')}
            className={`px-3 py-1.5 rounded-full font-commons text-xs font-medium transition-colors ${
              typeFilter === f.value
                ? 'bg-[#171717] text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-commons text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && agents.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50"
        >
          <Bot className="w-12 h-12 text-neutral-300 mb-4" />
          <p className="font-grotesk text-neutral-500 font-medium">Henuz ajan tanimlanmamis</p>
          <p className="font-commons text-neutral-400 text-sm mt-1">
            Ilk ajani olusturmak icin "Yeni Ajan" butonuna tiklayin.
          </p>
          <Link
            to="/admin/agents/new"
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-xl font-commons text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Ajan
          </Link>
        </motion.div>
      )}

      {/* Agent grid */}
      {!loading && agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-neutral-200 p-5 hover:shadow-md transition-shadow"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex flex-col gap-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full font-commons text-[10px] font-medium ${
                      AI_AGENT_TYPE_COLORS[agent.agentType]
                    }`}
                  >
                    {AI_AGENT_TYPE_LABELS[agent.agentType]}
                  </span>
                  {agent.model && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-commons text-[10px] font-medium">
                      {agent.model === 'pro' ? 'Gemini Pro' : 'Gemini Flash'}
                    </span>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-commons text-[10px] font-medium ${
                    agent.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {agent.status === 'active' ? 'Aktif' : 'Taslak'}
                </span>
              </div>

              {/* Name & description */}
              <h3 className="font-grotesk font-semibold text-[#171717] mb-1">{agent.name}</h3>
              {agent.description && (
                <p className="font-commons text-xs text-neutral-500 line-clamp-2 mb-3">
                  {agent.description}
                </p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mb-4">
                {agent.requiresHumanReview && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-commons text-[10px] font-medium">
                    <Eye className="w-3 h-3" />
                    Insan Incelemesi
                  </span>
                )}
                {agent.agentType !== 'canva_autofill' && agent.promptTemplate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-commons text-[10px] font-medium">
                    <Sparkles className="w-3 h-3" />
                    Prompt Var
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
                <Link
                  to={`/admin/agents/${agent.id}/edit`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-commons text-xs font-medium transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Duzenle
                </Link>
                <button
                  onClick={() => handleDelete(agent.id, agent.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 font-commons text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Sil
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showGenerateModal && (
        <GenerateAgentModal onClose={() => setShowGenerateModal(false)} />
      )}
    </div>
  );
};

export default AgentRegistryPage;
