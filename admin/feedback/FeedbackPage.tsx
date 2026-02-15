import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Video,
  Plus,
  Search,
  Eye,
  MessageCircle,
  Clock,
  Copy,
  Check,
  Monitor,
  Camera,
  MonitorSmartphone,
  Filter,
  Loader2,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import {
  getFeedbackVideos,
  getFeedbackStats,
} from '@/shared/services/feedbackService';
import type {
  FeedbackVideoSummary,
  FeedbackVideoFilters,
  FeedbackType,
  RecordingMode,
} from '@/shared/types/feedback';
import {
  RECORDING_MODE_LABELS,
  FEEDBACK_STATUS_COLORS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  formatDuration,
} from '@/shared/types/feedback';
import RecordFeedbackModal from './RecordFeedbackModal';

const FeedbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermission();

  const [videos, setVideos] = useState<FeedbackVideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FeedbackVideoFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalVideos: 0,
    thisWeekVideos: 0,
    totalComments: 0,
    totalViews: 0,
  });

  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getFeedbackVideos(filters, 24);
      setVideos(result.videos);
    } catch (err) {
      console.error('[FeedbackPage] Error loading videos:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadStats = useCallback(async () => {
    try {
      const s = await getFeedbackStats();
      setStats(s);
    } catch (err) {
      console.error('[FeedbackPage] Error loading stats:', err);
    }
  }, []);

  useEffect(() => {
    loadVideos();
    loadStats();
  }, [loadVideos, loadStats]);

  const handleCopyLink = async (shareToken: string, videoId: string) => {
    const url = `${window.location.origin}/feedback/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(videoId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFilterMode = (mode: RecordingMode | undefined) => {
    setFilters((prev) => ({
      ...prev,
      recordingMode: prev.recordingMode === mode ? undefined : mode,
    }));
  };

  const handleRecordComplete = () => {
    setShowRecordModal(false);
    loadVideos();
    loadStats();
  };

  const filteredVideos = searchQuery
    ? videos.filter((v) =>
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.createdByName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : videos;

  const modeIcons: Record<RecordingMode, React.ElementType> = {
    screen: Monitor,
    camera: Camera,
    screen_camera: MonitorSmartphone,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-ramillas font-bold text-[#171717]">
            Geribildirim
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Video veya yazi ile ekibinize geribildirim verin
          </p>
        </div>
        {can(PERMISSIONS.FEEDBACK_CREATE) && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white rounded-full font-commons text-sm font-medium hover:bg-[#171717]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Kayit
          </motion.button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Video', value: stats.totalVideos, icon: Video },
          { label: 'Bu Hafta', value: stats.thisWeekVideos, icon: Clock },
          { label: 'Toplam Yorum', value: stats.totalComments, icon: MessageCircle },
          { label: 'Toplam Goruntulenme', value: stats.totalViews, icon: Eye },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-commons text-neutral-500">{stat.label}</p>
                <p className="text-2xl font-commons font-bold text-[#171717] mt-1">
                  {stat.value}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Video veya kisi ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            />
          </div>

          {/* Mode filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400" />
            {(Object.keys(RECORDING_MODE_LABELS) as RecordingMode[]).map((mode) => {
              const Icon = modeIcons[mode];
              const isActive = filters.recordingMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => handleFilterMode(mode)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-lg font-commons text-xs font-medium transition-colors
                    ${isActive
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {RECORDING_MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-16">
          <Video className="w-12 h-12 text-neutral-300 mx-auto" />
          <p className="mt-4 text-lg font-commons font-medium text-neutral-600">
            Henuz geribildirim yok
          </p>
          <p className="mt-1 text-sm font-commons text-neutral-400">
            Yeni bir kayit veya yazi olusturarak baslayabilirsiniz
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((video, index) => {
            const isText = video.type === 'text';
            const ModeIcon = isText ? FileText : modeIcons[video.recordingMode];
            return (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/admin/feedback/${video.id}`)}
              >
                {/* Thumbnail / Text Preview */}
                {isText ? (
                  <div className="relative aspect-video bg-gradient-to-br from-emerald-50 to-teal-50 p-5 flex flex-col justify-between">
                    <p className="font-commons text-sm text-neutral-600 line-clamp-4 leading-relaxed">
                      {video.textContent || ''}
                    </p>
                    {/* Type badge */}
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-xs font-commons px-2 py-1 rounded-lg flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Yazi</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative aspect-video bg-neutral-100">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-10 h-10 text-neutral-300" />
                      </div>
                    )}

                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-commons px-2 py-0.5 rounded-md">
                      {formatDuration(video.duration)}
                    </div>

                    {/* Mode badge */}
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-xs font-commons px-2 py-1 rounded-lg flex items-center gap-1">
                      <ModeIcon className="w-3.5 h-3.5 text-neutral-600" />
                      <span className="text-neutral-700">{RECORDING_MODE_LABELS[video.recordingMode]}</span>
                    </div>

                    {/* Status badge */}
                    {video.status !== 'ready' && (
                      <div className={`absolute top-2 right-2 text-xs font-commons px-2 py-1 rounded-lg flex items-center gap-1 ${FEEDBACK_STATUS_COLORS[video.status]}`}>
                        {video.status === 'transcribing' && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {FEEDBACK_STATUS_LABELS[video.status]}
                      </div>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-commons font-medium text-[#171717] text-sm truncate">
                    {video.title}
                  </h3>
                  <p className="text-xs font-commons text-neutral-500 mt-1">
                    {video.createdByName}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3 text-xs font-commons text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {video.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {video.commentCount}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLink(video.shareToken, video.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                      title="Linki kopyala"
                    >
                      {copiedId === video.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-neutral-400" />
                      )}
                    </button>
                  </div>

                  <p className="text-xs font-commons text-neutral-300 mt-2">
                    {new Date(video.createdAt).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Record Modal */}
      {showRecordModal && (
        <RecordFeedbackModal
          onClose={() => setShowRecordModal(false)}
          onComplete={handleRecordComplete}
        />
      )}
    </div>
  );
};

export default FeedbackPage;
