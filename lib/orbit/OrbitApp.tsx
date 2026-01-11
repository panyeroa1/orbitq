
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './services/supabaseClient';
import { AppMode, Language, LANGUAGES, RoomState, AudioSource, EmotionType, EMOTION_COLORS } from './types';
import TranslatorDock from './components/TranslatorDock';
import ErrorBanner from './components/ErrorBanner';
import * as orbitService from './services/orbitService';
import * as roomStateService from './services/roomStateService';
import { startTranscriptionSession } from './services/geminiService';


const getStoredUserId = () => {
  if (typeof window === 'undefined') return '00000000-0000-0000-0000-000000000000';
  let stored = sessionStorage.getItem('eburon_user_id');
  if (!stored) {
    // Generate valid UUID
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      stored = crypto.randomUUID();
    } else {
      // Fallback UUID v4 generator
      stored = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    sessionStorage.setItem('eburon_user_id', stored);
  }
  return stored;
};

const MY_USER_ID = getStoredUserId();
const MY_USER_NAME = `Member ${MY_USER_ID.substring(0, 4).toUpperCase()}`;

export function OrbitApp() {
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [mode, setMode] = useState<AppMode>('idle');
  const [isDockMinimized, setIsDockMinimized] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [transcriptionEngine, setTranscriptionEngine] = useState<'webspeech' | 'deepgram' | 'gemini'>('webspeech');
  
  // Orbit / Gemini Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const geminiSessionRef = useRef<any>(null);
  const reportError = useCallback((message: string, error?: any) => {
    console.error(message, error);
    setErrorMessage(message + (error?.message ? `: ${error.message}` : ''));
  }, []);

  // Initialize Auth and Meeting ID
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setSessionUser(session.user);
        }

        // Initialize meetingId regardless of session (allows guest use)
        let currentMeetingId = sessionStorage.getItem('eburon_meeting_id');
        if (!currentMeetingId) {
          currentMeetingId = `MEETING_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
          sessionStorage.setItem('eburon_meeting_id', currentMeetingId);
        }
        setMeetingId(currentMeetingId);
      } catch (err) {
        reportError("Session initialization failed", err);
      }
    };
    initSession();
  }, [reportError]);

  const [roomState, setRoomState] = useState<RoomState>({ activeSpeaker: null, raiseHandQueue: [], lockVersion: 0 });
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(LANGUAGES[0]);
  
  const [lastFinalText, setLastFinalText] = useState<string>('');
  const [livePartialText, setLivePartialText] = useState<string>('');
  
  const [fullTranscript, setFullTranscript] = useState('');
  const fullTranscriptRef = useRef('');
  useEffect(() => {
    fullTranscriptRef.current = fullTranscript;
  }, [fullTranscript]);

  const selectedLanguageRef = useRef<Language>(LANGUAGES[0]);
  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // VAD & Segmentation tracking
  const sentenceBufferRef = useRef('');
  const shippedCharsRef = useRef(0);
  const silenceTimerRef = useRef<any>(null);

  // -- Translation & TTS State --
  const [translatedStreamText, setTranslatedStreamText] = useState<string>('');
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [audioData, setAudioData] = useState<Uint8Array | undefined>(undefined);
  const [emotion, setEmotion] = useState<EmotionType>('neutral');

  // -- Audio Device State --
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>('');

  // Queues for sequential processing
  const processingQueueRef = useRef<any[]>([]);
  const isProcessingRef = useRef(false);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Mode ref for async access
  const modeRef = useRef<AppMode>('idle');
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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

  const updateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      const speakers = devices.filter(d => d.kind === 'audiooutput');
      setAudioDevices(mics);
      setAudioOutputDevices(speakers);
    } catch (err) {
      console.error("Failed to enumerate devices", err);
    }
  }, []);

  useEffect(() => {
    updateDevices();
    // Re-run when permissions might have changed
    navigator.mediaDevices.addEventListener('devicechange', updateDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', updateDevices);
  }, [updateDevices]);

  const splitSentences = (text: string): string[] => {
    if (!text.trim()) return [];
    if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'sentence' });
      return Array.from(segmenter.segment(text)).map((s: any) => s.segment);
    }
    return text.match(/[^.!?]+[.!?]*|[^.!?]+$/g) || [text];
  };

  const shipSegment = useCallback(async (text: string) => {
    const segment = text.trim();
    if (!segment) return;
    try {
       // Append to full transcript (client-side approximation)
      const newFull = (fullTranscriptRef.current + " " + segment).trim();
      setFullTranscript(newFull);

      const { error } = await supabase.from('transcriptions').insert({ 
        meeting_id: meetingId, 
        speaker_id: MY_USER_ID, 
        transcribe_text_segment: segment,
        full_transcription: newFull,
        users_all: [] // Placeholder for "all listening users"
      });
      if (error) throw error;
    } catch (err) {
      reportError("Failed to send transcription", err);
    }
  }, [meetingId, reportError]);

  const playNextAudio = useCallback(async () => {
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
      
      // -- Output Selection (SinkId) --
      if (selectedOutputDeviceId && (audioCtx as any).setSinkId) {
        try {
          await (audioCtx as any).setSinkId(selectedOutputDeviceId);
        } catch (err) {
          console.error("Failed to set sink ID", err);
        }
      }

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
  }, [ensureAudioContext, selectedOutputDeviceId]);

  const processNextInQueue = useCallback(async () => {
    if (isProcessingRef.current || processingQueueRef.current.length === 0) return;
    isProcessingRef.current = true;

    const item = processingQueueRef.current.shift();
    if (!item) {
        isProcessingRef.current = false;
        return;
    }

    try {
        console.log(`[Pipeline] 3. Starting processing for: "${item.text}"`);
        
        // Strict Gate: Only process if in listening mode
        if (modeRef.current !== 'listening') {
             console.log(`[Pipeline] Skipped Translation/TTS (Not in listening mode)`);
             // We can still update the UI with the raw text if desired, but user asked for "No need to do anything"
             return; 
        }

        setIsTtsLoading(true);
        
        // 1. Translate
        console.log(`[Pipeline] 4. Fetching Translation...`);
        const tRes = await fetch('/api/orbit/translate', {
            method: 'POST',
            body: JSON.stringify({
                text: item.text,
                targetLang: selectedLanguageRef.current.name
            })
        });
        const tData = await tRes.json();
        const translated = tData.translation || item.text;
        console.log(`[Pipeline] 5. Translation received: "${translated}"`);
        
        setTranslatedStreamText(translated);

        // 2. TTS
        if (modeRef.current === 'listening') {
             console.log(`[Pipeline] 6. Fetching TTS...`);
             const ttsRes = await fetch('/api/orbit/tts', {
                method: 'POST',
                body: JSON.stringify({ text: translated })
             });
             const arrayBuffer = await ttsRes.arrayBuffer();
             console.log(`[Pipeline] 7. TTS Audio received: ${arrayBuffer.byteLength} bytes`);

             if (arrayBuffer.byteLength > 0) {
                 audioQueueRef.current.push(arrayBuffer);
                 playNextAudio();
             }
        } else {
             console.log(`[Pipeline] 6. Skipped TTS (Not in listening mode)`);
        }
    } catch (e) {
        console.error("[Pipeline] Error:", e);
    } finally {
        setIsTtsLoading(false);
        isProcessingRef.current = false;
        processNextInQueue();
    }
  }, [playNextAudio]);

  // Deepgram Recording Loop
  useEffect(() => {
    if (mode === 'speaking' && transcriptionEngine === 'deepgram') {
      let recorder: MediaRecorder;
      
      const startRecording = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined } 
          });
          recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };

          recorder.start(1000); // 1-second chunks

          // Periodic send
          const interval = setInterval(async () => {
            if (audioChunksRef.current.length > 0) {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              audioChunksRef.current = []; // Clear buffer
              
              const formData = new FormData();
              formData.append('audio', blob);
              formData.append('language', selectedLanguageRef.current.code === 'auto' ? 'auto' : selectedLanguageRef.current.code);

              try {
                const res = await fetch('/api/orbit/stt', { method: 'POST', body: formData });
                if (res.ok) {
                    const data = await res.json();
                    if (data.transcript && data.transcript.trim()) {
                        console.log(`[Orbit Pro] Transcript: "${data.transcript}"`);
                        shipSegment(data.transcript); 
                        setLastFinalText(prev => prev + ' ' + data.transcript);
                    }
                }
              } catch (e) {
                console.error("Orbit Pro send error", e);
              }
            }
          }, 2000); // Send every 2 seconds

          return () => {
            clearInterval(interval);
            if (recorder && recorder.state !== 'inactive') recorder.stop();
            stream.getTracks().forEach(t => t.stop());
          };
        } catch (e) {
          console.error("Orbit Pro Init Error", e);
          setErrorMessage("Microphone access denied for Orbit Pro");
        }
      };

      const cleanupPromise = startRecording();
      return () => { cleanupPromise.then(cleanup => cleanup && cleanup()); };
    }
  }, [mode, transcriptionEngine, shipSegment, selectedDeviceId]);

  // Gemini Recording Loop
  useEffect(() => {
    if (mode === 'speaking' && transcriptionEngine === 'gemini') {
      let audioContext: AudioContext;
      let processor: ScriptProcessorNode;
      let stream: MediaStream;

      const startGeminiSession = async () => {
        try {
          geminiSessionRef.current = await startTranscriptionSession(
            (text) => {
               if (text.trim()) {
                 console.log(`[Orbit Live] Transcript: "${text}"`);
                 shipSegment(text);
                 setLastFinalText(prev => prev + ' ' + text);
               }
            },
            () => {
               console.log("[Orbit Live] Session ended");
            },
            selectedLanguageRef.current.name || "English"
          );

          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined } 
          });
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const source = audioContext.createMediaStreamSource(stream);
          processor = audioContext.createScriptProcessor(4096, 1, 1);

          source.connect(processor);
          processor.connect(audioContext.destination);

          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert to 16-bit PCM
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            // Base64 encode
            const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
            if (geminiSessionRef.current) {
              geminiSessionRef.current.sendAudio(base64);
            }
          };

          return () => {
            if (geminiSessionRef.current) geminiSessionRef.current.stop();
            if (processor) processor.disconnect();
            if (audioContext) audioContext.close();
            if (stream) stream.getTracks().forEach(t => t.stop());
          };
        } catch (e) {
          console.error("Orbit Live Init Error", e);
          setErrorMessage("Microphone access denied for Orbit Live");
        }
      };

      const cleanupPromise = startGeminiSession();
      return () => { cleanupPromise.then(cleanup => cleanup && cleanup()); };
    }
  }, [mode, transcriptionEngine, shipSegment, selectedDeviceId]);

  const toggleListen = async () => {
    const ctx = ensureAudioContext(); 
    if (!ctx) return;
    
    if (mode === 'listening') {
      setMode('idle');
      // Unmute project audio
      try {
          (document.querySelectorAll('audio, video') as any).forEach((el: HTMLMediaElement) => {
              if (el.dataset.orbitAutoMuted === 'true') {
                  el.muted = false;
                  delete el.dataset.orbitAutoMuted;
              }
          });
      } catch (e) {
          console.error("Orbit Unmute Error", e);
      }
    } else {
      setMode('listening');
      // Auto-Mute project audio
      try {
          (document.querySelectorAll('audio, video') as any).forEach((el: HTMLMediaElement) => {
              if (!el.muted) {
                  el.muted = true;
                  el.dataset.orbitAutoMuted = 'true';
              }
          });
      } catch (e) {
          console.error("Orbit Auto-Mute Error", e);
      }
      
      setLivePartialText('');
      setLastFinalText('');

      // Fetch latest transcription to "catch up" or verify connection
      if (meetingId) {
          console.log(`[Pipeline] Manual Fetch triggered by Listen Button for meeting: ${meetingId}`);
          try {
              const { data, error } = await supabase
                .from('transcriptions')
                .select('*')
                .eq('meeting_id', meetingId)
                .neq('speaker_id', MY_USER_ID)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (error && error.code !== 'PGRST116') { // Ignore "Row not found"
                  console.error("Error fetching latest transcription:", error);
              }

              if (data && data.transcribe_text_segment) {
                  console.log(`[Pipeline] Manual Fetch found: "${data.transcribe_text_segment}"`);
                  // Only process if it looks recent or we just want to test pipeline
                  // For now, we always process it to demonstrate "trigger" behavior
                  processingQueueRef.current.push({
                      text: data.transcribe_text_segment,
                      id: data.id || 'manual-fetch'
                  });
                  processNextInQueue();
              } else {
                  console.log(`[Pipeline] Manual Fetch: No recent transcriptions found.`);
              }
          } catch (err) {
              console.error("Manual fetch failed", err);
          }
      }
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
      const acquired = await orbitService.acquireSpeakerLock(meetingId, MY_USER_ID);
      if (acquired) {
        setMode('speaking');

        // Only start Web Speech if engine is webspeech
        if (transcriptionEngine === 'webspeech') {
            try {
               const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
               if (!SpeechRecognition) throw new Error("Speech recognition not supported.");
    
               const recognition = new SpeechRecognition();
               recognition.continuous = true;
               recognition.interimResults = true;
               recognition.lang = selectedLanguageRef.current.code === 'auto' ? navigator.language : selectedLanguageRef.current.code; 
           
           const flushBuffer = () => {
             const pending = sentenceBufferRef.current.substring(shippedCharsRef.current).trim();
             if (pending) {
               shipSegment(pending);
               shippedCharsRef.current = sentenceBufferRef.current.length;
             }
           };

           recognition.onresult = (event: any) => {
             if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
             
             let currentFull = '';
             for (let i = 0; i < event.results.length; ++i) {
               currentFull += event.results[i][0].transcript;
             }
             sentenceBufferRef.current = currentFull;

             const sentences = splitSentences(currentFull);
             if (sentences.length > 1) {
                const completeSentences = sentences.slice(0, -1).join(' ');
                const toShip = completeSentences.substring(shippedCharsRef.current).trim();
                if (toShip) {
                  shipSegment(toShip);
                  shippedCharsRef.current = completeSentences.length;
                }
             }

             const latestPartial = currentFull.substring(shippedCharsRef.current).trim();
             setLivePartialText(latestPartial);
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
       } // End if webspeech
      } else {
        reportError("Could not acquire speaker lock (someone else is speaking).");
      }
    }
  };



  const sourceDisplayText = livePartialText || lastFinalText;





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



  useEffect(() => {
    if (meetingId) {
       const unsub = roomStateService.subscribeToRoom(meetingId, setRoomState);

       // Subscribe to Transcripts
       const channel = supabase.channel(`room:${meetingId}:transcripts`)
         .on('postgres_changes', {
           event: 'INSERT',
           schema: 'public',
           table: 'transcriptions',
           filter: `meeting_id=eq.${meetingId}`
         }, (payload: any) => {
           if (payload.new.speaker_id !== MY_USER_ID) {
             setLastFinalText(payload.new.transcribe_text_segment);
             
             if (modeRef.current === 'listening' && selectedLanguageRef.current.code !== 'auto') {
                console.log(`[Pipeline] 1. Received Transcript Event: "${payload.new.transcribe_text_segment}" from ${payload.new.speaker_id}`);
                processingQueueRef.current.push({ 
                    text: payload.new.transcribe_text_segment,
                    id: payload.new.id
                });
                console.log(`[Pipeline] 2. Queueing item. Queue length: ${processingQueueRef.current.length}`);
                processNextInQueue();
             }

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
  }, [meetingId, processNextInQueue]);



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
          
          transcriptionEngine={transcriptionEngine}
          onEngineChange={setTranscriptionEngine}

          audioDevices={audioDevices}
          selectedDeviceId={selectedDeviceId}
          onDeviceIdChange={setSelectedDeviceId}

          audioOutputDevices={audioOutputDevices}
          selectedOutputDeviceId={selectedOutputDeviceId}
          onOutputDeviceIdChange={setSelectedOutputDeviceId}

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
          {translatedStreamText && (
            <p className="text-[24px] font-semibold tracking-tight text-emerald-400 drop-shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 px-6 py-2 mt-2 rounded-xl bg-black/60 backdrop-blur-md">
              {translatedStreamText}
            </p>
          )}
          {!sourceDisplayText && !translatedStreamText && mode === 'speaking' && (
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
