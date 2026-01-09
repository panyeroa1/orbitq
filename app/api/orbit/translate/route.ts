
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text, targetLang } = await request.json();

    if (!text || !targetLang) {
      return new NextResponse('Missing text or targetLang', { status: 400 });
    }

    const apiKey = process.env.OLLAMA_API_KEY;
    
    const ollamaUrl = 'https://ollama.com/api/chat';

    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3-flash-preview',
        stream: true, // Enable streaming
        messages: [
          { role: "system", content: "Translate naturally. Return ONLY the translated text. No labels." },
          { role: "user", content: `Translate to ${targetLang}:\n\n${text}` }
        ]
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[Translation Failed] Ollama at ${ollamaUrl} returned ${response.status}:`, err);
      return new NextResponse(err, { status: response.status });
    }

    // Return the stream directly to the client
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Orbit translation route error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}