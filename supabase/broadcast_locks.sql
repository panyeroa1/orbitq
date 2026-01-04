-- Supabase schema for broadcast locks
-- This table ensures only one user can broadcast in a room at a time

CREATE TABLE IF NOT EXISTS broadcast_locks (
  room_id TEXT PRIMARY KEY,
  broadcaster_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE broadcast_locks ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for simplicity (adjust for production)
CREATE POLICY "Allow all access to broadcast_locks" ON broadcast_locks
  FOR ALL USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_broadcast_locks_room ON broadcast_locks(room_id);
