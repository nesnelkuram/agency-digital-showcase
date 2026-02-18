import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  Filter,
  Plus,
  ChevronRight,
  Calendar,
  Building2,
  Mail,
  Phone,
  Sparkles,
  TrendingUp,
  Clock,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  getBrandLeads,
  getBrandLeadStats,
} from '@/shared/services/brandLeadService';
import {
  BrandLeadSummary,
  BrandLeadFilters,
  LeadStatus,
  LeadPriority,
  Sector,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  PRIORITY_LABELS,
  SECTOR_LABELS,
} from '@/shared/types/brandLead';
import { Timestamp, DocumentSnapshot } from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/firebase/config';

const LeadsPage: React.FC = () => {
  const { user } = useAuth();
  const { can } = usePermission();
  const tenantId = useTenantId();

  // State
  const [leads, setLeads] = useState<BrandLeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    byStatus: Record<LeadStatus, number>;
    newThisWeek: number;
    conversionRate: number;
  } | null>(null);

  // Filters
  const [filters, setFilters] = useState<BrandLeadFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Load leads
  const loadLeads = useCallback(async (reset = false) => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await getBrandLeads(
        tenantId,
        filters,
        20,
        reset ? undefined : lastDoc || undefined
      );

      if (reset) {
        setLeads(result.leads);
      } else {
        setLeads((prev) => [...prev, ...result.leads]);
      }

      setLastDoc(result.lastDoc);
      setHasMore(result.leads.length === 20);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId, filters, lastDoc]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!isFirebaseConfigured) return;

    try {
      const statsData = await getBrandLeadStats(tenantId);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [tenantId]);

  // Initial load
  useEffect(() => {
    loadLeads(true);
    loadStats();
  }, []);

  // Reload on filter change
  useEffect(() => {
    loadLeads(true);
  }, [filters]);

  // Format date
  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes} dk once`;
      }
      return `${hours} saat once`;
    }
    if (days === 1) return 'Dun';
    if (days < 7) return `${days} gun once`;

    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
    });
  };

  // Filter by status
  const handleStatusFilter = (status: LeadStatus | null) => {
    setFilters((prev) => ({
      ...prev,
      status: status ? [status] : undefined,
    }));
  };

  // Filter by sector
  const handleSectorFilter = (sector: Sector | null) => {
    setFilters((prev) => ({
      ...prev,
      sector: sector ? [sector] : undefined,
    }));
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Users className="w-12 h-12 text-neutral-300 mb-4" />
        <h3 className="font-grotesk text-xl font-bold text-neutral-700 mb-2">
          Firebase Yapilandirilmadi
        </h3>
        <p className="font-grotesk text-neutral-500 max-w-md">
          Leads ozelligini kullanmak icin Firebase'i yapilandirmaniz gerekiyor.
          .env.local dosyaniza Firebase bilgilerinizi ekleyin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Marka Basvurulari
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1">
            Website formlarindan gelen basvurular
          </p>
        </div>
        <div className="flex gap-2">
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-200 bg-white text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
            Filtrele
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Manuel Ekle
          </motion.button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="admin-stat-card"
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-grotesk font-medium px-2.5 py-1 rounded-full backdrop-blur-sm bg-blue-500/10 text-blue-600">
                Toplam
              </span>
            </div>
            <div className="mt-5">
              <p className="text-3xl font-grotesk font-bold text-[#1a1a2e]">
                {stats.total}
              </p>
              <p className="font-grotesk text-sm text-neutral-500 mt-1">Lead</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="admin-stat-card"
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-green-500/10 text-green-600">
                <UserPlus className="w-6 h-6" />
              </div>
              <span className="text-xs font-grotesk font-medium px-2.5 py-1 rounded-full backdrop-blur-sm bg-green-500/10 text-green-600">
                Bu hafta
              </span>
            </div>
            <div className="mt-5">
              <p className="text-3xl font-grotesk font-bold text-[#1a1a2e]">
                {stats.newThisWeek}
              </p>
              <p className="font-grotesk text-sm text-neutral-500 mt-1">Yeni Lead</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="admin-stat-card"
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-xs font-grotesk font-medium px-2.5 py-1 rounded-full backdrop-blur-sm bg-amber-500/10 text-amber-600">
                Bekliyor
              </span>
            </div>
            <div className="mt-5">
              <p className="text-3xl font-grotesk font-bold text-[#1a1a2e]">
                {stats.byStatus.new}
              </p>
              <p className="font-grotesk text-sm text-neutral-500 mt-1">Incelenmemis</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="admin-stat-card"
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <span className="text-xs font-grotesk font-medium px-2.5 py-1 rounded-full backdrop-blur-sm bg-purple-500/10 text-purple-600">
                Oran
              </span>
            </div>
            <div className="mt-5">
              <p className="text-3xl font-grotesk font-bold text-[#1a1a2e]">
                %{stats.conversionRate}
              </p>
              <p className="font-grotesk text-sm text-neutral-500 mt-1">Donusum</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-xl p-4 shadow-sm border border-neutral-100"
        >
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Isletme adi veya email ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              className="px-4 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-grotesk text-sm focus:outline-none focus:border-neutral-400"
              value={filters.status?.[0] || ''}
              onChange={(e) => handleStatusFilter(e.target.value as LeadStatus || null)}
            >
              <option value="">Tum Durumlar</option>
              {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Sector Filter */}
            <select
              className="px-4 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-grotesk text-sm focus:outline-none focus:border-neutral-400"
              value={filters.sector?.[0] || ''}
              onChange={(e) => handleSectorFilter(e.target.value as Sector || null)}
            >
              <option value="">Tum Sektorler</option>
              {Object.entries(SECTOR_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </motion.div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => handleStatusFilter(null)}
          className={`px-4 py-2 rounded-full font-grotesk text-sm whitespace-nowrap transition-colors ${
            !filters.status
              ? 'bg-[#171717] text-white'
              : 'bg-white text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          Tumu ({stats?.total || 0})
        </button>
        {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
          <button
            key={value}
            onClick={() => handleStatusFilter(value as LeadStatus)}
            className={`px-4 py-2 rounded-full font-grotesk text-sm whitespace-nowrap transition-colors ${
              filters.status?.[0] === value
                ? 'bg-[#171717] text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {label} ({stats?.byStatus[value as LeadStatus] || 0})
          </button>
        ))}
      </div>

      {/* Leads List */}
      <div className="admin-card p-0 overflow-hidden">
        {loading && leads.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <Users className="w-12 h-12 text-neutral-300 mb-4" />
            <h3 className="font-grotesk text-xl font-bold text-neutral-700 mb-2">
              Henuz basvuru yok
            </h3>
            <p className="font-grotesk text-neutral-500 max-w-md">
              Website'deki Brand Strategy formunu dolduran kisiler burada gorunecek.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {leads.map((lead, index) => (
              <motion.a
                key={lead.id}
                href={`/admin/leads/${lead.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-5 hover:bg-neutral-50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-[#fffceb] flex items-center justify-center flex-shrink-0">
                  <span className="font-grotesk font-bold text-[#171717] text-lg">
                    {lead.contact.businessName.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-grotesk font-semibold text-[#171717] truncate">
                      {lead.contact.businessName}
                    </h3>
                    <span className={`text-xs font-grotesk font-medium px-2 py-0.5 rounded-full ${LEAD_STATUS_COLORS[lead.status]}`}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </span>
                    {lead.hasAIAnalysis && (
                      <span className="text-xs font-grotesk font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {SECTOR_LABELS[lead.sector]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {lead.contact.email}
                    </span>
                    <span className="hidden sm:flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(lead.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Services Count */}
                <div className="hidden md:block text-right">
                  <p className="font-grotesk text-sm text-neutral-500">
                    {lead.requestedServicesCount} hizmet
                  </p>
                  {lead.assignedToName && (
                    <p className="font-grotesk text-xs text-neutral-400 mt-1">
                      {lead.assignedToName}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              </motion.a>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && leads.length > 0 && (
          <div className="p-5 border-t border-neutral-100">
            <button
              onClick={() => loadLeads(false)}
              disabled={loading}
              className="w-full py-2 font-grotesk text-sm text-neutral-600 hover:text-[#171717] transition-colors disabled:opacity-50"
            >
              {loading ? 'Yukleniyor...' : 'Daha fazla yukle'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsPage;
