'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { supabase } from '@/lib/orbit/services/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { ConnectionDetails } from '@/lib/types';
import { EburonControlBar } from '@/lib/EburonControlBar';


import { ChatPanel } from '@/lib/ChatPanel';
import { ParticipantsPanel } from '@/lib/ParticipantsPanel';
import { AgentPanel } from '@/lib/AgentPanel';
import { LiveCaptions } from '@/lib/LiveCaptions';
import roomStyles from '@/styles/Eburon.module.css';
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
  usePersistentUserChoices,
  isTrackReference,
  RoomAudioRenderer,
  ConnectionStateToast,
} from '@livekit/components-react';
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
import { useRouter, useParams } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';

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

type SidebarPanel = 'participants' | 'agent' | 'chat' | 'settings';

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
      setPreJoinChoices(values);
    },
    [
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
    if (!preJoinChoices) {
      return;
    }
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
        if (isMounted) {
          setConnectionDetails(data);
        }
      } catch (error) {
        console.error('Connection details error', error);
        if (isMounted) {
          setConnectionDetails(undefined);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    loadConnectionDetails();
    return () => {
      isMounted = false;
    };
  }, [preJoinChoices, props.roomName, props.region]);

  if (isLoading) {
    return <div className={roomStyles.videoPlaceholder}>Loading...</div>;
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
  const [voiceFocusEnabled, setVoiceFocusEnabled] = React.useState(true);
  const [vadEnabled, setVadEnabled] = React.useState(true);
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = React.useState(true);
  const [echoCancellationEnabled, setEchoCancellationEnabled] = React.useState(true);
  const [autoGainEnabled, setAutoGainEnabled] = React.useState(true);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = React.useState(false);
  const [waitingList, setWaitingList] = React.useState<{ identity: string; name: string }[]>([]);
  const [admittedIds, setAdmittedIds] = React.useState<Set<string>>(new Set());
  const { user } = useAuth();
  const [isAppMuted, setIsAppMuted] = React.useState(false);

  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = React.useState(false);


  const layoutContext = useCreateLayoutContext();

  // Sync roomName to session storage for OrbitApp integration
  React.useEffect(() => {
    if (roomName) {
      sessionStorage.setItem('eburon_meeting_id', roomName);
    }
  }, [roomName]);

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

  const admitParticipant = React.useCallback((identity: string) => {
    setWaitingList((prev) => prev.filter((p) => p.identity !== identity));
    setAdmittedIds((prev) => {
      const next = new Set(prev);
      next.add(identity);
      return next;
    });
  }, []);

  const isAgentSpeakingRef = React.useRef(false);

  const updateVolumes = React.useCallback(() => {
     const vol = isAgentSpeakingRef.current ? 0.15 : 1.0;
     Array.from(room.remoteParticipants.values()).forEach(p => {
        Array.from(p.trackPublications.values()).forEach(pub => {
           if (pub.kind === Track.Kind.Audio && pub.track) {
              pub.track.attachedElements.forEach(el => {
                 el.volume = vol;
              });
           }
        });
     });
  }, [room]);

  const handleAgentSpeakingChange = React.useCallback((speaking: boolean) => {
     isAgentSpeakingRef.current = speaking;
     updateVolumes();
  }, [updateVolumes]);

  const handleSidebarPanelToggle = (panel: SidebarPanel) => {
    setSidebarCollapsed((prevCollapsed) => {
      if (!prevCollapsed && activeSidebarPanel === panel) {
        return true;
      }
      return false;
    });
    setActiveSidebarPanel(panel);
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
        return (
          <AgentPanel 
            meetingId={roomName} 
            onSpeakingStateChange={handleAgentSpeakingChange}
            isTranscriptionEnabled={isTranscriptionEnabled}
            onToggleTranscription={() => setIsTranscriptionEnabled(prev => !prev)}
          />
        );
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
      default:
        return null;
    }
  };

  const handleTranscriptSegment = React.useCallback(async (segment: any) => {
    if (!roomName) return;
    
    try {
        const { data: current } = await supabase
            .from('transcript_segments')
            .select('full_transcription')
            .eq('meeting_id', roomName)
            .single();
            
        const previousFull = current?.full_transcription || '';
        const newFull = previousFull + (previousFull ? ' ' : '') + segment.text;
        const segmentId = crypto.randomUUID();
        
        await supabase.from('transcript_segments').upsert({
            meeting_id: roomName,
            speaker_id: user?.id || room.localParticipant.identity,
            source_text: segment.text,
            source_lang: segment.language || 'auto',
            last_segment_id: segmentId,
            full_transcription: newFull,
        }, { onConflict: 'meeting_id' });
        
    } catch (err) {
        console.error('Failed to save transcript', err);
    }
  }, [roomName, room.localParticipant.identity]);

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
          


          {isTranscriptionEnabled && (
            <LiveCaptions 
              room={room}
              enabled={isTranscriptionEnabled}
              vadEnabled={vadEnabled}
              broadcastEnabled={true}
              language="auto"
              audioSource="auto"
              onTranscriptSegment={handleTranscriptSegment}
            />
          )}

          {/* Custom control bar */}
          <EburonControlBar 
            onParticipantsToggle={() => handleSidebarPanelToggle('participants')}
            onAgentToggle={() => handleSidebarPanelToggle('agent')}
            onChatToggle={() => handleSidebarPanelToggle('chat')}
            onSettingsToggle={() => handleSidebarPanelToggle('settings')}


            onTranscriptionToggle={() => setIsTranscriptionEnabled((prev) => !prev)}
            isParticipantsOpen={!sidebarCollapsed && activeSidebarPanel === 'participants'}
            isAgentOpen={!sidebarCollapsed && activeSidebarPanel === 'agent'}
            isChatOpen={!sidebarCollapsed && activeSidebarPanel === 'chat'}
            isSettingsOpen={!sidebarCollapsed && activeSidebarPanel === 'settings'}


            isTranscriptionOpen={isTranscriptionEnabled}
            isAppMuted={isAppMuted}
            onAppMuteToggle={setIsAppMuted}
            audioCaptureOptions={audioCaptureOptions}
          />
          
          <DebugMode />
          <RecordingIndicator />
        </LayoutContextProvider>
      </RoomContext.Provider>
    </div>
  );
}
