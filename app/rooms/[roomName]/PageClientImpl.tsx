'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { ConnectionDetails } from '@/lib/types';
import { SuccessClassControlBar } from '@/lib/SuccessClassControlBar';
import { ChatPanel } from '@/lib/ChatPanel';
import { ParticipantsPanel } from '@/lib/ParticipantsPanel';
import { AgentPanel } from '@/lib/AgentPanel';
import { LiveCaptions } from '@/lib/LiveCaptions';
import roomStyles from '@/styles/SuccessClass.module.css';
import {
  LocalUserChoices,
  PreJoin,
  RoomContext,
  LayoutContextProvider,
  GridLayout,
  FocusLayout,
  FocusLayoutContainer,
  ParticipantTile,
  useTracks,
  useCreateLayoutContext,
  useLayoutContext,
  usePinnedTracks,
  isTrackReference,
  RoomAudioRenderer,
  ConnectionStateToast,
} from '@livekit/components-react';
import { TranscriptSegment } from '@/lib/LiveCaptions';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
  AudioCaptureOptions,
  ConnectionState,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
} from 'livekit-client';
import { useRouter, useParams } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { toast } from 'react-hot-toast';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';

// Icons
const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

type SidebarPanel = 'participants' | 'agent' | 'chat' | 'broadcast' | 'translate' | 'settings';

type TranslationEntry = {
  id: string;
  speakerId: string;
  source: string;
  translated: string;
  engine: 'google' | 'ollama' | 'gemini';
  timestamp: number;
};

function VideoGrid({ allowedParticipantIds }: { allowedParticipantIds: Set<string> }) {
  const layoutContext = useLayoutContext();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const focusTrackRef = focusTrack && isTrackReference(focusTrack) ? focusTrack : undefined;
  const focusTrackSid = focusTrackRef?.publication?.trackSid;
  const autoPinnedSidRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const dispatch = layoutContext?.pin?.dispatch;
    if (!dispatch) {
      return;
    }

    const screenShareTracks = tracks
      .filter(isTrackReference)
      .filter((track) => track.source === Track.Source.ScreenShare && track.publication?.isSubscribed);
    const currentPinnedSid = focusTrackRef?.publication?.trackSid ?? null;
    const hasManualPin = currentPinnedSid && currentPinnedSid !== autoPinnedSidRef.current;

    if (hasManualPin) {
      autoPinnedSidRef.current = null;
      return;
    }

    if (!currentPinnedSid && screenShareTracks.length > 0) {
      const target = screenShareTracks[0];
      autoPinnedSidRef.current = target.publication.trackSid ?? null;
      dispatch({ msg: 'set_pin', trackReference: target });
      return;
    }

    if (autoPinnedSidRef.current) {
      const stillExists = screenShareTracks.some(
        (track) => track.publication.trackSid === autoPinnedSidRef.current,
      );
      if (!stillExists) {
        dispatch({ msg: 'clear_pin' });
        autoPinnedSidRef.current = null;
      }
    }
  }, [layoutContext, tracks, focusTrackRef]);

  // Filter to only show local participant camera and any screen shares
  // Remote participants are shown in the Trainor sidebar only
  const filteredTracks = tracks.filter((track) => {
    // Always show screen shares
    if (track.source === Track.Source.ScreenShare) {
      return true;
    }
    // Only show local participant's camera in the grid
    if (track.participant?.isLocal) {
      return true;
    }
    if (track.participant && allowedParticipantIds.has(track.participant.identity)) {
      return true;
    }
    if (focusTrackSid && isTrackReference(track) && track.publication.trackSid === focusTrackSid) {
      return true;
    }
    return false;
  });

  const focusIsInGrid =
    !!focusTrackRef &&
    filteredTracks.some(
      (track) => isTrackReference(track) && track.publication.trackSid === focusTrackRef.publication?.trackSid,
    );
  const activeFocusTrack = focusIsInGrid ? focusTrackRef : undefined;

  // If no tracks to show, display a placeholder
  if (filteredTracks.length === 0) {
    return (
      <div className={roomStyles.videoPlaceholder}>
        Your camera will appear here
      </div>
    );
  }

  return !activeFocusTrack ? (
    <GridLayout tracks={filteredTracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  ) : (
    <FocusLayoutContainer className={roomStyles.focusLayoutContainer}>
      <FocusLayout trackRef={activeFocusTrack} />
    </FocusLayoutContainer>
  );
}

function SettingsPanel({
  voiceFocusEnabled,
  onVoiceFocusChange,
  vadEnabled,
  onVadChange,
  noiseSuppressionEnabled,
  onNoiseSuppressionChange,
  echoCancellationEnabled,
  onEchoCancellationChange,
  autoGainEnabled,
  onAutoGainChange,
}: {
  voiceFocusEnabled: boolean;
  onVoiceFocusChange: (enabled: boolean) => void;
  vadEnabled: boolean;
  onVadChange: (enabled: boolean) => void;
  noiseSuppressionEnabled: boolean;
  onNoiseSuppressionChange: (enabled: boolean) => void;
  echoCancellationEnabled: boolean;
  onEchoCancellationChange: (enabled: boolean) => void;
  autoGainEnabled: boolean;
  onAutoGainChange: (enabled: boolean) => void;
}) {
  return (
    <div className={roomStyles.sidebarPanel}>
      <div className={roomStyles.sidebarHeader}>
        <div className={roomStyles.sidebarHeaderText}>
          <h3>Audio Settings</h3>
          <span className={roomStyles.sidebarHeaderMeta}>Configure audio processing</span>
        </div>
      </div>
      <div className={roomStyles.sidebarBody}>
        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Voice Focus</span>
            <span className={roomStyles.sidebarCardHint}>Isolate your voice from background noise.</span>
          </div>
          <label className={roomStyles.sidebarSwitch}>
            <input
              type="checkbox"
              checked={voiceFocusEnabled}
              onChange={(e) => onVoiceFocusChange(e.target.checked)}
              aria-label="Voice Focus"
            />
            <span className={roomStyles.sidebarSwitchTrack}>
              <span className={roomStyles.sidebarSwitchThumb} />
            </span>
          </label>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Voice Detection</span>
            <span className={roomStyles.sidebarCardHint}>Auto-mute when not speaking.</span>
          </div>
          <label className={roomStyles.sidebarSwitch}>
            <input
              type="checkbox"
              checked={vadEnabled}
              onChange={(e) => onVadChange(e.target.checked)}
              aria-label="Voice Activity Detection"
            />
            <span className={roomStyles.sidebarSwitchTrack}>
              <span className={roomStyles.sidebarSwitchThumb} />
            </span>
          </label>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Noise Suppression</span>
            <span className={roomStyles.sidebarCardHint}>Reduce background noise.</span>
          </div>
          <label className={roomStyles.sidebarSwitch}>
            <input
              type="checkbox"
              checked={noiseSuppressionEnabled}
              onChange={(e) => onNoiseSuppressionChange(e.target.checked)}
              aria-label="Noise Suppression"
            />
            <span className={roomStyles.sidebarSwitchTrack}>
              <span className={roomStyles.sidebarSwitchThumb} />
            </span>
          </label>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Echo Cancellation</span>
            <span className={roomStyles.sidebarCardHint}>Prevent audio feedback.</span>
          </div>
          <label className={roomStyles.sidebarSwitch}>
            <input
              type="checkbox"
              checked={echoCancellationEnabled}
              onChange={(e) => onEchoCancellationChange(e.target.checked)}
              aria-label="Echo Cancellation"
            />
            <span className={roomStyles.sidebarSwitchTrack}>
              <span className={roomStyles.sidebarSwitchThumb} />
            </span>
          </label>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Auto Gain Control</span>
            <span className={roomStyles.sidebarCardHint}>Auto-adjust microphone volume.</span>
          </div>
          <label className={roomStyles.sidebarSwitch}>
            <input
              type="checkbox"
              checked={autoGainEnabled}
              onChange={(e) => onAutoGainChange(e.target.checked)}
              aria-label="Auto Gain Control"
            />
            <span className={roomStyles.sidebarSwitchTrack}>
              <span className={roomStyles.sidebarSwitchThumb} />
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

function BroadcastPanel({
  captionsEnabled,
  onCaptionsToggle,
  transcriptions,
  continuousSaveEnabled,
  onContinuousSaveChange,
  captionLanguage,
  onCaptionLanguageChange,
  captionEngine,
  onCaptionEngineChange,
  captionAudioSource,
  onCaptionAudioSourceChange,
  onSaveTranscription,
  isBroadcasting,
  onBroadcastToggle,
  broadcastLocked,
  currentBroadcasterId,
}: {
  captionsEnabled: boolean;
  onCaptionsToggle: (enabled: boolean) => void;
  transcriptions: { id: string; speakerId: string; text: string; timestamp: number }[];
  continuousSaveEnabled: boolean;
  onContinuousSaveChange: (enabled: boolean) => void;
  captionLanguage: string;
  onCaptionLanguageChange: (lang: string) => void;
  captionEngine: 'webspeech';
  onCaptionEngineChange: (engine: 'webspeech') => void;
  captionAudioSource: 'auto' | 'microphone' | 'screen';
  onCaptionAudioSourceChange: (source: 'auto' | 'microphone' | 'screen') => void;
  onSaveTranscription: () => void;
  isBroadcasting: boolean;
  onBroadcastToggle: () => void;
  broadcastLocked: boolean;
  currentBroadcasterId: string | null;
}) {
  const room = React.useContext(RoomContext);
  const isLockedByOther = broadcastLocked && currentBroadcasterId !== room?.localParticipant?.identity;

  return (
    <div className={roomStyles.sidebarPanel}>
      <div className={roomStyles.sidebarHeader}>
        <div className={roomStyles.sidebarHeaderText}>
          <h3>Broadcast & Captions</h3>
          <span className={roomStyles.sidebarHeaderMeta}>Control your broadcast and view live captions</span>
        </div>
      </div>
      <div className={roomStyles.sidebarBody}>
        {/* Broadcast Audio Toggle */}
        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Broadcast Audio</span>
            <span className={roomStyles.sidebarCardHint}>
              {isLockedByOther
                ? `Locked by ${currentBroadcasterId}`
                : 'Stream your audio for transcription.'}
            </span>
          </div>
          <label className={roomStyles.sidebarSwitch}>
            <input
              type="checkbox"
              checked={isBroadcasting}
              onChange={onBroadcastToggle}
              aria-label="Broadcast audio"
              disabled={isLockedByOther}
            />
            <span className={roomStyles.sidebarSwitchTrack}>
              <span className={roomStyles.sidebarSwitchThumb} />
            </span>
          </label>
        </div>

        {/* Live Captions Toggle */}
        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Show Captions</span>
            <span className={roomStyles.sidebarCardHint}>Display real-time subtitles.</span>
          </div>
          <label className={roomStyles.sidebarSwitch}>
            <input
              type="checkbox"
              checked={captionsEnabled}
              onChange={(event) => onCaptionsToggle(event.target.checked)}
              aria-label="Show captions"
            />
            <span className={roomStyles.sidebarSwitchTrack}>
              <span className={roomStyles.sidebarSwitchThumb} />
            </span>
          </label>
        </div>

        {/* Caption Settings */}
        <div className={roomStyles.sidebarSectionHeader}>
          <span>Advanced Settings</span>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Caption Engine</span>
            <span className={roomStyles.sidebarCardHint}>Using Web Speech API.</span>
          </div>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Audio Source</span>
          </div>
          <select
            title="Audio Source"
            className={roomStyles.sidebarSelect}
            value={captionAudioSource}
            onChange={(event) => onCaptionAudioSourceChange(event.target.value as 'auto' | 'microphone' | 'screen')}
          >
            <option value="auto">Auto</option>
            <option value="microphone">Microphone</option>
            <option value="screen">Screen share</option>
          </select>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Continuous Save</span>
            <span className={roomStyles.sidebarCardHint}>
              Auto-save captions to a single database record.
            </span>
          </div>
          <label className={roomStyles.sidebarSwitch}>
            <input
              type="checkbox"
              checked={continuousSaveEnabled}
              onChange={(event) => onContinuousSaveChange(event.target.checked)}
              aria-label="Toggle continuous transcription save"
            />
            <span className={roomStyles.sidebarSwitchTrack}>
              <span className={roomStyles.sidebarSwitchThumb} />
            </span>
          </label>
        </div>

        <button 
          className={roomStyles.sidebarCardButton}
          onClick={onSaveTranscription}
        >
          Save Transcription
        </button>

        {/* Feed */}
        <div className={roomStyles.transcriptionsList}>
          <div className={roomStyles.sidebarSectionHeader}>
            <span>Transcription Feed</span>
            <span className={roomStyles.badge}>{transcriptions.length}</span>
          </div>
          <div className={roomStyles.transcriptionsScroll}>
            {transcriptions.length === 0 ? (
              <div className={roomStyles.emptyState}>
                <p>No transcriptions yet.</p>
              </div>
            ) : (
              transcriptions.map((t) => (
                <div key={t.id} className={roomStyles.transcriptItem}>
                  <div className={roomStyles.transcriptHeader}>
                    <span className={roomStyles.transcriptSpeaker}>
                      {room?.getParticipantByIdentity(t.speakerId)?.name || t.speakerId}
                    </span>
                    <span className={roomStyles.transcriptTime}>
                      {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={roomStyles.transcriptText}>{t.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TranslatePanel({
  isListening,
  isBroadcastActive,
  onListenToggle,
  onListenTranslationClick,
  targetLanguage,
  onTargetLanguageChange,
  translationEngine,
  onTranslationEngineChange,
  transcriptions,
  translationLog,
  translationVoiceSelection,
  onTranslationVoiceSelectionChange,
  customTranslationVoice,
  onCustomTranslationVoiceChange,
  ttsEngine,
  onTtsEngineChange,
}: {
  isListening: boolean;
  isBroadcastActive: boolean;
  onListenToggle: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  onListenTranslationClick: () => void;
  targetLanguage: string;
  onTargetLanguageChange: (lang: string | ((prev: string) => string)) => void;
  translationEngine: 'google' | 'ollama' | 'gemini';
  onTranslationEngineChange: (engine: 'google' | 'ollama' | 'gemini') => void;
  transcriptions: { id: string; speakerId: string; text: string; timestamp: number }[];
  translationLog: TranslationEntry[];
  translationVoiceSelection: 'default' | 'custom';
  onTranslationVoiceSelectionChange: (selection: 'default' | 'custom') => void;
  customTranslationVoice: string;
  onCustomTranslationVoiceChange: (voice: string) => void;
  ttsEngine: 'cartesia' | 'google-genai' | 'livekit-agent';
  onTtsEngineChange: (engine: 'cartesia' | 'google-genai' | 'livekit-agent') => void;
}) {
  const room = React.useContext(RoomContext);
  const languageGroups = [
    {
      label: 'Common',
      options: [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
        { value: 'de', label: 'German' },
        { value: 'zh', label: 'Chinese (Mandarin)' },
        { value: 'ja', label: 'Japanese' },
        { value: 'ko', label: 'Korean' },
        { value: 'pt', label: 'Portuguese' },
        { value: 'it', label: 'Italian' },
        { value: 'ru', label: 'Russian' },
        { value: 'ar', label: 'Arabic' },
        { value: 'hi', label: 'Hindi' },
      ],
    },
    {
      label: 'Dutch Variants',
      options: [
        { value: 'nl-NL', label: 'Dutch (Netherlands)' },
        { value: 'nl-BE', label: 'Dutch (Belgium/Flemish)' },
        { value: 'nl-LI', label: 'Dutch (Limburgish)' },
        { value: 'nl-ZE', label: 'Dutch (Zeelandic)' },
      ],
    },
    {
      label: 'Cameroon',
      options: [
        { value: 'fr-CM', label: 'Cameroonian French' },
        { value: 'en-CM', label: 'Cameroonian English' },
        { value: 'pcm-CM', label: 'Cameroonian Pidgin English' },
        { value: 'cmf', label: 'Camfranglais' },
        { value: 'ewo', label: 'Ewondo' },
      ],
    },
  ];

  return (
    <div className={roomStyles.sidebarPanel}>
      <div className={roomStyles.sidebarHeader}>
        <div className={roomStyles.sidebarHeaderText}>
          <h3>Translation</h3>
          <span className={roomStyles.sidebarHeaderMeta}>Real-time AI voice translation.</span>
        </div>
      </div>
      <div className={roomStyles.sidebarBody}>
        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Language: {targetLanguage}</span>
            <span className={roomStyles.sidebarCardHint}>
              Select your listener language.
            </span>
          </div>
          <div
            role="radiogroup"
            aria-label="Translation mode"
            className={roomStyles.translationModeRadioGroup}
          >
            <label
              className={`${roomStyles.translationModeOption} ${
                !isListening ? roomStyles.translationModeOptionActive : ''
              }`}
            >
              <input
                type="radio"
                name="translationMode"
                value="text"
                checked={!isListening}
                onChange={() => onListenToggle(false)}
              />
              <div>
                <strong>Text only</strong>
                <p>Read live translations.</p>
              </div>
            </label>
            <label
              className={`${roomStyles.translationModeOption} ${
                isListening ? roomStyles.translationModeOptionActive : ''
              }`}
            >
              <input
                type="radio"
                name="translationMode"
                value="audio"
                checked={isListening}
                disabled={!isBroadcastActive}
                onChange={() => onListenToggle(true)}
              />
              <div>
                <strong>AI Voice</strong>
                <p>Real-time voice synthesis.</p>
              </div>
            </label>
          </div>
          <button
            className={roomStyles.sidebarCardButton}
            onClick={onListenTranslationClick}
            disabled={!isBroadcastActive || transcriptions.length === 0}
          >
            Listen Translation
          </button>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Target language</span>
            <span className={roomStyles.sidebarCardHint}>Choose your translation language.</span>
          </div>
          <select
            title="Target Language"
            aria-label="Target Language"
            className={roomStyles.sidebarSelect}
            value={targetLanguage}
            onChange={(event) => onTargetLanguageChange(event.target.value)}
          >
            {languageGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Translation provider</span>
            <span className={roomStyles.sidebarCardHint}>
              Google Translate is fast and reliable; Ollama (Gemini 3 Flash Preview: cloud) adds conversational polish
              right before TTS playback.
            </span>
          </div>
          <select
            title="Translation Engine"
            aria-label="Translation Engine"
            className={roomStyles.sidebarSelect}
            value={translationEngine}
            onChange={(event) => onTranslationEngineChange(event.target.value as 'google' | 'ollama' | 'gemini')}
          >
            <option value="google">Google Translate (auto)</option>
            <option value="ollama">Ollama (Gemini 3 Flash Preview: cloud)</option>
            <option value="gemini">Gemini Flash Lite (Google)</option>
          </select>
          <div className={roomStyles.clipContentSection}>
            <button className={roomStyles.sidebarCardButton} disabled={!transcriptions.length}>
              Add clip to content
            </button>
          </div>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Cartesia voice</span>
            <span className={roomStyles.sidebarCardHint}>
              Pick the voice that reads your translations or enter a Cartesia voice ID.
            </span>
          </div>
          <div className={roomStyles.sidebarCardColumn}>
            <select
              title="Cartesia voice preset"
              aria-label="Cartesia voice preset"
              className={roomStyles.sidebarSelect}
              value={translationVoiceSelection}
              onChange={(event) => onTranslationVoiceSelectionChange(event.target.value as 'default' | 'custom')}
            >
              <option value="default">Server default voice</option>
              <option value="custom">Custom voice ID</option>
            </select>
            {translationVoiceSelection === 'custom' && (
              <input
                className={roomStyles.sidebarInput}
                type="text"
                placeholder="e.g. aurora-narrator"
                value={customTranslationVoice}
                onChange={(event) => onCustomTranslationVoiceChange(event.target.value)}
              />
            )}
          </div>
        </div>

        <div className={roomStyles.sidebarCard}>
          <div className={roomStyles.sidebarCardText}>
            <span className={roomStyles.sidebarCardLabel}>Translation voice engine</span>
            <span className={roomStyles.sidebarCardHint}>
              Choose the backend that synthesizes translations for the “Listen to Translation” flow.
            </span>
          </div>
          <select
            title="Translation TTS Engine"
            aria-label="Translation TTS Engine"
            className={roomStyles.sidebarSelect}
            value={ttsEngine}
            onChange={(event) => onTtsEngineChange(event.target.value as 'cartesia' | 'google-genai' | 'livekit-agent')}
          >
            <option value="cartesia">Cartesia Sonic-3 (default)</option>
            <option value="google-genai">Google Gemini Live Audio</option>
            <option value="livekit-agent">LiveKit Agent (muted mic)</option>
          </select>
          <div className={roomStyles.clipContentSection}>
            <span className={roomStyles.sidebarCardHint}>
              Capture the highlighted transcript and pin it as a content clip.
            </span>
            <button className={roomStyles.sidebarCardButton} disabled={!transcriptions.length}>
              Add clip to content
            </button>
          </div>
        </div>

        <div className={roomStyles.translationClipGrid}>
          <div className={roomStyles.translationClipCard}>
            <div className={roomStyles.sidebarSectionHeader}>
              <span>Supabase transcripts (live)</span>
              <span className={roomStyles.badge}>{transcriptions.length}</span>
            </div>
            <div className={roomStyles.transcriptionsScroll}>
              {transcriptions.length === 0 ? (
                <div className={roomStyles.emptyState}>
                  <p>No transcripts stored yet.</p>
                  <small className={roomStyles.sidebarCardHint}>Add clip-to-content snippets here.</small>
                </div>
              ) : (
                transcriptions.map((entry) => (
                  <div key={entry.id} className={roomStyles.transcriptItem}>
                    <div className={roomStyles.transcriptHeader}>
                      <span className={roomStyles.transcriptSpeaker}>
                        {room?.getParticipantByIdentity(entry.speakerId)?.name || entry.speakerId}
                      </span>
                      <span className={roomStyles.transcriptTime}>
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={roomStyles.transcriptText}>{entry.text}</p>
                  </div>
                ))
              )}
            </div>
            <button
              className={roomStyles.sidebarCardButton}
              onClick={onListenTranslationClick}
              disabled={!isBroadcastActive || transcriptions.length === 0}
            >
              Listen to Translation
            </button>
          </div>
          <div className={roomStyles.translationClipCard}>
            <div className={roomStyles.sidebarSectionHeader}>
              <span>Translation preview</span>
              <span className={roomStyles.badge}>{translationLog.length}</span>
            </div>
            <div className={roomStyles.transcriptionsScroll}>
              {translationLog.length === 0 ? (
                <div className={roomStyles.emptyState}>
                  <p>Waiting for translations to arrive...</p>
                </div>
              ) : (
                translationLog.map((entry) => (
                  <div key={entry.id} className={roomStyles.transcriptItem}>
                    <div className={roomStyles.transcriptHeader}>
                      <span className={roomStyles.transcriptSpeaker}>
                        {room?.getParticipantByIdentity(entry.speakerId)?.name || entry.speakerId}
                      </span>
                      <span className={roomStyles.transcriptTime}>
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={roomStyles.transcriptText}>
                      <strong>Source:</strong> {entry.source}
                    </p>
                    <p className={`${roomStyles.transcriptText} ${roomStyles.translationHighlight}`}>
                      <strong>
                        Translated (
                        {entry.engine === 'google'
                          ? 'Google'
                          : entry.engine === 'ollama'
                          ? 'Ollama'
                          : 'Gemini'}
                        ):
                      </strong>{' '}
                      {entry.translated}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  // Loading state to prevent flash of PreJoin on refresh
  const [isLoading, setIsLoading] = React.useState(true);

  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  // Restore session on mount
  React.useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedSession = sessionStorage.getItem('lk_session_storage');
        if (savedSession) {
          const session = JSON.parse(savedSession);
          // Only restore if it's for the same room
          if (session.roomName === props.roomName) {
            setConnectionDetails(session.connectionDetails);
            setPreJoinChoices(session.userChoices);
          }
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, [props.roomName]);

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
    
    // Save to session storage
    sessionStorage.setItem('lk_session_storage', JSON.stringify({
      roomName: props.roomName,
      connectionDetails: connectionDetailsData,
      userChoices: values,
      timestamp: Date.now(),
    }));
  }, [props.roomName, props.region]);
  
  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  if (isLoading) {
    return (
      <div className={roomStyles.videoPlaceholder}>
        Loading...
      </div>
    );
  }

  return (
    <main data-lk-theme="default" className="lk-room-container">
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div className={roomStyles.preJoinContainer}>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
          />
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
}) {
  const keyProvider = React.useMemo(() => new ExternalE2EEKeyProvider(), []);
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const { roomName } = useParams<{ roomName: string }>();
  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);
  const [activeSidebarPanel, setActiveSidebarPanel] = React.useState<SidebarPanel>('participants');
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [captionsEnabled, setCaptionsEnabled] = React.useState(true);
  const [isBroadcasting, setIsBroadcasting] = React.useState(false);
  const [captionEngine, setCaptionEngine] = React.useState<'webspeech'>('webspeech');
  const [captionLanguage, setCaptionLanguage] = React.useState('auto');
  const [captionAudioSource, setCaptionAudioSource] = React.useState<'auto' | 'microphone' | 'screen'>('auto');
  const [transcriptSegments, setTranscriptSegments] = React.useState<TranscriptSegment[]>([]);
  const [continuousSaveEnabled, setContinuousSaveEnabled] = React.useState(false);
  const [voiceFocusEnabled, setVoiceFocusEnabled] = React.useState(true);
  const [vadEnabled, setVadEnabled] = React.useState(true);
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = React.useState(true);
  const [echoCancellationEnabled, setEchoCancellationEnabled] = React.useState(true);
  const [autoGainEnabled, setAutoGainEnabled] = React.useState(true);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = React.useState(false);
  const [waitingList, setWaitingList] = React.useState<{ identity: string; name: string }[]>([]);
  const [admittedIds, setAdmittedIds] = React.useState<Set<string>>(new Set());
  const [isListening, setIsListening] = React.useState(false);
  const [isAppMuted, setIsAppMuted] = React.useState(false);
  const [targetLanguage, setTargetLanguage] = React.useState('en');
  const [translationQueue, setTranslationQueue] = React.useState<string[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isRemoteBroadcastActive, setIsRemoteBroadcastActive] = React.useState(false);
  const broadcastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [transcriptions, setTranscriptions] = React.useState<{ id: string; speakerId: string; text: string; timestamp: number }[]>([]);
  const lastSeenTextMap = React.useRef<Map<string, string>>(new Map());
  const pipelineEmitter = React.useRef(new EventTarget());

  const layoutContext = useCreateLayoutContext();
  const [broadcastLocked, setBroadcastLocked] = React.useState(false);
  const [currentBroadcasterId, setCurrentBroadcasterId] = React.useState<string | null>(null);
  const heartbeatRef = React.useRef<NodeJS.Timeout | null>(null);

  const [translationEngine, setTranslationEngine] = React.useState<'google' | 'ollama' | 'gemini'>('google');
  const [translationLog, setTranslationLog] = React.useState<TranslationEntry[]>([]);
  const [translationVoiceSelection, setTranslationVoiceSelection] = React.useState<'default' | 'custom'>(
    'default',
  );
  const [customTranslationVoice, setCustomTranslationVoice] = React.useState('');
  const [ttsEngine, setTtsEngine] = React.useState<'cartesia' | 'google-genai' | 'livekit-agent'>('cartesia');

  const translationVoiceId = React.useMemo(() => {
    if (translationVoiceSelection === 'custom') {
      const trimmed = customTranslationVoice.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  }, [translationVoiceSelection, customTranslationVoice]);

  // Pipeline Listeners
  React.useEffect(() => {
    const emitter = pipelineEmitter.current;

    /**
     * Step 1: Render Source
     * Renders the source sentence in the translation panel immediately.
     */
    const onRenderSource = async (e: any) => {
      const { speakerId, text, timestamp, id } = e.detail;
      
      setTranslationLog((prev) => [
        {
          id,
          speakerId,
          source: text,
          translated: '...', // Rendering "in progress" state
          engine: translationEngine,
          timestamp,
        },
        ...prev,
      ].slice(0, 50));

      // Propagate to next step
      emitter.dispatchEvent(new CustomEvent('translate', { detail: e.detail }));
    };

    /**
     * Step 2: Translate
     * Performs AI translation and updates the log entry.
     */
    const onTranslate = async (e: any) => {
      const { speakerId, text, timestamp, id } = e.detail;
      
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            targetLanguage,
            provider: translationEngine,
          }),
        });

        if (!res.ok) throw new Error('Translation failed');
        const { translatedText } = await res.json();

        // Update UI with translated text
        setTranslationLog((prev) => prev.map(entry => 
          entry.id === id ? { ...entry, translated: translatedText } : entry
        ));

        // Persist to DB if enabled
        if (continuousSaveEnabled) {
          fetch('/api/transcription/save-live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meetingId: roomName,
              sourceText: text,
              sourceLang: 'auto',
              speakerId,
              targetLang: targetLanguage,
              translatedText,
            }),
          }).catch((err) => console.warn('Persistence failed:', err));
        }

        // Propagate to TTS
        emitter.dispatchEvent(new CustomEvent('tts', { detail: { ...e.detail, translatedText } }));
      } catch (err) {
        console.warn('Pipeline translation error:', err);
        setTranslationLog((prev) => prev.map(entry => 
          entry.id === id ? { ...entry, translated: '[Translation Error]' } : entry
        ));
      }
    };

    /**
     * Step 3: TTS
     * Generates audio for the translated text and adds to playback queue.
     */
    const onTTS = async (e: any) => {
      const { translatedText, playAudio } = e.detail;
      if (!playAudio) return;

      try {
        const ttsPayload: Record<string, string> = {
          text: translatedText,
          provider: ttsEngine,
        };
        if (ttsEngine === 'cartesia' && translationVoiceId) {
          ttsPayload.voiceId = translationVoiceId;
        }

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ttsPayload),
        });

        if (!res.ok) return;
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        setTranslationQueue((prev) => [...prev, audioUrl]);
      } catch (err) {
        console.warn('Pipeline TTS error:', err);
      }
    };

    emitter.addEventListener('render-source', onRenderSource);
    emitter.addEventListener('translate', onTranslate);
    emitter.addEventListener('tts', onTTS);

    return () => {
      emitter.removeEventListener('render-source', onRenderSource);
      emitter.removeEventListener('translate', onTranslate);
      emitter.removeEventListener('tts', onTTS);
    };
  }, [roomName, isListening, targetLanguage, translationEngine, translationVoiceId, ttsEngine, continuousSaveEnabled]);

  const translateAndQueue = React.useCallback(
    async (speakerId: string, sourceText: string, playAudio: boolean) => {
      const text = sourceText.trim();
      if (!text || text.length < 2) return;

      pipelineEmitter.current.dispatchEvent(new CustomEvent('render-source', {
        detail: {
          id: Math.random().toString(36).substring(7),
          speakerId,
          text,
          timestamp: Date.now(),
          playAudio // This can be used in the listeners to skip steps if needed
        }
      }));
    },
    [],
  );

  const handleListenTranslationClick = React.useCallback(async () => {
    const latest = transcriptions.reduce<{
      id: string;
      speakerId: string;
      text: string;
      timestamp: number;
    } | null>((prev, next) => {
      if (!prev || next.timestamp > prev.timestamp) {
        return next;
      }
      return prev;
    }, null);

    if (!latest || !latest.text) {
      return;
    }

    setIsListening(true);
    setIsAppMuted(true);
    
    // Prime audio
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.load();
    
    await translateAndQueue(latest.speakerId, latest.text, true);
  }, [transcriptions, translateAndQueue]);

  const playJoinSound = React.useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
      setTimeout(() => ctx.close(), 500);
    } catch (error) {
      console.warn('Join sound failed', error);
    }
  }, []);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1080, VideoPresets.h720]
        : [VideoPresets.h540, VideoPresets.h216],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
      singlePeerConnection: true,
    };
  }, [e2eeEnabled, keyProvider, worker, props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);
  const audioCaptureOptions = React.useMemo<AudioCaptureOptions>(() => {
    const activeDeviceId = room.getActiveDevice('audioinput') ?? props.userChoices.audioDeviceId ?? undefined;
    return {
      deviceId: activeDeviceId,
      channelCount: 1,
      sampleRate: 48000,
      autoGainControl: autoGainEnabled,
      echoCancellation: echoCancellationEnabled,
      noiseSuppression: noiseSuppressionEnabled,
      voiceIsolation: voiceFocusEnabled ? true : undefined,
    };
  }, [
    room,
    props.userChoices.audioDeviceId,
    autoGainEnabled,
    echoCancellationEnabled,
    noiseSuppressionEnabled,
    voiceFocusEnabled,
  ]);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase, keyProvider]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => {
    sessionStorage.removeItem('lk_session_storage');
    router.push('/');
  }, [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      playJoinSound();
      if (waitingRoomEnabled && !participant.isLocal) {
        setWaitingList((prev) => [
          ...prev,
          { identity: participant.identity, name: participant.name || participant.identity },
        ]);
        setAdmittedIds((prev) => {
          const next = new Set(prev);
          next.delete(participant.identity);
          return next;
        });
      } else {
        setAdmittedIds((prev) => {
          const next = new Set(prev);
          next.add(participant.identity);
          return next;
        });
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      setWaitingList((prev) => prev.filter((p) => p.identity !== participant.identity));
      setAdmittedIds((prev) => {
        const next = new Set(prev);
        next.delete(participant.identity);
        return next;
      });
    });

    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });
      if (props.userChoices.videoEnabled) {
        room.localParticipant.setCameraEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      if (props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true, audioCaptureOptions).catch((error) => {
          handleError(error);
        });
      }
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
      room.removeAllListeners(RoomEvent.ParticipantConnected);
      room.removeAllListeners(RoomEvent.ParticipantDisconnected);
    };
  }, [
    e2eeSetupComplete,
    room,
    props.connectionDetails,
    props.userChoices,
    connectOptions,
    handleOnLeave,
    handleEncryptionError,
    handleError,
    audioCaptureOptions,
    playJoinSound,
    waitingRoomEnabled,
  ]);

  const lowPowerMode = useLowCPUOptimizer(room);

  React.useEffect(() => {
    if (room.state !== ConnectionState.Connected) {
      return;
    }
    if (!room.localParticipant.isMicrophoneEnabled) {
      return;
    }
    setAdmittedIds((prev) => {
      const next = new Set(prev);
      next.add(room.localParticipant.identity);
      return next;
    });
    room.localParticipant.setMicrophoneEnabled(true, audioCaptureOptions).catch((error) => {
      console.warn('Failed to apply audio processing settings', error);
    });
  }, [room, audioCaptureOptions]);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  // Cleanup broadcast lock on unmount
  React.useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      // Release lock on unmount
      const localIdentity = room.localParticipant?.identity;
      if (isBroadcasting && localIdentity && roomName) {
        fetch('/api/room/broadcast-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: roomName, identity: localIdentity, action: 'release' }),
        }).catch(() => {});
      }
    };
  }, [isBroadcasting, room.localParticipant?.identity, roomName]);

  const handleTranscriptSegment = React.useCallback(
    async (segment: TranscriptSegment) => {
      setTranscriptSegments((prev) => [...prev, segment]);
      
      const speakerId = room.localParticipant?.identity ?? 'local';
      const speakerName = room.localParticipant?.name ?? 'Unknown Speaker';

      // 1. Save to Supabase if enabled
      if (continuousSaveEnabled) {
        try {
          await fetch('/api/transcription/save-live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meetingId: roomName,
              sourceText: segment.text,
              sourceLang: segment.language ?? captionLanguage,
              speakerId,
            }),
          });
        } catch (error) {
          console.warn('Live transcription save failed', error);
        }
      }

      // 2. Publish to transcription stream for others to translate/hear
      try {
        await fetch('/api/transcription/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingId: roomName,
            speakerId,
            speakerName,
            text: segment.text,
            isFinal: segment.isFinal,
            language: segment.language ?? captionLanguage,
          }),
        });
      } catch (error) {
        console.warn('Failed to publish segment to stream', error);
      }
    },
    [continuousSaveEnabled, roomName, captionLanguage, room],
  );

  // Fetch initial transcriptions from Supabase on mount
  React.useEffect(() => {
    if (!roomName) return;

    const fetchInitialTranscripts = async () => {
      try {
        const res = await fetch(`/api/transcription?meetingId=${roomName}`);
        if (res.ok) {
          const data = await res.json();
          // Assuming data is an array of segments
          const formatted = data.map((d: any) => ({
            id: d.id,
            speakerId: d.speaker_id || 'unknown',
            text: d.source_text,
            timestamp: new Date(d.created_at).getTime(),
          }));
          // Sort descending
          setTranscriptions(formatted.sort((a: any, b: any) => b.timestamp - a.timestamp));
          
          // Seed the delta tracker with existing text to avoid repeating history
          formatted.forEach((t: any) => {
            if (!lastSeenTextMap.current.has(t.speakerId)) {
                lastSeenTextMap.current.set(t.speakerId, t.text.trim());
            }
          });
        }
      } catch (error) {
        console.warn('Failed to fetch initial transcripts', error);
      }
    };

    fetchInitialTranscripts();
  }, [roomName]);

  // Check broadcast lock status on mount and poll periodically
  React.useEffect(() => {
    if (!roomName) return;

    const checkBroadcastLock = async () => {
      try {
        const res = await fetch(`/api/room/broadcast-status?roomId=${roomName}`);
        if (res.ok) {
          const data = await res.json();
          setBroadcastLocked(data.isLocked);
          setCurrentBroadcasterId(data.broadcasterId);
        }
      } catch (error) {
        console.warn('Failed to check broadcast lock', error);
      }
    };

    checkBroadcastLock();
    const pollInterval = setInterval(checkBroadcastLock, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [roomName]);

  // Audio Muting Logic - Mute others when listening to translation
  React.useEffect(() => {
    if (!room) return;

    const remoteAudioTracks = Array.from(room.remoteParticipants.values()).flatMap((p: RemoteParticipant) => 
      Array.from(p.audioTrackPublications.values())
    ).filter((t: RemoteTrackPublication) => t.source === Track.Source.Microphone);
    
    remoteAudioTracks.forEach((trackPub: RemoteTrackPublication) => {
      if (trackPub.track) {
        if (isListening) {
          (trackPub.track as any).setMuted?.(true);
          // If using standard HTML elements, we might need to find them and mute
          const elements = trackPub.track.attachedElements;
          elements.forEach((el: HTMLMediaElement) => {
            el.muted = true;
          });
        } else {
          (trackPub.track as any).setMuted?.(false);
          const elements = trackPub.track.attachedElements;
          elements.forEach((el: HTMLMediaElement) => {
            el.muted = false;
          });
        }
      }
    });

    // Also handle future tracks
    const handleTrackSubscribed = (track: RemoteTrack) => {
      if (track.source === Track.Source.Microphone) {
        if (isListening) {
          track.attachedElements.forEach((el: HTMLMediaElement) => {
            el.muted = true;
          });
        }
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [isListening, room]);

  // SSE listener for remote transcriptions (to avoid local echo and handle cumulative text)
  React.useEffect(() => {
    if (!roomName) return;

    const eventSource = new EventSource(`/api/transcription/stream?meetingId=${roomName}`);

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'transcript' || !data.text || !data.isFinal) return;

        // Remote Broadcast Activity Detection
        setIsRemoteBroadcastActive(true);
        if (broadcastTimeoutRef.current) clearTimeout(broadcastTimeoutRef.current);
        broadcastTimeoutRef.current = setTimeout(() => {
          setIsRemoteBroadcastActive(false);
        }, 15000); // Reset after 15s of silence

        const speakerId = data.speakerId || 'unknown';
        const fullText = data.text.trim();

        // Update UI Feed (Descending)
        setTranscriptions(prev => {
          // Find the most recent entry for this speaker
          const existingIdx = prev.findIndex(t => t.speakerId === speakerId);
          
          // Logic:
          // 1. If no existing entry, prepend new one.
          // 2. If existing entry text is a prefix of new text (cumulative update), replace it.
          // 3. If new text is different (new sentence/segment), prepend new one.
          
          if (existingIdx !== -1) {
            const existing = prev[existingIdx];
            // Check if it's an update (cumulative)
            if (fullText.startsWith(existing.text) || existing.text.startsWith(fullText)) {
              // It's likely a correction or extension of the same sentence
              // Use the longer one or the new one if they match length
              const next = [...prev];
              next[existingIdx] = { 
                ...existing, 
                text: fullText.length >= existing.text.length ? fullText : existing.text, 
                timestamp: Date.now() 
              };
              return next.sort((a, b) => b.timestamp - a.timestamp);
            }
          }
          
          // Fallback: Prepend as new segment
          return [{ id: Math.random().toString(), speakerId, text: fullText, timestamp: Date.now() }, ...prev].slice(0, 50);
        });

        // ---------------------------------------------------------
        // Skip translation if it's the local participant's own speech (no echo)
        if (data.speakerId === room.localParticipant?.identity) return;

        // Delta Extraction Logic
        const lastSeen = lastSeenTextMap.current.get(speakerId) || '';

        // If the current text starts with the last seen text, extract the delta
        let delta = fullText;
        if (fullText.startsWith(lastSeen)) {
          delta = fullText.substring(lastSeen.length).trim();
        }

        // Update last seen for this speaker
        lastSeenTextMap.current.set(speakerId, fullText);

        if (!delta || delta.length < 2) return;

        await translateAndQueue(speakerId, delta, isListening);
      } catch (error) {
        console.warn('Failed to process message from stream', error);
      }
    };

    eventSource.onerror = (error) => {
      console.warn('SSE connection error (will auto-retry)', error);
      // Do NOT close. Let the browser retry automatically.
      // eventSource.close(); 
    };

    return () => {
      eventSource.close();
    };
  }, [roomName, isListening, translationVoiceId, translateAndQueue, room.localParticipant?.identity]);

  // Audio queue runner
  React.useEffect(() => {
    if (translationQueue.length > 0 && !isAudioPlaying && isListening) {
      const nextAudio = translationQueue[0];
      setIsAudioPlaying(true);
      
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      console.log('Playing translation audio:', nextAudio);
      audioRef.current.src = nextAudio;
      audioRef.current.play().catch(error => {
        console.warn('Playback failed (possibly autoplay blocked):', error);
        // Move to next even if it fails to avoid getting stuck
        setIsAudioPlaying(false);
        setTranslationQueue((prev) => prev.slice(1));
        URL.revokeObjectURL(nextAudio);
      });
      
      audioRef.current.onended = () => {
        console.log('Finished playing translation audio');
        setTranslationQueue((prev) => prev.slice(1));
        setIsAudioPlaying(false);
        URL.revokeObjectURL(nextAudio);
      };

      audioRef.current.onerror = (e) => {
        console.error('Audio element error:', e);
        setIsAudioPlaying(false);
        setTranslationQueue((prev) => prev.slice(1));
        URL.revokeObjectURL(nextAudio);
      };
    }
  }, [translationQueue, isAudioPlaying, isListening]);

  // Stop audio if listening is toggled off
  React.useEffect(() => {
    if (!isListening) {
      audioRef.current?.pause();
      setIsAudioPlaying(false);
      setTranslationQueue([]);
    }
  }, [isListening]);

  const admitParticipant = React.useCallback((identity: string) => {
    setWaitingList((prev) => prev.filter((p) => p.identity !== identity));
    setAdmittedIds((prev) => {
      const next = new Set(prev);
      next.add(identity);
      return next;
    });
  }, []);

  const handleSaveTranscription = async () => {
    if (transcriptSegments.length === 0) {
      toast.error('No transcription to save');
      return;
    }
    const toastId = toast.loading('Saving transcription...');
    try {
      const response = await fetch('/api/transcription/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: roomName, // Use roomName as meeting ID
          segments: transcriptSegments,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      toast.success('Transcription saved!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to save transcription', { id: toastId });
    }
  };

  const handleSidebarPanelToggle = (panel: SidebarPanel) => {
    setSidebarCollapsed((prevCollapsed) => {
      if (!prevCollapsed && activeSidebarPanel === panel) {
        return true;
      }
      return false;
    });
    setActiveSidebarPanel(panel);
  };

  const setBroadcastState = async (enabled: boolean) => {
    const localIdentity = room.localParticipant?.identity;
    if (!localIdentity || !roomName) return;

    if (enabled) {
      // Try to claim the broadcast lock
      try {
        const res = await fetch('/api/room/broadcast-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: roomName, identity: localIdentity, action: 'claim' }),
        });
        const data = await res.json();
        if (!data.success) {
          console.warn('Failed to claim broadcast lock:', data.error);
          return; // Don't enable broadcasting if lock failed
        }
      } catch (error) {
        console.error('Failed to claim broadcast lock', error);
        return;
      }

      setIsBroadcasting(true);
      setCaptionsEnabled(true);
      setContinuousSaveEnabled(true);
      setIsListening(false);

      // Start heartbeat
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(async () => {
        try {
          await fetch('/api/room/broadcast-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: roomName, identity: localIdentity, action: 'heartbeat' }),
          });
        } catch (error) {
          console.warn('Heartbeat failed', error);
        }
      }, 30000); // Every 30 seconds
    } else {
      // Release the broadcast lock
      try {
        await fetch('/api/room/broadcast-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: roomName, identity: localIdentity, action: 'release' }),
        });
      } catch (error) {
        console.warn('Failed to release broadcast lock', error);
      }

      setIsBroadcasting(false);

      // Stop heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }
  };

  const handleToggleListenTranslation = async () => {
    const nextValue = !isListening;
    setIsListening(nextValue);
    
    // Prime the audio element in direct response to user click to unlock autoplay
    if (nextValue) {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      // Play a tiny silence or just call load() to unlock
      audioRef.current.load();
      console.log('Audio element primed via user interaction');
    }

    if (nextValue && transcriptions.length > 0) {
      const lastTranscript = transcriptions[0];
      if (lastTranscript && lastTranscript.text) {
        await translateAndQueue(lastTranscript.speakerId, lastTranscript.text, true);
      }
    }
  };

  const renderSidebarPanel = () => {
    if (sidebarCollapsed) {
      return null;
    }
    switch (activeSidebarPanel) {
      case 'participants':
        return (
          <ParticipantsPanel
            alias="Participants"
            waitingRoomEnabled={waitingRoomEnabled}
            onWaitingRoomToggle={(enabled) => {
              setWaitingRoomEnabled(enabled);
              if (!enabled) {
                // Admit everyone waiting
                setAdmittedIds((prev) => {
                  const next = new Set(prev);
                  waitingList.forEach((p) => next.add(p.identity));
                  return next;
                });
                setWaitingList([]);
              }
            }}
            waitingList={waitingList}
            onAdmitParticipant={admitParticipant}
            admittedIds={admittedIds}
          />
        );
      case 'agent':
        return <AgentPanel />;
      case 'chat':
        return <ChatPanel />;
      case 'settings':
        return (
          <SettingsPanel
            voiceFocusEnabled={voiceFocusEnabled}
            onVoiceFocusChange={setVoiceFocusEnabled}
            vadEnabled={vadEnabled}
            onVadChange={setVadEnabled}
            noiseSuppressionEnabled={noiseSuppressionEnabled}
            onNoiseSuppressionChange={setNoiseSuppressionEnabled}
            echoCancellationEnabled={echoCancellationEnabled}
            onEchoCancellationChange={setEchoCancellationEnabled}
            autoGainEnabled={autoGainEnabled}
            onAutoGainChange={setAutoGainEnabled}
          />
        );
      case 'broadcast':
        return (
          <BroadcastPanel
            captionsEnabled={captionsEnabled}
            onCaptionsToggle={setCaptionsEnabled}
            transcriptions={transcriptions}
            continuousSaveEnabled={continuousSaveEnabled}
            onContinuousSaveChange={setContinuousSaveEnabled}
            captionLanguage={captionLanguage}
            onCaptionLanguageChange={setCaptionLanguage}
            captionEngine={captionEngine}
            onCaptionEngineChange={setCaptionEngine}
            captionAudioSource={captionAudioSource}
            onCaptionAudioSourceChange={setCaptionAudioSource}
            onSaveTranscription={handleSaveTranscription}
            isBroadcasting={isBroadcasting}
            onBroadcastToggle={() => setBroadcastState(!isBroadcasting)}
            broadcastLocked={broadcastLocked}
            currentBroadcasterId={currentBroadcasterId}
          />
        );
      case 'translate':
          return (
            <TranslatePanel
              isListening={isListening}
              isBroadcastActive={isRemoteBroadcastActive}
              onListenToggle={(enabled: boolean | ((prev: boolean) => boolean)) => {
                const nextEnabled = typeof enabled === 'function' ? enabled(isListening) : enabled;
                setIsListening(nextEnabled);
                setIsAppMuted(nextEnabled);
                if (nextEnabled) {
                  if (!audioRef.current) audioRef.current = new Audio();
                  audioRef.current.load();
                }
              }}
              targetLanguage={targetLanguage}
              onTargetLanguageChange={setTargetLanguage}
              translationEngine={translationEngine}
              onTranslationEngineChange={setTranslationEngine}
              transcriptions={transcriptions}
              translationLog={translationLog}
              translationVoiceSelection={translationVoiceSelection}
              onTranslationVoiceSelectionChange={setTranslationVoiceSelection}
              customTranslationVoice={customTranslationVoice}
              onCustomTranslationVoiceChange={setCustomTranslationVoice}
              ttsEngine={ttsEngine}
              onTtsEngineChange={setTtsEngine}
              onListenTranslationClick={handleListenTranslationClick}
            />
          );
      default:
        return null;
    }
  };

  return (
    <div
      className={`lk-room-container ${roomStyles.roomLayout} ${sidebarCollapsed ? roomStyles.roomLayoutCollapsed : ''}`}
    >
      <RoomContext.Provider value={room}>
        <LayoutContextProvider value={layoutContext}>
          <KeyboardShortcuts />
          <RoomAudioRenderer />
          <ConnectionStateToast />
          
          {/* Main video grid */}
          <div className={roomStyles.videoGridContainer}>
            <VideoGrid allowedParticipantIds={admittedIds} />
            <LiveCaptions 
              room={room} 
              enabled={captionsEnabled} 
              vadEnabled={vadEnabled}
              broadcastEnabled={isBroadcasting}
              language={captionLanguage}
              audioSource={captionAudioSource}
              onTranscriptSegment={handleTranscriptSegment}
            />
          </div>
          
          {/* Right Sidebar */}
          <div className={`${roomStyles.chatPanel} ${sidebarCollapsed ? roomStyles.chatPanelCollapsed : ''}`}>
            <button 
              className={roomStyles.sidebarToggle}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </button>
            <div className={roomStyles.sidebarContent}>
              {renderSidebarPanel()}
            </div>
          </div>
          
          {/* Custom control bar */}
          <SuccessClassControlBar 
            onParticipantsToggle={() => handleSidebarPanelToggle('participants')}
            onAgentToggle={() => handleSidebarPanelToggle('agent')}
            onChatToggle={() => handleSidebarPanelToggle('chat')}
            onBroadcastToggle={() => {
              handleSidebarPanelToggle('broadcast');
              if (sidebarCollapsed || activeSidebarPanel !== 'broadcast') {
                setBroadcastState(true);
              }
            }}
            onTranslateToggle={() => handleSidebarPanelToggle('translate')}
            onSettingsToggle={() => handleSidebarPanelToggle('settings')}
            isParticipantsOpen={!sidebarCollapsed && activeSidebarPanel === 'participants'}
            isAgentOpen={!sidebarCollapsed && activeSidebarPanel === 'agent'}
            isChatOpen={!sidebarCollapsed && activeSidebarPanel === 'chat'}
            isBroadcastOpen={!sidebarCollapsed && activeSidebarPanel === 'broadcast'}
            isTranslateOpen={!sidebarCollapsed && activeSidebarPanel === 'translate'}
            isSettingsOpen={!sidebarCollapsed && activeSidebarPanel === 'settings'}
            isBroadcasting={isBroadcasting}
            isAppMuted={isAppMuted}
            onAppMuteToggle={setIsAppMuted}
            isListening={isListening}
            onListenTranslationToggle={handleToggleListenTranslation}
            audioCaptureOptions={audioCaptureOptions}
          />
          
          <DebugMode />
          <RecordingIndicator />
        </LayoutContextProvider>
      </RoomContext.Provider>
    </div>
  );
}
