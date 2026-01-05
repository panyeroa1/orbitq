import { NextResponse } from 'next/server';
import { supabase } from '@/lib/orbit/services/supabaseClient';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('DEBUG: Resetting all speaker locks...');
    const { data, error } = await supabase
      .from('meetings')
      .update({ active_speaker_id: null })
      .not('active_speaker_id', 'is', null)
      .select();

    if (error) {
      console.error('DEBUG: Error clearing locks:', error);
      return new NextResponse(JSON.stringify({ error }), { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Successfully cleared all speaker locks.',
      affectedRows: data?.length || 0,
      data
    });
  } catch (error: any) {
    console.error('DEBUG: Unexpected error:', error);
    return new NextResponse(error.message || 'Internal error', { status: 500 });
  }
}
