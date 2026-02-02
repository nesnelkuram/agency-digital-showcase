import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  Eye,
  Loader2,
  FileCheck,
  Clock,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import {
  Quote,
  QuoteStatus,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  formatCurrency,
} from '@/shared/types/pricing';
import {
  ProposalDocument,
  ProposalDocStatus,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
} from '@/shared/types/pricing/proposal';

type TabType = 'quotes' | 'proposals';

const ProposalListPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [proposals, setProposals] = useState<ProposalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<'quote' | 'proposal' | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!db) return;
    setIsLoading(true);

    try {
      // Fetch quotes - calculatedAt (CostEngine) veya createdAt (Katalog) ile siralanabilir
      const quotesRef = collection(db, 'quotes');
      let quotesData: Quote[] = [];
      try {
        // Oncelikle createdAt ile dene (katalog teklifleri)
        const quotesSnap = await getDocs(quotesRef);
        quotesData = quotesSnap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as Quote[];
        // Manuel siralama: en yeni en uste
        quotesData.sort((a, b) => {
          const aTime = (a as any).createdAt?.seconds || (a as any).calculatedAt?.seconds || 0;
          const bTime = (b as any).createdAt?.seconds || (b as any).calculatedAt?.seconds || 0;
          return bTime - aTime;
        });
      } catch (err) {
        console.error('Error fetching quotes:', err);
      }
      setQuotes(quotesData);

      // Fetch proposals
      const proposalsRef = collection(db, 'proposals');
      try {
        const proposalsSnap = await getDocs(proposalsRef);
        const proposalsData = proposalsSnap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as ProposalDocument[];
        proposalsData.sort((a, b) => {
          const aTime = (a as any).createdAt?.seconds || 0;
          const bTime = (b as any).createdAt?.seconds || 0;
          return bTime - aTime;
        });
        setProposals(proposalsData);
      } catch (err) {
        console.error('Error fetching proposals:', err);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!db) return;
    setDeletingId(quoteId);
    try {
      await deleteDoc(doc(db, 'quotes', quoteId));
      setQuotes(prev => prev.filter(q => q.id !== quoteId));
    } catch (err) {
      console.error('Error deleting quote:', err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
      setConfirmDeleteType(null);
    }
  };

  const handleDeleteProposal = async (proposalId: string) => {
    if (!db) return;
    setDeletingId(proposalId);
    try {
      await deleteDoc(doc(db, 'proposals', proposalId));
      setProposals(prev => prev.filter(p => p.id !== proposalId));
    } catch (err) {
      console.error('Error deleting proposal:', err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
      setConfirmDeleteType(null);
    }
  };

  const filteredQuotes = quotes.filter(q => {
    const matchSearch = !searchTerm ||
      (q.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.projectTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredProposals = proposals.filter(p => {
    const matchSearch = !searchTerm ||
      p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.proposalNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.projectTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <FileText className="w-3.5 h-3.5" />;
      case 'sent': case 'ready': return <Send className="w-3.5 h-3.5" />;
      case 'accepted': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'rejected': return <XCircle className="w-3.5 h-3.5" />;
      case 'expired': return <AlertCircle className="w-3.5 h-3.5" />;
      case 'viewed': return <Eye className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#171717]" />
          <p className="font-grotesk text-sm text-neutral-500">Veriler yukleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
            Teklif Yonetimi
          </h1>
          <p className="font-grotesk text-neutral-600 mt-1">
            Kayitli tekliflerden profesyonel teklif dokumanlari olusturun
          </p>
        </div>
        <div className="flex gap-2">
          <motion.button
            onClick={() => navigate('/admin/pricing/quotes/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Yeni Teklif
          </motion.button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 text-neutral-500 mb-1">
            <FileText className="w-4 h-4" />
            <span className="font-grotesk text-xs">Toplam Teklif</span>
          </div>
          <p className="font-ramillas text-2xl font-bold text-[#171717]">{quotes.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 text-neutral-500 mb-1">
            <FileCheck className="w-4 h-4" />
            <span className="font-grotesk text-xs">Olusturulan Dokumanlar</span>
          </div>
          <p className="font-ramillas text-2xl font-bold text-[#171717]">{proposals.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 text-green-500 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="font-grotesk text-xs">Kabul Edilen</span>
          </div>
          <p className="font-ramillas text-2xl font-bold text-green-600">
            {proposals.filter(p => p.status === 'accepted').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 text-blue-500 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="font-grotesk text-xs">Toplam Tutar</span>
          </div>
          <p className="font-ramillas text-2xl font-bold text-[#171717]">
            {formatCurrency(quotes.reduce((sum, q) => sum + ((q as any).finalPrice || q.sellPrice || 0), 0))}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setActiveTab('quotes'); setStatusFilter('all'); }}
          className={`px-4 py-2 rounded-lg font-grotesk text-sm font-medium transition-all ${
            activeTab === 'quotes'
              ? 'bg-white text-[#171717] shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Kaydedilen Teklifler ({quotes.length})
        </button>
        <button
          onClick={() => { setActiveTab('proposals'); setStatusFilter('all'); }}
          className={`px-4 py-2 rounded-lg font-grotesk text-sm font-medium transition-all ${
            activeTab === 'proposals'
              ? 'bg-white text-[#171717] shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Teklif Dokumanlari ({proposals.length})
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Musteri adi, proje adi ile ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] bg-white"
        >
          <option value="all">Tum Durumlar</option>
          {activeTab === 'quotes' ? (
            <>
              <option value="draft">Taslak</option>
              <option value="sent">Gonderildi</option>
              <option value="accepted">Kabul Edildi</option>
              <option value="rejected">Reddedildi</option>
            </>
          ) : (
            <>
              <option value="draft">Taslak</option>
              <option value="ready">Hazir</option>
              <option value="sent">Gonderildi</option>
              <option value="accepted">Kabul Edildi</option>
            </>
          )}
        </select>
      </div>

      {/* Content */}
      {activeTab === 'quotes' ? (
        <QuoteList
          quotes={filteredQuotes}
          onGenerateProposal={(quoteId) => navigate(`/admin/pricing/proposals/new?quoteId=${quoteId}`)}
          onViewProposal={(quoteId) => {
            const proposal = proposals.find(p => p.quoteId === quoteId);
            if (proposal) navigate(`/admin/pricing/proposals/${proposal.id}`);
          }}
          proposals={proposals}
          formatDate={formatDate}
          getStatusIcon={getStatusIcon}
          onDelete={handleDeleteQuote}
          deletingId={deletingId}
          confirmDeleteId={confirmDeleteId}
          onConfirmDelete={(id) => { setConfirmDeleteId(id); setConfirmDeleteType('quote'); }}
          onCancelDelete={() => { setConfirmDeleteId(null); setConfirmDeleteType(null); }}
        />
      ) : (
        <ProposalList
          proposals={filteredProposals}
          onView={(id) => navigate(`/admin/pricing/proposals/${id}`)}
          formatDate={formatDate}
          getStatusIcon={getStatusIcon}
          onDelete={handleDeleteProposal}
          deletingId={deletingId}
          confirmDeleteId={confirmDeleteId}
          onConfirmDelete={(id) => { setConfirmDeleteId(id); setConfirmDeleteType('proposal'); }}
          onCancelDelete={() => { setConfirmDeleteId(null); setConfirmDeleteType(null); }}
        />
      )}
    </div>
  );
};

// ============================================
// QUOTE LIST
// ============================================

interface QuoteListProps {
  quotes: Quote[];
  onGenerateProposal: (quoteId: string) => void;
  onViewProposal: (quoteId: string) => void;
  proposals: ProposalDocument[];
  formatDate: (timestamp: any) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  onDelete: (id: string) => void;
  deletingId: string | null;
  confirmDeleteId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

const QuoteList: React.FC<QuoteListProps> = ({
  quotes,
  onGenerateProposal,
  onViewProposal,
  proposals,
  formatDate,
  getStatusIcon,
  onDelete,
  deletingId,
  confirmDeleteId,
  onConfirmDelete,
  onCancelDelete,
}) => {
  if (quotes.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
        <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="font-grotesk text-neutral-500">Henuz kaydedilmis teklif bulunmuyor</p>
        <p className="font-grotesk text-sm text-neutral-400 mt-1">
          Cost Engine veya Teklif Sihirbazi ile yeni bir teklif olusturun
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quotes.map((quote, index) => {
        const hasProposal = proposals.some(p => p.quoteId === quote.id);
        const price = (quote as any).finalPrice || quote.sellPrice || 0;
        const status = quote.status || 'draft';

        return (
          <motion.div
            key={quote.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
            className="bg-white rounded-xl border border-neutral-200 p-5 hover:border-neutral-300 transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-grotesk font-semibold text-[#171717] truncate">
                    {quote.clientName || (quote as any).clientName || 'Isimsiz Musteri'}
                  </h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-grotesk font-medium ${
                    QUOTE_STATUS_COLORS[status as QuoteStatus] || 'bg-gray-100 text-gray-700'
                  }`}>
                    {getStatusIcon(status)}
                    {QUOTE_STATUS_LABELS[status as QuoteStatus] || 'Taslak'}
                  </span>
                  {hasProposal && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-grotesk font-medium bg-green-50 text-green-700">
                      <FileCheck className="w-3 h-3" />
                      Dokuman Mevcut
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                  {quote.projectTitle && (
                    <span className="font-grotesk">{quote.projectTitle}</span>
                  )}
                  <span className="font-grotesk flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate((quote as any).calculatedAt || quote.createdAt)}
                  </span>
                  {(quote as any).projectType && (
                    <span className="font-grotesk px-2 py-0.5 bg-neutral-100 rounded text-xs">
                      {(quote as any).projectType === 'production' ? 'Production' : 'Retainer'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-ramillas text-xl font-bold text-[#171717]">
                    {formatCurrency(price)}
                  </p>
                  <p className="font-grotesk text-xs text-neutral-400">KDV Haric</p>
                </div>
                <div className="flex gap-2">
                  {hasProposal ? (
                    <motion.button
                      onClick={() => onViewProposal(quote.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-grotesk text-xs font-medium hover:bg-neutral-200 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Goruntule
                    </motion.button>
                  ) : null}
                  <motion.button
                    onClick={() => onGenerateProposal(quote.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-xs font-medium hover:bg-neutral-800 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {hasProposal ? 'Yeni Versiyon' : 'Teklif Olustur'}
                  </motion.button>
                  {confirmDeleteId === quote.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onDelete(quote.id)}
                        disabled={deletingId === quote.id}
                        className="px-2.5 py-2 bg-red-500 text-white rounded-lg font-grotesk text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingId === quote.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sil'}
                      </button>
                      <button
                        onClick={onCancelDelete}
                        className="px-2.5 py-2 bg-neutral-200 text-neutral-700 rounded-lg font-grotesk text-xs font-medium hover:bg-neutral-300 transition-colors"
                      >
                        Iptal
                      </button>
                    </div>
                  ) : (
                    <motion.button
                      onClick={() => onConfirmDelete(quote.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-2 border border-red-200 text-red-500 rounded-lg font-grotesk text-xs font-medium hover:bg-red-50 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// ============================================
// PROPOSAL LIST
// ============================================

interface ProposalListProps {
  proposals: ProposalDocument[];
  onView: (id: string) => void;
  formatDate: (timestamp: any) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  onDelete: (id: string) => void;
  deletingId: string | null;
  confirmDeleteId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

const ProposalList: React.FC<ProposalListProps> = ({
  proposals,
  onView,
  formatDate,
  getStatusIcon,
  onDelete,
  deletingId,
  confirmDeleteId,
  onConfirmDelete,
  onCancelDelete,
}) => {
  if (proposals.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
        <FileCheck className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="font-grotesk text-neutral-500">Henuz teklif dokumani olusturulmamis</p>
        <p className="font-grotesk text-sm text-neutral-400 mt-1">
          Kaydedilen teklifler sekmesinden bir teklif secip dokuman olusturun
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {proposals.map((proposal, index) => (
        <motion.div
          key={proposal.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          className="bg-white rounded-xl border border-neutral-200 p-5 hover:border-neutral-300 transition-all cursor-pointer"
          onClick={() => onView(proposal.id)}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-grotesk text-sm font-mono text-neutral-400">
                  {proposal.proposalNumber}
                </span>
                <h3 className="font-grotesk font-semibold text-[#171717] truncate">
                  {proposal.clientName}
                </h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-grotesk font-medium ${
                  PROPOSAL_STATUS_COLORS[proposal.status]
                }`}>
                  {getStatusIcon(proposal.status)}
                  {PROPOSAL_STATUS_LABELS[proposal.status]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                <span className="font-grotesk">{proposal.projectTitle}</span>
                <span className="font-grotesk flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(proposal.createdAt)}
                </span>
                <span className="font-grotesk text-xs">
                  Gecerlilik: {formatDate(proposal.validUntil)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-ramillas text-xl font-bold text-[#171717]">
                  {formatCurrency(proposal.grandTotal)}
                </p>
                <p className="font-grotesk text-xs text-neutral-400">KDV Dahil</p>
              </div>
              <div className="flex gap-2">
                <motion.button
                  onClick={(e) => { e.stopPropagation(); onView(proposal.id); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-grotesk text-xs font-medium hover:bg-neutral-200 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Goruntule
                </motion.button>
                {confirmDeleteId === proposal.id ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onDelete(proposal.id)}
                      disabled={deletingId === proposal.id}
                      className="px-2.5 py-2 bg-red-500 text-white rounded-lg font-grotesk text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deletingId === proposal.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sil'}
                    </button>
                    <button
                      onClick={onCancelDelete}
                      className="px-2.5 py-2 bg-neutral-200 text-neutral-700 rounded-lg font-grotesk text-xs font-medium hover:bg-neutral-300 transition-colors"
                    >
                      Iptal
                    </button>
                  </div>
                ) : (
                  <motion.button
                    onClick={(e) => { e.stopPropagation(); onConfirmDelete(proposal.id); }}
                    className="inline-flex items-center gap-1 px-2.5 py-2 border border-red-200 text-red-500 rounded-lg font-grotesk text-xs font-medium hover:bg-red-50 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default ProposalListPage;
