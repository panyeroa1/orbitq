'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRoomContext, useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';
import { RoomEvent, DataPacket_Kind, RemoteParticipant, Track } from 'livekit-client';
import { TTSProvider } from '../types';

interface TranslationMessage {
  type: 'orbit_translation';
  text: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  timestamp: number;
}

interface UseOrbitTranslatorOptions {
  targetLanguage: string;
  enabled: boolean;
  isSourceSpeaker: boolean;  // True if this user holds the floor for translation
  hearRawAudio?: boolean;    // If true, remote raw audio is NOT muted when translation is enabled
  ttsProvider?: TTSProvider;
}

interface UseOrbitTranslatorReturn {
  // Outbound
  sendTranslation: (text: string) => Promise<void>;
  
  // Inbound
  incomingTranslations: Array<{ participantId: string; text: string; timestamp: number }>;
  
  // State
  isProcessing: boolean;
  error: string | null;
  
  // Audio control
  muteRawAudio: (participantId: string) => void;
  unmuteRawAudio: (participantId: string) => void;
  mutedParticipants: Set<string>;
  analyser: AnalyserNode | null;
}

/**
 * Hook for bidirectional Orbit translation via LiveKit Data Channel.
 * 
 * Outbound: Sends translated text to all participants (they synthesize TTS locally).
 * Inbound: Receives translated text from participants and synthesizes TTS locally.
 */
export function useOrbitTranslator(options: UseOrbitTranslatorOptions): UseOrbitTranslatorReturn {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incomingTranslations, setIncomingTranslations] = useState<Array<{ participantId: string; text: string; timestamp: number }>>([]);
  const [mutedParticipants, setMutedParticipants] = useState<Set<string>>(new Set());
  
  const ttsQueueRef = useRef<Array<{ text: string; participantId: string }>>([]);
  const isSpeakingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duckStoreRef = useRef<Map<HTMLMediaElement, number>>(new Map());

  const DUCK_LEVEL = 0.25; // 25% volume during TTS

  // Audio Context and Analyser for visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Initialize audio element for TTS playback and setup analysis
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.autoplay = true;

      // Setup Web Audio API for visualization
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;

          // Connect audio element to analyser
          // Note: createMediaElementSource requires the audio element to be in the DOM or at least created? 
          // It works with new Audio() but we must ensure we don't reconnect if it already exists.
          const source = ctx.createMediaElementSource(audioRef.current);
          sourceNodeRef.current = source;
          source.connect(analyser);
          analyser.connect(ctx.destination);
        }
      } catch (err) {
        console.warn('Failed to setup audio analysis for Orbit visualizer:', err);
      }
    }
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Resume AudioContext on user interaction if needed (browser autoplay policy)
  const resumeAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  // Mute raw audio from a specific participant
  const muteRawAudio = useCallback((participantId: string) => {
    setMutedParticipants(prev => {
      if (prev.has(participantId)) return prev;
      const participant = remoteParticipants.find(p => p.identity === participantId);
      if (participant) {
        const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
        if (audioTrack) {
          audioTrack.setEnabled(false);
        }
      }
      return new Set(prev).add(participantId);
    });
  }, [remoteParticipants]);

  // Unmute raw audio from a specific participant
  const unmuteRawAudio = useCallback((participantId: string) => {
    setMutedParticipants(prev => {
      if (!prev.has(participantId)) return prev;
      const participant = remoteParticipants.find(p => p.identity === participantId);
      if (participant) {
        const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
        if (audioTrack) {
          audioTrack.setEnabled(true);
        }
      }
      const next = new Set(prev);
      next.delete(participantId);
      return next;
    });
  }, [remoteParticipants]);

  // Auto-mute all remote participants when translation is enabled (unless hearRawAudio is true)
  useEffect(() => {
    if (!options.enabled) {
      // Restore all muted participants
      mutedParticipants.forEach(id => {
        const participant = remoteParticipants.find(p => p.identity === id);
        if (participant) {
          const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
          if (audioTrack) {
            audioTrack.setEnabled(true);
          }
        }
      });
      setMutedParticipants(new Set());
      return;
    }

    if (options.hearRawAudio) {
       // Restore all muted participants if hearRawAudio was just toggled ON
       mutedParticipants.forEach(id => {
         const participant = remoteParticipants.find(p => p.identity === id);
         if (participant) {
           const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
           if (audioTrack) {
             audioTrack.setEnabled(true);
           }
         }
       });
       setMutedParticipants(new Set());
       return;
    }

    // Mute all remote participants
    remoteParticipants.forEach(participant => {
      muteRawAudio(participant.identity);
    });
  }, [options.enabled, options.hearRawAudio, remoteParticipants, muteRawAudio]);

  // Duck all other audio/video elements to 25%
  const duckOtherMedia = useCallback(() => {
    if (typeof document === 'undefined') return;
    const elements = Array.from(document.querySelectorAll('audio, video')) as HTMLMediaElement[];
    elements.forEach(el => {
      if (el === audioRef.current) return;
      if (!duckStoreRef.current.has(el)) {
        duckStoreRef.current.set(el, el.volume);
      }
      el.volume = Math.min(el.volume, DUCK_LEVEL);
    });
  }, []);

  // Restore all ducked audio/video elements
  const restoreOtherMedia = useCallback(() => {
    duckStoreRef.current.forEach((originalVol, el) => {
      try {
        el.volume = originalVol;
      } catch (_) {}
    });
    duckStoreRef.current.clear();
  }, []);

  // Process TTS queue sequentially with ducking
  const processTTSQueue = useCallback(async () => {
    if (isSpeakingRef.current || ttsQueueRef.current.length === 0) return;
    
    isSpeakingRef.current = true;
    resumeAudioContext(); // Ensure AudioContext is running
    const next = ttsQueueRef.current.shift();
    
    if (next) {
      duckOtherMedia(); // Duck before playing

      // --- WEB (BROWSER) TTS ---
      if (options.ttsProvider === 'web') {
        if (!window.speechSynthesis) {
           console.warn("[Orbit] Web Speech API not supported.");
           isSpeakingRef.current = false;
           restoreOtherMedia();
           return;
        }

        const utterance = new SpeechSynthesisUtterance(next.text);
        
        // Attempt to match voice to target language (rough heuristic)
        // Note: voices are loaded asynchronously, so this might not catch them on first run
        const voices = window.speechSynthesis.getVoices();
        const langCode = options.targetLanguage?.split('-')[0]; // e.g. "fr"
        if (langCode) {
            const voice = voices.find(v => v.lang.startsWith(langCode));
            if (voice) utterance.voice = voice;
        }

        utterance.rate = 1.0;
        utterance.volume = 1.0;

        await new Promise<void>(resolve => {
           utterance.onend = () => { resolve(); };
           utterance.onerror = (e) => { 
                console.error("[Orbit] Web TTS error", e);
                resolve(); 
           };
           window.speechSynthesis.speak(utterance);
        });

        restoreOtherMedia();
        isSpeakingRef.current = false;

        // Process next item in queue
        if (ttsQueueRef.current.length > 0) {
          processTTSQueue();
        }
        return;
      }

      // --- CARTESIA (SERVER) TTS ---
      // (Default / existing logic)
      if (audioRef.current) {
        try {
          const response = await fetch('/api/orbit/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: next.text })
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            audioRef.current.src = url;
            
            await new Promise<void>((resolve) => {
              if (!audioRef.current) {
                resolve();
                return;
              }
              audioRef.current.onended = () => {
                URL.revokeObjectURL(url);
                resolve();
              };
              audioRef.current.onerror = () => {
                URL.revokeObjectURL(url);
                resolve();
              };
              audioRef.current.play().catch(() => resolve());
            });
          }
        } catch (e) {
          console.error('[Orbit] TTS synthesis failed:', e);
        }
      }
      restoreOtherMedia(); // Restore after playing
    }
    
    isSpeakingRef.current = false;
    
    // Process next item in queue
    if (ttsQueueRef.current.length > 0) {
      processTTSQueue();
    }
  }, [duckOtherMedia, restoreOtherMedia, resumeAudioContext, options.ttsProvider, options.targetLanguage]); // Added dependencies

  // Send translation to all participants via Data Channel (only if source speaker)
  const sendTranslation = useCallback(async (text: string) => {
    if (!localParticipant || !text.trim()) return;
    if (!options.isSourceSpeaker) return; // Only source speaker can send translations
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Translate the text
      const translateResponse = await fetch('/api/orbit/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang: options.targetLanguage })
      });
      
      if (!translateResponse.ok) {
        throw new Error('Translation failed');
      }
      
      const { translation } = await translateResponse.json();
      
      // Broadcast via Data Channel
      const message: TranslationMessage = {
        type: 'orbit_translation',
        text: translation,
        targetLanguage: options.targetLanguage,
        timestamp: Date.now()
      };
      
      const payload = new TextEncoder().encode(JSON.stringify(message));
      await localParticipant.publishData(payload, { reliable: true });
      
    } catch (e: any) {
      setError(e.message || 'Translation failed');
      console.error('[Orbit] Send translation failed:', e);
    } finally {
      setIsProcessing(false);
    }
  }, [localParticipant, options.targetLanguage]);

  // Listen for incoming translations
  useEffect(() => {
    if (!room || !options.enabled) return;
    
    const handleDataReceived = (
      payload: Uint8Array,
      participant?: RemoteParticipant
    ) => {
      // Ignore messages from self (shouldn't happen, but safety check)
      if (!participant || participant.identity === localParticipant?.identity) {
        return;
      }
      
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        
        if (data.type === 'orbit_translation' && data.text) {
          // Add to incoming translations list
          setIncomingTranslations(prev => [
            ...prev.slice(-50), // Keep last 50
            { 
              participantId: participant.identity, 
              text: data.text, 
              timestamp: data.timestamp 
            }
          ]);
          
          // Queue TTS synthesis
          ttsQueueRef.current.push({ text: data.text, participantId: participant.identity });
          processTTSQueue();
        }
      } catch (e) {
        // Not a translation message, ignore
      }
    };
    
    room.on(RoomEvent.DataReceived, handleDataReceived);
    
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, options.enabled, localParticipant, processTTSQueue]);

  return {
    sendTranslation,
    incomingTranslations,
    isProcessing,
    error,
    muteRawAudio,
    unmuteRawAudio,
    mutedParticipants,
    analyser: analyserRef.current
  };
}
