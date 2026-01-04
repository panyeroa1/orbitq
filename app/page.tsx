'use client';

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

function ControlCard({ onJoin }: { onJoin: () => void }) {
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));

  const handleJoin = () => {
    const roomId = generateRoomId();
    const href = e2ee ? `/rooms/${roomId}#${encodePassphrase(sharedPassphrase)}` : `/rooms/${roomId}`;
    window.location.assign(href);
    onJoin();
  };

  return (
    <div className={styles.controlCard}>
      <h3>Launch instant premium room</h3>
      <p>Auto-configured HD connection that rivals the competition.</p>
      <button className={styles.primaryButton} onClick={handleJoin}>
        Start premium meeting
      </button>
      <div className={styles.cardSettings}>
        <label className={styles.switchLabel}>
          <input
            type="checkbox"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          />
          <span>Enable E2E encryption</span>
        </label>
        {e2ee && (
          <input
            className={styles.passphraseInput}
            type="password"
            value={sharedPassphrase}
            onChange={(ev) => setSharedPassphrase(ev.target.value)}
            placeholder="Enter passphrase..."
          />
        )}
      </div>
    </div>
  );
}

function ConnectionCard() {
  return (
    <div className={styles.highlightCard}>
      <h3>Integration toolkit</h3>
      <p>Auto-token flows for Cartesia, Gemini, Ollama, and LiveKit automation.</p>
      <button className={styles.secondaryButton} onClick={() => window.location.assign('/integrations')}>
        Explore integration suite
      </button>
    </div>
  );
}

export default function Page() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [recordUrl, setRecordUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        localStorage.setItem('lastMeetingClip', url);
        setRecordUrl(url);
        recordedChunks.current = [];
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error', error);
    }
  };

  const handleJoin = () => router.push('/rooms');

  return (
    <main className={styles.main}>
      <section className={styles.heroLayer}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.badgeDot} />
            Enterprise-grade experience
          </div>
          <a href="/integrations" className={styles.integrationIcon} aria-label="View integrations">
            🔗
          </a>
          <button
            className={styles.themeToggle}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
          <Image
            className={styles.logo}
            src="/images/success-class-logo.svg"
            alt="Eburon Meet"
            width={220}
            height={36}
            priority
          />
          <h1 className={styles.headline}>
            Premium meetings with <span className={styles.headlineAccent}>AI-native translation</span>
          </h1>
          <p className={styles.subheadline}>
            Crystal-clear video, live multilingual captions, and AI voice narration that mirrors every speaker with human nuance.
          </p>
          <div className={styles.heroStats}>
            <div>
              <strong>4K</strong>
              <span>Ultra HD streaming</span>
            </div>
            <div>
              <strong>Live</strong>
              <span>Translation + TTS</span>
            </div>
            <div>
              <strong>Secure</strong>
              <span>Per-room access controls</span>
            </div>
            <div>
              <button className={`${styles.secondaryButton} ${styles.recordBtn}`} onClick={toggleRecording}>
                {isRecording ? 'Stop recording' : 'Record meeting clip'}
              </button>
            </div>
            {recordUrl && (
              <div className={styles.recordPreview}>
                <strong>Last clip ready</strong>
                <video src={recordUrl} controls className={styles.recordedVideo} />
              </div>
            )}
          </div>
        </div>
        <div className={styles.heroCardWrap}>
          <ControlCard onJoin={handleJoin} />
          <ConnectionCard />
        </div>
      </section>

      <section className={styles.featuresGrid}>
        {[
          { title: 'Adaptive AI captions', body: 'Realtime Supabase archive + translation memory.' },
          { title: 'Translation dashboard', body: 'Ticker-style log, engine switching, TTS playback controls.' },
          { title: 'Broadcast controls', body: 'Single broadcaster, remote muting, continuous saves.' },
          { title: 'AI workflows', body: 'Automations that summarize, transcribe, or nudge responders.' },
        ].map((feature) => (
          <article key={feature.title} className={styles.featureTile}>
            <div className={styles.featureIcon}>{feature.title.charAt(0)}</div>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className={styles.integrationBanner}>
        <div>
          <h2>Integrations for every workflow</h2>
          <p>
            Push clips to Gemini, run Cartesia Sonic-3, or sync LiveKit analytics from a single panel.
            More AI tools keep your workspace superior to the rest.
          </p>
        </div>
        <button className={styles.primaryButton} onClick={() => window.location.assign('/integrations')}>
          View integration tools
        </button>
      </section>
    </main>
  );
}
