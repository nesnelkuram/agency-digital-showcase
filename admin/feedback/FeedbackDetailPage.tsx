import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  Clock,
  Eye,
  MessageCircle,
  Send,
  Monitor,
  Camera,
  MonitorSmartphone,
  Globe,
  Lock,
  Smile,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import {
  getFeedbackVideo,
  getComments,
  getReactions,
  addComment,
  deleteComment,
  toggleReaction,
  deleteFeedbackVideo,
  updateFeedbackVideo,
  incrementViewCount,
} from '@/shared/services/feedbackService';
import type {
  FeedbackVideo,
  FeedbackComment,
  FeedbackReaction,
} from '@/shared/types/feedback';
import {
  formatDuration,
  RECORDING_MODE_LABELS,
  FEEDBACK_STATUS_LABELS,
} from '@/shared/types/feedback';
import VideoPlayer from './components/VideoPlayer';

const EMOJI_OPTIONS = ['👍', '👏', '🔥', '❤️', '😍', '🎉', '💡', '⚡'];

const FeedbackDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermission();

  const [video, setVideo] = useState<FeedbackVideo | null>(null);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [reactions, setReactions] = useState<FeedbackReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);

      // Load video first - this is required
      const videoData = await getFeedbackVideo(id);
      setVideo(videoData);

      if (videoData) {
        incrementViewCount(id);

        // Load comments and reactions separately - don't block video if indexes are missing
        const [commentsResult, reactionsResult] = await Promise.allSettled([
          getComments(id),
          getReactions(id),
        ]);

        if (commentsResult.status === 'fulfilled') {
          setComments(commentsResult.value);
        } else {
          console.warn('[FeedbackDetail] Comments yüklenemedi (index gerekli olabilir):', commentsResult.reason);
        }

        if (reactionsResult.status === 'fulfilled') {
          setReactions(reactionsResult.value);
        } else {
          console.warn('[FeedbackDetail] Reactions yüklenemedi (index gerekli olabilir):', reactionsResult.reason);
        }
      }
    } catch (err) {
      console.error('[FeedbackDetail] Error loading video:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll for transcribing status updates
  useEffect(() => {
    if (!id || !video || video.status !== 'transcribing') return;
    const interval = setInterval(async () => {
      try {
        const updated = await getFeedbackVideo(id);
        if (updated && updated.status !== 'transcribing') {
          setVideo(updated);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, video?.status]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !user || !id) return;

    setSubmitting(true);
    try {
      await addComment(
        { videoId: id, timestamp: Math.floor(currentTime), text: commentText.trim() },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      setCommentText('');
      const updatedComments = await getComments(id);
      setComments(updatedComments);
    } catch (err) {
      console.error('[FeedbackDetail] Error adding comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id) return;
    try {
      await deleteComment(commentId, id);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('[FeedbackDetail] Error deleting comment:', err);
    }
  };

  const handleToggleReaction = async (emoji: string) => {
    if (!user || !id) return;
    try {
      await toggleReaction(id, emoji, Math.floor(currentTime), user.uid, user.displayName || '');
      const updatedReactions = await getReactions(id);
      setReactions(updatedReactions);
    } catch (err) {
      console.error('[FeedbackDetail] Error toggling reaction:', err);
    }
    setShowEmojiPicker(false);
  };

  const handleCopyLink = async () => {
    if (!video) return;
    const url = `${window.location.origin}/feedback/${video.shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTogglePublic = async () => {
    if (!video || !id) return;
    await updateFeedbackVideo(id, { isPublic: !video.isPublic });
    setVideo({ ...video, isPublic: !video.isPublic });
  };

  const handleDelete = async () => {
    if (!id || !confirm('Bu videoyu silmek istediginize emin misiniz?')) return;
    setDeleting(true);
    try {
      await deleteFeedbackVideo(id);
      navigate('/admin/feedback');
    } catch (err) {
      console.error('[FeedbackDetail] Error deleting video:', err);
      setDeleting(false);
    }
  };

  const handleCommentClick = (comment: FeedbackComment) => {
    // Scroll to comment in list
    const el = document.getElementById(`comment-${comment.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const modeIcons: Record<string, React.ElementType> = {
    screen: Monitor,
    camera: Camera,
    screen_camera: MonitorSmartphone,
  };

  // Group reactions by emoji
  const reactionGroups = reactions.reduce<Record<string, { count: number; userReacted: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, userReacted: false };
    }
    acc[r.emoji].count++;
    if (r.createdBy === user?.uid) {
      acc[r.emoji].userReacted = true;
    }
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-commons text-neutral-600">Video bulunamadi</p>
        <button
          onClick={() => navigate('/admin/feedback')}
          className="mt-4 text-indigo-600 font-commons text-sm hover:underline"
        >
          Geri Don
        </button>
      </div>
    );
  }

  const ModeIcon = modeIcons[video.recordingMode] || Monitor;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/feedback')}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-ramillas font-bold text-[#171717]">
            {video.title}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm font-commons text-neutral-500">
            <span>{video.createdByName}</span>
            <span>-</span>
            <span>
              {new Date(video.createdAt).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Kopyalandi' : 'Linki Kopyala'}
          </motion.button>

          {(can(PERMISSIONS.FEEDBACK_DELETE) || video.createdBy === user?.uid) && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Videoyu sil"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main content: Video + Comments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Column */}
        <div className="lg:col-span-2 space-y-4">
          <VideoPlayer
            src={video.videoUrl}
            comments={comments}
            onTimeUpdate={setCurrentTime}
            onCommentClick={handleCommentClick}
          />

          {/* AI transcribing indicator */}
          {video.status === 'transcribing' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
              <p className="text-sm font-commons text-blue-700">
                AI baslik ve aciklama olusturuyor... Tamamlandiginda otomatik guncellenecek.
              </p>
            </div>
          )}

          {/* Video info */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 space-y-4">
            {/* Stats row */}
            <div className="flex items-center gap-4 text-sm font-commons text-neutral-500">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {video.viewCount} goruntulenme
              </span>
              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" />
                {comments.length} yorum
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {formatDuration(video.duration)}
              </span>
              <span className="flex items-center gap-1.5">
                <ModeIcon className="w-4 h-4" />
                {RECORDING_MODE_LABELS[video.recordingMode]}
              </span>
            </div>

            {/* Description */}
            {video.description && (
              <p className="text-sm font-commons text-neutral-600">
                {video.description}
              </p>
            )}

            {/* Sharing toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <div className="flex items-center gap-2 text-sm font-commons">
                {video.isPublic ? (
                  <>
                    <Globe className="w-4 h-4 text-green-600" />
                    <span className="text-green-700">Herkese acik</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-neutral-500" />
                    <span className="text-neutral-600">Ozel</span>
                  </>
                )}
              </div>
              {(can(PERMISSIONS.FEEDBACK_MANAGE) || video.createdBy === user?.uid) && (
                <button
                  onClick={handleTogglePublic}
                  className="text-sm font-commons text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  {video.isPublic ? 'Ozel Yap' : 'Herkese Ac'}
                </button>
              )}
            </div>

            {/* Reactions */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-neutral-100">
              {Object.entries(reactionGroups).map(([emoji, { count, userReacted }]) => (
                <button
                  key={emoji}
                  onClick={() => handleToggleReaction(emoji)}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-commons transition-colors
                    ${userReacted
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-neutral-100 text-neutral-600 border border-neutral-200 hover:bg-neutral-200'
                    }
                  `}
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </button>
              ))}

              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <Smile className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {showEmojiPicker && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowEmojiPicker(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-neutral-200 p-2 flex gap-1 z-20"
                      >
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(emoji)}
                            className="w-9 h-9 rounded-lg hover:bg-neutral-100 flex items-center justify-center text-lg transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Column */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100">
              <h2 className="font-commons font-medium text-[#171717]">
                Yorumlar ({comments.length})
              </h2>
            </div>

            {/* Comment input */}
            {can(PERMISSIONS.FEEDBACK_COMMENT) && (
              <div className="px-5 py-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      placeholder={`${formatDuration(Math.floor(currentTime))} aninda yorum yaz...`}
                      className="w-full px-3 py-2 pr-10 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-commons text-neutral-400">
                      {formatDuration(Math.floor(currentTime))}
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || submitting}
                    className="p-2 rounded-lg bg-[#171717] text-white hover:bg-[#171717]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* Comments list */}
            <div className="max-h-[500px] overflow-y-auto divide-y divide-neutral-100">
              {comments.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <MessageCircle className="w-8 h-8 text-neutral-300 mx-auto" />
                  <p className="mt-2 text-sm font-commons text-neutral-400">
                    Henuz yorum yok
                  </p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    id={`comment-${comment.id}`}
                    className="px-5 py-3 hover:bg-neutral-50 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-commons text-sm font-medium text-[#171717] truncate">
                            {comment.createdByName}
                          </span>
                          <button
                            onClick={() => {
                              // Seek video to comment timestamp
                              const video = document.querySelector('video');
                              if (video) video.currentTime = comment.timestamp;
                            }}
                            className="flex-shrink-0 text-xs font-commons text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors"
                          >
                            {formatDuration(comment.timestamp)}
                          </button>
                        </div>
                        <p className="text-sm font-commons text-neutral-600 mt-1">
                          {comment.text}
                        </p>
                        <p className="text-xs font-commons text-neutral-300 mt-1">
                          {new Date(comment.createdAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      {(can(PERMISSIONS.FEEDBACK_DELETE) || comment.createdBy === user?.uid) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 rounded text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDetailPage;
