
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnvVar(name) {
  const regex = new RegExp(`^${name}=(.*)$`, 'm');
  const match = envContent.match(regex);
  return match ? match[1].trim() : null;
}

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Log keys length and start/end for debugging (masked)
console.log(`URL: ${supabaseUrl}`);
console.log(`Key Length: ${supabaseKey.length}`);
console.log(`Key Start: ${supabaseKey.substring(0, 10)}...${supabaseKey.substring(supabaseKey.length - 10)}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function killAllSpeaking() {
  console.log('Clearing all speaker locks...');
  const { data, error } = await supabase
    .from('meetings')
    .update({ active_speaker_id: null })
    .not('active_speaker_id', 'is', null)
    .select();

  if (error) {
    console.error('Error clearing locks:', error);
  } else {
    console.log('Successfully cleared all speaker locks.', data);
  }
}

killAllSpeaking();
