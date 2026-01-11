
import { supabase } from './supabaseClient';

export interface RoomState {
  activeSpeakerUserId: string | null;
  activeSpeakerSince: string | null;
  lockVersion: number;
}

export async function ensureRoomState(roomCode: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('ensure_room_state', { p_room_code: roomCode });
  if (error) {
    console.error('Error ensuring room state:', error);
    return null;
  }
  return data;
}

export async function acquireSpeakerLock(roomCode: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('acquire_speaker_lock', {
    p_room_code: roomCode,
    p_user_id: userId
  });
  if (error) {
    console.error('Error acquiring speaker lock:', error);
    return false;
  }
  return !!data;
}

// Alias for roomStateService compatibility if needed
export const tryAcquireSpeaker = acquireSpeakerLock;

export async function releaseSpeakerLock(roomCode: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('release_speaker_lock', {
    p_room_code: roomCode,
    p_user_id: userId
  });
  if (error) {
    console.error('Error releasing speaker lock:', error);
    return false;
  }
  return !!data;
}

export const releaseSpeaker = releaseSpeakerLock;

export const saveUtterance = async (
  meetingId: string,
  speakerId: string,
  text: string,
  language: string
) => {
  try {
    const { error } = await supabase.from('transcriptions').insert({
      meeting_id: meetingId,
      speaker_id: speakerId,
      transcribe_text_segment: text,
      full_transcription: text, // Fallback for simple save
      users_all: []
      // created_at is default now()
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving transcription:', error);
  }
};

export async function saveTranslation(roomId: string, utteranceId: string, listenerUserId: string | null, targetLang: string, translatedText: string) {
  const { data, error } = await supabase
    .from('public.translations')
    .insert({
      room_id: roomId,
      utterance_id: utteranceId,
      listener_user_id: listenerUserId,
      target_language: targetLang,
      translated_text: translatedText
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving translation:', error);
    return null;
  }
  return data;
}

export async function updateParticipantLanguage(roomId: string, userId: string, lang: string) {
  const { error } = await supabase
    .from('public.participants')
    .upsert({
      room_id: roomId,
      user_id: userId,
      preferred_language: lang
    }, { onConflict: 'room_id,user_id' });

  if (error) console.error('Error updating participant language:', error);
}

export function subscribeToTranscriptions(meetingId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`public:transcriptions:${meetingId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'transcriptions',
      filter: `meeting_id=eq.${meetingId}`
    }, (payload) => callback(payload.new))
    .subscribe();
}

export function subscribeToUtterances(roomId: string, callback: (utterance: any) => void) {
  return supabase
    .channel(`public:utterances:${roomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'utterances',
      filter: `room_id=eq.${roomId}`
    }, (payload) => callback(payload.new))
    .subscribe();
}

export function subscribeToRoomState(roomId: string, callback: (state: any) => void) {
  return supabase
    .channel(`public:room_state:${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'room_state',
      filter: `room_id=eq.${roomId}`
    }, (payload) => callback(payload.new))
    .subscribe();
}
