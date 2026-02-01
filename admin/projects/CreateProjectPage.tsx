import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createProject } from '@/shared/services/projectService';
import { SERVICE_MODULE_CONFIG } from '@/admin/projects/constants';
import type { ServiceCategory } from '@/shared/types/pricing/services';
import type { ProjectService } from '@/shared/types/project';
import { Timestamp } from 'firebase/firestore';
import ProjectBreadcrumb from './components/ProjectBreadcrumb';

const ALL_SERVICE_CATEGORIES: ServiceCategory[] = [
  'digital_marketing',
  'social_media',
  'video_production',
  'photography',
  'event_coverage',
  'brand_strategy',
  'graphic_design',
];

const CreateProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [selectedServices, setSelectedServices] = useState<ServiceCategory[]>([]);
  const [totalBudget, setTotalBudget] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleService = (category: ServiceCategory) => {
    setSelectedServices((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Proje adi zorunludur');
      return;
    }

    if (!clientName.trim()) {
      setError('Musteri adi zorunludur');
      return;
    }

    if (!user) {
      setError('Oturum acmaniz gerekiyor');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const services: ProjectService[] = selectedServices.map((category) => ({
        category,
        status: 'not_started' as const,
      }));

      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const projectData = {
        name: name.trim(),
        description: description.trim() || undefined,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        clientCompany: clientCompany.trim() || undefined,
        services,
        totalBudget: totalBudget ? parseFloat(totalBudget) : undefined,
        monthlyFee: monthlyFee ? parseFloat(monthlyFee) : undefined,
        startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      };

      const newId = await createProject(
        projectData,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      navigate(`/admin/projects/${newId}`);
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || 'Proje olusturulurken bir hata olustu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <ProjectBreadcrumb
        projectId=""
        currentPage="Yeni Proje"
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
          Yeni Proje Olustur
        </h1>
        <p className="font-grotesk text-neutral-600 mt-1">
          Musteri bilgilerini ve hizmet secimlerini girerek yeni bir proje olusturun.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="font-grotesk text-sm text-red-700">{error}</p>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
          <h2 className="font-ramillas text-lg font-bold text-[#171717] mb-5">
            Proje Bilgileri
          </h2>
          <div className="space-y-4">
            {/* Project Name */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Proje Adi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ornegin: ACME Corp Dijital Pazarlama"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
                required
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
                placeholder="Proje ile ilgili kisa bir aciklama..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
          <h2 className="font-ramillas text-lg font-bold text-[#171717] mb-5">
            Musteri Bilgileri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Name */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Musteri Adi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ad Soyad"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
                required
              />
            </div>

            {/* Company */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Sirket
              </label>
              <input
                type="text"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                placeholder="Sirket adi"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="ornek@email.com"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Telefon
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+90 5XX XXX XX XX"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
          <h2 className="font-ramillas text-lg font-bold text-[#171717] mb-2">
            Hizmetler
          </h2>
          <p className="font-grotesk text-sm text-neutral-500 mb-5">
            Bu projede sunulacak hizmetleri secin
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_SERVICE_CATEGORIES.map((category) => {
              const config = SERVICE_MODULE_CONFIG[category];
              if (!config) return null;
              const Icon = config.icon;
              const isSelected = selectedServices.includes(category);

              return (
                <motion.button
                  key={category}
                  type="button"
                  onClick={() => toggleService(category)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                    isSelected
                      ? 'border-[#171717] bg-neutral-50'
                      : 'border-neutral-100 bg-white hover:border-neutral-200'
                  }`}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bgColor}`}
                  >
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-grotesk text-sm font-medium text-[#171717]">
                      {config.label}
                    </p>
                    <p className="font-grotesk text-xs text-neutral-500 truncate">
                      {config.description}
                    </p>
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-[#171717] bg-[#171717]'
                          : 'border-neutral-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
          <h2 className="font-ramillas text-lg font-bold text-[#171717] mb-5">
            Finansal Bilgiler
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Budget */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Toplam Butce
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="100"
                  className="w-full px-4 py-2.5 pr-12 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-grotesk text-xs text-neutral-400">
                  TL
                </span>
              </div>
            </div>

            {/* Monthly Fee */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Aylik Ucret
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="100"
                  className="w-full px-4 py-2.5 pr-12 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-grotesk text-xs text-neutral-400">
                  TL/ay
                </span>
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Baslangic Tarihi
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Etiketler
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="etiket1, etiket2, etiket3"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
              <p className="font-grotesk text-xs text-neutral-400 mt-1">
                Virgul ile ayirin
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/projects')}
            className="px-6 py-2.5 rounded-full font-grotesk text-sm font-medium text-neutral-600 hover:text-[#171717] transition-colors"
          >
            Iptal
          </button>
          <motion.button
            type="submit"
            disabled={submitting || !name.trim() || !clientName.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            whileHover={{ scale: submitting ? 1 : 1.02 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Olusturuluyor...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Proje Olustur
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectPage;
