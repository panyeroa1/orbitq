
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './services/supabaseClient';
import { AppMode, Language, LANGUAGES, RoomState, AudioSource, EmotionType, EMOTION_COLORS } from './types';
import TranslatorDock from './components/TranslatorDock';
import ErrorBanner from './components/ErrorBanner';
import * as orbitService from './services/orbitService';
import * as roomStateService from './services/roomStateService';


const getStoredUserId = () => {
  if (typeof window === 'undefined') return 'user_guest';
  let stored = sessionStorage.getItem('eburon_user_id');
  if (!stored) {
    stored = `user_${Math.random().toString(36).substring(7)}`;
    sessionStorage.setItem('eburon_user_id', stored);
  }
  return stored;
};

const MY_USER_ID = getStoredUserId();
const MY_USER_NAME = `Member ${MY_USER_ID.split('_')[1].toUpperCase()}`;

export function OrbitApp() {
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [mode, setMode] = useState<AppMode>('idle');
  const [isDockMinimized, setIsDockMinimized] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const reportError = useCallback((message: string, error?: any) => {
    console.error(message, error);
    setErrorMessage(message + (error?.message ? `: ${error.message}` : ''));
  }, []);

  // Initialize Auth and Meeting ID
  useEffect(() => {
    const initSession = async () => {
      try {
        // Check for existing session first to avoid rate limits
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setSessionUser(session.user);
          
          // Only generate meeting ID if we have a session
          let currentMeetingId = sessionStorage.getItem('eburon_meeting_id');
          if (!currentMeetingId) {
            currentMeetingId = `MEETING_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
            sessionStorage.setItem('eburon_meeting_id', currentMeetingId);
          }
          setMeetingId(currentMeetingId);
        }

      } catch (err) {
        reportError("Session initialization failed", err);
      }
    };

    initSession();
  }, [reportError]);


  const [audioSource, setAudioSource] = useState<AudioSource>('mic');
  const [roomState, setRoomState] = useState<RoomState>({ activeSpeaker: null, raiseHandQueue: [], lockVersion: 0 });
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(LANGUAGES[0]);
  
  const [lastFinalText, setLastFinalText] = useState<string>('');
  const [livePartialText, setLivePartialText] = useState<string>('');
  
  const [fullTranscript, setFullTranscript] = useState('');

  const selectedLanguageRef = useRef<Language>(LANGUAGES[0]);
  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const realtimeChannelRef = useRef<any>(null);

  // VAD & Segmentation tracking
  const sentenceBufferRef = useRef('');
  const shippedCharsRef = useRef(0);
  const silenceTimerRef = useRef<any>(null);

  // -- Translation & TTS State --
  const [translatedStreamText, setTranslatedStreamText] = useState<string>('');
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [audioData, setAudioData] = useState<Uint8Array | undefined>(undefined);
  const [emotion, setEmotion] = useState<EmotionType>('neutral');

  // Queues for sequential processing
  const processingQueueRef = useRef<any[]>([]);
  const isProcessingRef = useRef(false);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const ensureAudioContext = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(e => reportError("Failed to resume audio context", e));
      }
      return audioCtxRef.current;
    } catch (e) {
      reportError("Failed to initialize audio context", e);
      return null;
    }
  }, [reportError]);

  const splitSentences = (text: string): string[] => {
    if (!text.trim()) return [];
    if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'sentence' });
      return Array.from(segmenter.segment(text)).map((s: any) => s.segment);
    }
    // Fallback: simple split by punctuation
    return text.match(/[^.!?]+[.!?]*|[^.!?]+$/g) || [text];
  };

  const shipSegment = async (text: string, isFinalSegment: boolean = false) => {
    const segment = text.trim();
    if (!segment) return;

    const segmentId = Math.random().toString(36).substring(7);
    try {
      // Fetch latest full transcript to append
      const { data: existing } = await supabase.from('transcript_segments')
        .select('full_transcription')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      const baseText = existing?.full_transcription || '';
      const newFull = isFinalSegment ? (baseText + " " + segment).trim() : baseText;

      const { error } = await supabase.from('transcript_segments').upsert({ 
        meeting_id: meetingId, 
        speaker_id: MY_USER_ID, 
        source_lang: selectedLanguageRef.current.code, 
        source_text: segment,
        full_transcription: newFull,
        last_segment_id: segmentId
      }, { onConflict: 'meeting_id' });
      
      if (error) throw error;
      if (isFinalSegment) setFullTranscript(newFull);
    } catch (err) {
      reportError("Failed to send transcript", err);
    }
  };

  const toggleListen = async () => {
    const ctx = ensureAudioContext(); 
    if (!ctx) return;
    
    if (mode === 'listening') {
      setMode('idle');
    } else {
      setMode('listening');
      setLivePartialText('');
      setLastFinalText('');
    }
  };

  const handleSpeakToggle = async () => {
    ensureAudioContext();
    if (mode === 'speaking') {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setMode('idle');
      setLivePartialText('');
      setLastFinalText('');
      sentenceBufferRef.current = '';
      shippedCharsRef.current = 0;
      if (meetingId) await orbitService.releaseSpeakerLock(meetingId, MY_USER_ID);
    } else {
      if (!meetingId) return; 
      // Use orbitService for RPC based lock
      const acquired = await orbitService.acquireSpeakerLock(meetingId, MY_USER_ID);
      if (acquired) {
        try {
           const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
           if (!SpeechRecognition) throw new Error("Speech recognition not supported.");

           const recognition = new SpeechRecognition();
           console.log("OrbitApp: Starting recognition", { lang: selectedLanguageRef.current.code });
           recognition.continuous = true;
           recognition.interimResults = true;
           recognition.lang = selectedLanguageRef.current.code === 'auto' ? navigator.language : selectedLanguageRef.current.code; 
           
           const flushBuffer = () => {
             const pending = sentenceBufferRef.current.substring(shippedCharsRef.current).trim();
             if (pending) {
               shipSegment(pending, true);
               shippedCharsRef.current = sentenceBufferRef.current.length;
             }
           };

           recognition.onresult = (event: any) => {
             if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
             console.log("OrbitApp: recognition result", event.results.length);
             
             let currentFull = '';
             for (let i = 0; i < event.results.length; ++i) {
               currentFull += event.results[i][0].transcript;
             }
             sentenceBufferRef.current = currentFull;

             // VAD trigger: If we have new sentences, ship them
             const sentences = splitSentences(currentFull);
             if (sentences.length > 1) {
                // All except the last one (which might be incomplete)
                const completeSentences = sentences.slice(0, -1).join(' ');
                const toShip = completeSentences.substring(shippedCharsRef.current).trim();
                if (toShip) {
                  shipSegment(toShip, true);
                  shippedCharsRef.current = completeSentences.length;
                }
             }

             const latestPartial = currentFull.substring(shippedCharsRef.current).trim();
             setLivePartialText(latestPartial);

             // Silence timeout (pseudo-VAD)
             silenceTimerRef.current = setTimeout(flushBuffer, 1500);
           };

           recognition.onerror = (event: any) => {
             if (event.error !== 'no-speech') {
                reportError(`Speech recognition error: ${event.error}`);
                setMode('idle');
             }
           };

           recognition.onend = () => {
             flushBuffer();
           };

           recognition.start();
           recognitionRef.current = recognition;
           setMode('speaking');
           setLastFinalText('');
           sentenceBufferRef.current = '';
           shippedCharsRef.current = 0;
        } catch (e) {
          reportError("Failed to start speech recognition", e);
          setMode('idle');
        }
      } else {
        reportError("Could not acquire speaker lock (someone else is speaking).");
      }
    }
  };

  useEffect(() => {
    if (meetingId) {
       const unsub = roomStateService.subscribeToRoom(meetingId, setRoomState);

       // Subscribe to Transcripts
       const channel = supabase.channel(`room:${meetingId}:transcripts`)
         .on('postgres_changes', {
           event: 'INSERT',
           schema: 'public',
           table: 'transcript_segments',
           filter: `meeting_id=eq.${meetingId}`
         }, (payload: any) => {
           // If it's not me, show it
           if (payload.new.speaker_id !== MY_USER_ID) {
             setLastFinalText(payload.new.source_text);
             
             // Trigger Translation if listening and valid language
             if (mode === 'listening' && selectedLanguageRef.current.code !== 'auto') {
                processingQueueRef.current.push({ 
                    text: payload.new.source_text,
                    id: payload.new.id
                });
                processNextInQueue();
             }

             // Clear after 5s
             if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
             silenceTimerRef.current = setTimeout(() => {
               setLastFinalText('');
             }, 5000);
           }
         })
         .subscribe();

       return () => {
         unsub();
         supabase.removeChannel(channel);
       };
    }
  }, [meetingId]);

  const sourceDisplayText = livePartialText || lastFinalText;

  // -- Translation & TTS Logic --

  const playNextAudio = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    const audioCtx = ensureAudioContext();
    if (!audioCtx) {
      isPlayingRef.current = false;
      return;
    }

    const nextBuffer = audioQueueRef.current.shift();
    if (!nextBuffer) {
      isPlayingRef.current = false;
      return;
    }

    try {
      const audioBuffer = await audioCtx.decodeAudioData(nextBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      
      // Visualize
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const draw = () => {
        if (!isPlayingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        setAudioData(new Uint8Array(dataArray));
        requestAnimationFrame(draw);
      };
      draw();

      source.onended = () => {
        isPlayingRef.current = false;
        setAudioData(undefined);
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
        setIsTtsLoading(true);
        // 1. Translate
        const tRes = await fetch('/api/orbit/translate', {
            method: 'POST',
            body: JSON.stringify({
                text: item.text,
                targetLang: selectedLanguageRef.current.code
            })
        });
        const tData = await tRes.json();
        const translated = tData.translation || item.text;
        setTranslatedStreamText(translated);

        // 2. TTS
        if (mode === 'listening') {
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
        console.error("Translation/TTS pipeline error", e);
    } finally {
        setIsTtsLoading(false);
        isProcessingRef.current = false;
        processNextInQueue();
    }
  };

  // Join meeting DB logic
  const joinMeetingDB = async (mId: string, uId: string) => {
    try {
      // 1. Check if meeting exists
      const { data: meeting } = await supabase.from('meetings').select('host_id').eq('meeting_id', mId).maybeSingle();
      
      let role = 'attendee';
      if (!meeting) {
        // Create meeting, I am host
        const { error: createErr } = await supabase.from('meetings').insert({ meeting_id: mId, host_id: uId });
        if (!createErr) role = 'host';
      } else if (meeting.host_id === uId) {
        role = 'host';
      }

      // 2. Add/Update participant
      await supabase.from('participants').upsert({
        meeting_id: mId,
        user_id: uId,
        role: role
      }, { onConflict: 'meeting_id,user_id' });
      
    } catch (err) {
      console.error("Error joining meeting DB:", err);
    }
  };

  // Modified: Removed bg-black to allow transparency, added pointer-events-none to container but auto to children
  return (
    <div className={`absolute inset-0 flex flex-col items-center overflow-hidden pointer-events-none transition-all duration-300 ${isDockMinimized ? 'pt-0' : 'pt-[60px]'}`}>
      <div className="pointer-events-auto w-full"> 
        <TranslatorDock
          mode={mode}
          roomState={roomState}
          selectedLanguage={selectedLanguage}
          myUserId={MY_USER_ID}
          onSpeakToggle={handleSpeakToggle}
          onListenToggle={toggleListen}
          onLanguageChange={setSelectedLanguage}
          onRaiseHand={() => roomStateService.raiseHand(MY_USER_ID, MY_USER_NAME)}
          
          audioData={audioData}
          translatedStreamText={translatedStreamText}
          isTtsLoading={isTtsLoading}
          emotion={emotion}

          isSignedIn={!!sessionUser}
          onAuthToggle={async (initialMeetingId?: string) => {
            if (sessionUser) {
              // Stop / Sign Out
              await supabase.auth.signOut();
              setSessionUser(null);
              setMeetingId(null);
              sessionStorage.removeItem('eburon_meeting_id');
              window.location.reload();
            } else {
              // Start / Sign In
              const { data: { user }, error } = await supabase.auth.signInAnonymously();
              if (error) {
                reportError("Sign in failed", error);
              } else {
                setSessionUser(user);
                // Use provided ID or generate new one
                const newId = initialMeetingId || `MEETING_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
                sessionStorage.setItem('eburon_meeting_id', newId);
                setMeetingId(newId);
                
                // Allow async join to happen in background
                joinMeetingDB(newId, MY_USER_ID);
                // Auto-start listening
                setMode('listening');

                if (initialMeetingId) {
                  window.location.href = `${window.location.origin}?meeting=${newId}`;
                }
              }
            }
          }}
          onJoin={(newId: string) => {
            if (newId && newId !== meetingId) {
              sessionStorage.setItem('eburon_meeting_id', newId);
              setMeetingId(newId);
              // Optional: Reload to ensure clean state, or just state update is enough if useEffect handles re-subscription
              window.location.reload(); 
            }
          }}
          meetingId={meetingId}
          onInvite={() => {
            if (meetingId) {
              const url = `${window.location.origin}?meeting=${meetingId}`;
              navigator.clipboard.writeText(url);
              alert(`Meeting link copied!\n${url}`);
            }
          }}
          liveStreamText={sourceDisplayText}
          isMinimized={isDockMinimized}
          onMinimizeToggle={() => setIsDockMinimized(!isDockMinimized)}
        />
      </div>
      
      <div className="pointer-events-auto w-full">
        <ErrorBanner message={errorMessage} onClear={() => setErrorMessage('')} />
      </div>
      
      {/* Bottom Transcription Area - 14px font, centered, 75px from bottom */}
      <div className="fixed bottom-[75px] left-1/2 -translate-x-1/2 w-full max-w-4xl px-12 z-40 pointer-events-none">
        <div className="text-center">
           {sourceDisplayText && (
            <p className="text-[28px] font-bold tracking-tight text-white drop-shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 px-6 py-4 rounded-xl bg-black/40 backdrop-blur-md">
              {sourceDisplayText}
            </p>
          )}
          {!sourceDisplayText && mode === 'speaking' && (
             <p className="text-[16px] text-white/50 animate-pulse font-medium">Listening...</p>
          )}

        </div>
      </div>

      <div className="fixed inset-0 pointer-events-none -z-10 opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,0.5)_0%,rgba(0,0,0,0)_100%)]" />
      </div>
    </div>
  );
};
