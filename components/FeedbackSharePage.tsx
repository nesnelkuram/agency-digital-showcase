import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock,
  Eye,
  MessageCircle,
  Send,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import {
  getFeedbackVideoByShareToken,
  getComments,
  addComment,
  incrementViewCount,
} from '@/shared/services/feedbackService';
import type { FeedbackVideo, FeedbackComment } from '@/shared/types/feedback';
import { formatDuration } from '@/shared/types/feedback';

const FeedbackSharePage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [video, setVideo] = useState<FeedbackVideo | null>(null);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!shareToken) return;
      try {
        setLoading(true);
        const v = await getFeedbackVideoByShareToken(shareToken);
        if (!v || !v.isPublic) {
          setNotFound(true);
          return;
        }
        setVideo(v);
        const c = await getComments(v.id);
        setComments(c);
        incrementViewCount(v.id);
      } catch (err) {
        console.error('[FeedbackShare] Error:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [shareToken]);

  // Video event listeners
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => setCurrentTime(vid.currentTime);
    const onMeta = () => setDuration(vid.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('loadedmetadata', onMeta);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('loadedmetadata', onMeta);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
    };
  }, [video]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.paused ? vid.play() : vid.pause();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    const bar = progressRef.current;
    if (!vid || !bar) return;
    const rect = bar.getBoundingClientRect();
    vid.currentTime = ((e.clientX - rect.left) / rect.width) * vid.duration;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !video) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-center px-4">
        <div>
          <h1 className="text-2xl font-ramillas font-bold text-white">
            Video bulunamadi
          </h1>
          <p className="text-neutral-400 font-commons mt-2">
            Bu link gecersiz veya video ozel olarak ayarlanmis olabilir.
          </p>
          <Link
            to="/"
            className="inline-block mt-6 text-indigo-400 hover:text-indigo-300 font-commons text-sm"
          >
            Ana sayfaya don
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Video Player */}
        <div
          className="relative bg-black rounded-xl overflow-hidden"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="w-full aspect-video object-contain cursor-pointer"
            onClick={togglePlay}
            playsInline
          />

          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <Play className="w-7 h-7 text-[#171717] ml-1" />
              </div>
            </div>
          )}

          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-8 transition-opacity ${isHovering || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
            <div
              ref={progressRef}
              className="relative h-1.5 bg-white/30 rounded-full cursor-pointer mb-3"
              onClick={handleProgressClick}
            >
              <div className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
              {comments.map((c, i) => (
                <button
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-white/50 z-10"
                  style={{ left: `${duration > 0 ? (c.timestamp / duration) * 100 : 0}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) videoRef.current.currentTime = c.timestamp;
                  }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="text-white">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }} className="text-white/70 hover:text-white">
                  <SkipBack className="w-4 h-4" />
                </button>
                <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }} className="text-white/70 hover:text-white">
                  <SkipForward className="w-4 h-4" />
                </button>
                <span className="text-white/80 text-xs font-commons">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setIsMuted(!isMuted); } }} className="text-white/70 hover:text-white">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button onClick={() => videoRef.current?.requestFullscreen()} className="text-white/70 hover:text-white">
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Info */}
        <div className="mt-6">
          <h1 className="text-xl font-ramillas font-bold text-white">
            {video.title}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm font-commons text-neutral-400">
            <span>{video.createdByName}</span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {video.viewCount}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(video.duration)}
            </span>
            <span>
              {new Date(video.createdAt).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          {video.description && (
            <p className="mt-3 text-sm font-commons text-neutral-300">
              {video.description}
            </p>
          )}
        </div>

        {/* Comments (read-only for public) */}
        <div className="mt-8">
          <h2 className="font-commons font-medium text-white mb-4">
            Yorumlar ({comments.length})
          </h2>
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm font-commons text-neutral-500">Henuz yorum yok</p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-white/5 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-commons text-sm font-medium text-white">
                      {comment.createdByName}
                    </span>
                    <button
                      onClick={() => {
                        if (videoRef.current) videoRef.current.currentTime = comment.timestamp;
                      }}
                      className="text-xs font-commons text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-md hover:bg-indigo-400/20 transition-colors"
                    >
                      {formatDuration(comment.timestamp)}
                    </button>
                  </div>
                  <p className="text-sm font-commons text-neutral-300">
                    {comment.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Powered by intiba */}
        <div className="mt-12 text-center">
          <span className="font-commons text-sm text-neutral-600">
            Powered by{' '}
            <Link to="/" className="text-white font-bold hover:text-indigo-400 transition-colors">
              intiba
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
};

export default FeedbackSharePage;
