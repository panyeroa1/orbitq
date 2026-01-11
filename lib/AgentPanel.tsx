'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from '@/styles/Eburon.module.css';
import { supabase } from '@/lib/orbit/services/supabaseClient';
import { streamTranslation, translateWithOrbit } from '@/lib/orbit/services/geminiService';
import { LANGUAGES, Language, RoomState } from '@/lib/orbit/types';
import { Volume2, Mic, MicOff, StopCircle, ChevronDown, Lock } from 'lucide-react';

interface AgentPanelProps {
  meetingId?: string;
  onSpeakingStateChange?: (isSpeaking: boolean) => void;
  isTranscriptionEnabled: boolean;
  onToggleTranscription: () => void;
  roomState?: RoomState;
  userId?: string;
}

interface TranslationLog {
  id: string;
  original: string;
  translation: string;
  lang: string;
}

export function AgentPanel({ meetingId, onSpeakingStateChange, isTranscriptionEnabled, onToggleTranscription, roomState, userId }: AgentPanelProps) {
  const [targetLang, setTargetLang] = useState<Language>(LANGUAGES.find(l => l.code === 'es-ES') || LANGUAGES[1]);
  
  const activeSpeakerId = roomState?.activeSpeaker?.userId;
  const isLocked = activeSpeakerId && activeSpeakerId !== userId;
  const isMeSpeaking = activeSpeakerId && activeSpeakerId === userId && isTranscriptionEnabled;

  const [isAgentActive, setIsAgentActive] = useState(false);
  const [logs, setLogs] = useState<TranslationLog[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // TTS Provider State
  const [ttsProvider, setTtsProvider] = useState<'gemini' | 'orbit'>('gemini');

  // Notify parent of speaking state
  useEffect(() => {
    onSpeakingStateChange?.(isSpeaking);
  }, [isSpeaking, onSpeakingStateChange]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<any[]>([]);
  const processingRef = useRef(false);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0 || !isAgentActive) return;

    processingRef.current = true;
    const segment = queueRef.current.shift();

    try {
      setIsSpeaking(true);
      const ctx = ensureAudioContext();
      
      // Add 'Processing' log
      const logId = Math.random().toString(36).substring(7);
      setLogs(prev => [...prev, { 
        id: logId, 
        original: segment.source_text, 
        translation: 'Translating...', 
        lang: targetLang.name 
      }]);

      let finalTranslation = '';

      try {
        // Step 1: Translate via Orbit Cloud
        finalTranslation = await translateWithOrbit(segment.source_text, targetLang.name);
        
        // Update log with translated text immediately
        setLogs(prev => prev.map(l => l.id === logId ? { ...l, translation: finalTranslation } : l));
      } catch (err) {
        console.error("Orbit translation failed, falling back", err);
        finalTranslation = segment.source_text;
      }

      // Step 2: Playback via Orbit Engine
      await streamTranslation(
        finalTranslation,
        targetLang.name,
        ctx,
        () => {}, // Audio handled by service
        (text) => {
          // Live update (optional)
        },
        async (finalText) => {
          const resolvedText = finalText?.trim() ? finalText : finalTranslation;
          finalTranslation = resolvedText;
          processingRef.current = false;
          setIsSpeaking(false);
          
          // Update log with final
          setLogs(prev => prev.map(l => l.id === logId ? { ...l, translation: resolvedText } : l));

          // Persist translation to DB
          if (segment.id) {
             await supabase.from('transcript_segments')
               .update({ 
                 translated_text: resolvedText, 
                 target_lang: targetLang.name
               })
               .eq('id', segment.id);
          }
          
          // Next
          processQueue();
        },
        segment.source_lang || 'auto',
        0, // retryCount
        ttsProvider // Pass selected provider
      );
    } catch (e) {
      console.error("Agent translation error:", e);
      processingRef.current = false;
      setIsSpeaking(false);
      processQueue();
    }
  }, [isAgentActive, targetLang, ensureAudioContext, ttsProvider]);

  // Trigger queue processing when active or new items added
  useEffect(() => {
    if (isAgentActive && !processingRef.current && queueRef.current.length > 0) {
      processQueue();
    }
  }, [isAgentActive, processQueue]);

  // Stop audio when agent is disabled
  useEffect(() => {
    if (!isAgentActive && audioCtxRef.current) {
        audioCtxRef.current.suspend();
        setIsSpeaking(false);
        processingRef.current = false; 
    }
  }, [isAgentActive]);

  // Subscribe to transcription
  useEffect(() => {
    if (!meetingId) return;

    const handleRow = (newRow: any) => {
       if (newRow.last_segment_id && processedIdsRef.current.has(newRow.last_segment_id)) return;
       if (newRow.last_segment_id) processedIdsRef.current.add(newRow.last_segment_id);
       
       if (newRow.source_text) {
         queueRef.current.push(newRow);
         processQueue();
       }
    };

    console.log(`Subscribing to transcript_segments for meeting: ${meetingId}`);
    const channel = supabase.channel(`agent:${meetingId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transcript_segments', filter: `meeting_id=eq.${meetingId}` }, 
        (payload) => {
          console.log("Realtime INSERT:", payload);
          handleRow(payload.new);
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transcript_segments', filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          console.log("Realtime UPDATE:", payload);
          handleRow(payload.new);
        }
      )
      .subscribe((status) => {
        console.log(`Realtime Subscription for ${meetingId} status:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, processQueue]);

  return (
    <div className={styles.sidebarPanel}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarHeaderText}>
          <h3>ORBIT TRANSLATOR</h3>
          <div className={styles.sidebarHeaderMeta}>
             <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] transition-colors duration-500 ${isSpeaking ? 'text-emerald-400 bg-emerald-400 animate-pulse' : 'text-slate-600 bg-slate-600'}`} />
                <span className="text-[10px] uppercase tracking-wide font-medium">
                  {isSpeaking ? 'Voice Active' : 'Ready'}
                </span>
             </div>
          </div>
        </div>
      </div>

      <div className={styles.agentPanelBody}>
        {/* Main Controls */}
        <div className={styles.agentControls}>
          <button
            onClick={onToggleTranscription}
            disabled={!!isLocked}
            className={`${styles.agentControlButton} ${isMeSpeaking ? styles.agentControlButtonActiveSpeak : ''} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isLocked ? 'Someone else is speaking' : 'Transcription'}
          >
            {isLocked ? <Lock size={20} /> : (isMeSpeaking ? <Mic size={20} /> : <MicOff size={20} />)}
            <span>{isLocked ? 'Locked' : 'Speak'}</span>
          </button>

          <button
            onClick={() => {
               const newState = !isAgentActive;
               setIsAgentActive(newState);
               if (newState) ensureAudioContext();
            }}
            className={`${styles.agentControlButton} ${isAgentActive ? styles.agentControlButtonActiveListen : ''}`}
          >
            {isAgentActive ? <StopCircle size={20} /> : <Volume2 size={20} />}
            <span>Listen</span>
          </button>
          
          {/* Voice Model Dropdown */}
          <div className={styles.agentVoiceModel}>
             <label className={styles.agentControlLabel} htmlFor="agent-voice-model">
               Voice Model
             </label>
             <div className={styles.agentSelectWrap}>
               <select 
                 id="agent-voice-model"
                 aria-label="Voice model"
                 className={`${styles.sidebarSelect} ${styles.agentSelect}`}
                 value={ttsProvider}
                 onChange={(e) => setTtsProvider(e.target.value as any)}
               >
                  <option value="orbit">Agent</option>
                  <option value="gemini">Orbit Engine</option>
               </select>
               <div className={styles.agentSelectIcon}>
                  <ChevronDown size={14} />
               </div>
             </div>
          </div>
        </div>

        {/* Target Language */}
        <div className={styles.agentSection}>
          <label className={styles.agentSectionLabel}>
             <span>Target Language</span>
             <span className={styles.agentSectionDivider} />
          </label>
          <div className={styles.agentSelectWrap}>
             <select 
               aria-label="Target language"
               className={`${styles.sidebarSelect} ${styles.agentSelect}`}
               value={targetLang.code}
               onChange={(e) => setTargetLang(LANGUAGES.find(l => l.code === e.target.value) || LANGUAGES[0])}
             >
               {LANGUAGES.map(lang => (
                 <option key={lang.code} value={lang.code}>
                   {lang.flag} {lang.name}
                 </option>
               ))}
             </select>
             <div className={styles.agentSelectIcon}>
                <ChevronDown size={14} />
             </div>
          </div>
        </div>

        {/* Messages */}
        <div className={styles.agentLogs}>
            {logs.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-50">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/5 flex items-center justify-center">
                     <Volume2 size={24} className="text-slate-500" strokeWidth={1} />
                  </div>
                  <p className="text-xs font-medium tracking-wide">Waiting for speech...</p>
               </div>
            )}
            
            {logs.map((log) => (
              <div key={log.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                 {/* Original */}
                 <div className="group relative pl-3.5 mb-3 opacity-80 hover:opacity-100 transition-opacity">
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-slate-800 rounded-full group-hover:bg-slate-600 transition-colors" />
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 font-semibold">Original</p>
                    <p className="text-xs text-slate-300 leading-relaxed font-light">{log.original}</p>
                 </div>

                 {/* Translation */}
                 <div className="bg-gradient-to-br from-[#151d2b] to-[#0f141f] border border-emerald-500/10 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                       <span className="text-[9px] text-emerald-500/40 font-mono tracking-tighter uppercase">{log.lang}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                       <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500">Agent</span>
                    </div>
                    <p className="text-sm text-slate-100 leading-relaxed font-medium">{log.translation}</p>
                 </div>
              </div>
            ))}
            
            {isSpeaking && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <div className="flex gap-1">
                     <div className="w-1 h-3 bg-emerald-500/50 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                     <div className="w-1 h-5 bg-emerald-500/50 rounded-full animate-[pulse_0.6s_ease-in-out_0.2s_infinite]" />
                     <div className="w-1 h-3 bg-emerald-500/50 rounded-full animate-[pulse_0.6s_ease-in-out_0.4s_infinite]" />
                  </div>
                  <span className="text-xs font-medium text-emerald-500/70 tracking-wide uppercase">Speaking</span>
                </div>
            )}
            <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
