'use client';

import React from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track, type ScreenShareCaptureOptions, type AudioCaptureOptions } from 'livekit-client';
import toast from 'react-hot-toast';
import styles from '../styles/Eburon.module.css';
import { OrbitIcon } from '@/lib/orbit/components/OrbitTranslatorVertical';

// Jitsi-style SVG Icons (simple, line-based)
const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const CaptionsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <path d="M7 15h2.5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H7" />
    <path d="M15 15h2.5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H15" />
  </svg>
);


import { OrbitMicVisualizer } from '@/lib/orbit/components/OrbitMicVisualizer';
import { OrbitFloatingText } from '@/lib/orbit/components/OrbitFloatingText';

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 8-6 4 6 4V8Z" />
    <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
  </svg>
);

const CameraOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
    <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
  </svg>
);

const ScreenShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <path d="m9 10 3-3 3 3" />
    <line x1="12" y1="7" x2="12" y2="14" />
  </svg>
);

const RaiseHandIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 11V6a1.5 1.5 0 0 1 3 0v5" />
    <path d="M9 11V4a1.5 1.5 0 0 1 3 0v7" />
    <path d="M12 11V5a1.5 1.5 0 0 1 3 0v6" />
    <path d="M15 11V7a1.5 1.5 0 0 1 3 0v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-2a2 2 0 0 1 2-2h2" />
  </svg>
);

const ToolsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);



const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="6" width="16" height="12" rx="4" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <line x1="12" y1="3" x2="12" y2="6" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <circle cx="8" cy="6" r="2" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <circle cx="14" cy="12" r="2" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="10" cy="18" r="2" />
  </svg>
);

const InviteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const LeaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ParticipantsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const GridViewIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);



const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

import { RoomState, LANGUAGES, Language } from '@/lib/orbit/types';

interface EburonControlBarProps {
  onChatToggle?: () => void;
  onParticipantsToggle?: () => void;
  onAgentToggle?: () => void;
  onSettingsToggle?: () => void;
  onSpeakToggle?: () => void;


  onTranscriptionToggle?: () => void;
  audioCaptureOptions?: AudioCaptureOptions;
  isChatOpen?: boolean;
  isParticipantsOpen?: boolean;
  isAgentOpen?: boolean;
  isSettingsOpen?: boolean;
  isSpeakOpen?: boolean;


  isTranscriptionOpen?: boolean;
  isGridView?: boolean;
  onGridToggle?: () => void;
  isAppMuted?: boolean;
  onAppMuteToggle?: (muted: boolean | ((prev: boolean) => boolean)) => void;
  roomState?: RoomState;
  userId?: string;
  onCaptionToggle?: () => void;
  isCaptionOpen?: boolean;
  onLanguageChange?: (language: string) => void;
  onTranslatorToggle?: () => void;
  isTranslatorOpen?: boolean;
  orbitMicState?: any; // Accepting the lifted state
}

export function EburonControlBar({
  onChatToggle,
  onParticipantsToggle,
  onAgentToggle,
  onSettingsToggle,
  onSpeakToggle,


  onTranscriptionToggle,
  audioCaptureOptions,
  isChatOpen,
  isParticipantsOpen,
  isAgentOpen,
  isSettingsOpen,
  isSpeakOpen,


  isTranscriptionOpen,
  isGridView,
  onGridToggle,
  isAppMuted = false,
  onAppMuteToggle,
  roomState,
  userId,
  onCaptionToggle,
  isCaptionOpen,
  onLanguageChange,
  onTranslatorToggle,
  isTranslatorOpen,
  orbitMicState,
}: EburonControlBarProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  
  const [isMicEnabled, setIsMicEnabled] = React.useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = React.useState(true);
  const [isScreenSharing, setIsScreenSharing] = React.useState(false);
  const [isScreenShareMenuOpen, setIsScreenShareMenuOpen] = React.useState(false);
  const [shareAudioEnabled, setShareAudioEnabled] = React.useState(false);
  const [isHandRaised, setIsHandRaised] = React.useState(false);
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = React.useState<string>('');
  const [isMicMenuOpen, setIsMicMenuOpen] = React.useState(false);
  
  const micMenuRef = React.useRef<HTMLDivElement | null>(null);
  const screenShareMenuRef = React.useRef<HTMLDivElement | null>(null);

  // Orbit Mic State (Passed down or fallback)
  const { isRecording: isOrbitMicRecording, transcript: orbitTranscript, isFinal: isOrbitFinal, toggle: toggleOrbitMic, analyser: orbitAnalyser } = orbitMicState || { 
     isRecording: false, transcript: '', isFinal: false, toggle: () => {}, analyser: null 
  };

  // Audio Visualizer State
  const [audioLevel, setAudioLevel] = React.useState(0);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);

  // Sync state with actual track status
  React.useEffect(() => {
    if (localParticipant) {
      const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
      const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
      const screenPub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
      
      setIsMicEnabled(!micPub?.isMuted && micPub?.track !== undefined);
      setIsCameraEnabled(!camPub?.isMuted && camPub?.track !== undefined);
      setIsScreenSharing(screenPub?.track !== undefined);
    }
  }, [localParticipant]);

  React.useEffect(() => {
    if (isScreenSharing) {
      setIsScreenShareMenuOpen(false);
    }
  }, [isScreenSharing]);

  React.useEffect(() => {
    if (!localParticipant) {
      return;
    }
    const syncRaisedHand = () => {
      setIsHandRaised(localParticipant.attributes?.handRaised === 'true');
    };
    syncRaisedHand();
    localParticipant.on('attributesChanged', syncRaisedHand);
    return () => {
      localParticipant.off('attributesChanged', syncRaisedHand);
    };
  }, [localParticipant]);

  // Enumerate audio input devices
  React.useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(audioInputs);
        // Set default device if not already set
        if (!selectedAudioDevice && audioInputs.length > 0) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }

      } catch (error) {
        console.error('Failed to enumerate audio devices:', error);
      }
    };
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, [selectedAudioDevice]);

  // Audio Level Monitoring
  React.useEffect(() => {
    if (!isMicEnabled || !localParticipant) {
      setAudioLevel(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
    if (!micTrack || !(micTrack.mediaStreamTrack instanceof MediaStreamTrack)) {
      return;
    }

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(
        new MediaStream([micTrack.mediaStreamTrack])
      );
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(100, (average / 255) * 200));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        source.disconnect();
        analyser.disconnect();
        audioContext.close();
      };
    } catch (error) {
      console.error('Failed to setup audio visualizer:', error);
    }
  }, [isMicEnabled, localParticipant]);

  const ensureMicPermissionForLabels = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));

    } catch (e) {
      // Permission denied is fine; keep unlabeled devices.
      console.warn('Mic permission not granted for device labels.');
    }
  }, []);

  // Close mic menu on outside click
  React.useEffect(() => {
    if (!isMicMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (micMenuRef.current && !micMenuRef.current.contains(event.target as Node)) {
        setIsMicMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMicMenuOpen]);



  const switchAudioDevice = async (deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    setIsMicMenuOpen(false);
    if (localParticipant) {
      try {
        await localParticipant.setMicrophoneEnabled(false);
        await room.switchActiveDevice('audioinput', deviceId);
        const captureOptions = {
          ...(audioCaptureOptions ?? {}),
          deviceId,
        };
        await localParticipant.setMicrophoneEnabled(true, captureOptions);
        const device = audioDevices.find(d => d.deviceId === deviceId);
        toast.success(`Switched to ${device?.label || 'new microphone'}`);
      } catch (error) {
        console.error('Failed to switch audio device:', error);
        toast.error('Failed to switch microphone');
      }
    }
  };

  const applyAppMute = React.useCallback(
    (elements: HTMLMediaElement[]) => {
      elements.forEach((element) => {
        if (isAppMuted) {
          if (element.dataset.appMuted !== 'true') {
            element.dataset.appMutedPrev = element.muted ? '1' : '0';
            element.dataset.appMuted = 'true';
          }
          element.muted = true;
          return;
        }
        if (element.dataset.appMuted === 'true') {
          const wasMuted = element.dataset.appMutedPrev === '1';
          element.muted = wasMuted;
          delete element.dataset.appMuted;
          delete element.dataset.appMutedPrev;
        }
      });
    },
    [isAppMuted]
  );

  React.useEffect(() => {
    const mediaElements = Array.from(document.querySelectorAll('audio, video')) as HTMLMediaElement[];
    applyAppMute(mediaElements);

    if (!isAppMuted) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      const newlyAdded: HTMLMediaElement[] = [];
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          if (node instanceof HTMLMediaElement) {
            newlyAdded.push(node);
          }
          node.querySelectorAll?.('audio, video').forEach((child) => {
            if (child instanceof HTMLMediaElement) {
              newlyAdded.push(child);
            }
          });
        });
      });
      if (newlyAdded.length > 0) {
        applyAppMute(newlyAdded);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyAppMute, isAppMuted]);

  React.useEffect(() => {
    if (!isScreenShareMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!screenShareMenuRef.current) {
        return;
      }
      if (!screenShareMenuRef.current.contains(event.target as Node)) {
        setIsScreenShareMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isScreenShareMenuOpen]);

  const toggleMicrophone = async () => {
    if (localParticipant) {
      const enabled = !isMicEnabled;
      const captureOptions = enabled
        ? {
            ...(audioCaptureOptions ?? {}),
            deviceId: room.getActiveDevice('audioinput') ?? audioCaptureOptions?.deviceId,
          }
        : undefined;
      try {
        await localParticipant.setMicrophoneEnabled(enabled, captureOptions);
        setIsMicEnabled(enabled);
      } catch (error: any) {
        console.error('Failed to toggle microphone:', error);
        if (error.name === 'NotAllowedError' || error.message?.includes('Permission denied')) {
          toast.error('Microphone permission denied. Please enable it in your browser settings.');
        } else {
          toast.error('Failed to toggle microphone');
        }
        // Revert state if needed, though here we only set it on success.
        // If we optimistically updated, we would revert here.
      }
    }
  };

  const toggleCamera = async () => {
    if (localParticipant) {
      const enabled = !isCameraEnabled;
      await localParticipant.setCameraEnabled(enabled);
      setIsCameraEnabled(enabled);
    }
  };

  const stopScreenShare = async () => {
    if (!localParticipant) {
      return;
    }
    await localParticipant.setScreenShareEnabled(false);
    setIsScreenSharing(false);
  };

  const startScreenShare = async (displaySurface: 'browser' | 'monitor') => {
    if (!localParticipant) {
      return;
    }
    try {
      const options: ScreenShareCaptureOptions = {
        audio: shareAudioEnabled,
        video: { displaySurface },
        ...(displaySurface === 'browser' ? { preferCurrentTab: true } : {}),
        ...(shareAudioEnabled ? { systemAudio: 'include' } : {}),
      };
      const publication = await localParticipant.setScreenShareEnabled(true, options);
      setIsScreenSharing(Boolean(publication?.track));
      setIsScreenShareMenuOpen(false);
    } catch (error) {
      console.error('Failed to start screen share:', error);
      setIsScreenSharing(false);
    }
  };

  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Invite link copied!', {
        style: {
          background: '#22c55e',
          color: '#fff',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#22c55e',
        },
      });
    });
  };

  const handleLeave = () => {
    if (typeof window !== 'undefined' && room.name) {
      sessionStorage.removeItem(`lk_autojoin_${room.name}`);
    }
    room.disconnect();
  };

  const toggleRaiseHand = async () => {
    if (!localParticipant) {
      return;
    }
    const nextValue = !isHandRaised;
    setIsHandRaised(nextValue);
    // Some deployments restrict metadata/attribute updates; ignore errors to avoid noisy logs.
    try {
      const nextAttributes = {
        ...(localParticipant.attributes ?? {}),
        handRaised: nextValue ? 'true' : 'false',
      };
      // Best-effort; may throw if token is not allowed to update attributes.
      await localParticipant.setAttributes(nextAttributes);
    } catch (error) {
      console.warn('Raise hand not permitted; keeping local state only.', error);
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const isSidebarOpen = Boolean(
    isChatOpen || 
    isParticipantsOpen || 
    isAgentOpen || 
    isSettingsOpen
  );

  return (
    <>
      <div 
        className={`${styles.controlBar} ${isSidebarOpen ? styles.controlBarShifted : ''} notranslate`}
        translate="no"
      >
        <OrbitFloatingText transcript={orbitTranscript} isFinal={isOrbitFinal} isVisible={isOrbitMicRecording || !!orbitTranscript} />
        {/* Left Group: AV Controls */}
        <div className={styles.controlGroup}>




          <div className={styles.audioSplitControl}>
            {/* Speak (Mic) Section */}
            <div className={`${styles.audioSplitSection} ${styles.audioSplitLeft}`} ref={micMenuRef}>
              <div 
                className={`${styles.audioSplitMain} ${isSpeakOpen ? styles.iconActive : ''}`} 
                onClick={() => {
                   toggleMicrophone();
                   toggleOrbitMic();
                   onSpeakToggle?.();
                }}
                title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                style={{ position: 'relative' }} // ensure relative for visualizer
              >
                <span className={styles.audioSplitLabel}>Speak</span>
                <div className={`${styles.audioSplitIcon} ${isMicEnabled ? styles.iconActive : styles.iconMuted}`}>
                  {isMicEnabled ? <MicIcon /> : <MicOffIcon />}
                </div>
                {/* Custom Orbit Visualizer Overlay */}
                <OrbitMicVisualizer analyser={orbitAnalyser} isRecording={isOrbitMicRecording} />
                {/* Audio Visualizer */}
                {isMicEnabled && (
                  <div style={{
                    display: 'flex',
                    gap: '2px',
                    alignItems: 'center',
                    height: '16px',
                    marginLeft: '8px'
                  }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: '3px',
                          height: `${Math.max(20, audioLevel * (0.6 + i * 0.15))}%`,
                          backgroundColor: '#2e7d32',
                          borderRadius: '2px',
                          transition: 'height 0.1s ease-out'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <button
                className={styles.audioSplitDropdown}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!isMicMenuOpen) await ensureMicPermissionForLabels();
                  setIsMicMenuOpen((prev) => !prev);

                }}
                title="Select microphone"
                aria-expanded={isMicMenuOpen}
                aria-haspopup="listbox"
              >
                <ChevronDownIcon />
              </button>
              {isMicMenuOpen && audioDevices.length > 0 && (
                <div className={styles.deviceMenu} role="listbox" aria-label="Select Microphone">
                  {audioDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      className={`${styles.deviceOption} ${selectedAudioDevice === device.deviceId ? styles.deviceOptionActive : ''}`}
                      onClick={() => switchAudioDevice(device.deviceId)}
                      role="option"
                      aria-selected={selectedAudioDevice === device.deviceId}
                    >
                      {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Listen Button (Translator) */}
            <div className={styles.audioSplitSection} style={{ marginLeft: '8px' }}>
              <div 
                className={`${styles.audioSplitMain} ${isTranslatorOpen ? styles.iconActive : ''}`} 
                onClick={onTranslatorToggle}
                title="Open Translator"
              >
                  <span className={styles.audioSplitLabel}>Listen</span>
                  <div className={styles.audioSplitIcon}>
                    {/* Headphone icon */}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                    </svg>
                  </div>
              </div>
            </div>




          </div>
        </div>

        {/* Center Group: Navigation/Feature Controls */}
        <div className={styles.controlGroupCenter}>
          <button
            className={`${styles.controlButton} ${isCameraEnabled ? styles.controlButtonActive : styles.controlButtonMuted}`}
            onClick={toggleCamera}
            title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCameraEnabled ? <CameraIcon /> : <CameraOffIcon />}
          </button>

          <div className={styles.screenShareWrapper} ref={screenShareMenuRef}>
            <button
              className={`${styles.controlButton} ${isScreenSharing ? styles.controlButtonActive : ''}`}
              onClick={() => {
                if (isScreenSharing) {
                  stopScreenShare();
                  return;
                }
                setIsScreenShareMenuOpen((prev) => !prev);
              }}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              aria-expanded={isScreenShareMenuOpen ? 'true' : 'false'}
              aria-haspopup="dialog"
            >
              <ScreenShareIcon />
            </button>
            {isScreenShareMenuOpen && !isScreenSharing && (
              <div className={styles.screenShareMenu} role="dialog" aria-label="Screen Share Options">
                <button
                  className={styles.screenShareOption}
                  type="button"
                  onClick={() => startScreenShare('browser')}
                >
                  Share tab
                </button>
                <button
                  className={styles.screenShareOption}
                  type="button"
                  onClick={() => startScreenShare('monitor')}
                >
                  Share screen
                </button>
                <label className={styles.screenShareToggle}>
                  <span className={styles.screenShareToggleLabel}>Share audio</span>
                  <span className={styles.screenShareToggleControl}>
                    <input
                      className={styles.screenShareToggleInput}
                      type="checkbox"
                      checked={shareAudioEnabled}
                      onChange={(event) => setShareAudioEnabled(event.target.checked)}
                      aria-label="Share screen audio"
                    />
                    <span className={styles.screenShareToggleTrack}>
                      <span className={styles.screenShareToggleThumb} />
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
          
          {onParticipantsToggle && (
            <button
              className={`${styles.controlButton} ${isParticipantsOpen ? styles.controlButtonActive : ''}`}
              onClick={onParticipantsToggle}
              title="Participants"
            >
              <ParticipantsIcon />
            </button>
          )}

          <button
            className={`${styles.controlButton} ${isHandRaised ? styles.raiseHandActive : ''}`}
            onClick={toggleRaiseHand}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
            aria-pressed={isHandRaised}
          >
            <RaiseHandIcon />
          </button>

          {/* Grid View Toggle */}
          {onCaptionToggle && (
            <button
              className={`${styles.controlButton} ${isCaptionOpen ? styles.controlButtonActive : ''}`}
              onClick={onCaptionToggle}
              title={isCaptionOpen ? "Hide Captions" : "Show Captions"}
            >
              <CaptionsIcon />
            </button>
          )}

          {onGridToggle && (
            <button
              className={`${styles.controlButton} ${isGridView ? styles.controlButtonActive : ''}`}
              onClick={onGridToggle}
              title={isGridView ? "Focused View" : "Grid View"}
            >
              <GridViewIcon />
            </button>
          )}

          {onChatToggle && (
            <button
              className={`${styles.controlButton} ${isChatOpen ? styles.chatActive : ''}`}
              onClick={onChatToggle}
              title="Toggle chat"
            >
              <ChatIcon />
            </button>
          )}


          {onAgentToggle && (
            <button
              className={`${styles.controlButton} ${isAgentOpen ? styles.controlButtonActive : ''}`}
              onClick={onAgentToggle}
              title="Translator"
            >
              <OrbitIcon size={20} />
            </button>
          )}

          {onSettingsToggle && (
            <button
              className={`${styles.controlButton} ${isSettingsOpen ? styles.controlButtonActive : ''}`}
              onClick={onSettingsToggle}
              title="Settings"
            >
              <SettingsIcon />
            </button>
          )}
        </div>

        {/* Right Group: Action Controls */}
        <div className={`${styles.controlGroup} ${styles.controlGroupEnd}`}>
          <button
            className={`${styles.controlButton} ${styles.inviteButton}`}
            onClick={copyInviteLink}
            title="Copy invite link"
          >
            <InviteIcon />
          </button>

          <button
            className={styles.leaveButton}
            onClick={handleLeave}
            title="Leave meeting"
          >
            <LeaveIcon />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Mobile Navbar */}
      <nav className={styles.mobileNavbar}>


        <button 
          className={`${styles.mobileNavbarItem} ${isMicEnabled ? styles.mobileNavbarItemActive : ''}`}
          onClick={toggleMicrophone}
        >
          {isMicEnabled ? <MicIcon /> : <MicOffIcon />}
          <span>Mic</span>
        </button>
        <button 
          className={`${styles.mobileNavbarItem} ${isCameraEnabled ? styles.mobileNavbarItemActive : ''}`}
          onClick={toggleCamera}
        >
          {isCameraEnabled ? <CameraIcon /> : <CameraOffIcon />}
          <span>Video</span>
        </button>
        <button 
          className={`${styles.mobileNavbarItem} ${isChatOpen ? styles.mobileNavbarItemActive : ''}`}
          onClick={() => {
            onChatToggle?.();
            setIsMobileMenuOpen(false);
          }}
        >
          <ChatIcon />
          <span>Chat</span>
        </button>
        <button 
          className={`${styles.mobileNavbarItem} ${isParticipantsOpen ? styles.mobileNavbarItemActive : ''}`}
          onClick={() => {
            onParticipantsToggle?.();
            setIsMobileMenuOpen(false);
          }}
        >
          <ParticipantsIcon />
          <span>People</span>
        </button>
        <button 
          className={`${styles.mobileNavbarItem} ${isMobileMenuOpen ? styles.mobileNavbarItemActive : ''}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <MenuIcon />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile Menu Drawer */}
      <div className={`${isMobileMenuOpen ? styles.mobileMenuVisible : ''}`}>
        <div className={styles.mobileMenuOverlay} onClick={() => setIsMobileMenuOpen(false)} />
        <div className={styles.mobileMenuDrawer}>
          <div className={styles.mobileMenuHeader}>
            <h3>More Options</h3>
            <button className={styles.mobileMenuClose} onClick={() => setIsMobileMenuOpen(false)} title="Close menu">
              <CloseIcon />
            </button>
          </div>
          <div className={styles.mobileGrid}>
            <button 
              className={`${styles.mobileGridItem} ${isScreenSharing ? styles.mobileGridItemActive : ''}`}
              onClick={() => {
                if (isScreenSharing) stopScreenShare();
                else startScreenShare('monitor');
                setIsMobileMenuOpen(false);
              }}
            >
              <div className={styles.mobileGridIcon}><ScreenShareIcon /></div>
              <span className={styles.mobileGridLabel}>{isScreenSharing ? 'Stop Share' : 'Share'}</span>
            </button>

            {onAgentToggle && (
              <button 
                className={`${styles.mobileGridItem} ${isAgentOpen ? styles.mobileGridItemActive : ''}`}
                onClick={() => {
                  onAgentToggle();
                  setIsMobileMenuOpen(false);
                }}
              >
                <div className={styles.mobileGridIcon}><OrbitIcon size={24} /></div>
                <span className={styles.mobileGridLabel}>Translator</span>
              </button>
            )}

            <button 
              className={`${styles.mobileGridItem} ${isHandRaised ? styles.mobileGridItemActive : ''}`}
              onClick={() => {
                toggleRaiseHand();
                setIsMobileMenuOpen(false);
              }}
            >
              <div className={styles.mobileGridIcon}><RaiseHandIcon /></div>
              <span className={styles.mobileGridLabel}>Raise Hand</span>
            </button>



            {onSettingsToggle && (
              <button 
                className={`${styles.mobileGridItem} ${isSettingsOpen ? styles.mobileGridItemActive : ''}`}
                onClick={() => {
                  onSettingsToggle();
                  setIsMobileMenuOpen(false);
                }}
              >
                <div className={styles.mobileGridIcon}><SettingsIcon /></div>
                <span className={styles.mobileGridLabel}>Settings</span>
              </button>
            )}

            {onCaptionToggle && (
              <button 
                className={`${styles.mobileGridItem} ${isCaptionOpen ? styles.mobileGridItemActive : ''}`}
                onClick={() => {
                  onCaptionToggle();
                  setIsMobileMenuOpen(false);
                }}
              >
                <div className={styles.mobileGridIcon}><CaptionsIcon /></div>
                <span className={styles.mobileGridLabel}>{isCaptionOpen ? 'Hide CC' : 'Captions'}</span>
              </button>
            )}

            <button 
              className={styles.mobileGridItem}
              onClick={() => {
                copyInviteLink();
                setIsMobileMenuOpen(false);
              }}
            >
              <div className={styles.mobileGridIcon}><InviteIcon /></div>
              <span className={styles.mobileGridLabel}>Invite</span>
            </button>

            <button 
              className={`${styles.mobileGridItem} ${styles.leaveGridItem}`}
              onClick={handleLeave}
            >
              <div className={styles.mobileGridIcon}><LeaveIcon /></div>
              <span className={styles.mobileGridLabel}>Leave</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
