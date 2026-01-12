'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/orbit/services/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { ConnectionDetails } from '@/lib/types';
import { EburonControlBar } from '@/lib/EburonControlBar';
import { subscribeToRoom, tryAcquireSpeaker, releaseSpeaker, claimHost, toggleFloorLock, setConversationMode } from '@/lib/orbit/services/roomStateService';
import { RoomState } from '@/lib/orbit/types';
import { OrbitIcon } from '@/lib/orbit/components/OrbitTranslatorVertical';

import { ChatPanel } from '@/lib/ChatPanel';
import { ParticipantsPanel } from '@/lib/ParticipantsPanel';
import { OrbitTranslatorPanel } from '@/lib/orbit/components/OrbitTranslatorPanel';
import { LiveCaptions } from '@/lib/LiveCaptions';
import { CustomPreJoin } from '@/lib/CustomPreJoin';
import { useDeepgramLive } from '@/lib/orbit/hooks/useDeepgramLive';
import { ensureRoomState } from '@/lib/orbit/services/orbitService';
import { LANGUAGES } from '@/lib/orbit/types';
import { useOrbitTranslator } from '@/lib/orbit/hooks/useOrbitTranslator';
import { VisualizerRing } from '@/lib/orbit/components/VisualizerRing';

import { HostCaptionOverlay } from '@/lib/orbit/components/HostCaptionOverlay';
import { CinemaCaptionOverlay } from '@/lib/CinemaCaptionOverlay';

import roomStyles from '@/styles/Eburon.module.css';

import {
  LocalUserChoices,
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
  usePersistentUserChoices,
  isTrackReference,
  RoomAudioRenderer,
  ConnectionStateToast,
} from '@livekit/components-react';
import { useMeetingFloor } from '@/lib/useMeetingFloor';
import { useParams } from 'next/navigation';
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
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';

// Icons
import { useOrbitMic } from '@/lib/orbit/hooks/useOrbitMic';
import { useSound } from '@/lib/hooks/useSound';

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

const TranslatorLogo = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
      <path d="M5 8l6 6" />
      <path d="M4 14l6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="M22 22l-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
);

type SidebarPanel = 'participants' | 'chat' | 'settings' | 'orbit';

function VideoGrid({ allowedParticipantIds, isGridView }: { allowedParticipantIds: Set<string>, isGridView: boolean }) {
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

  const filteredTracks = tracks.filter((track) => {
    if (track.source === Track.Source.ScreenShare) return true;
    if (track.participant?.isLocal) return true;
    if (track.participant && allowedParticipantIds.has(track.participant.identity)) return true;
    if (isGridView && track.participant) return true;
    if (focusTrackSid && isTrackReference(track) && track.publication.trackSid === focusTrackSid) return true;
    return false;
  });

  const focusIsInGrid =
    !!focusTrackRef &&
    filteredTracks.some(
      (track) => isTrackReference(track) && track.publication.trackSid === focusTrackRef.publication?.trackSid,
    );
  const activeFocusTrack = focusIsInGrid ? focusTrackRef : undefined;

  if (filteredTracks.length === 0) {
    return (
      <div className={roomStyles.videoPlaceholder}>
        Your camera will appear here
      </div>
    );
  }

  return (!activeFocusTrack || isGridView) ? (
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

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails>();
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices>();
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    userChoices,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
    saveUsername,
  } = usePersistentUserChoices();

  const preJoinDefaults = React.useMemo(
    () => ({
      audioEnabled: userChoices.audioEnabled,
      videoEnabled: userChoices.videoEnabled,
      audioDeviceId: userChoices.audioDeviceId,
      videoDeviceId: userChoices.videoDeviceId,
      username: userChoices.username,
    }),
    [userChoices],
  );

  const handlePreJoinSubmit = React.useCallback(
    (values: LocalUserChoices) => {
      saveAudioInputEnabled(values.audioEnabled);
      saveVideoInputEnabled(values.videoEnabled);
      saveAudioInputDeviceId(values.audioDeviceId);
      saveVideoInputDeviceId(values.videoDeviceId);
      saveUsername(values.username);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`lk_autojoin_${props.roomName}`, 'true');
      }
      setPreJoinChoices(values);
    },
    [
      props.roomName,
      saveAudioInputEnabled,
      saveAudioInputDeviceId,
      saveVideoInputEnabled,
      saveVideoInputDeviceId,
      saveUsername,
    ],
  );

  const handlePreJoinError = React.useCallback((error: unknown) => {
    console.error('Pre-join error', error);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const shouldAutoJoin = sessionStorage.getItem(`lk_autojoin_${props.roomName}`);
    if (shouldAutoJoin === 'true' && userChoices.username) {
       setPreJoinChoices({
         username: userChoices.username,
         videoEnabled: userChoices.videoEnabled ?? true,
         audioEnabled: userChoices.audioEnabled ?? true,
         videoDeviceId: userChoices.videoDeviceId ?? 'default',
         audioDeviceId: userChoices.audioDeviceId ?? 'default',
       });
    }
  }, [props.roomName, userChoices]);

  React.useEffect(() => {
    if (!preJoinChoices) return;
    let isMounted = true;
    const loadConnectionDetails = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          roomName: props.roomName,
          participantName: preJoinChoices.username || 'Guest',
        });
        if (props.region) {
          params.set('region', props.region);
        }
        const response = await fetch(`${CONN_DETAILS_ENDPOINT}?${params.toString()}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch connection details');
        }
        const data = (await response.json()) as ConnectionDetails;
        if (isMounted) setConnectionDetails(data);
      } catch (error) {
        console.error('Connection details error', error);
        if (isMounted) setConnectionDetails(undefined);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadConnectionDetails();
    return () => { isMounted = false; };
  }, [preJoinChoices, props.roomName, props.region]);

  if (isLoading) return <div className={roomStyles.videoPlaceholder}>Loading...</div>;

  return (
    <main data-lk-theme="default" className="lk-room-container">
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <CustomPreJoin
          roomName={props.roomName}
          defaults={{
            username: preJoinDefaults.username,
            videoEnabled: preJoinDefaults.videoEnabled,
            audioEnabled: preJoinDefaults.audioEnabled,
            videoDeviceId: preJoinDefaults.videoDeviceId,
            audioDeviceId: preJoinDefaults.audioDeviceId,
          }}
          onSubmit={handlePreJoinSubmit}
          onError={handlePreJoinError}
        />
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
  options: { hq: boolean; codec: VideoCodec };
}) {
  const keyProvider = React.useMemo(() => new ExternalE2EEKeyProvider(), []);
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);
  const { roomName } = useParams<{ roomName: string }>();
  const { user } = useAuth();

  const [roomState, setRoomState] = React.useState<RoomState>({ 
    hostId: null, 
    activeSpeaker: null, 
    isFloorLocked: false, 
    conversationMode: 'manual',
    raiseHandQueue: [], 
    lockVersion: 0 
  });
  const [sourceLanguage, setSourceLanguage] = React.useState('multi');
  const [targetLanguage, setTargetLanguage] = React.useState('West Flemish (Belgium)');
  const [roomId, setRoomId] = React.useState<string | null>(null);
  const [hostId, setHostId] = React.useState<string | null>(null);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    return {
      videoCaptureDefaults: {
        deviceId: props.userChoices.videoDeviceId ?? undefined,
        resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
      },
      publishDefaults: {
        dtx: false,
        videoSimulcastLayers: props.options.hq
          ? [VideoPresets.h1080, VideoPresets.h720]
          : [VideoPresets.h540, VideoPresets.h216],
        red: !e2eeEnabled,
        videoCodec,
      },
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
      singlePeerConnection: true,
    };
  }, [e2eeEnabled, keyProvider, worker, props.userChoices, props.options.hq, props.options.codec]);

  const lkRoom = React.useMemo(() => new Room(roomOptions), [roomOptions]);

  return (
    <RoomContext.Provider value={lkRoom}>
      <RoomInner 
        {...props} 
        lkRoom={lkRoom} 
        roomState={roomState}
        setRoomState={setRoomState}
        roomName={roomName}
        user={user}
        roomId={roomId}
        setRoomId={setRoomId}
        hostId={hostId}
        setHostId={setHostId}
        sourceLanguage={sourceLanguage}
        setSourceLanguage={setSourceLanguage}
        targetLanguage={targetLanguage}
        setTargetLanguage={setTargetLanguage}
        e2eeEnabled={e2eeEnabled}
        e2eePassphrase={e2eePassphrase}
        keyProvider={keyProvider}
      />
    </RoomContext.Provider>
  );
}

function RoomInner(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: { hq: boolean; codec: VideoCodec };
  lkRoom: Room;
  roomName: string | undefined;
  user: any;
  roomState: RoomState;
  setRoomState: React.Dispatch<React.SetStateAction<RoomState>>;
  roomId: string | null;
  setRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  hostId: string | null;
  setHostId: React.Dispatch<React.SetStateAction<string | null>>;
  sourceLanguage: string;
  setSourceLanguage: React.Dispatch<React.SetStateAction<string>>;
  targetLanguage: string;
  setTargetLanguage: React.Dispatch<React.SetStateAction<string>>;
  e2eeEnabled: boolean;
  e2eePassphrase?: string;
  keyProvider: ExternalE2EEKeyProvider;
}) {
  const { 
    lkRoom, roomName, user, roomState, setRoomState, 
    roomId, setRoomId, hostId, setHostId,
    sourceLanguage, setSourceLanguage, targetLanguage, setTargetLanguage,
    e2eeEnabled, e2eePassphrase, keyProvider
  } = props;
  
  const [activeSidebarPanel, setActiveSidebarPanel] = React.useState<SidebarPanel>('participants');
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [voiceFocusEnabled, setVoiceFocusEnabled] = React.useState(true);
  const [isGridView, setIsGridView] = React.useState(false);
  const [vadEnabled, setVadEnabled] = React.useState(true);
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = React.useState(true);
  const [echoCancellationEnabled, setEchoCancellationEnabled] = React.useState(true);
  const [autoGainEnabled, setAutoGainEnabled] = React.useState(true);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = React.useState(false);
  const [waitingList, setWaitingList] = React.useState<{ identity: string; name: string }[]>([]);
  const [admittedIds, setAdmittedIds] = React.useState<Set<string>>(new Set());
  const [isAppMuted, setIsAppMuted] = React.useState(false);
  const [orbPosition, setOrbPosition] = React.useState<{ x: number; y: number } | null>({ x: 20, y: 20 });
  const [isOrbDragging, setIsOrbDragging] = React.useState(false);
  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);
  const orbRef = React.useRef<HTMLDivElement | null>(null);
  const orbBarIndices = React.useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);
  const orbStyle: React.CSSProperties | undefined = orbPosition
    ? { left: orbPosition.x, top: orbPosition.y, right: 'auto', bottom: 'auto' }
    : undefined;

  const [isListening, setIsListening] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('orbit_is_listening');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('orbit_is_listening', String(isListening));
    }
  }, [isListening]);
  const [hearRawAudio, setHearRawAudio] = React.useState(false);
  const { playClick, playToggle } = useSound();

  const { activeSpeakerId: floorSpeakerId, isFloorHolder, claimFloor, grantFloor } = useMeetingFloor(roomName || '', user?.id || '');
  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = React.useState(true);

  // Context-dependent hooks
  const lastClickTime = React.useRef<number | null>(null);
  const deepgram = useDeepgramLive({ model: 'nova-2', language: 'multi' });
  const orbitMicState = useOrbitMic({ language: sourceLanguage });
  const translator = useOrbitTranslator({
    targetLanguage,
    enabled: isListening,
    hearRawAudio,
    isSourceSpeaker: roomState?.activeSpeaker?.userId === user?.id
  });

  React.useEffect(() => {
    if (isListening && roomState?.activeSpeaker?.userId === user?.id && orbitMicState.isFinal && orbitMicState.transcript?.trim()) {
      translator.sendTranslation(orbitMicState.transcript);
    }
  }, [isListening, roomState?.activeSpeaker?.userId, user?.id, orbitMicState.isFinal, orbitMicState.transcript, translator]);

  const audioCaptureOptions = React.useMemo<AudioCaptureOptions>(() => {
    const activeDeviceId = lkRoom.getActiveDevice('audioinput') ?? props.userChoices.audioDeviceId ?? undefined;
    return {
      deviceId: activeDeviceId,
      channelCount: 1,
      sampleRate: 48000,
      autoGainControl: autoGainEnabled,
      echoCancellation: echoCancellationEnabled,
      noiseSuppression: noiseSuppressionEnabled,
      voiceIsolation: voiceFocusEnabled ? true : undefined,
    };
  }, [lkRoom, props.userChoices.audioDeviceId, autoGainEnabled, echoCancellationEnabled, noiseSuppressionEnabled, voiceFocusEnabled]);

  const layoutContext = useCreateLayoutContext();

  // Room State Services Subscription
  React.useEffect(() => {
    if (!roomName) return;
    ensureRoomState(roomName);
    const unsubscribe = subscribeToRoom(roomName, (state: RoomState) => {
      setRoomState(state);
      if (state.hostId) setHostId(state.hostId);
    });
    return () => unsubscribe();
  }, [roomName, setRoomState, setHostId]);


  // Orb Audio Visualizer Loop
  React.useEffect(() => {
    if (!roomName) return;
    let animationId: number;
    const updateViz = () => {
      if (!orbRef.current) return;
      
      // Outgoing (Blue) - Local Mic
      let outLevel = 0;
      if (orbitMicState.isRecording && orbitMicState.analyser) {
        const data = new Uint8Array(orbitMicState.analyser.frequencyBinCount);
        orbitMicState.analyser.getByteFrequencyData(data);
        const sum = data.reduce((acc, val) => acc + val, 0);
        outLevel = sum / data.length / 255;
      }
      const outBars = orbRef.current.querySelectorAll(`.${roomStyles.orbBarOut}`);
      outBars.forEach((bar: any, idx: number) => {
        const h = 5 + outLevel * (30 + idx * 5);
        bar.style.height = `${h}px`;
        bar.style.opacity = 0.4 + outLevel * 0.6;
      });

      // Incoming (Green) - From Active Speaker
      let inLevel = 0;
      const speakerId = roomState.activeSpeaker?.userId;
      if (speakerId && speakerId !== lkRoom.localParticipant.identity) {
        const p = lkRoom.remoteParticipants.get(speakerId);
        if (p) {
          inLevel = p.audioLevel > 0 ? p.audioLevel : (p.isSpeaking ? 0.3 + Math.random() * 0.2 : 0);
        }
      }
      const inBars = orbRef.current.querySelectorAll(`.${roomStyles.orbBarIn}`);
      inBars.forEach((bar: any, idx: number) => {
        const h = 5 + inLevel * (30 + idx * 5);
        bar.style.height = `${h}px`;
        bar.style.opacity = 0.4 + inLevel * 0.6;
      });

      animationId = requestAnimationFrame(updateViz);
    };
    animationId = requestAnimationFrame(updateViz);
    return () => cancelAnimationFrame(animationId);
  }, [roomName, roomState, orbitMicState.isRecording, orbitMicState.analyser, lkRoom]);

  // Orb Dragging Logic
  React.useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const margin = 12;

    const clampPosition = (x: number, y: number) => {
      const rect = orb.getBoundingClientRect();
      const size = rect.width || 86;
      const maxX = Math.max(margin, window.innerWidth - size - margin);
      const maxY = Math.max(margin, window.innerHeight - size - margin);
      return { x: Math.min(Math.max(margin, x), maxX), y: Math.min(Math.max(margin, y), maxY) };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as HTMLElement)?.closest('[data-orb-settings="true"]')) return;
      
      // Check for double click
      const now = Date.now();
      if (lastClickTime.current && now - lastClickTime.current < 300) {
        // Double click detected
        orbitMicState.toggle();
        if (!orbitMicState.isRecording) {
            // Starting: Mute app
            setIsAppMuted(true);
            playToggle(true);
        } else {
            // Stopping: Unmute app
            setIsAppMuted(false);
            playToggle(false);
        }
        lastClickTime.current = null;
        return;
      }
      lastClickTime.current = now;

      const rect = orb.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top; startX = event.clientX; startY = event.clientY;
      dragging = true; setIsOrbDragging(true);
      orb.setPointerCapture(event.pointerId);
      setOrbPosition(clampPosition(rect.left, rect.top));
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const next = clampPosition(startLeft + (event.clientX - startX), startTop + (event.clientY - startY));
      setOrbPosition(next);
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false; setIsOrbDragging(false);
      try { orb.releasePointerCapture(event.pointerId); } catch (_) {}
    };

    const onResize = () => {
      setOrbPosition(prev => {
        if (!prev) return prev;
        const rect = orb.getBoundingClientRect();
        const size = rect.width || 86;
        const maxX = Math.max(margin, window.innerWidth - size - margin);
        const maxY = Math.max(margin, window.innerHeight - size - margin);
        return { x: Math.min(Math.max(margin, prev.x), maxX), y: Math.min(Math.max(margin, prev.y), maxY) };
      });
    };

    orb.addEventListener('pointerdown', onPointerDown);
    orb.addEventListener('pointermove', onPointerMove);
    orb.addEventListener('pointerup', endDrag);
    orb.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', onResize);
    return () => {
      orb.removeEventListener('pointerdown', onPointerDown);
      orb.removeEventListener('pointermove', onPointerMove);
      orb.removeEventListener('pointerup', endDrag);
      orb.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // E2EE Setup
  React.useEffect(() => {
    if (e2eeEnabled && e2eePassphrase) {
      keyProvider.setKey(decodePassphrase(e2eePassphrase))
        .then(() => lkRoom.setE2EEEnabled(true))
        .then(() => setE2eeSetupComplete(true))
        .catch(console.error);
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, lkRoom, e2eePassphrase, keyProvider]);

  // Room Connection & Events
  const router = useRouter();
  React.useEffect(() => {
    const handleOnLeave = () => { sessionStorage.removeItem('lk_session_storage'); router.push('/'); };
    lkRoom.on(RoomEvent.Disconnected, handleOnLeave);
    lkRoom.on(RoomEvent.ParticipantConnected, (p) => {
      if (waitingRoomEnabled && !p.isLocal) {
        setWaitingList(prev => [...prev, { identity: p.identity, name: p.name || p.identity }]);
      } else {
        setAdmittedIds(prev => new Set(prev).add(p.identity));
      }
    });
    lkRoom.on(RoomEvent.ParticipantDisconnected, (p) => {
      setWaitingList(prev => prev.filter(w => w.identity !== p.identity));
      setAdmittedIds(prev => { const next = new Set(prev); next.delete(p.identity); return next; });
    });

    if (e2eeSetupComplete) {
      lkRoom.connect(props.connectionDetails.serverUrl, props.connectionDetails.participantToken, { autoSubscribe: true })
        .then(() => {
          if (props.userChoices.videoEnabled) lkRoom.localParticipant.setCameraEnabled(true);
          if (props.userChoices.audioEnabled) lkRoom.localParticipant.setMicrophoneEnabled(true, audioCaptureOptions);
        })
        .catch(console.error);
    }
    return () => {
      lkRoom.off(RoomEvent.Disconnected, handleOnLeave);
      lkRoom.removeAllListeners(RoomEvent.ParticipantConnected);
      lkRoom.removeAllListeners(RoomEvent.ParticipantDisconnected);
    };
  }, [e2eeSetupComplete, lkRoom, props.connectionDetails, props.userChoices, props.options, audioCaptureOptions, waitingRoomEnabled, router]);

  const lowPowerMode = useLowCPUOptimizer(lkRoom);

  const admitParticipant = React.useCallback(async (identity: string) => {
    setWaitingList(prev => prev.filter(p => p.identity !== identity));
    setAdmittedIds(prev => new Set(prev).add(identity));
  }, []);

  const rejectParticipant = React.useCallback(async (identity: string) => {
    setWaitingList(prev => prev.filter(p => p.identity !== identity));
    if (!roomName) return;
    try {
      await fetch('/api/room/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantIdentity: identity }),
      });
    } catch (e) { console.error(e); }
  }, [roomName]);

  const handleSidebarPanelToggle = (panel: SidebarPanel) => {
    setSidebarCollapsed(prev => !prev && activeSidebarPanel === panel);
    setActiveSidebarPanel(panel);
  };

  const renderSidebarPanel = () => {
    if (sidebarCollapsed) return null;
    switch (activeSidebarPanel) {
      case 'participants': return <ParticipantsPanel alias="Participants" waitingRoomEnabled={waitingRoomEnabled} onWaitingRoomToggle={setWaitingRoomEnabled} waitingList={waitingList} onAdmitParticipant={admitParticipant} onRejectParticipant={rejectParticipant} admittedIds={admittedIds} hostIdentity={hostId || undefined} />;
      case 'chat': return <ChatPanel />;
      case 'settings': return <SettingsPanel voiceFocusEnabled={voiceFocusEnabled} onVoiceFocusChange={setVoiceFocusEnabled} vadEnabled={vadEnabled} onVadChange={setVadEnabled} noiseSuppressionEnabled={noiseSuppressionEnabled} onNoiseSuppressionChange={setNoiseSuppressionEnabled} echoCancellationEnabled={echoCancellationEnabled} onEchoCancellationChange={setEchoCancellationEnabled} autoGainEnabled={autoGainEnabled} onAutoGainChange={setAutoGainEnabled} />;
      case 'orbit': return (
        <OrbitTranslatorPanel 
          roomCode={roomName} userId={user?.id} isSourceSpeaker={roomState?.activeSpeaker?.userId === user?.id} currentSpeakerId={roomState?.activeSpeaker?.userId} currentSpeakerName={roomState?.activeSpeaker?.userId?.split('__')[0]} 
          onRequestFloor={async () => roomName && user?.id ? await tryAcquireSpeaker(roomName, user.id, false) : false}
          onReleaseFloor={async () => roomName && user?.id && await releaseSpeaker(roomName, user.id)}
          isListening={isListening} setIsListening={setIsListening}
          targetLanguage={targetLanguage} setTargetLanguage={setTargetLanguage}
          incomingTranslations={translator.incomingTranslations}
          isProcessing={translator.isProcessing}
          error={translator.error}
          // New props for sidebar settings
          hearRawAudio={hearRawAudio} setHearRawAudio={setHearRawAudio}
          orbitMicState={orbitMicState}
          sourceLanguage={sourceLanguage} setSourceLanguage={setSourceLanguage}
        />
      );
      default: return null;
    }
  };

  const handleTranscriptionToggle = React.useCallback(async () => {
    if (!roomName || !user?.id) return;
    if (!isTranscriptionEnabled) {
      const speakerId = roomState?.activeSpeaker?.userId;
      const isSpeakerInRoom = speakerId ? (Array.from(lkRoom.remoteParticipants.values()).some(p => p.identity === speakerId) || lkRoom.localParticipant.identity === speakerId) : false;
      const success = await tryAcquireSpeaker(roomName, user.id, !!(speakerId && !isSpeakerInRoom));
      if (success) setIsTranscriptionEnabled(true);
      else toast.error('Someone else is currently speaking' as any);
    } else {
      await releaseSpeaker(roomName, user.id);
      setIsTranscriptionEnabled(false);
    }
  }, [isTranscriptionEnabled, roomName, user?.id, roomState, lkRoom]);

  return (
    <div className={`lk-room-container ${roomStyles.roomLayout} ${sidebarCollapsed ? roomStyles.roomLayoutCollapsed : ''}`}>
      <LayoutContextProvider value={layoutContext}>
        <KeyboardShortcuts />
        <RoomAudioRenderer volume={1} />
        <ConnectionStateToast />

        <div ref={orbRef} className={`${roomStyles.orbDock} ${isOrbDragging ? roomStyles.orbDockDragging : ''}`} style={orbStyle} aria-label="Orbit audio orb">
          <VisualizerRing analyser={translator.analyser} />
          <div className={roomStyles.orbCore} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.8)', zIndex: 11, pointerEvents: 'none' }}>
            <TranslatorLogo />
          </div>
          <div className={roomStyles.orbVisualizer} aria-hidden="true">
            <div className={roomStyles.orbVizRow}>
              {orbBarIndices.map(i => <span key={`orb-in-${i}`} className={`${roomStyles.orbBar} ${roomStyles.orbBarIn}`} style={{ animationDelay: `${i * 0.12}s` }} />)}
            </div>
            <div className={roomStyles.orbVizRow}>
              {orbBarIndices.map(i => <span key={`orb-out-${i}`} className={`${roomStyles.orbBar} ${roomStyles.orbBarOut}`} style={{ animationDelay: `${i * 0.1}s` }} />)}
            </div>
          </div>
          <button type="button" className={roomStyles.orbSettingsBtn} data-orb-settings="true" onClick={() => handleSidebarPanelToggle('orbit')} aria-label="Open Orbit settings" title="Open Orbit settings">
            <OrbitIcon size={12} />
          </button>
        </div>


        <div className={roomStyles.videoGridContainer}><VideoGrid allowedParticipantIds={admittedIds} isGridView={isGridView} /></div>
        <div className={`${roomStyles.chatPanel} ${sidebarCollapsed ? roomStyles.chatPanelCollapsed : ''}`}>
          <button className={roomStyles.sidebarToggle} onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>{sidebarCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}</button>
          <div className={roomStyles.sidebarContent} style={{ overflowY: 'auto', overflowX: 'hidden' }}>{renderSidebarPanel()}</div>
        </div>
        <HostCaptionOverlay words={deepgram.words} isFinal={deepgram.isFinal} isListening={deepgram.isListening} analyser={deepgram.analyser} />
        <EburonControlBar onParticipantsToggle={() => handleSidebarPanelToggle('participants')} onChatToggle={() => handleSidebarPanelToggle('chat')} onSettingsToggle={() => handleSidebarPanelToggle('settings')} onOrbitToggle={() => handleSidebarPanelToggle('orbit')} onGridToggle={() => setIsGridView(!isGridView)} isGridView={isGridView} onTranscriptionToggle={handleTranscriptionToggle} isParticipantsOpen={!sidebarCollapsed && activeSidebarPanel === 'participants'} isChatOpen={!sidebarCollapsed && activeSidebarPanel === 'chat'} isSettingsOpen={!sidebarCollapsed && activeSidebarPanel === 'settings'} isOrbitOpen={!sidebarCollapsed && activeSidebarPanel === 'orbit'} isTranscriptionOpen={isTranscriptionEnabled} isAppMuted={isAppMuted} onAppMuteToggle={setIsAppMuted} roomState={roomState} userId={user?.id} audioCaptureOptions={audioCaptureOptions} onCaptionToggle={() => setIsTranscriptionEnabled(!isTranscriptionEnabled)} isCaptionOpen={isTranscriptionEnabled} onLanguageChange={setTargetLanguage} orbitMicState={orbitMicState} />
        <DebugMode /><RecordingIndicator />
      </LayoutContextProvider>
    </div>
  );
}
