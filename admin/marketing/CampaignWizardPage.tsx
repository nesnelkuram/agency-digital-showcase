import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { createCampaign } from '@/shared/services/marketingService';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';
import type {
  CampaignObjective,
  AdPlatform,
  AudienceTargeting,
} from '@/shared/types/marketing';

// Wizard step components
import { ModeSelectionStep } from './components/wizard/ModeSelectionStep';
import { BasicInfoStep } from './components/wizard/BasicInfoStep';
import { TargetingStep } from './components/wizard/TargetingStep';
import BudgetScheduleStep from './components/wizard/BudgetScheduleStep';
import AdSetsStep from './components/wizard/AdSetsStep';
import CreativesStep from './components/wizard/CreativesStep';
import PreviewStep from './components/wizard/PreviewStep';
import { WizardStepIndicator } from './components/wizard/WizardStepIndicator';

// ============================================
// WIZARD STATE INTERFACE
// ============================================

interface WizardAd {
  id: string;
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  destinationUrl: string;
  variant?: string;
  isAIGenerated?: boolean;
}

interface WizardAdSet {
  id: string;
  name: string;
  platform: AdPlatform;
  bidStrategy: string;
  budgetDaily: number;
  ads: WizardAd[];
}

interface WizardState {
  mode: 'manual' | 'ai' | null;
  step: number;
  basicInfo: {
    name: string;
    description: string;
    objective: string;
    platforms: string[];
    brief: string;
  };
  targeting: Partial<AudienceTargeting>;
  budget: {
    totalBudget: number;
    dailyLimit: number;
    currency: 'TRY' | 'USD' | 'EUR';
    platformSplit: Record<string, number>;
    startDate: string;
    endDate: string;
  };
  adSets: WizardAdSet[];
  aiRationale: string;
  aiLoading: boolean;
}

const initialState: WizardState = {
  mode: null,
  step: 1,
  basicInfo: {
    name: '',
    description: '',
    objective: '',
    platforms: [],
    brief: '',
  },
  targeting: {},
  budget: {
    totalBudget: 5000,
    dailyLimit: 0,
    currency: 'TRY',
    platformSplit: {},
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  },
  adSets: [],
  aiRationale: '',
  aiLoading: false,
};

// ============================================
// MAIN COMPONENT
// ============================================

const CampaignWizardPage: React.FC = () => {
  const { projectId, basePath, isProjectScoped } = useProjectScope();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<WizardState>(initialState);
  const [submitting, setSubmitting] = useState(false);

  // Auto-set AI mode from URL param ?mode=ai
  useEffect(() => {
    if (searchParams.get('mode') === 'ai') {
      setState((prev) => ({ ...prev, mode: 'ai', step: 1 }));
    }
  }, [searchParams]);

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================

  const goNext = () => {
    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const goPrev = () => {
    setState((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) }));
  };

  // ============================================
  // AI GENERATION HANDLER
  // ============================================

  const generateWithAI = async () => {
    setState((prev) => ({ ...prev, aiLoading: true }));
    try {
      const res = await fetch('/api/marketing/generate-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: state.basicInfo.brief,
          objective: state.basicInfo.objective,
          platforms: state.basicInfo.platforms,
          totalBudget: state.budget.totalBudget || 5000,
          currency: state.budget.currency,
          duration: 30,
          businessName: '',
        }),
      });

      const data = await res.json();

      if (data.success && data.campaign) {
        // Map AI output to wizard format
        const mappedAdSets: WizardAdSet[] = (data.campaign.adSets || []).map((as: any) => ({
          id: as.id || `adset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: as.name,
          platform: as.platform,
          bidStrategy: as.bidStrategy || 'lowest_cost',
          budgetDaily: as.budgetDaily || 0,
          ads: (as.ads || []).map((ad: any) => ({
            id: ad.id || `ad-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            headline: ad.creative?.headline || ad.name || '',
            primaryText: ad.creative?.primaryText || '',
            description: ad.creative?.description || '',
            cta: ad.creative?.callToAction || 'learn_more',
            destinationUrl: ad.creative?.destinationUrl || '',
            variant: ad.variant || 'A',
            isAIGenerated: true,
          })),
        }));

        setState((prev) => ({
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            name: data.campaign.name || prev.basicInfo.name,
          },
          targeting: data.campaign.targeting || {},
          budget: {
            ...prev.budget,
            totalBudget: data.campaign.budget?.totalBudget || prev.budget.totalBudget,
            dailyLimit: data.campaign.budget?.dailyLimit || 0,
            platformSplit: data.campaign.budget?.platformSplit || {},
          },
          adSets: mappedAdSets,
          aiRationale: data.rationale || '',
          aiLoading: false,
          step: 3,
        }));
      } else {
        console.error('AI generation failed:', data.error);
        setState((prev) => ({ ...prev, aiLoading: false }));
      }
    } catch (err) {
      console.error('AI generation error:', err);
      setState((prev) => ({ ...prev, aiLoading: false }));
    }
  };

  // ============================================
  // FINAL SUBMISSION HANDLER
  // ============================================

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Convert wizard adSets to marketing AdSet format
      const marketingAdSets = state.adSets.map((adSet) => ({
        id: adSet.id,
        name: adSet.name,
        platform: adSet.platform,
        targeting: state.targeting as AudienceTargeting,
        budget: { daily: adSet.budgetDaily },
        schedule: {
          startDate: state.budget.startDate,
          endDate: state.budget.endDate || undefined,
        },
        bidStrategy: adSet.bidStrategy as 'lowest_cost' | 'cost_cap' | 'bid_cap' | 'target_cost',
        status: 'active' as const,
        ads: adSet.ads.map((ad) => ({
          id: ad.id,
          name: ad.headline,
          type: 'image' as const,
          creative: {
            headline: ad.headline,
            primaryText: ad.primaryText,
            description: ad.description,
            callToAction: ad.cta,
            destinationUrl: ad.destinationUrl,
          },
          status: 'active' as const,
        })),
      }));

      const campaignId = await createCampaign(
        {
          projectId: projectId || undefined,
          name: state.basicInfo.name,
          description: state.basicInfo.description,
          objective: state.basicInfo.objective as CampaignObjective,
          platforms: state.basicInfo.platforms as AdPlatform[],
          budget: {
            totalBudget: state.budget.totalBudget,
            dailyLimit: state.budget.dailyLimit,
            currency: state.budget.currency,
            platformBreakdown: state.basicInfo.platforms.map((p) => ({
              platform: p as AdPlatform,
              amount: state.budget.totalBudget * ((state.budget.platformSplit[p] || 0) / 100),
              percentage: state.budget.platformSplit[p] || 0,
            })),
            testBudgetPercentage: 20,
          },
          schedule: {
            startDate: state.budget.startDate,
            endDate: state.budget.endDate || undefined,
            timezone: 'Europe/Istanbul',
          },
          targeting: state.targeting as AudienceTargeting,
          adSets: marketingAdSets,
        },
        'admin',
        'Admin'
      );

      navigate(`${basePath}/campaigns/${campaignId}`);
    } catch (err) {
      console.error('Failed to create campaign:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================
  // STEP NAVIGATION BUTTON HANDLER
  // ============================================

  const handleNextClick = () => {
    // If AI mode and on step 2, generate with AI
    if (state.mode === 'ai' && state.step === 2) {
      generateWithAI();
    } else {
      goNext();
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      {isProjectScoped && projectId && (
        <ProjectBreadcrumb projectId={projectId} currentPage="Yeni Kampanya" />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`${basePath}/campaigns`)}
          className="p-2 hover:bg-neutral-50 rounded-lg transition-colors"
          aria-label="Geri"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">
            Yeni Kampanya Olustur
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            {state.mode === 'ai'
              ? 'AI destekli kampanya olusturma'
              : 'Adim adim kampanya yapilandirma'}
          </p>
        </div>
      </div>

      {/* Step indicator (only show after mode selection) */}
      {state.mode && state.step >= 2 && (
        <WizardStepIndicator
          currentStep={state.step - 1}
          totalSteps={6}
          stepLabels={[
            'Bilgiler',
            'Hedefleme',
            'Butce',
            'Reklam Setleri',
            'Reklamlar',
            'Onizleme',
          ]}
        />
      )}

      {/* AI Loading overlay */}
      {state.aiLoading && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-commons font-semibold text-indigo-900">
            AI kampanyanizi olusturuyor...
          </h3>
          <p className="text-sm font-commons text-indigo-600 mt-1">
            Hedefleme, butce ve reklam icerikleri hazirlaniyor
          </p>
        </div>
      )}

      {/* Step content */}
      {!state.aiLoading && (
        <>
          {state.step === 1 && (
            <ModeSelectionStep
              selectedMode={state.mode}
              onSelectMode={(mode) =>
                setState((prev) => ({ ...prev, mode, step: 2 }))
              }
            />
          )}

          {state.step === 2 && (
            <BasicInfoStep
              data={state.basicInfo}
              mode={state.mode!}
              onChange={(field, value) =>
                setState((prev) => ({
                  ...prev,
                  basicInfo: { ...prev.basicInfo, [field]: value },
                }))
              }
            />
          )}

          {state.step === 3 && (
            <TargetingStep
              data={state.targeting}
              platforms={state.basicInfo.platforms as AdPlatform[]}
              onChange={(targeting) =>
                setState((prev) => ({ ...prev, targeting }))
              }
              isAIFilled={state.mode === 'ai' && !!state.aiRationale}
            />
          )}

          {state.step === 4 && (
            <BudgetScheduleStep
              data={state.budget}
              platforms={state.basicInfo.platforms as AdPlatform[]}
              onChange={(field, value) =>
                setState((prev) => ({
                  ...prev,
                  budget: { ...prev.budget, [field]: value },
                }))
              }
              isAIFilled={state.mode === 'ai' && !!state.aiRationale}
            />
          )}

          {state.step === 5 && (
            <AdSetsStep
              adSets={state.adSets}
              platforms={state.basicInfo.platforms as AdPlatform[]}
              onChange={(adSets) => setState((prev) => ({ ...prev, adSets }))}
              isAIFilled={state.mode === 'ai' && !!state.aiRationale}
            />
          )}

          {state.step === 6 && (
            <CreativesStep
              adSets={state.adSets}
              onChange={(adSets) => setState((prev) => ({ ...prev, adSets }))}
            />
          )}

          {state.step === 7 && (
            <PreviewStep
              wizardData={{
                mode: state.mode!,
                name: state.basicInfo.name,
                description: state.basicInfo.description,
                objective: state.basicInfo.objective,
                platforms: state.basicInfo.platforms,
                targeting: state.targeting as any,
                budget: state.budget,
                adSets: state.adSets as any,
                aiRationale: state.aiRationale,
              }}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
        </>
      )}

      {/* Navigation buttons */}
      {state.mode && !state.aiLoading && state.step < 7 && (
        <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
          {state.step > 1 ? (
            <button
              onClick={goPrev}
              className="px-4 py-2 font-commons text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Geri
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={handleNextClick}
            className="px-4 py-2 font-commons text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {state.mode === 'ai' && state.step === 2
              ? 'AI ile Olustur'
              : 'Sonraki'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CampaignWizardPage;
