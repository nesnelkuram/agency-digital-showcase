import React from 'react';
import { Circle, Pause, Play, Square, X } from 'lucide-react';
import type { RecordingMode } from '@/shared/types/feedback';
import { formatDuration } from '@/shared/types/feedback';

interface PiPRecordingControlsProps {
  duration: number;
  isPaused: boolean;
  recordingMode: RecordingMode | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}

const modeLabels: Record<string, string> = {
  screen: 'Ekran',
  camera: 'Kamera',
  screen_camera: 'Ekran + Kamera',
};

const PiPRecordingControls: React.FC<PiPRecordingControlsProps> = ({
  duration,
  isPaused,
  recordingMode,
  onPause,
  onResume,
  onStop,
  onCancel,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: '#171717',
        color: '#fff',
        padding: '12px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        height: '100vh',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* Recording indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <Circle
          size={10}
          fill="#ef4444"
          color="#ef4444"
          style={isPaused ? {} : { animation: 'pip-pulse 1.5s ease-in-out infinite' }}
        />
        <span style={{ fontSize: '12px', color: '#a3a3a3', whiteSpace: 'nowrap' }}>
          {isPaused ? 'Duraklatildi' : (modeLabels[recordingMode || ''] || 'Kayit')}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: '#525252', flexShrink: 0 }} />

      {/* Timer */}
      <span
        style={{
          fontSize: '13px',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          minWidth: '42px',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        {formatDuration(duration)}
      </span>

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: '#525252', flexShrink: 0 }} />

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Pause / Resume */}
        {isPaused ? (
          <button
            onClick={onResume}
            title="Devam Et"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: '#4f46e5',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Play size={14} style={{ marginLeft: '1px' }} />
          </button>
        ) : (
          <button
            onClick={onPause}
            title="Duraklat"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: '#525252',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pause size={14} />
          </button>
        )}

        {/* Stop */}
        <button
          onClick={onStop}
          title="Kaydi Durdur"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: '#dc2626',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Square size={14} fill="currentColor" />
        </button>

        {/* Cancel */}
        <button
          onClick={onCancel}
          title="Iptal"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: '#404040',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Pulse animation for PiP window */}
      <style>{`
        @keyframes pip-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default PiPRecordingControls;
