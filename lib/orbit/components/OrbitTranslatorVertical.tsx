'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as orbitService from '@/lib/orbit/services/orbitService';
import { toast } from 'react-hot-toast';
import styles from './OrbitTranslator.module.css';
import { OrbitSubtitleOverlay } from './OrbitSubtitleOverlay';
import { supabase } from '@/lib/orbit/services/supabaseClient';
import { LANGUAGES } from '@/lib/orbit/types';

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
}

export function OrbitTranslatorVertical({ roomCode, userId, onLiveTextChange }: OrbitTranslatorVerticalProps) {
  // --- Core state (kept) ---
  const [mode, setMode] = useState<'idle' | 'speaking'>('idle');
  const [messages, setMessages] = useState<Array<{
    id: string;
    text: string;
    translation?: string;
    speakerId: string;
    isMe: boolean;
    timestamp: Date;
  }>>([]);
  const [liveText, setLiveText] = useState('');
  const [isLockedByOther, setIsLockedByOther] = useState(false);
  // We use roomCode as our unique identifier for now, assuming it is the meeting ID
  const roomUuid = roomCode;

  const recognitionRef = useRef<any>(null);

  // --- Translation & TTS ---
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
  const [isListening, setIsListening] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState('');

  // UI: show last translated text (visual only)
  const [translatedPreview, setTranslatedPreview] = useState('');

  // Audio Playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Pipeline queue
  const processingQueueRef = useRef<any[]>([]);
  const isProcessingRef = useRef(false);

  // Refs to avoid stale closures
  const selectedLanguageRef = useRef(selectedLanguage);
  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  const isListeningRef = useRef(isListening);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

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
      // 1) Translate
      const targetLang = selectedLanguageRef.current.code;

      const tRes = await fetch('/api/orbit/translate', {
        method: 'POST',
        body: JSON.stringify({ text: item.text, targetLang }),
      });
      const tData = await tRes.json();
      const translated = tData.translation || item.text;

      setMessages(prev => [...prev, {
        id: item.id || Math.random().toString(),
        text: item.text,
        translation: translated,
        speakerId: item.speakerId || 'remote',
        isMe: false,
        timestamp: new Date()
      }]);

      // 2) TTS
      if (isListeningRef.current) {
        const ttsRes = await fetch('/api/orbit/tts', {
          method: 'POST',
          body: JSON.stringify({ text: translated }),
        });
        const arrayBuffer = await ttsRes.arrayBuffer();
        if (arrayBuffer.byteLength > 0) {
          audioQueueRef.current.push(arrayBuffer);
          playNextAudio();
        }
      }
    } catch (e) {
      console.error('Pipeline error', e);
    } finally {
      isProcessingRef.current = false;
      processNextInQueue();
    }
  }, [playNextAudio]);

  // Subscribe: lock state + transcript inserts
  useEffect(() => {
    if (!roomUuid) return;

    const channel = supabase
      .channel(`room:${roomUuid}:transcripts_modern`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcript_segments',
          filter: `meeting_id=eq.${roomUuid}`,
        },
        (payload: any) => {
          const isMe = payload.new.speaker_id === userId;
          
          if (!isMe) {
            if (isListeningRef.current) {
              processingQueueRef.current.push({ 
                text: payload.new.source_text || '',
                id: payload.new.id,
                speakerId: payload.new.speaker_id
              });
              processNextInQueue();
            } else {
              setMessages(prev => [...prev, {
                id: payload.new.id || Math.random().toString(),
                text: payload.new.source_text || '',
                speakerId: payload.new.speaker_id,
                isMe: false,
                timestamp: new Date()
              }]);
            }
          }
        }
      )
      .subscribe();

    const sub = orbitService.subscribeToRoomState(roomUuid, (state) => {
      const activeSpeaker = state.active_speaker_user_id;
      setIsLockedByOther(!!activeSpeaker && activeSpeaker !== userId);
    });

    return () => {
      sub.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [roomUuid, userId, processNextInQueue]);

  // Start WebSpeech
  const startWebSpeech = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('WebSpeech not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    const lang = selectedLanguageRef.current.code === 'auto' ? 'en-US' : selectedLanguageRef.current.code;
    recognition.lang = lang;

    recognition.onresult = async (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }

      const display = interim || final;
      setLiveText(display);
      onLiveTextChange?.(display);

      if (final.trim() && roomUuid) {
        const msgId = Math.random().toString();
        setMessages(prev => [...prev, {
          id: msgId,
          text: final,
          speakerId: userId,
          isMe: true,
          timestamp: new Date()
        }]);
        setLiveText('');

        const sentences = final
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const sentence of sentences) {
          orbitService
            .saveUtterance(roomUuid, userId, sentence, selectedLanguageRef.current.code)
            .catch((e) => console.warn(e));
        }
      }
    };

    recognition.onerror = (e: any) => {
      console.error('Speech recognition error:', e.error);
    };

    recognition.onend = () => {
      if (mode === 'speaking' && recognitionRef.current) {
        try {
          recognition.start();
        } catch {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error(e);
      toast.error('Unable to start microphone.');
    }
  }, [roomUuid, userId, mode, onLiveTextChange]);

  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setLiveText('');
    onLiveTextChange?.('');
  }, [onLiveTextChange]);

  const startSpeaking = useCallback(async () => {
    if (!roomUuid) {
      toast.error('Connecting to room...');
      return;
    }

    const acquired = await orbitService.acquireSpeakerLock(roomCode, userId);
    if (!acquired) {
      toast.error('Someone else is speaking');
      return;
    }

    setMode('speaking');
    startWebSpeech();
  }, [roomUuid, roomCode, userId, startWebSpeech]);

  const stopSpeaking = useCallback(async () => {
    stopWebSpeech();
    await orbitService.releaseSpeakerLock(roomCode, userId);
    setMode('idle');
  }, [roomCode, userId, stopWebSpeech]);

  const speakDisabled = isLockedByOther || !roomUuid;

  // Language dropdown click-outside
  const langMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = () =>
    new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

  const status = useMemo(() => {
    if (!roomUuid) return { label: 'Connecting', tone: 'amber' as const };
    if (mode === 'speaking') return { label: 'Live', tone: 'rose' as const };
    if (isLockedByOther) return { label: 'Locked', tone: 'orange' as const };
    return { label: 'Ready', tone: 'emerald' as const };
  }, [roomUuid, mode, isLockedByOther]);

  const statusChip = useMemo(() => {
    const base =
      'flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 shadow-sm backdrop-blur';
    const dotBase = 'w-1.5 h-1.5 rounded-full';
    if (status.tone === 'amber')
      return (
        <div className={`${base} text-amber-300`}>
          <div className={`${dotBase} bg-amber-400 ${styles.pulseSoft}`} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Connecting</span>
        </div>
      );
    if (status.tone === 'rose')
      return (
        <div className={`${base} text-rose-200`}>
          <div className={`${dotBase} bg-rose-400 ${styles.pingSoft}`} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Live</span>
        </div>
      );
    if (status.tone === 'orange')
      return (
        <div className={`${base} text-orange-200`}>
          <div className={`${dotBase} bg-orange-400`} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Locked</span>
        </div>
      );
    return (
      <div className={`${base} text-emerald-200`}>
        <div className={`${dotBase} bg-emerald-400`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Ready</span>
      </div>
    );
  }, [status.tone]);

  const filteredLanguages = useMemo(() => {
    const q = langQuery.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter((l) => `${l.name} ${l.code}`.toLowerCase().includes(q));
  }, [langQuery]);

  return (
    <div
      className={[
        'flex flex-col h-full text-slate-100 border-l border-white/5',
        'bg-[radial-gradient(1200px_800px_at_15%_-10%,rgba(99,102,241,0.18),transparent_60%),radial-gradient(900px_700px_at_90%_10%,rgba(16,185,129,0.12),transparent_55%),linear-gradient(to_bottom,#0b0f16,#07090d)]',
      ].join(' ')}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 px-5 py-4 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-md rounded-full" />
              <OrbitIcon size={22} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-[14px] tracking-wide text-slate-100">Orbit Translator</span>
              <span className="text-[11px] text-slate-400">
                Room <span className="text-slate-300 font-medium">{roomCode}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">{statusChip}</div>
        </div>
      </div>


      {/* Main */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Transcript */}
        <div className="flex-1 flex flex-col p-4 min-h-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Activity Feed</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMessages([])}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-tight"
              >
                Clear
              </button>
              <span className="text-[10px] text-slate-500">{formatTime()}</span>
            </div>
          </div>

          <div className={`flex-1 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl p-4 overflow-y-auto shadow-inner space-y-6 ${styles.scrollbar}`}>
            {messages.length > 0 || liveText ? (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex items-start gap-3 ${msg.isMe ? 'flex-row-reverse' : ''}`}>
                    <div
                      className={[
                        'w-8 h-8 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0',
                        msg.isMe
                          ? 'bg-gradient-to-br from-indigo-500 to-cyan-500'
                          : 'bg-gradient-to-br from-violet-500 to-indigo-600',
                      ].join(' ')}
                    >
                      {msg.isMe ? 'ME' : 'SP'}
                    </div>

                    <div className={`flex-1 min-w-0 flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                          {msg.isMe ? 'You' : 'Speaker'}
                        </span>
                        <span className="text-[9px] text-slate-600 font-medium">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className={[
                        'max-w-[90%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm',
                        msg.isMe 
                          ? 'rounded-tr-sm bg-indigo-500/10 border border-indigo-500/20 text-indigo-50'
                          : 'rounded-tl-sm bg-white/5 border border-white/10 text-slate-100'
                      ].join(' ')}>
                        {msg.text}
                      </div>

                      {msg.translation && (
                        <div className={`mt-2 max-w-[85%] rounded-2xl px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/20 ${msg.isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/80">
                              Translated
                            </span>
                            <div className="h-[1px] flex-1 bg-emerald-500/10" />
                          </div>
                          <div className="text-[13px] leading-relaxed text-emerald-100/90 italic">
                            {msg.translation}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {liveText && (
                  <div className="flex items-start gap-3 flex-row-reverse animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30 grid place-items-center text-[10px] font-bold text-rose-300 shrink-0">
                      ME
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-end">
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wide">Speaking…</span>
                      </div>
                      <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-[14px] text-rose-50 italic">
                        {liveText}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full grid place-items-center opacity-40">
                <div className="text-center">
                  <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-white/5 border border-white/10 grid place-items-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="text-[13px] font-semibold text-slate-300">Quiet in here</div>
                  <div className="text-[11px] mt-1 text-slate-500">Activity will appear here as you speak.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls Overlay-ish at bottom */}
        <div className="p-4 pt-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-2xl overflow-hidden p-3 space-y-3">
            <button
              onClick={mode === 'speaking' ? stopSpeaking : startSpeaking}
              disabled={speakDisabled}
              className={[
                'w-full group relative overflow-hidden rounded-xl p-4 transition-all duration-300',
                'border border-white/10',
                mode === 'speaking'
                  ? 'bg-rose-500/90'
                  : speakDisabled
                  ? 'bg-white/5 opacity-50 cursor-not-allowed'
                  : 'bg-white/5 hover:bg-white/10',
              ].join(' ')}
            >
              <div className="relative z-10 flex items-center justify-center gap-3">
                {mode === 'speaking' ? (
                  <>
                    <div className="flex items-end gap-1 h-3.5">
                      <span className={styles.waveBar} />
                      <span className={styles.waveBar2} />
                      <span className={styles.waveBar3} />
                    </div>
                    <span className="font-bold text-white text-[14px] uppercase tracking-wider">Stop</span>
                  </>
                ) : (
                  <>
                    <div className={`p-1.5 rounded-full ${speakDisabled ? 'bg-white/10' : 'bg-indigo-500'}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      </svg>
                    </div>
                    <span className={`font-bold text-[14px] uppercase tracking-wider ${speakDisabled ? 'text-slate-500' : 'text-slate-100'}`}>
                      {speakDisabled ? 'Wait…' : 'Push to Talk'}
                    </span>
                  </>
                )}
              </div>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsListening((v) => !v)}
                className={`flex flex-col gap-1 rounded-xl p-3 border transition-all text-left ${
                  isListening ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isListening ? 'text-emerald-400' : 'text-slate-400'}`}>
                    Live Voice
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-600'}`} />
                </div>
                <span className="text-[12px] font-medium text-slate-200">{isListening ? 'Enabled' : 'Disabled'}</span>
              </button>

              <div className="relative" ref={langMenuRef}>
                <button
                  onClick={() => setIsLangOpen((v) => !v)}
                  className="w-full flex flex-col gap-1 rounded-xl p-3 border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Language</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[14px] shrink-0">{selectedLanguage.flag}</span>
                    <span className="text-[12px] font-medium text-slate-200 truncate">{selectedLanguage.name}</span>
                  </div>
                </button>

                {isLangOpen && (
                  <div className="absolute right-0 bottom-full mb-3 w-[260px] z-50 rounded-2xl border border-white/10 bg-[#0b0f16] shadow-2xl overflow-hidden backdrop-blur-3xl">
                    <div className="p-3 border-b border-white/10">
                      <input
                        value={langQuery}
                        onChange={(e) => setLangQuery(e.target.value)}
                        placeholder="Search…"
                        className="w-full rounded-lg px-3 py-1.5 text-[12px] bg-white/5 border border-white/10 outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div className={`max-h-[200px] overflow-y-auto ${styles.scrollbar}`}>
                      {filteredLanguages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setSelectedLanguage(lang);
                            setIsLangOpen(false);
                            setLangQuery('');
                            if (mode === 'speaking' && recognitionRef.current) {
                              stopWebSpeech();
                              setTimeout(startWebSpeech, 120);
                            }
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-3 ${
                            selectedLanguage.code === lang.code ? 'bg-indigo-500/10' : ''
                          }`}
                        >
                          <span className="text-[16px]">{lang.flag}</span>
                          <span className={`text-[12px] ${selectedLanguage.code === lang.code ? 'text-indigo-300 font-bold' : 'text-slate-200'}`}>
                            {lang.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2 border-t border-white/10 bg-black/20 text-[10px] text-slate-500 flex justify-between items-center backdrop-blur-xl">
        <span>Orbit • Live Translation</span>
        <span className="text-slate-600">Build</span>
      </div>
    </div>
  );
}

export { OrbitIcon };