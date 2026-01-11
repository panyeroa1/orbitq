import { useState, useRef, useEffect, useCallback } from 'react';
import { ref, update, serverTimestamp } from 'firebase/database';
import { rtdb } from '@/lib/orbit/services/firebase';

const DEEPGRAM_API_KEY = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || '';

export function useOrbitMic() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const updateOrbitRTDB = async (text: string, final: boolean) => {
    try {
      const orbitRef = ref(rtdb, 'orbit/live_state');
      await update(orbitRef, {
        transcript: text,
        is_final: final,
        updatedAt: serverTimestamp(),
        brand: "Orbit"
      });
    } catch (e) {
      console.error("Orbit Update Failed", e);
    }
  };

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const url = 'wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true&interim_results=true&punctuate=true&utterances=true&endpointing=100';
      const socket = new WebSocket(url, ['token', DEEPGRAM_API_KEY]);
      socketRef.current = socket;

      socket.onopen = () => {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === 1) {
            socket.send(e.data);
          }
        };
        mediaRecorder.start(250);
        
        setIsRecording(true);
      };

      socket.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);
            const alt = data.channel?.alternatives?.[0];
            const text = alt?.transcript;
            
            if (text) {
              if (data.is_final) {
                // Determine buffer
                const currentBuffer = (socket as any)._sentenceBuffer || [];
                currentBuffer.push(text);
                (socket as any)._sentenceBuffer = currentBuffer;

                if (currentBuffer.length >= 2) {
                   const fullText = currentBuffer.join(' ');
                   setTranscript(fullText);
                   setIsFinal(true);
                   updateOrbitRTDB(fullText, true);
                   // Reset buffer
                   (socket as any)._sentenceBuffer = [];
                }
              } else {
                // Interim results: optionally show them?
                // User requirement: "make at least 2 sentence before shipping to save".
                // If we show interim, it's "shipping" to UI. 
                // To be safe and compliant, we hide interim or only show it if strictly needed.
                // Given "shipping to save", I'll suppress interim updates to the main transcript 
                // to ensure the "batch" effect is clear.
                // However, seeing *nothing* might be bad UX. 
                // But the request is specific. I will NOT setTranscript for interim.
              }
            }
        } catch (err) {
            console.error("Deepgram parse error", err);
        }
      };

      socket.onclose = stop;
      socket.onerror = stop;

    } catch (e) {
      console.error("Orbit Mic Start Failed", e);
      stop();
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (socketRef.current) {
        socketRef.current.close();
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
    }

    setIsRecording(false);
    setTranscript('');
    streamRef.current = null;
    socketRef.current = null;
    mediaRecorderRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) {
        stop();
    } else {
        start();
    }
  }, [isRecording, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        if (isRecording) stop();
    };
  }, []);

  return {
    isRecording,
    transcript,
    isFinal,
    toggle,
    analyser: analyserRef.current
  };
}
