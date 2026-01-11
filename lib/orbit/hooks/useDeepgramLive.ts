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
  error: string | null;
  analyser: AnalyserNode | null;
}

/**
 * Hook for real-time Deepgram WebSocket STT with accuracy optimizations
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
  const [error, setError] = useState<string | null>(null);

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
      setError('Deepgram API key not configured');
      return;
    }

    setError(null);
    setTranscript('');
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
      const model = options.model || 'nova-3';
      const language = options.language || 'multi';
      
      // Base params with accuracy optimizations
      const params = new URLSearchParams({
        model,
        language,
        smart_format: 'true',      // Human-readable formatting
        punctuate: 'true',         // Add punctuation
        utterances: 'true',        // Phrase-level segmentation
        interim_results: 'true',   // Real-time feedback
        endpointing: '100',        // 100ms pause detection (optimal for code-switching)
        encoding: 'linear16',
        sample_rate: '48000',
      });

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

      // Connect to Deepgram
      const socket = new WebSocket(wsUrl, ['token', apiKey]);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsListening(true);
        
        // Start recording with optimal settings for Deepgram
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

        recorder.start(100); // Send chunks every 100ms for lower latency
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const text = data.channel?.alternatives?.[0]?.transcript;
          
          if (text) {
            setTranscript(text);
            setIsFinal(data.is_final ?? false);
          }
        } catch (e) {
          console.error('Error parsing Deepgram response:', e);
        }
      };

      socket.onerror = () => {
        setError('Deepgram connection error');
        stop();
      };

      socket.onclose = () => {
        setIsListening(false);
      };

    } catch (e: any) {
      setError(e.message || 'Microphone access denied');
      stop();
    }
  }, [options.model, options.language, options.diarize, options.keywords, stop]);

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
    error,
    analyser: analyserRef.current
  };
}
