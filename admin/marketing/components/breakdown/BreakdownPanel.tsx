import React, { useState } from 'react';
import type { BreakdownType } from '@/shared/types/breakdown';
import { BREAKDOWN_LABELS } from '@/shared/types/breakdown';
import AgeGenderBreakdown from './AgeGenderBreakdown';
import DeviceBreakdown from './DeviceBreakdown';
import PlacementBreakdown from './PlacementBreakdown';
import RegionBreakdown from './RegionBreakdown';

interface BreakdownPanelProps {
  campaignId: string;
  metaCampaignId?: string;
  projectId?: string;
}

const TABS: BreakdownType[] = ['age_gender', 'device', 'placement', 'region'];

const BreakdownPanel: React.FC<BreakdownPanelProps> = ({
  campaignId,
  metaCampaignId,
  projectId,
}) => {
  const [activeTab, setActiveTab] = useState<BreakdownType>('age_gender');

  return (
    <div className="space-y-4">
      {/* Tab buttons */}
      <div className="flex items-center gap-1 bg-white rounded-lg border border-neutral-200/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-commons text-sm transition-colors ${
              activeTab === tab
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {BREAKDOWN_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div>
        {activeTab === 'age_gender' && (
          <AgeGenderBreakdown
            campaignId={campaignId}
            metaCampaignId={metaCampaignId}
            projectId={projectId}
          />
        )}
        {activeTab === 'device' && (
          <DeviceBreakdown
            campaignId={campaignId}
            metaCampaignId={metaCampaignId}
            projectId={projectId}
          />
        )}
        {activeTab === 'placement' && (
          <PlacementBreakdown
            campaignId={campaignId}
            metaCampaignId={metaCampaignId}
            projectId={projectId}
          />
        )}
        {activeTab === 'region' && (
          <RegionBreakdown
            campaignId={campaignId}
            metaCampaignId={metaCampaignId}
            projectId={projectId}
          />
        )}
      </div>
    </div>
  );
};

export default BreakdownPanel;
