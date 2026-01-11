
import { GoogleGenAI, Modality, Type, LiveServerMessage, MediaResolution } from "@google/genai";
import { TranslationResult, EmotionType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

export async function translateWithOrbit(text: string, targetLang: string): Promise<string> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLang
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.translation || text;
  } catch (e) {
    console.error("Internal Orbit Translation API Error", e);
    return text;
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Decodes base64 string to Uint8Array.
 */
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

async function playOrbitTTS(text: string, ctx: AudioContext) {
  try {
     const res = await fetch('/api/tts', {
       method: 'POST',
       body: JSON.stringify({ text, provider: 'orbit' }),
       headers: { 'Content-Type': 'application/json' }
     });
     if (!res.ok) throw new Error(await res.text());
     const buf = await res.arrayBuffer();
     const audioBuf = await ctx.decodeAudioData(buf);
     const source = ctx.createBufferSource();
     source.buffer = audioBuf;
     source.connect(ctx.destination);
     source.start();
  } catch (e) {
     console.error("Orbit TTS Playback Error", e);
  }
}

/**
 * Live Translation Stream with Retry Logic and Auto-Detection.
 */
export async function streamTranslation(
  sourceText: string,
  targetLangName: string,
  audioCtx: AudioContext,
  onAudioData: (data: Uint8Array) => void,
  onTranscript: (text: string) => void,
  onEnd: (finalText: string) => void,

  sourceLangCode: string = 'auto',
  retryCount: number = 0,
  ttsProvider: 'orbit' | 'gemini' = 'gemini'
) {
  let nextStartTime = 0;
  let fullTranslation = "";
  const isAutoDetect = sourceLangCode === 'auto';

  try {
    const sessionPromise = ai.live.connect({
      model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [ttsProvider === 'orbit' ? Modality.TEXT : Modality.AUDIO],
        outputAudioTranscription: {}, 
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
        },
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        contextWindowCompression: {
            triggerTokens: '25600',
            slidingWindow: { targetTokens: '12800' },
        },
        systemInstruction: `You are Orbit, a high-fidelity vocal synthesis engine. 
        Your goal is to speak the provided text in ${targetLangName} with extreme precision, aiming for native human speaker quality.
        
        CRITICAL PERFORMANCE SPECS:
        1. NATIVE PRONUNCIATION: Use precise phonetic articulation based on native-speaker oral references for ${targetLangName}.
        2. EMOTION SYNTHESIS: Deliver the text with natural emotion and prosody.
        3. INSTANT DELIVERY: Start the audio immediately.
        
        You are a seamless, high-performance vocal synthesis bridge.`
      },
      callbacks: {
        onopen: () => {
          sessionPromise.then(s => s.sendClientContent({ 
            turns: [{ parts: [{ text: sourceText }] }] 
          }));
        },
        onmessage: async (message: LiveServerMessage) => {
          const parts = message.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                const rawData = decode(part.inlineData.data);
                onAudioData(rawData);
                
                nextStartTime = Math.max(nextStartTime, audioCtx.currentTime);
                const buffer = await decodeAudioData(rawData, audioCtx);
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(audioCtx.destination);
                
                source.start(nextStartTime);
                nextStartTime += buffer.duration;
              }
              if (part.text) {
                fullTranslation += part.text;
                onTranscript(fullTranslation);
              }
            }
          }

          if (message.serverContent?.outputTranscription) {
            fullTranslation += message.serverContent.outputTranscription.text;
            onTranscript(fullTranslation);
          }

          if (message.serverContent?.turnComplete) {
            
            if (ttsProvider === 'orbit' && fullTranslation.trim()) {
                await playOrbitTTS(fullTranslation, audioCtx);
            }

            const waitTime = Math.max(0, (nextStartTime - audioCtx.currentTime) * 1000);
            setTimeout(() => onEnd(fullTranslation), waitTime + 100);
          }
        },
        onclose: () => onEnd(fullTranslation),
        onerror: async (e: any) => {
          console.warn(`Orbit Live Error (Attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, e);
          
          const isServiceUnavailable = e?.message?.includes('unavailable') || e?.status === 503;
          
          if (isServiceUnavailable && retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY * Math.pow(2, retryCount);
            console.log(`Retrying in ${delay}ms...`);
            setTimeout(() => {
              streamTranslation(sourceText, targetLangName, audioCtx, onAudioData, onTranscript, onEnd, sourceLangCode, retryCount + 1, ttsProvider);
            }, delay);
          } else {
            onEnd(fullTranslation);
          }
        }
      }
    });
  } catch (err) {
    console.error("Connection initiation failed:", err);
    onEnd("");
  }
}


/**
 * Starts a Gemini Multimodal Live session for real-time transcription.
 */
export async function startTranscriptionSession(
  onTranscript: (text: string) => void,
  onEnd: () => void,
  targetLangName: string = "English"
) {
  let fullTranscript = "";
  
  try {
    const sessionPromise = ai.live.connect({
      model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.TEXT],
        outputAudioTranscription: {},
        systemInstruction: `You are Orbit, a high-fidelity real-time transcription engine. 
        Transcribe the incoming audio into ${targetLangName}. 
        Provide ONLY the transcript, no other commentary. 
        If the audio is in another language, translate it to ${targetLangName} in real-time.
        Focus on accuracy and speed.`
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          // Some versions of the API return transcript in modelTurn.parts
          const parts = message.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.text) {
                fullTranscript += part.text;
                onTranscript(part.text);
              }
            }
          }
          // Other versions return it in outputTranscription
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            if (text) onTranscript(text);
          }
        },
        onclose: () => onEnd(),
        onerror: (e) => {
          console.error("Orbit Live STT Error:", e);
          onEnd();
        }
      }
    });

    const session = await sessionPromise;

    return {
      sendAudio: (base64Audio: string) => {
        session.sendRealtimeInput({
          audio: {
            mimeType: "audio/pcm;rate=16000",
            data: base64Audio
          }
        });
      },
      stop: () => {
        try {
          session.close();
        } catch (e) {
          console.warn("Error closing Orbit session", e);
        }
      }
    };
  } catch (err) {
    console.error("Failed to connect to Orbit Live:", err);
    throw err;
  }
}
