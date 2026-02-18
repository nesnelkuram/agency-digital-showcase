import React from 'react';
import { Rocket, Clock, Target, CalendarDays } from 'lucide-react';
import type { AIAnalysis } from '@/shared/types/brandLead';

interface Props {
  actionPlan: NonNullable<AIAnalysis['actionPlan']>;
}

const PhaseBlock: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  items: Array<{ action: string; owner: string; metric: string; estimatedImpact: string }>;
}> = ({ title, subtitle, icon, color, bgColor, borderColor, items }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className={`${bgColor} rounded-xl p-5`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className={`font-grotesk text-xs ${color} uppercase tracking-wider font-medium`}>
          {title}
        </p>
      </div>
      <p className="font-grotesk text-[10px] text-neutral-400 mb-3">{subtitle}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className={`bg-white rounded-lg p-3 border ${borderColor}`}>
            <p className="font-grotesk text-sm text-[#171717] font-medium mb-2">{item.action}</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="font-grotesk text-[10px] text-neutral-400 uppercase">Sorumlu</p>
                <p className="font-grotesk text-xs text-neutral-700">{item.owner}</p>
              </div>
              <div>
                <p className="font-grotesk text-[10px] text-neutral-400 uppercase">Basari Olcutu</p>
                <p className="font-grotesk text-xs text-neutral-700">{item.metric}</p>
              </div>
              <div>
                <p className="font-grotesk text-[10px] text-neutral-400 uppercase">Beklenen Etki</p>
                <p className="font-grotesk text-xs text-neutral-700">{item.estimatedImpact}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ActionPlanSection: React.FC<Props> = ({ actionPlan }) => {
  const hasActions = (actionPlan.immediate?.length > 0) ||
    (actionPlan.shortTerm?.length > 0) ||
    (actionPlan.mediumTerm?.length > 0);

  if (!hasActions) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="w-5 h-5 text-amber-600" />
        <h4 className="font-grotesk text-lg font-bold text-[#171717]">
          90 Gunluk Eylem Plani
        </h4>
      </div>

      <div className="space-y-4">
        <PhaseBlock
          title="Acil Aksiyonlar"
          subtitle="Ilk 30 gun"
          icon={<Target className="w-4 h-4 text-red-500" />}
          color="text-red-600"
          bgColor="bg-red-50"
          borderColor="border-red-100"
          items={actionPlan.immediate}
        />
        <PhaseBlock
          title="Kisa Vadeli"
          subtitle="30-60 gun"
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          color="text-amber-600"
          bgColor="bg-amber-50"
          borderColor="border-amber-100"
          items={actionPlan.shortTerm}
        />
        <PhaseBlock
          title="Orta Vadeli"
          subtitle="60-90 gun"
          icon={<CalendarDays className="w-4 h-4 text-green-500" />}
          color="text-green-600"
          bgColor="bg-green-50"
          borderColor="border-green-100"
          items={actionPlan.mediumTerm}
        />
      </div>
    </div>
  );
};

export default ActionPlanSection;
