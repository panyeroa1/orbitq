'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/orbit/services/supabaseClient';
import styles from '../styles/Portal.module.css';

export default function Page() {
  const router = useRouter();
  const [midInput, setMidInput] = useState('');
  const [showJoinArea, setShowJoinArea] = useState(false);
  const [authStatus, setAuthStatus] = useState('● Connecting to Satellite...');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        if (data?.user) {
          setUserId(data.user.id.slice(0, 8));
          setAuthStatus('ONLINE');
        }
      } catch (e) {
        console.error('Auth boot error:', e);
        setAuthStatus('OFFLINE');
      }
    }
    boot();
  }, []);

  const createClass = () => {
    const mid = 'MEET-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    router.push(`/rooms/${mid}`);
  };

  const joinSession = () => {
    const mid = midInput.trim();
    if (mid) {
      router.push(`/rooms/${mid}`);
    }
  };

  return (
    <div className={styles.body}>
      {/* Settings Icon */}
      <Link href="/settings" className={styles.settingsBtn} title="API Configuration">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </Link>

      <div className={styles.container}>
        <h1 className={styles.title}>
          ORBIT <span>CONFERENCE</span>
        </h1>

        <div className={styles.bento}>
          <div className={`${styles.tile} ${styles.tileLarge}`} onClick={createClass}>
            <div className={styles.tileIconLarge}>🎙️</div>
            <h3>Start Instant Class</h3>
            <p className={styles.tileSubtitle}>Create Room & Take Floor</p>
          </div>
          <div className={styles.tile} onClick={() => setShowJoinArea(true)}>
            <div className={styles.tileIcon}>🔗</div>
            <h3>Join</h3>
          </div>
          <div className={styles.tile} onClick={() => alert('Coming soon!')}>
            <div className={styles.tileIcon}>📅</div>
            <h3>Schedule</h3>
          </div>
        </div>

        {showJoinArea && (
          <div className={styles.joinArea}>
            <input
              type="text"
              className={styles.input}
              placeholder="MEET-XXXXXX"
              value={midInput}
              onChange={(e) => setMidInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && joinSession()}
            />
            <button className={styles.btn} onClick={joinSession}>
              Connect to Orbit
            </button>
          </div>
        )}

        <div className={styles.authStatus}>
          {authStatus === 'ONLINE' ? (
            <>
              <span className={styles.onlineStatus}>● ONLINE</span> ID: {userId}
            </>
          ) : authStatus === 'OFFLINE' ? (
            <span className={styles.offlineStatus}>● OFFLINE</span>
          ) : (
            authStatus
          )}
        </div>
      </div>
    </div>
  );
}
