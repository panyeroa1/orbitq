
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob;
    const language = formData.get('language') as string || 'en';

    if (!audioBlob) {
      return new NextResponse('Missing audio data', { status: 400 });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return new NextResponse('Orbit API key not configured', { status: 503 });
    }

    // Convert blob to buffer
    const arrayBuffer = await audioBlob.arrayBuffer();

    let dgUrl = 'https://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&smart_format=true';
    if (language === 'auto') {
      dgUrl += '&detect_language=true';
    } else {
      dgUrl += `&language=${language}`;
    }

    // Call Orbit Engine API
    const response = await fetch(
      dgUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': audioBlob.type || 'audio/webm',
        },
        body: arrayBuffer,
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Orbit STT Error:', err);
      return new NextResponse(err, { status: response.status });
    }

    const data = await response.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    return NextResponse.json({ 
      transcript: transcript.trim(),
      confidence: data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0
    });
  } catch (error) {
    console.error('Orbit STT route error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
