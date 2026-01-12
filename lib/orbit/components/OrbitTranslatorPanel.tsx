'use client';

import React from 'react';
import { useOrbitTranslator } from '@/lib/orbit/hooks/useOrbitTranslator';
import { LANGUAGES } from '@/lib/orbit/types';
import sharedStyles from '@/styles/Eburon.module.css';
import { useSound } from '@/lib/hooks/useSound';

// Re-export OrbitIcon for backwards compatibility
export { OrbitIcon } from './OrbitTranslatorVertical';

export interface OrbitMicState {
  source: 'microphone' | 'screen';
  setSource: (source: 'microphone' | 'screen') => void;
  isRecording: boolean;
  toggle: () => void;
  transcript: string;
  isFinal: boolean;
  analyser: AnalyserNode | null;
}

interface OrbitTranslatorPanelProps {
  roomCode?: string;
  userId?: string;
  isSourceSpeaker?: boolean;
  currentSpeakerId?: string | null;
  currentSpeakerName?: string | null;
  onRequestFloor?: () => Promise<boolean>;
  onReleaseFloor?: () => Promise<void>;
  // Global translation state
  isListening: boolean;
  setIsListening: (enabled: boolean) => void;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
  // Raw audio
  hearRawAudio: boolean;
  setHearRawAudio: (enabled: boolean) => void;
  // Source State
  orbitMicState: OrbitMicState;
  sourceLanguage: string;
  setSourceLanguage: (lang: string) => void;
  // Inbound translations
  incomingTranslations: Array<{ participantId: string; text: string; timestamp: number }>;
  // State
  isProcessing: boolean;
  error: string | null;
}

export function OrbitTranslatorPanel({ 
  roomCode, 
  userId,
  isSourceSpeaker = false,
  currentSpeakerId,
  currentSpeakerName,
  onRequestFloor,
  onReleaseFloor,
  isListening,
  setIsListening,
  targetLanguage,
  setTargetLanguage,
  hearRawAudio,
  setHearRawAudio,
  orbitMicState,
  sourceLanguage,
  setSourceLanguage,
  incomingTranslations,
  isProcessing,
  error
}: OrbitTranslatorPanelProps) {
  const [activeTab, setActiveTab] = React.useState<'source' | 'receiver'>('source');
  const [isRequestingFloor, setIsRequestingFloor] = React.useState(false);
  const { playClick, playToggle } = useSound();

  // Toggle listening mode
  const handleListenToggle = React.useCallback(() => {
    setIsListening(!isListening);
    playToggle(!isListening);
  }, [isListening, setIsListening, playToggle]);

  // Start speaking (request floor)
  const handleStartSpeaking = React.useCallback(async () => {
    if (!onRequestFloor) return;
    setIsRequestingFloor(true);
    playClick();
    try {
      const success = await onRequestFloor();
      if (success) {
        // Option: Auto-start recording? keeping manual for now
      }
    } finally {
      setIsRequestingFloor(false);
    }
  }, [onRequestFloor, playClick]);

  // Stop speaking (release floor)
  const handleStopSpeaking = React.useCallback(async () => {
    playClick();
    if (orbitMicState.isRecording) orbitMicState.toggle();
    if (onReleaseFloor) {
      await onReleaseFloor();
    }
  }, [onReleaseFloor, orbitMicState, playClick]);


  const floorHolderName = currentSpeakerName || currentSpeakerId?.split('__')[0] || 'Unknown';
  const isSomeoneElseSpeaking = !!currentSpeakerId && currentSpeakerId !== userId;

  return (
    <div className={sharedStyles.sidebarPanel}>
      <div className={sharedStyles.sidebarHeader}>
        <div className={sharedStyles.sidebarHeaderText}>
          <h3>Success Class Translator</h3>
          <span className={sharedStyles.sidebarHeaderMeta}>
            Real-time Translation System
          </span>
        </div>
      </div>
      
      <div className={sharedStyles.sidebarBody} style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
        
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            onClick={() => { setActiveTab('source'); playClick(); }}
            style={{ 
              flex: 1, 
              padding: '12px', 
              background: 'none', 
              border: 'none',
              borderBottom: activeTab === 'source' ? '2px solid #fbbf24' : '2px solid transparent',
              color: activeTab === 'source' ? '#fbbf24' : 'rgba(255,255,255,0.5)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s'
            }}
          >
            Source
          </button>
          <button 
            onClick={() => { setActiveTab('receiver'); playClick(); }}
            style={{ 
              flex: 1, 
              padding: '12px', 
              background: 'none', 
              border: 'none',
              borderBottom: activeTab === 'receiver' ? '2px solid #fbbf24' : '2px solid transparent',
              color: activeTab === 'receiver' ? '#fbbf24' : 'rgba(255,255,255,0.5)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s'
            }}
          >
            Receiver
          </button>
        </div>

        <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
          
          {/* SOURCE TAB */}
          {activeTab === 'source' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Floor Status */}
              <div style={{
                padding: '12px',
                background: isSourceSpeaker 
                  ? 'rgba(50, 205, 50, 0.15)' 
                  : isSomeoneElseSpeaking 
                    ? 'rgba(255, 200, 50, 0.1)' 
                    : 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: `1px solid ${isSourceSpeaker ? 'rgba(50, 205, 50, 0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}>
                <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Floor Status
                </div>
                
                {isSourceSpeaker ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)' }} />
                    <span style={{ flex: 1, fontSize: '13px' }}>You have the floor</span>
                    <button onClick={handleStopSpeaking} style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(255, 100, 100, 0.2)', border: '1px solid rgba(255, 100, 100, 0.3)', color: '#ff6b6b', fontSize: '11px', cursor: 'pointer' }}>
                      Release
                    </button>
                  </div>
                ) : isSomeoneElseSpeaking ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fbbf24' }} />
                    <span style={{ fontSize: '13px' }}>{floorHolderName} is speaking</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    <span style={{ flex: 1, fontSize: '13px', opacity: 0.7 }}>Floor is open</span>
                    {onRequestFloor && (
                      <button onClick={handleStartSpeaking} disabled={isRequestingFloor} style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(50, 205, 50, 0.2)', border: '1px solid rgba(50, 205, 50, 0.3)', color: '#32cd32', fontSize: '11px', cursor: isRequestingFloor ? 'wait' : 'pointer', opacity: isRequestingFloor ? 0.6 : 1 }}>
                        {isRequestingFloor ? '...' : 'Take Floor'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Source Controls (Only if I have floor or want to configure before taking it) */}
              {/* Actually, let's allow config always */}
              
              <div>
                <label style={{ fontSize: '10px', opacity: 0.6, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Source Language</label>
                <select 
                  value={sourceLanguage} 
                  aria-label="Source Language"
                  onChange={(e) => { setSourceLanguage(e.target.value); playClick(); }} 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px' }}
                >
                  <option value="multi">Auto-detect</option>
                  {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', opacity: 0.6, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Audio Source</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => { orbitMicState.setSource('microphone'); playClick(); }} 
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', background: orbitMicState.source === 'microphone' ? 'rgba(50, 205, 50, 0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${orbitMicState.source === 'microphone' ? 'rgba(50, 205, 50, 0.3)' : 'rgba(255,255,255,0.1)'}`, color: orbitMicState.source === 'microphone' ? '#32cd32' : 'inherit', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Microphone
                  </button>
                  <button 
                    onClick={() => { orbitMicState.setSource('screen'); playClick(); }} 
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', background: orbitMicState.source === 'screen' ? 'rgba(50, 205, 50, 0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${orbitMicState.source === 'screen' ? 'rgba(50, 205, 50, 0.3)' : 'rgba(255,255,255,0.1)'}`, color: orbitMicState.source === 'screen' ? '#32cd32' : 'inherit', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Screen Audio
                  </button>
                </div>
              </div>

              <button 
                onClick={() => { orbitMicState.toggle(); playToggle(!orbitMicState.isRecording); }} 
                style={{ 
                  width: '100%', padding: '14px', borderRadius: '10px', 
                  background: orbitMicState.isRecording ? 'rgba(255, 100, 100, 0.1)' : 'rgba(50, 205, 50, 0.1)', 
                  border: `1px solid ${orbitMicState.isRecording ? 'rgba(255, 100, 100, 0.3)' : 'rgba(50, 205, 50, 0.3)'}`, 
                  color: orbitMicState.isRecording ? '#ff6b6b' : '#32cd32', 
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', 
                  boxShadow: orbitMicState.isRecording ? '0 0 15px rgba(255, 100, 100, 0.2)' : 'none', 
                  animation: orbitMicState.isRecording ? 'pulse-red 2s infinite' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'currentColor' }} />
                {orbitMicState.isRecording ? 'Stop Broadcasting' : 'Start Broadcasting'}
              </button>

              {/* Current Transcript (only when source speaker) */}
              {isSourceSpeaker && orbitMicState.isRecording && orbitMicState.transcript && (
                <div style={{ marginTop: 'auto', padding: '12px', background: 'rgba(50, 205, 50, 0.1)', borderRadius: '8px', border: '1px solid rgba(50, 205, 50, 0.2)' }}>
                  <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '4px', textTransform: 'uppercase' }}>You said:</div>
                  <div style={{ fontSize: '13px', lineHeight: 1.4, color: orbitMicState.isFinal ? '#fff' : 'rgba(255,255,255,0.6)', fontStyle: orbitMicState.isFinal ? 'normal' : 'italic' }}>
                    {orbitMicState.transcript}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RECEIVER TAB */}
          {activeTab === 'receiver' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Status Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isListening ? (isProcessing ? '#fbbf24' : '#22c55e') : 'rgba(255,255,255,0.2)' }} />
                <span style={{ fontSize: '12px', opacity: 0.7 }}>
                  {error ? `Error: ${error}` : isListening ? (isProcessing ? 'Processing translation...' : 'Receiver Active') : 'Receiver Idle'}
                </span>
              </div>

               <div className={sharedStyles.sidebarCard}>
                <div className={sharedStyles.sidebarCardText}>
                  <span className={sharedStyles.sidebarCardLabel}>Receive Translations</span>
                  <span className={sharedStyles.sidebarCardHint}>Enable to hear translated audio</span>
                </div>
                <label className={sharedStyles.sidebarSwitch}>
                  <input type="checkbox" checked={isListening} onChange={handleListenToggle} aria-label="Enable Translation Receiver" />
                  <span className={sharedStyles.sidebarSwitchTrack}><span className={sharedStyles.sidebarSwitchThumb} /></span>
                </label>
              </div>

              <div>
                <label style={{ fontSize: '10px', opacity: 0.6, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>My Language (Translate To)</label>
                <select 
                  value={targetLanguage} 
                  aria-label="Target Language"
                  onChange={(e) => { setTargetLanguage(e.target.value); playClick(); }} 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px' }}
                >
                  {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                </select>
              </div>

              <div className={sharedStyles.sidebarCard}>
                <div className={sharedStyles.sidebarCardText}>
                  <span className={sharedStyles.sidebarCardLabel}>Hear Original Audio</span>
                  <span className={sharedStyles.sidebarCardHint}>Mix authentic voice with translation</span>
                </div>
                <label className={sharedStyles.sidebarSwitch}>
                  <input type="checkbox" checked={hearRawAudio} onChange={() => { setHearRawAudio(!hearRawAudio); playToggle(!hearRawAudio); }} aria-label="Toggle Mixed Audio" />
                  <span className={sharedStyles.sidebarSwitchTrack}><span className={sharedStyles.sidebarSwitchThumb} /></span>
                </label>
              </div>

              {/* Incoming Translations Feed */}
              <div style={{ flex: 1, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Translation History</div>
                <div 
                  ref={(el) => {
                    if (el) {
                      el.scrollTop = el.scrollHeight;
                    }
                  }}
                  style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}
                >
                  {incomingTranslations.length === 0 ? (
                    <div style={{ fontSize: '12px', opacity: 0.4, fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>No translations yet</div>
                  ) : (
                    incomingTranslations.map((msg, i) => (
                      <div key={msg.timestamp + i} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '13px' }}>
                        <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, color: '#fbbf24' }}>{msg.participantId.split('__')[0]}</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ lineHeight: '1.4' }}>{msg.text}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

