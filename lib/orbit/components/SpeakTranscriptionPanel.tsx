'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Trash2 } from 'lucide-react';
import styles from '@/styles/Eburon.module.css';
import { OrbitMicVisualizer } from './OrbitMicVisualizer';

interface SpeakTranscriptionPanelProps {
  deviceId?: string;
  deepgram: {
    isListening: boolean;
    transcript: string;
    isFinal: boolean;
    start: (deviceId?: string) => Promise<void>;
    stop: () => void;
    error: string | null;
    analyser: AnalyserNode | null;
  };
  meetingId?: string | null;
  roomCode?: string;
  userId?: string;
}

export function SpeakTranscriptionPanel({ 
  deviceId, 
  deepgram,
  meetingId,
  roomCode,
  userId
}: SpeakTranscriptionPanelProps) {
  const {
    isListening,
    transcript,
    isFinal,
    start,
    stop,
    error,
    analyser
  } = deepgram;

  const meetingIdToUse = meetingId || roomCode || 'Orbit-Session';

  const [transcripts, setTranscripts] = useState<Array<{
    id: string;
    text: string;
    isFinal: boolean;
    timestamp: Date;
  }>>([]);

  // Handle new transcripts & Persist to DB
  useEffect(() => {
    if (transcript && isFinal) {
      setTranscripts(prev => [...prev, {
        id: Math.random().toString(),
        text: transcript,
        isFinal: true,
        timestamp: new Date()
      }]);

      // Shared Binding: Persist to DB for Listeners
      if (meetingIdToUse && userId && userId !== '') {
        import('@/lib/orbit/services/orbitService').then(service => {
          service.saveUtterance(meetingIdToUse, userId, transcript, 'multi');
        });
      }
    }
  }, [transcript, isFinal, meetingIdToUse, userId]);

  const handleToggle = () => {
    if (isListening) {
      stop();
    } else {
      start(deviceId);
    }
  };

  const handleClear = () => {
    setTranscripts([]);
  };

  return (
    <div className={styles.sidebarPanel}>
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarHeaderText}>
          <div className="flex items-center gap-2">
            <Mic size={16} />
            <h3 className="uppercase tracking-widest text-[11px] font-bold">Live Transcription</h3>
          </div>
          <div className={styles.sidebarHeaderMeta}>
            <span className={`text-[10px] uppercase tracking-wide font-medium ${isListening ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isListening ? 'Listening...' : 'Ready'}
            </span>
          </div>
        </div>
        <div className={styles.sidebarHeaderActions}>
          <button onClick={handleClear} className={styles.sidebarHeaderButton} title="Clear">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Meeting Context Binding Info */}
      <div className="px-4 py-2 border-b border-white/5 bg-[#070707]/30 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold font-plus-jakarta">Meeting Context</span>
          <code className="text-[10px] text-lime-400 font-mono flex items-center gap-1.5 line-clamp-1">
            <span className="w-1 h-1 rounded-full bg-lime-500 animate-pulse" />
            {(roomCode || 'Lobby').toUpperCase()}
          </code>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold font-plus-jakarta">Invite Code</span>
          <span className="text-[10px] text-slate-400 font-mono">
            {String(meetingIdToUse).slice(0, 8).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.agentPanelBody}>
        <div className={styles.agentControls}>
          <button
            onClick={handleToggle}
            className={`${styles.agentControlButton} ${isListening ? styles.agentControlButtonActiveListen : ''}`}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            <span>{isListening ? 'Stop' : 'Start'}</span>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-4 py-2 text-xs text-rose-400 bg-rose-500/10 rounded-lg mx-4 mt-2">
            {error}
          </div>
        )}

        {/* Transcript Feed */}
        <div className={styles.agentLogs}>
          {transcripts.length === 0 && !transcript && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-50">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/5 flex items-center justify-center">
                <Mic size={24} className="text-slate-500" strokeWidth={1} />
              </div>
              <p className="text-xs font-medium tracking-wide">Tap Start to begin transcription</p>
            </div>
          )}

          {/* Final transcripts */}
          {transcripts.map((t) => (
            <div key={t.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 mb-4">
              <div className="bg-gradient-to-br from-[#151d2b] to-[#0f141f] border border-lime-500/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-lime-500 shadow-[0_0_8px_rgba(132,204,22,0.4)]" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-lime-500">
                    {t.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-slate-100 leading-relaxed">{t.text}</p>
              </div>
            </div>
          ))}

          {/* Current interim transcript */}
          {transcript && !isFinal && (
            <div className="animate-pulse mb-4">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500">
                    Speaking...
                  </span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed italic">{transcript}</p>
              </div>
            </div>
          )}

          <div className="h-4" />
        </div>

        {/* Audio Visualizer at the absolute bottom-most position */}
        <div className="mt-auto flex items-center justify-center border-t border-white/5 bg-[#070707]/90 backdrop-blur-xl sticky bottom-0 z-50 py-3">
          <div className="bg-slate-900/40 rounded-full px-4 py-1.5 border border-white/5 flex items-center gap-3 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
             <div className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-slate-700'}`} />
             <OrbitMicVisualizer analyser={analyser} isRecording={isListening} />
          </div>
        </div>
      </div>
    </div>
  );
}
