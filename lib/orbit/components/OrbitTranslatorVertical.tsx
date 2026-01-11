'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import styles from './OrbitTranslator.module.css';
import sharedStyles from '@/styles/Eburon.module.css';
import { LANGUAGES } from '@/lib/orbit/types';
import { Volume2, ChevronDown, Trash2, Mic, Send, MicOff } from 'lucide-react';

// Orbit Planet Icon SVG
const OrbitIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="planetGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60666e" />
        <stop offset="50%" stopColor="#3d4147" />
        <stop offset="100%" stopColor="#1a1c1f" />
      </linearGradient>
      <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#888" stopOpacity="0.3" />
        <stop offset="50%" stopColor="#ccc" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#888" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    <ellipse
      cx="16"
      cy="16"
      rx="14"
      ry="5"
      stroke="url(#ringGradient)"
      strokeWidth="1.5"
      fill="none"
      transform="rotate(-20 16 16)"
    />
    <circle cx="16" cy="16" r="9" fill="url(#planetGradient)" />
    <path
      d="M 2 16 Q 16 21, 30 16"
      stroke="url(#ringGradient)"
      strokeWidth="1.5"
      fill="none"
      transform="rotate(-20 16 16)"
    />
  </svg>
);

interface OrbitTranslatorVerticalProps {
  roomCode: string;
  userId: string;
  onLiveTextChange?: (text: string) => void;
  audioDevices?: MediaDeviceInfo[];
  selectedDeviceId?: string;
  onDeviceIdChange?: (deviceId: string) => void;
  onListeningChange?: (isListening: boolean) => void;
  deepgram: {
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
}

export function OrbitTranslatorVertical({ 
  roomCode, 
  userId, 
  onLiveTextChange,
  audioDevices = [],
  selectedDeviceId = '',
  onDeviceIdChange,
  onListeningChange,
  deepgram,
  meetingId
}: OrbitTranslatorVerticalProps) {
  // --- Core state ---
  const [messages, setMessages] = useState<Array<{
    id: string;
    text: string;
    translation?: string;
    speakerId: string;
    isMe: boolean;
    timestamp: Date;
  }>>([]);
  const [liveText, setLiveText] = useState('');
  const [transcripts, setTranscripts] = useState<Array<{
    id: string;
    text: string;
    isFinal: boolean;
    timestamp: Date;
    source: 'local' | 'remote';
  }>>([]);

  const {
    isListening: isOrbitListening,
    transcript: orbitTranscript,
    isFinal: isOrbitFinal,
    start: startOrbit,
    stop: stopOrbit,
    error: orbitError,
    detectedLanguage: orbitDetectedLanguage
  } = deepgram;

  // Track if we should play TTS
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const ttsEnabledRef = useRef(ttsEnabled);
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  const meetingIdToUse = meetingId || roomCode || 'Orbit-Session';

  // --- Translation & TTS ---
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES.find(l => l.code === 'vls-BE') || LANGUAGES[0]);
  const [manualText, setManualText] = useState('');

  // Track last processed transcript
  const lastTranscriptRef = useRef<string>('');

  // Audio Playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Pipeline queue
  const processingQueueRef = useRef<any[]>([]);
  const isProcessingRef = useRef(false);

  // Refs
  const selectedLanguageRef = useRef(selectedLanguage);
  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
    // Sync with Orbit STT
    if (deepgram.setLanguage) {
      deepgram.setLanguage(selectedLanguage.code);
    }
  }, [selectedLanguage, deepgram]);

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    const ctx = ensureAudioContext();
    if (!ctx) {
      isPlayingRef.current = false;
      return;
    }

    const nextBuffer = audioQueueRef.current.shift();
    if (!nextBuffer) {
      isPlayingRef.current = false;
      return;
    }

    try {
      const audioBuffer = await ctx.decodeAudioData(nextBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        isPlayingRef.current = false;
        playNextAudio();
      };
      source.start();
    } catch (e) {
      console.error('Audio playback error', e);
      isPlayingRef.current = false;
      playNextAudio();
    }
  }, [ensureAudioContext]);

  const processNextInQueue = useCallback(async () => {
    if (isProcessingRef.current || processingQueueRef.current.length === 0) return;
    isProcessingRef.current = true;

    const item = processingQueueRef.current.shift();
    if (!item) {
      isProcessingRef.current = false;
      return;
    }

    try {
      // 1) Translate via Orbit Cloud (streaming response)
      const targetLang = selectedLanguageRef.current.name;
      const targetCode = selectedLanguageRef.current.code;
      let translated = item.text;
      
      try {
        if (targetCode !== 'auto') {
          const tRes = await fetch('/api/orbit/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: item.text, targetLang }),
          });
          
          if (tRes.ok && tRes.body) {
            // Handle streaming response from Orbit
            const reader = tRes.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              // Parse NDJSON stream from Orbit
              const lines = chunk.split('\n').filter(l => l.trim());
              for (const line of lines) {
                try {
                  const json = JSON.parse(line);
                  if (json.message?.content) {
                    fullText += json.message.content;
                  }
                } catch {}
              }
            }
            
            if (fullText.trim()) {
              translated = fullText.trim();
            }
          }
        }
      } catch (translateError) {
        console.warn('Translation API failed, using original text', translateError);
      }

      setMessages(prev => [...prev, {
        id: item.id || Math.random().toString(),
        text: item.text,
        translation: translated !== item.text ? translated : undefined,
        speakerId: item.speakerId || 'remote',
        isMe: item.isMe ?? false,
        timestamp: new Date()
      }]);

      // 2) TTS via Orbit
      if (ttsEnabledRef.current) {
        try {
          const ttsRes = await fetch('/api/orbit/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: translated }),
          });
          const arrayBuffer = await ttsRes.arrayBuffer();
          if (arrayBuffer.byteLength > 0) {
            audioQueueRef.current.push(arrayBuffer);
            playNextAudio();
          }
        } catch (ttsError) {
          console.warn('TTS API failed', ttsError);
        }
      }
    } catch (e) {
      console.error('Pipeline error', e);
    } finally {
      isProcessingRef.current = false;
      processNextInQueue();
    }
  }, [playNextAudio]);

  // Handle Orbit transcript changes
  useEffect(() => {
    // Show interim transcript
    if (orbitTranscript && !isOrbitFinal) {
      setLiveText(orbitTranscript);
    }

    // When final, push to translation queue
    if (isOrbitFinal && orbitTranscript) {
      if (orbitTranscript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = orbitTranscript;
        setLiveText('');
        
        processingQueueRef.current.push({
          text: orbitTranscript,
          id: Math.random().toString(),
          speakerId: userId || 'orbit-mic',
          isMe: true
        });
        processNextInQueue();

        // Shared Binding: Persist to DB for others
        if (meetingIdToUse && userId && userId !== '') {
          import('@/lib/orbit/services/orbitService').then(service => {
            service.saveUtterance(meetingIdToUse, userId, orbitTranscript, 'multi');
          });
        }
      }
    }
  }, [orbitTranscript, isOrbitFinal, processNextInQueue, meetingIdToUse, userId]);

  // Shared Binding: Subscribe to DB Transcripts from others
  useEffect(() => {
    if (!meetingIdToUse) return;

    let channel: any = null;

    import('@/lib/orbit/services/orbitService').then(service => {
      channel = service.subscribeToTranscriptions(meetingIdToUse, (newTranscript) => {
        // Only add if it's NOT from us
        if (newTranscript.speaker_id !== userId) {
          console.log(`[Shared Binding] Received remote transcript: "${newTranscript.transcribe_text_segment}"`);
          processingQueueRef.current.push({
            text: newTranscript.transcribe_text_segment,
            id: newTranscript.id,
            speakerId: newTranscript.speaker_id,
            isMe: false
          });
          processNextInQueue();
        }
      });
    });

    return () => {
      if (channel) {
        import('@/lib/orbit/services/supabaseClient').then(({ supabase }) => {
          supabase.removeChannel(channel);
        });
      }
    };
  }, [meetingIdToUse, userId, processNextInQueue]);

  // Handle Orbit errors
  useEffect(() => {
    if (orbitError) {
      toast.error(orbitError);
    }
  }, [orbitError]);

  // Toggle Orbit listening
  const handleListenToggle = useCallback(() => {
    if (isOrbitListening) {
      stopOrbit();
      onListeningChange?.(false);
    } else {
      startOrbit(selectedDeviceId || undefined);
      onListeningChange?.(true);
    }
  }, [isOrbitListening, startOrbit, stopOrbit, selectedDeviceId, onListeningChange]);

  const handleManualSubmit = useCallback(() => {
    if (!manualText.trim()) return;

    // Push to processing queue just like recognized speech
    processingQueueRef.current.push({
      text: manualText,
      id: Math.random().toString(),
      speakerId: 'manual', 
      isMe: true, // Treat as local user
    });

    processNextInQueue();
    setManualText('');
  }, [manualText, processNextInQueue]);

  return (
    <div className={sharedStyles.sidebarPanel}>
      {/* Header */}
      <div className={sharedStyles.sidebarHeader}>
        <div className={sharedStyles.sidebarHeaderText}>
          <div className="flex items-center gap-2">
            <OrbitIcon size={18} />
            <h3 className="uppercase tracking-widest text-[11px] font-bold">Orbit Translator</h3>
          </div>
          <div className={sharedStyles.sidebarHeaderMeta}>
            <div className="flex items-center gap-1.5 mt-1">
              {isOrbitListening && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
              <span className={`text-[10px] uppercase tracking-wide font-medium ${isOrbitListening ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isOrbitListening 
                  ? (orbitDetectedLanguage ? `Detected: ${orbitDetectedLanguage.toUpperCase()}` : 'Listening...')
                  : 'Ready'}
              </span>
            </div>
          </div>
        </div>
        <div className={sharedStyles.sidebarHeaderActions}>
          <button
            onClick={() => setMessages([])}
            className={sharedStyles.sidebarHeaderButton}
            title="Clear Feed"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>


      <div className={sharedStyles.agentPanelBody}>
        {/* Main Controls */}
        <div className={sharedStyles.agentControls}>
          {/* Listen (Orbit STT) Button */}
          <button
            onClick={handleListenToggle}
            className={`${sharedStyles.agentControlButton} ${
              isOrbitListening ? sharedStyles.agentControlButtonActiveListen : ''
            }`}
          >
            {isOrbitListening ? <MicOff size={18} /> : <Mic size={18} />}
            <span>{isOrbitListening ? 'Stop Listening' : 'Start Listening'}</span>
          </button>

          {/* TTS Toggle */}
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`${sharedStyles.agentControlButton} ${
              ttsEnabled ? sharedStyles.agentControlButtonActiveListen : ''
            }`}
          >
            <Volume2 size={18} />
            <span>{ttsEnabled ? 'TTS On' : 'TTS Off'}</span>
          </button>
        </div>



        {/* Audio Source */}
        <div className={sharedStyles.agentSection}>
          <label className={sharedStyles.agentSectionLabel}>
            <span>Audio Source</span>
            <span className={sharedStyles.agentSectionDivider} />
          </label>
          <div className={sharedStyles.agentSelectWrap}>
            <select
              aria-label="Audio source"
              className={`${sharedStyles.sidebarSelect} ${sharedStyles.agentSelect}`}
              value={selectedDeviceId}
              onChange={(e) => onDeviceIdChange?.(e.target.value)}
            >
              {audioDevices.length === 0 ? (
                 <option value="" disabled>No microphones found</option>
              ) : (
                 audioDevices.map((device) => (
                   <option key={device.deviceId} value={device.deviceId}>
                     {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                   </option>
                 ))
              )}
            </select>
            <div className={sharedStyles.agentSelectIcon}>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* Target Language */}
        <div className={sharedStyles.agentSection}>
          <label className={sharedStyles.agentSectionLabel}>
            <span>Target Language</span>
            <span className={sharedStyles.agentSectionDivider} />
          </label>
          <div className={sharedStyles.agentSelectWrap}>
            <select
              aria-label="Target language"
              className={`${sharedStyles.sidebarSelect} ${sharedStyles.agentSelect}`}
              value={selectedLanguage.code}
              onChange={(e) => {
                const lang = LANGUAGES.find((l) => l.code === e.target.value) || LANGUAGES[0];
                setSelectedLanguage(lang);
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
            <div className={sharedStyles.agentSelectIcon}>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* Manual Input (Test) */}
        <div className={sharedStyles.agentSection}>
          <label className={sharedStyles.agentSectionLabel}>
            <span>Test Input</span>
            <span className={sharedStyles.agentSectionDivider} />
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className={`${sharedStyles.sidebarSelect} flex-1 min-w-0`}
              style={{ paddingRight: '8px' }}
              placeholder="Type to speak..."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualSubmit();
              }}
            />
            <button
              onClick={handleManualSubmit}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:scale-105 transition-all active:scale-95 border border-emerald-500/20"
              title="Speak"
              disabled={!manualText.trim()}
            >
              <Send size={14} />
            </button>
          </div>
        </div>

        {/* Activity Feed */}
        <div className={sharedStyles.agentLogs}>
          {messages.length === 0 && !liveText && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-50">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/5 flex items-center justify-center">
                <span className="text-xl">...</span>
              </div>
              <p className="text-xs font-medium tracking-wide">Ready for input</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500 mb-6">
              {/* Original */}
              <div className={`group relative pl-3.5 mb-3 opacity-80 hover:opacity-100 transition-opacity ${msg.isMe ? 'text-right pr-3.5 pl-0' : ''}`}>
                <div className={`absolute ${msg.isMe ? 'right-0' : 'left-0'} top-1.5 bottom-1.5 w-[2px] bg-slate-800 rounded-full group-hover:bg-indigo-500/50 transition-colors`} />
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 font-semibold">
                  {msg.isMe ? 'You' : 'Original'}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed font-light">{msg.text}</p>
              </div>

              {/* Translation (if exists) */}
              {msg.translation && (
                <div className="bg-gradient-to-br from-[#151d2b] to-[#0f141f] border border-emerald-500/10 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500">Translated</span>
                  </div>
                  <p className="text-sm text-slate-100 leading-relaxed font-medium italic">{msg.translation}</p>
                </div>
              )}
            </div>
          ))}

          {liveText && (
            <div className="animate-pulse">
              <div className="group relative pl-3.5 mb-3 text-right pr-3.5 pl-0">
                <div className="absolute right-0 top-1.5 bottom-1.5 w-[2px] bg-rose-500/50 rounded-full" />
                <p className="text-[10px] uppercase tracking-wide text-rose-500 mb-1 font-semibold">Speaking...</p>
                <p className="text-xs text-rose-200/80 leading-relaxed font-light italic">{liveText}</p>
              </div>
            </div>
          )}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}

export { OrbitIcon };