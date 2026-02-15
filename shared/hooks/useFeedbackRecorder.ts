import { useState, useRef, useCallback, useEffect } from 'react';
import type { RecordingMode } from '@/shared/types/feedback';

interface UseFeedbackRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingMode: RecordingMode | null;
  duration: number;
  previewStream: MediaStream | null;
  recordedBlob: Blob | null;
  recordedAudioBlob: Blob | null;
  startRecording: (mode: RecordingMode) => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<Blob>;
  cancelRecording: () => void;
  error: string | null;
  isSupported: boolean;
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}

// Adaptive bitrate and frame rate per recording mode
const RECORDING_CONFIG: Record<RecordingMode, {
  videoBitsPerSecond: number;
  frameRate: number;
}> = {
  screen: {
    videoBitsPerSecond: 1_000_000,  // 1.0 Mbps - static screen content
    frameRate: 15,
  },
  camera: {
    videoBitsPerSecond: 1_500_000,  // 1.5 Mbps - talking head
    frameRate: 30,
  },
  screen_camera: {
    videoBitsPerSecond: 1_500_000,  // 1.5 Mbps - mostly static + small PiP
    frameRate: 24,
  },
};

export function useFeedbackRecorder(): UseFeedbackRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null);
  const [duration, setDuration] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPageVisibleRef = useRef(true);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  const isSupported = typeof MediaRecorder !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined';

  // Cleanup all streams
  const cleanupStreams = useCallback(() => {
    [screenStreamRef, cameraStreamRef, canvasStreamRef, micStreamRef].forEach((streamRef) => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    });
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (canvasRef.current) {
      canvasRef.current = null;
    }
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      visibilityHandlerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setPreviewStream(null);
  }, []);

  // Start timer using Date.now() so background throttling doesn't affect displayed time
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    setDuration(0);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
      setDuration(Math.floor(elapsed / 1000));
    }, 1000);
  }, []);

  // Stop timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Get screen stream (audio fallback if not supported)
  const getScreenStream = useCallback(async (frameRate: number = 30): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: frameRate } },
        audio: true,
      });
    } catch (err: any) {
      // Some browsers don't support audio in getDisplayMedia - retry without
      if (err.name !== 'NotAllowedError') {
        return await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: frameRate } },
          audio: false,
        });
      }
      throw err;
    }
  }, []);

  // Get camera stream
  const getCameraStream = useCallback(async (): Promise<MediaStream> => {
    return navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: true,
    });
  }, []);

  // Merge microphone audio into a screen stream using Web Audio API
  const mergeAudioIntoStream = useCallback(
    (screenStream: MediaStream, micStream: MediaStream): MediaStream => {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      // Add system/tab audio if present
      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        const screenSource = audioContext.createMediaStreamSource(
          new MediaStream(screenAudioTracks)
        );
        screenSource.connect(destination);
      }

      // Add microphone audio
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);

      // Build final stream: screen video + mixed audio
      const combinedStream = new MediaStream();
      screenStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));
      destination.stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));

      return combinedStream;
    },
    []
  );

  // Combine screen + camera using canvas
  const combineStreams = useCallback(
    async (screenStream: MediaStream, cameraStream: MediaStream): Promise<MediaStream> => {
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;

      const ctx = canvas.getContext('2d')!;
      const screenVideo = document.createElement('video');
      const cameraVideo = document.createElement('video');

      // Set attributes before assigning stream
      screenVideo.playsInline = true;
      screenVideo.muted = true;
      cameraVideo.playsInline = true;
      cameraVideo.muted = true;

      screenVideo.srcObject = screenStream;
      cameraVideo.srcObject = cameraStream;

      // Wait for both videos to load their first frames
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          screenVideo.onloadeddata = () => resolve();
          screenVideo.onerror = () => reject(new Error('Ekran video yuklenemedi'));
          setTimeout(() => resolve(), 3000); // safety timeout
        }),
        new Promise<void>((resolve, reject) => {
          cameraVideo.onloadeddata = () => resolve();
          cameraVideo.onerror = () => reject(new Error('Kamera video yuklenemedi'));
          setTimeout(() => resolve(), 3000); // safety timeout
        }),
      ]);

      // Set canvas size from actual stream dimensions
      canvas.width = screenVideo.videoWidth || 1920;
      canvas.height = screenVideo.videoHeight || 1080;

      // Now start playback
      await Promise.all([
        screenVideo.play().catch(() => {}),
        cameraVideo.play().catch(() => {}),
      ]);

      const pipWidth = 240;
      const pipHeight = 180;
      const pipMargin = 20;
      const frameInterval = 1000 / RECORDING_CONFIG.screen_camera.frameRate;

      function drawFrame() {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

        // PiP camera - sag alt kose
        const pipX = canvas.width - pipWidth - pipMargin;
        const pipY = canvas.height - pipHeight - pipMargin;

        // Yuvarlak cerceve
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pipX, pipY, pipWidth, pipHeight, 12);
        ctx.clip();
        ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);
        ctx.restore();

        // Cerceve kenarligi
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(pipX, pipY, pipWidth, pipHeight, 12);
        ctx.stroke();
      }

      function scheduleNextFrame() {
        // Use requestAnimationFrame when visible, setTimeout when hidden
        // This ensures recording continues even when tab is in background
        if (isPageVisibleRef.current) {
          animFrameRef.current = requestAnimationFrame(() => {
            drawFrame();
            scheduleNextFrame();
          });
        } else {
          // Tab is hidden - use setTimeout to keep canvas updating for recording
          timeoutRef.current = setTimeout(() => {
            drawFrame();
            scheduleNextFrame();
          }, frameInterval);
        }
      }

      // Visibility change handler - stored in ref for cleanup
      const handleVisibilityChange = () => {
        isPageVisibleRef.current = !document.hidden;
      };
      visibilityHandlerRef.current = handleVisibilityChange;
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Draw first frame before capturing stream
      drawFrame();
      scheduleNextFrame();

      // Capture canvas stream after first frame is painted
      const canvasStream = canvas.captureStream(RECORDING_CONFIG.screen_camera.frameRate);

      // Add audio tracks
      const screenAudioTracks = screenStream.getAudioTracks();
      screenAudioTracks.forEach((track) => canvasStream.addTrack(track));

      // Add camera audio if screen has none
      const cameraAudioTracks = cameraStream.getAudioTracks();
      if (cameraAudioTracks.length > 0 && screenAudioTracks.length === 0) {
        cameraAudioTracks.forEach((track) => canvasStream.addTrack(track));
      }

      canvasStreamRef.current = canvasStream;
      return canvasStream;
    },
    []
  );

  const startRecording = useCallback(
    async (mode: RecordingMode) => {
      try {
        setError(null);
        setRecordedBlob(null);
        chunksRef.current = [];

        let recordStream: MediaStream;
        const config = RECORDING_CONFIG[mode];

        if (mode === 'screen') {
          const screen = await getScreenStream(config.frameRate);
          screenStreamRef.current = screen;

          // Capture microphone for narration during screen recording
          try {
            const mic = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            micStreamRef.current = mic;
            recordStream = mergeAudioIntoStream(screen, mic);

            // Keep AudioContext alive when tab goes to background
            const handleVisibility = () => {
              if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume().catch(() => {});
              }
            };
            visibilityHandlerRef.current = handleVisibility;
            document.addEventListener('visibilitychange', handleVisibility);
          } catch {
            // Microphone not available or denied - proceed with screen only
            recordStream = screen;
          }
        } else if (mode === 'camera') {
          const camera = await getCameraStream();
          cameraStreamRef.current = camera;
          recordStream = camera;
        } else {
          // screen_camera
          const screen = await getScreenStream(config.frameRate);
          screenStreamRef.current = screen;
          const camera = await getCameraStream();
          cameraStreamRef.current = camera;
          recordStream = await combineStreams(screen, camera);
        }

        setPreviewStream(recordStream);

        const mimeType = getSupportedMimeType();
        const recorder = new MediaRecorder(recordStream, {
          mimeType,
          videoBitsPerSecond: config.videoBitsPerSecond,
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onerror = () => {
          setError('Kayit sirasinda bir hata olustu');
          cleanupStreams();
          stopTimer();
          setIsRecording(false);
        };

        // Ekran paylasimi durdurulursa kaydi da durdur
        if (mode === 'screen' || mode === 'screen_camera') {
          const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
          if (screenTrack) {
            screenTrack.onended = () => {
              if (mediaRecorderRef.current?.state === 'recording') {
                stopRecording();
              }
            };
          }
        }

        mediaRecorderRef.current = recorder;
        // 500ms timeslice - daha sık keyframe ve header yazımı için
        // Bu seeking sorunlarını azaltır
        recorder.start(500);

        // Start parallel audio-only recorder for fast AI transcription
        const audioTracks = recordStream.getAudioTracks();
        if (audioTracks.length > 0) {
          try {
            const audioStream = new MediaStream(audioTracks);
            const audioMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : 'audio/webm';
            const audioRec = new MediaRecorder(audioStream, {
              mimeType: audioMime,
              audioBitsPerSecond: 32000, // 32kbps - small but clear for speech
            });
            audioChunksRef.current = [];
            audioRec.ondataavailable = (e) => {
              if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            audioRecorderRef.current = audioRec;
            audioRec.start(500);
          } catch {
            // Audio recording optional - ignore errors
          }
        }

        setIsRecording(true);
        setIsPaused(false);
        setRecordingMode(mode);
        startTimer();
      } catch (err: any) {
        const message = err.name === 'NotAllowedError'
          ? 'Ekran/kamera erisimi reddedildi'
          : err.name === 'NotFoundError'
          ? 'Kamera veya mikrofon bulunamadi'
          : err.message || 'Kayit baslatilirken hata olustu';
        setError(message);
        cleanupStreams();
      }
    },
    [getScreenStream, getCameraStream, combineStreams, mergeAudioIntoStream, cleanupStreams, startTimer, stopTimer]
  );

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (audioRecorderRef.current?.state === 'recording') {
        audioRecorderRef.current.pause();
      }
      pausedAtRef.current = Date.now();
      setIsPaused(true);
      stopTimer();
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      if (audioRecorderRef.current?.state === 'paused') {
        audioRecorderRef.current.resume();
      }
      // Accumulate the paused duration so elapsed time stays correct
      pausedDurationRef.current += Date.now() - pausedAtRef.current;
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
        setDuration(Math.floor(elapsed / 1000));
      }, 1000);
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('Kayit aktif degil'));
        return;
      }

      // Stop audio recorder first (non-blocking)
      const audioRec = audioRecorderRef.current;
      if (audioRec && audioRec.state !== 'inactive') {
        audioRec.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setRecordedAudioBlob(audioBlob);
          audioRecorderRef.current = null;
        };
        audioRec.stop();
      }

      recorder.onstop = () => {
        const mimeType = getSupportedMimeType();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        cleanupStreams();
        stopTimer();
        setIsRecording(false);
        setIsPaused(false);
        mediaRecorderRef.current = null;
        resolve(blob);
      };

      recorder.stop();
    });
  }, [cleanupStreams, stopTimer]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }
    chunksRef.current = [];
    audioChunksRef.current = [];
    cleanupStreams();
    stopTimer();
    setIsRecording(false);
    setIsPaused(false);
    setRecordedBlob(null);
    setRecordedAudioBlob(null);
    setRecordingMode(null);
    setDuration(0);
    mediaRecorderRef.current = null;
    audioRecorderRef.current = null;
  }, [cleanupStreams, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStreams();
      stopTimer();
    };
  }, [cleanupStreams, stopTimer]);

  return {
    isRecording,
    isPaused,
    recordingMode,
    duration,
    previewStream,
    recordedBlob,
    recordedAudioBlob,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    error,
    isSupported,
  };
}
