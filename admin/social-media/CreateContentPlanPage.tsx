import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Send,
  Loader2,
  Calendar,
  Plus,
  X,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import type {
  SocialPlatform,
  SocialPostSummary,
  CreateContentPlanData,
} from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS, POST_TYPE_LABELS, POST_TYPE_COLORS } from '@/shared/types/socialMedia';
import { getSocialPosts } from '@/shared/services/socialMediaService';
import { createContentPlan, submitForApproval } from '@/shared/services/contentPlanService';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';
import PlatformSelector from './components/PlatformSelector';

const PLAN_STEPS = [
  { id: 'platform', label: 'Platform & Tarih' },
  { id: 'posts', label: 'Post Secimi' },
  { id: 'review', label: 'Kontrol' },
];

const CreateContentPlanPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = useTenantId();

  const [currentStep, setCurrentStep] = useState(0);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);

  // Data
  const [availablePosts, setAvailablePosts] = useState<SocialPostSummary[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load draft posts for selection
  const loadAvailablePosts = useCallback(async () => {
    if (!projectId || !platform) return;
    setLoadingPosts(true);
    try {
      const result = await getSocialPosts(tenantId, { projectId, status: ['draft', 'scheduled'] }, 100);
      // Filter by platform
      const filtered = result.posts.filter((p) => p.platforms.includes(platform!));
      setAvailablePosts(filtered);
    } catch (err) {
      console.error('[CreateContentPlanPage] Error loading posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  }, [tenantId, projectId, platform]);

  useEffect(() => {
    if (currentStep === 1 && platform) {
      loadAvailablePosts();
    }
  }, [currentStep, platform, loadAvailablePosts]);

  const togglePostSelection = (postId: string) => {
    setSelectedPostIds((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]
    );
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: return platform !== null && title.trim().length > 0 && weekStart !== '' && weekEnd !== '';
      case 1: return selectedPostIds.length > 0;
      case 2: return true;
      default: return false;
    }
  };

  const handleSubmit = async (sendForApproval: boolean = false) => {
    if (!projectId || !user || !platform) return;

    setError(null);
    setSubmitting(true);

    try {
      const data: CreateContentPlanData = {
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        platform,
        postIds: selectedPostIds,
        weekStartDate: Timestamp.fromDate(new Date(weekStart)),
        weekEndDate: Timestamp.fromDate(new Date(weekEnd)),
      };

      const planId = await createContentPlan(
        tenantId,
        data,
        user.uid,
        user.displayName || 'Bilinmeyen'
      );

      if (sendForApproval) {
        await submitForApproval(tenantId, planId);
      }

      navigate(`/admin/projects/${projectId}/social-media/plans/${planId}`);
    } catch (err) {
      console.error('[CreateContentPlanPage] Error creating plan:', err);
      setError('Plan olusturulurken bir hata olustu.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPosts = availablePosts.filter((p) => selectedPostIds.includes(p.id));

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Plan Basligi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Orn: Instagram Haftalik Plan - 17-23 Subat"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Aciklama
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Plan hakkinda kisa bir not..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all resize-none"
              />
            </div>

            {/* Platform */}
            <PlatformSelector
              selected={platform}
              onSelect={setPlatform}
            />

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                  Baslangic Tarihi <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
                />
              </div>
              <div>
                <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                  Bitis Tarihi <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={weekEnd}
                  onChange={(e) => setWeekEnd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-grotesk font-semibold text-[#171717]">
                Postlari Secin
              </h2>
              <p className="font-grotesk text-sm text-neutral-500 mt-1">
                {SOCIAL_PLATFORM_LABELS[platform!]} icin mevcut taslak postlari plana ekleyin
              </p>
            </div>

            {loadingPosts ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : availablePosts.length === 0 ? (
              <div className="bg-neutral-50 rounded-xl p-8 text-center">
                <p className="font-grotesk text-sm text-neutral-500 mb-3">
                  Bu platform icin henuz taslak post yok.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/projects/${projectId}/social-media/new`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm hover:bg-neutral-800"
                >
                  <Plus className="w-4 h-4" />
                  Yeni Post Olustur
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {availablePosts.map((post) => {
                  const isSelected = selectedPostIds.includes(post.id);
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => togglePostSelection(post.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-[#171717] bg-neutral-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'border-[#171717] bg-[#171717]'
                            : 'border-neutral-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                          {post.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-grotesk font-medium ${POST_TYPE_COLORS[post.postType]}`}>
                            {POST_TYPE_LABELS[post.postType]}
                          </span>
                          {post.scheduledAt && (
                            <span className="font-grotesk text-[10px] text-neutral-500">
                              {post.scheduledAt.toDate().toLocaleDateString('tr-TR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      {post.media && post.media.length > 0 && (
                        <div className="w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden flex-shrink-0">
                          <img
                            src={post.media[0].thumbnailUrl || post.media[0].url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedPostIds.length > 0 && (
              <p className="font-grotesk text-xs text-neutral-500">
                {selectedPostIds.length} post secildi
              </p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-grotesk font-semibold text-[#171717]">
                Kontrol & Kaydet
              </h2>
              <p className="font-grotesk text-sm text-neutral-500 mt-1">
                Plan detaylarini kontrol edin
              </p>
            </div>

            <div className="bg-neutral-50 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-grotesk text-sm text-neutral-500">Baslik</span>
                <span className="font-grotesk text-sm font-medium text-[#171717]">{title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-grotesk text-sm text-neutral-500">Platform</span>
                <span className="font-grotesk text-sm font-medium text-[#171717]">
                  {platform ? SOCIAL_PLATFORM_LABELS[platform] : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-grotesk text-sm text-neutral-500">Tarih Araligi</span>
                <span className="font-grotesk text-sm font-medium text-[#171717]">
                  {weekStart && new Date(weekStart).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                  {' - '}
                  {weekEnd && new Date(weekEnd).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-grotesk text-sm text-neutral-500">Secili Post</span>
                <span className="font-grotesk text-sm font-medium text-[#171717]">
                  {selectedPostIds.length} post
                </span>
              </div>
            </div>

            {/* Selected posts list */}
            <div className="space-y-2">
              {selectedPosts.map((post, idx) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-100"
                >
                  <span className="font-grotesk text-xs text-neutral-400 w-5">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-grotesk text-sm text-[#171717] truncate">{post.title}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-grotesk font-medium ${POST_TYPE_COLORS[post.postType]}`}>
                    {POST_TYPE_LABELS[post.postType]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {projectId && (
        <ProjectBreadcrumb projectId={projectId} currentPage="Yeni Icerik Plani" />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/admin/projects/${projectId}/social-media/plans`)}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Yeni Icerik Plani
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1">
            Haftalik icerik plani olusturun
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {PLAN_STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => {
                if (index < currentStep) setCurrentStep(index);
              }}
              disabled={index > currentStep}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-all
                ${
                  index === currentStep
                    ? 'bg-[#171717] text-white'
                    : index < currentStep
                    ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200'
                    : 'bg-neutral-100 text-neutral-400 cursor-default'
                }
              `}
            >
              {index < currentStep ? (
                <Check className="w-3 h-3" />
              ) : (
                <span>{index + 1}</span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {index < PLAN_STEPS.length - 1 && (
              <div className={`w-6 h-0.5 ${index < currentStep ? 'bg-emerald-300' : 'bg-neutral-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-neutral-100 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-grotesk text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (currentStep > 0) setCurrentStep((prev) => prev - 1);
          }}
          disabled={currentStep === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
          Geri
        </button>

        {currentStep < PLAN_STEPS.length - 1 ? (
          <motion.button
            type="button"
            onClick={() => {
              if (canProceed()) setCurrentStep((prev) => prev + 1);
            }}
            disabled={!canProceed()}
            whileHover={{ scale: canProceed() ? 1.02 : 1 }}
            whileTap={{ scale: canProceed() ? 0.98 : 1 }}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Devam
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        ) : (
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              Taslak Kaydet
            </motion.button>
            <motion.button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Onaya Gonder
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateContentPlanPage;
