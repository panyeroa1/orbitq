'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as orbitService from '@/lib/orbit/services/orbitService';
import { toast } from 'react-hot-toast';
import styles from './OrbitTranslator.module.css';
import { OrbitSubtitleOverlay } from './OrbitSubtitleOverlay';

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
    {/* Ring behind planet */}
    <ellipse cx="16" cy="16" rx="14" ry="5" stroke="url(#ringGradient)" strokeWidth="1.5" fill="none" transform="rotate(-20 16 16)" />
    {/* Planet sphere */}
    <circle cx="16" cy="16" r="9" fill="url(#planetGradient)" />
    {/* Ring in front (clipped) */}
    <path d="M 2 16 Q 16 21, 30 16" stroke="url(#ringGradient)" strokeWidth="1.5" fill="none" transform="rotate(-20 16 16)" />
  </svg>
);

interface OrbitTranslatorVerticalProps {
  roomCode: string;
  userId: string;
  onLiveTextChange?: (text: string) => void;
}

import { supabase } from '@/lib/orbit/services/supabaseClient';
import { LANGUAGES } from '@/lib/orbit/types';

export function OrbitTranslatorVertical({ roomCode, userId, onLiveTextChange }: OrbitTranslatorVerticalProps) {
  // -- Original State --
  const [mode, setMode] = useState<'idle' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [liveText, setLiveText] = useState('');
  const [isLockedByOther, setIsLockedByOther] = useState(false);
  const [roomUuid, setRoomUuid] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // -- Translation & TTS State --
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
  const [isListening, setIsListening] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  
  // Audio Playback State
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const processingQueueRef = useRef<any[]>([]);
  const isProcessingRef = useRef(false);

  // Constants
  const MY_USER_ID = userId;

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playNextAudio = async () => {
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
      console.error("Audio playback error", e);
      isPlayingRef.current = false;
      playNextAudio();
    }
  };

  const processNextInQueue = async () => {
    if (isProcessingRef.current || processingQueueRef.current.length === 0) return;
    isProcessingRef.current = true;

    const item = processingQueueRef.current.shift();
    if (!item) {
        isProcessingRef.current = false;
        return;
    }

    try {
        // 1. Translate
        const tRes = await fetch('/api/orbit/translate', {
            method: 'POST',
            body: JSON.stringify({
                text: item.text,
                targetLang: selectedLanguage.code
            })
        });
        const tData = await tRes.json();
        let translated = tData.translation || item.text;
        
        // Show translated text temporarily as live text if listening
        if (isListening) {
             setLiveText(translated); 
             // Clear after delay or let next segment replace
        }

        // 2. TTS
        if (isListening) {
             const ttsRes = await fetch('/api/orbit/tts', {
                method: 'POST',
                body: JSON.stringify({ text: translated })
             });
             const arrayBuffer = await ttsRes.arrayBuffer();
             if (arrayBuffer.byteLength > 0) {
                 audioQueueRef.current.push(arrayBuffer);
                 playNextAudio();
             }
        }
    } catch (e) {
        console.error("Pipeline error", e);
    } finally {
        isProcessingRef.current = false;
        processNextInQueue();
    }
  };

  // Subscribe to Room State for Lock status
  useEffect(() => {
    if (!roomUuid) return;
    
    // Subscribe to DB Transcripts for Translation
    // We listen to ALL transcripts, filter out our own, and if isListening is true, we translate them.
    const channel = supabase.channel(`room:${roomUuid}:transcripts_sidebar`)
    .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transcript_segments',
        filter: `meeting_id=eq.${roomUuid}`
    }, (payload: any) => {
        if (payload.new.speaker_id !== MY_USER_ID) {
            // Someone else spoke
            // Update transcript view? 
            setTranscript(payload.new.source_text); // Simple update

            if (isListening) {
                processingQueueRef.current.push({ text: payload.new.source_text });
                processNextInQueue();
            }
        }
    })
    .subscribe();

    const sub = orbitService.subscribeToRoomState(roomUuid, (state) => {
      const activeSpeaker = state.active_speaker_user_id;
      setIsLockedByOther(!!activeSpeaker && activeSpeaker !== userId);
    });

    return () => {
      sub.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [roomUuid, userId, isListening, selectedLanguage]); // Re-sub if language/listening changes? No, logic is in callback. But callback captures closure. 
  // Actually, Effect deps need careful handling. 
  // Better to use Ref for selectedLanguage and isListening in the callback
  
  const selectedLanguageRef = useRef(selectedLanguage);
  useEffect(() => { selectedLanguageRef.current = selectedLanguage; }, [selectedLanguage]);
  
  const isListeningRef = useRef(isListening);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  // FIX: Re-implement subscription to use refs inside
  useEffect(() => {
      if (!roomUuid) return;
      const channel = supabase.channel(`room:${roomCode}:transcripts_v2`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transcript_segments', filter: `meeting_id=eq.${roomCode}` }, (payload: any) => {
             if (payload.new.speaker_id !== MY_USER_ID) {
                 setTranscript(payload.new.source_text);
                 if (isListeningRef.current) {
                     processingQueueRef.current.push({ text: payload.new.source_text });
                     processNextInQueue();
                 }
             }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [roomCode, MY_USER_ID]);


  // Start WebSpeech for real-time subtitles
  const startWebSpeech = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage.code === 'auto' ? 'en-US' : selectedLanguage.code;

    recognition.onresult = async (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }

      setLiveText(interim || final);

      if (final.trim() && roomUuid) {
        setTranscript(final);
        setLiveText('');
        
        const sentences = final.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
        for (const sentence of sentences) {
            orbitService.saveUtterance(roomUuid, userId, sentence, selectedLanguageRef.current.code).catch(e => console.warn(e));
        }
      }
    };

    recognition.onerror = (e: any) => {
      console.error('Speech recognition error:', e.error);
    };

    recognition.onend = () => {
      if (mode === 'speaking' && recognitionRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [roomUuid, userId, mode, selectedLanguage]);

  // Stop WebSpeech
  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setLiveText('');
  }, []);

  // Start Speaking Mode
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
    startWebSpeech();
    setMode('speaking');
  }, [mode, roomCode, roomUuid, userId, startWebSpeech]);

  // Stop Speaking Mode
  const stopSpeaking = useCallback(async () => {
    stopWebSpeech();
    await orbitService.releaseSpeakerLock(roomCode, userId);
    setMode('idle');
  }, [roomCode, userId, stopWebSpeech]);

  // Status helpers
  const getStatusClass = () => {
    if (!roomUuid) return styles.statusConnecting;
    if (mode === 'speaking') return styles.statusSpeaking;
    if (isLockedByOther) return styles.statusLocked;
    return styles.statusReady;
  };

  const getStatusText = () => {
    if (!roomUuid) return 'Connecting...';
    if (mode === 'speaking') return 'Speaking...';
    if (isLockedByOther) return 'Locked';
    return 'Ready';
  };

  const speakDisabled = isLockedByOther || !roomUuid;

  // Language Dropdown reference
  const langMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
      function handleClickOutside(event: any) {
          if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
              setIsLangOpen(false);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [langMenuRef]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <OrbitIcon size={20} /> Translator
        </div>
        <div className={`${styles.headerStatus} ${getStatusClass()}`}>● {getStatusText()}</div>
      </div>

      {/* Global Subtitle Overlay */}
      {typeof document !== 'undefined' && (
        <OrbitSubtitleOverlay 
          text={liveText || (mode === 'speaking' ? transcript : '')} 
          isVisible={mode === 'speaking' && !!(liveText || transcript)} 
        />
      )}

      {/* Controls Container */}
      <div className="flex flex-col gap-2 p-3 w-full">
          
          {/* Speak Now Button */}
          <button
            onClick={mode === 'speaking' ? stopSpeaking : startSpeaking}
            disabled={speakDisabled}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${
                mode === 'speaking' 
                ? 'bg-red-500/90 text-white animate-pulse shadow-lg shadow-red-500/20' 
                : speakDisabled 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5'
            }`}
          >
            {mode === 'speaking' ? <div className="w-2 h-2 bg-white rounded-full animate-ping mr-2"/> : null}
            {mode === 'speaking' ? 'Stop Speaking' : 'Speak Now'}
          </button>

          {/* Listen Translation Group */}
          <div className="flex items-stretch w-full rounded-xl border border-white/5 overflow-hidden">
                <button
                    onClick={() => setIsListening(!isListening)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 transition-colors ${
                        isListening 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'bg-transparent hover:bg-white/5 text-slate-300'
                    }`}
                >
                    <span className="font-bold text-sm">Listen Translation</span>
                    {isListening && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                </button>
                <div className="w-[1px] bg-white/5" />
                <button
                    onClick={() => setIsLangOpen(!isLangOpen)}
                    className="px-3 bg-transparent hover:bg-white/5 text-slate-300 flex items-center justify-center"
                >
                    <span className="text-lg mr-1">{selectedLanguage.flag}</span>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className={`opacity-60 transition-transform ${isLangOpen ? 'rotate-180' : ''}`}>
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                </button>
          </div>

          {/* Language Dropdown */}
          {isLangOpen && (
             <div ref={langMenuRef} className="absolute z-50 left-2 right-2 mt-2 bg-[#1a1c1f] border border-white/10 rounded-xl shadow-2xl max-h-[300px] overflow-y-auto">
                 {LANGUAGES.map((lang) => (
                     <button
                        key={lang.code}
                        onClick={() => {
                            setSelectedLanguage(lang);
                            setIsLangOpen(false);
                            // If speaking, restart to update language?
                            if (mode === 'speaking' && recognitionRef.current) {
                                stopWebSpeech();
                                setTimeout(startWebSpeech, 100);
                            }
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0 ${
                            selectedLanguage.code === lang.code ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-300'
                        }`}
                     >
                        <span className="text-xl">{lang.flag}</span>
                        <span className="text-sm font-medium">{lang.name}</span>
                        {selectedLanguage.code === lang.code && <div className="ml-auto w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                     </button>
                 ))}
             </div>
          )}

      </div>

      {/* Activity Section */}
      <div className={styles.activitySection}>
        <div className={styles.activityLabel}>Activity</div>
        <div className={styles.activityBox}>
          {transcript && (
            <div className={styles.transcriptOriginal}>
              <span className={styles.transcriptLabel}>{mode === 'speaking' ? 'You' : 'Speaker'}:</span> {transcript}
            </div>
          )}
          {!transcript && (
            <div className={styles.noActivity}>No activity yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
// Export the icon for use in control bar
export { OrbitIcon };
