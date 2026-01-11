
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    const apiKey = process.env.CARTESIA_API_KEY;
    if (!apiKey) {
      console.warn("Orbit API key not configured, returning mock audio (sine wave)");
      // Generate 1s sine wave at 440Hz
      const sampleRate = 44100;
      const duration = 1.0;
      const numSamples = sampleRate * duration;
      const buffer = new Float32Array(numSamples);
      const freq = 440;
      for (let i = 0; i < numSamples; i++) {
        buffer[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 0.5;
      }
      
      return new NextResponse(buffer.buffer as ArrayBuffer, {
        headers: {
            'Content-Type': 'audio/wav', // or audio/pcm if handled raw
        }
      });
    }

    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "Cartesia-Version": "2025-04-16",
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: "sonic-3-latest",
        transcript: text,
        voice: {
          mode: "id",
          id: "dda33d93-9f12-4a59-806e-a98279ebf050"
        },
        output_format: {
          container: "wav",
          encoding: "pcm_f32le",
          sample_rate: 44100
        },
        speed: "normal",
        generation_config: { speed: 1, volume: 1 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Orbit TTS Error] Status: ${response.status}`, errText);
      return new NextResponse(errText, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/wav',
      },
    });
  } catch (error) {
    console.error('Orbit TTS route error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}