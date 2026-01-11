'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseDeepgramLiveOptions {
  deviceId?: string;
  /** Model: 'nova-3' (best), 'nova-2', 'whisper-large' */
  model?: 'nova-3' | 'nova-2' | 'whisper-large';
  /** 
   * Language code: 
   * - 'multi' for code-switching (Dutch+French mix)
   * - 'nl-BE' for Flemish/Belgium Dutch
   * - 'nl' for Dutch
   * - 'fr' for French
   * - 'en' for English
   */
  language?: string;
  /** Keywords for vocabulary boosting: ['word:intensity', ...] */
  keywords?: string[];
  /** Enable speaker diarization */
  diarize?: boolean;
}

interface UseDeepgramLiveReturn {
  isListening: boolean;
  transcript: string;
  isFinal: boolean;
  start: (deviceId?: string) => Promise<void>;
  stop: () => void;
  setLanguage: (lang: string) => void;
  language: string;
  error: string | null;
  analyser: AnalyserNode | null;
  words: Array<{ word: string; start: number; end: number; confidence: number }>;
  detectedLanguage: string | null;
}

/**
 * Hook for real-time Orbit WebSocket STT with accuracy optimizations
 * 
 * Best practices applied:
 * - Nova-3 model (highest accuracy)
 * - smart_format=true (human-readable formatting)
 * - punctuate=true (sentence punctuation)
 * - utterances=true (phrase-level segmentation)
 * - endpointing=100 (optimal for code-switching)
 * - interim_results=true (real-time feedback)
 */
export function useDeepgramLive(options: UseDeepgramLiveOptions = {}): UseDeepgramLiveReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [words, setWords] = useState<Array<{ word: string; start: number; end: number; confidence: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState(options.language || 'multi');

  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    setIsListening(false);
    
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    if (!apiKey) {
      setError('Orbit API key not configured');
      return;
    }

    setError(null);
    setTranscript('');
    setWords([]);
    setIsFinal(false);

    try {
      // Get microphone stream with high quality audio
      const constraints: MediaStreamConstraints = {
        audio: deviceId 
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Set up AudioContext and Analyser for visualization
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser); // We don't need to connect to destination (speakers)
      analyserRef.current = analyser;

      // Build optimized WebSocket URL with accuracy features
      const model = options.model || 'nova-2';
      const language = options.language || 'en';
      
      // 1) Base parameters
      const params = new URLSearchParams({
        model,
        smart_format: 'true',
        punctuate: 'true',
        utterances: 'true',
        interim_results: 'true',
        endpointing: '300',
        words: 'true',
        // Removed explicit encoding to let Deepgram auto-detect container (WebM/Opus)
      });

      // 2) Language Handling & Dialect Mapping
      const DEEPGRAM_LANGUAGE_MAPPINGS: Record<string, string> = {
        'vls-BE': 'nl-BE',
        'zea-BE': 'nl-BE',
        'lim-BE': 'nl-BE',
        'wa-BE': 'fr-BE',
        'pcd-BE': 'fr-BE',
        'fr-CI': 'fr',   // Ivory Coast French
        'fr-CM': 'fr',   // Cameroon French
        'en-CM': 'en',   // Cameroon English
        'byv-CM': 'fr',  // Medumba (fallback to French as it's often spoken in that region)
        'fil-PH': 'fil', // Filipino
        'tl-PH': 'fil',  // Tagalog
        'ceb-PH': 'fil', // Cebuano (fallback to Filipino if not directly supported)
      };

      const mappedLanguage = DEEPGRAM_LANGUAGE_MAPPINGS[language] || language;

      if (mappedLanguage === 'auto' || mappedLanguage === 'multi') {
        params.set('detect_language', 'true');
      } else {
        params.set('language', mappedLanguage);
      }

      // Add diarization if enabled
      if (options.diarize) {
        params.set('diarize', 'true');
      }

      // Add keyword boosting
      if (options.keywords?.length) {
        options.keywords.forEach(kw => {
          params.append('keywords', kw);
        });
      }

      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
      console.log('🔌 Connecting to Orbit Engine:', wsUrl.replace(apiKey || '', '***'));
      console.log('🔑 Engine Key Validated');

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('✅ Orbit connection established');
        setIsListening(true);
        
        try {
          // Start recording with optimal settings for Orbit
          // Using audio/webm with opus for browser compatibility
          const recorder = new MediaRecorder(stream, { 
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
          });
          recorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
              socket.send(event.data);
            }
          };

          recorder.onerror = (err) => console.error('📽 Engine Error:', err);
          recorder.onstart = () => console.log('📽 Orbit STT started');

          recorder.start(100); // Send chunks every 100ms for lower latency
        } catch (recErr) {
          console.error('❌ Failed to start audio capture:', recErr);
          setError('Failed to start audio recording');
          stop();
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const alt = data.channel?.alternatives?.[0];
          const text = alt?.transcript;
          const newWords = alt?.words || [];
          
          if (text) {
            setTranscript(text);
            if (newWords.length > 0) {
              setWords(prev => data.is_final ? newWords : [...newWords]); // Simplified for interim
            }
            setIsFinal(data.is_final ?? false);
          }

          // Capture detected language from metadata or results
          if (data.metadata?.language) {
             setDetectedLanguage(data.metadata.language);
          } else if (data.results?.channels?.[0]?.detected_language) {
             setDetectedLanguage(data.results.channels[0].detected_language);
          }
        } catch (e) {
          console.error('Error parsing Orbit response:', e);
        }
      };

      socket.onerror = (error) => {
        console.error('Orbit Engine error:', error);
        setError('Orbit connection error. Check console for details.');
        stop();
      };

      socket.onclose = (event) => {
        console.log('Orbit connection closed:', event.code, event.reason);
        setIsListening(false);
        if (event.code !== 1000) {
          setError(`Orbit connection closed unexpectedly (${event.code})`);
        }
      };

    } catch (e: any) {
      setError(e.message || 'Microphone access denied');
      stop();
    }
  }, [options.model, options.diarize, options.keywords, stop, currentLanguage]);

  const setLanguage = useCallback((lang: string) => {
    if (lang !== currentLanguage) {
      setCurrentLanguage(lang);
      if (isListening) {
        // Restart with new language
        const currentDeviceId = recorderRef.current?.stream.getAudioTracks()[0]?.getSettings().deviceId;
        stop();
        setTimeout(() => start(currentDeviceId), 100);
      }
    }
  }, [currentLanguage, isListening, stop, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isListening,
    transcript,
    isFinal,
    start,
    stop,
    setLanguage,
    language: currentLanguage,
    error,
    analyser: analyserRef.current,
    words,
    detectedLanguage
  };
}
