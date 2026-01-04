import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Stale threshold for locks (2 minutes)
const STALE_THRESHOLD_MINUTES = 2;

// GET: Check if room has an active broadcaster
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  // Fetch lock from database
  const { data, error } = await supabase
    .from('broadcast_locks')
    .select('broadcaster_id, updated_at')
    .eq('room_id', roomId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    console.error('Fetch broadcast lock failed', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (data) {
    const updatedAt = new Date(data.updated_at).getTime();
    const now = Date.now();
    
    // Check if stale
    if (now - updatedAt < STALE_THRESHOLD_MINUTES * 60 * 1000) {
      return NextResponse.json({
        isLocked: true,
        broadcasterId: data.broadcaster_id,
      });
    } else {
      // Stale lock - could delete it here or just treat as unlocked
      await supabase.from('broadcast_locks').delete().eq('room_id', roomId);
    }
  }

  return NextResponse.json({ isLocked: false, broadcasterId: null });
}

// POST: Claim or release broadcast lock
export async function POST(request: Request) {
  try {
    const { roomId, identity, action } = await request.json();

    if (!roomId || !identity || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    if (action === 'claim') {
      // Upsert lock if it doesn't exist or is owned by self
      // We use RPC or basic check + insert/update for race condition prevention in real projects,
      // but here we keep it simple or use upsert with a check.
      
      const { data: existing } = await supabase
        .from('broadcast_locks')
        .select('broadcaster_id, updated_at')
        .eq('room_id', roomId)
        .single();

      if (existing) {
        const updatedAt = new Date(existing.updated_at).getTime();
        const now = Date.now();
        const isStale = (now - updatedAt) >= STALE_THRESHOLD_MINUTES * 60 * 1000;

        if (existing.broadcaster_id !== identity && !isStale) {
          return NextResponse.json({
            success: false,
            error: 'Room already has an active broadcaster',
            broadcasterId: existing.broadcaster_id,
          });
        }
      }

      const { error } = await supabase
        .from('broadcast_locks')
        .upsert({
          room_id: roomId,
          broadcaster_id: identity,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'release') {
      const { error } = await supabase
        .from('broadcast_locks')
        .delete()
        .eq('room_id', roomId)
        .eq('broadcaster_id', identity);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'heartbeat') {
      const { error } = await supabase
        .from('broadcast_locks')
        .update({ updated_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('broadcaster_id', identity);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Broadcast status error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
