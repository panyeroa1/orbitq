import { NextRequest, NextResponse } from 'next/server';
import { appKnowledge } from '@/lib/app-knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AgentMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const MAX_MESSAGES = 12;

function normalizeBaseUrl(baseUrl: string) {
  let normalized = baseUrl.trim();
  if (!normalized) {
    return 'https://orbit.ai';
  }
  normalized = normalized.replace('api.orbit.ai', 'orbit.ai');
  normalized = normalized.replace(/\/v1\/?$/, '');
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function normalizeModelName(model: string) {
  if (!model) {
    return 'orbit-ai-1';
  }
  if (model.includes(':')) {
    return model;
  }
  const match = model.match(/^(.*?)-(\d+b(?:-cloud)?)$/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return model;
}

function buildModelCandidates(model: string) {
  const normalized = normalizeModelName(model);
  const candidates = [normalized];
  if (normalized.endsWith('-cloud')) {
    candidates.push(normalized.replace(/-cloud$/, ''));
  } else if (normalized.includes(':')) {
    candidates.push(`${normalized}-cloud`);
  }
  return Array.from(new Set(candidates));
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ORBIT_AI_API_KEY;
    const rawBaseUrl = process.env.ORBIT_AI_BASE_URL ?? 'https://orbit.ai';
    const baseUrl = normalizeBaseUrl(rawBaseUrl);
    const model = process.env.ORBIT_AI_MODEL ?? 'orbit-ai-1';

    if (!apiKey) {
      return new NextResponse('ORBIT_AI_API_KEY is not configured', { status: 500 });
    }

    const body = await request.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages: AgentMessage[] = rawMessages
      .filter(
        (message: AgentMessage) =>
          message &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string',
      )
      .slice(-MAX_MESSAGES);

    if (messages.length === 0) {
      return new NextResponse('No messages provided', { status: 400 });
    }

    const systemPrompt = [
      'You are the Success Class AI Agent.',
      'You know the app structure, features, and UX.',
      'Use the app knowledge below to answer questions.',
      'If you are unsure, say so and ask a follow-up question.',
      'Never output secrets, keys, or private data.',
      '',
      'App knowledge:',
      appKnowledge,
    ].join('\n');

    const url = new URL('/api/chat', `${baseUrl}/`);
    const modelCandidates = buildModelCandidates(model);
    let data: any = null;

    for (const candidate of modelCandidates) {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: candidate,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isModelMissing =
          response.status === 404 || /model.+not found/i.test(errorText) || /not_found/i.test(errorText);
        const hasFallback = candidate !== modelCandidates[modelCandidates.length - 1];
        if (isModelMissing && hasFallback) {
          continue;
        }
        return new NextResponse(errorText || 'Orbit AI error', { status: response.status });
      }

      data = await response.json();
      break;
    }

    if (!data) {
      return new NextResponse('No response from Orbit AI', { status: 502 });
    }
    const reply =
      data?.message?.content ??
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text;

    if (!reply || typeof reply !== 'string') {
      return new NextResponse('No response from model', { status: 502 });
    }

    return NextResponse.json(
      { reply: reply.trim() },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    console.error('Agent error:', error);
    return new NextResponse('Agent error', { status: 500 });
  }
}
