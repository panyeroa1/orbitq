'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Trash2 } from 'lucide-react';
import styles from '@/styles/Eburon.module.css';

interface SpeakTranscriptionPanelProps {
  deviceId?: string;
  orbit: {
    isListening: boolean;
    transcript: string;
    isFinal: boolean;
    start: (deviceId?: string) => Promise<void>;
    stop: () => void;
    setLanguage?: (lang: string) => void;
    language?: string;
    error: string | null;
    detectedLanguage: string | null;
  };
  meetingId?: string | null;
  roomCode?: string;
  userId?: string;
}

export function SpeakTranscriptionPanel({ 
  deviceId, 
  orbit: deepgram,
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
    detectedLanguage
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
            <h3 className="uppercase tracking-widest text-[11px] font-bold">Orbit Feed</h3>
          </div>
          <div className={styles.sidebarHeaderMeta}>
            <div className="flex items-center gap-1.5 mt-1">
              {isListening && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
              <span className={`text-[10px] uppercase tracking-wide font-medium ${isListening ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isListening 
                  ? (detectedLanguage ? `Detected: ${detectedLanguage.toUpperCase()}` : 'Listening...')
                  : 'Ready'}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.sidebarHeaderActions}>
          <button onClick={handleClear} className={styles.sidebarHeaderButton} title="Clear">
            <Trash2 size={12} />
          </button>
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
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/5 flex items-center justify-center">
                <span className="text-xl">...</span>
              </div>
              <p className="text-xs font-medium tracking-wide">Awaiting speech</p>
            </div>
          )}

          {/* Final transcripts */}
          <div className="flex flex-col gap-1">
            {transcripts.map((t) => (
              <div key={t.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                <div className="bg-[#151d2b]/40 border-l-2 border-lime-500/30 pl-3 py-1.5 hover:bg-[#151d2b]/60 transition-colors">
                  <p className="text-sm text-slate-100 leading-relaxed overflow-wrap-anywhere">
                    {t.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Current interim transcript */}
          {transcript && !isFinal && (
            <div className="animate-pulse mt-2">
              <div className="bg-slate-800/30 border-l-2 border-amber-500/30 pl-3 py-1.5">
                <p className="text-sm text-slate-400 leading-relaxed italic">{transcript}</p>
              </div>
            </div>
          )}

          <div className="h-4" />
        </div>

      </div>
    </div>
  );
}
