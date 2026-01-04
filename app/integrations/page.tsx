import React from 'react';
import styles from '@/styles/Integrations.module.css';

const tools = [
  {
    title: 'Contextual Gemini Narration',
    description: 'Push translated text to Gemini Live Audio for human-like cadence with minimal delay.',
    icon: '🎤',
  },
  {
    title: 'Cartesia Sonic-3 Voice',
    description: 'High-fidelity WAV/PCM output with emotion and speed control for narrating every clip.',
    icon: '🎧',
  },
  {
    title: 'Ollama Conversational Polish',
    description: 'Apply Gemini 3 Flash prompts that tailor tone before hitting the TTS queue.',
    icon: '🤖',
  },
  {
    title: 'Supabase Transcript Gallery',
    description: 'Delta-tracked captions for clip replay, auto-save, and developer hooks.',
    icon: '📚',
  },
  {
    title: 'LiveKit Control Plane',
    description: 'Single broadcaster enforcement with remote muting and session persistence.',
    icon: '🛰️',
  },
  {
    title: 'Meeting Secretary',
    description: 'Summarize takeaways via Ollama with agenda tracking and action-item extraction.',
    icon: '✍️',
  },
  {
    title: 'Insights Summoner',
    description: 'Feed transcripts to lightweight HuggingFace LLMs (e.g., `distilbart-cnn-12-6`) for instant themes.',
    icon: '📊',
  },
  {
    title: 'SlideCraft Studio',
    description: 'Use HuggingFace Stable Diffusion XL backend to generate full PPT-style visuals from prompts.',
    icon: '🖼️',
  },
  {
    title: 'Tone Coach',
    description: 'Rotate between Ollama tone models to emphasize warmth, urgency, or calmness in speech.',
    icon: '🧭',
  },
  {
    title: 'AI Scout',
    description: 'Detect silence, queue rewinds, and push notifications via webhook toolchains.',
    icon: '🛰️',
  },
  {
    title: 'Clipboard Curator',
    description: 'Save clips to local storage or Supabase, tag them, and sync to marketing CRMs.',
    icon: '📎',
  },
];

export default function IntegrationsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroIcon}>⚡</span>
            Supercharge your meetings
          </div>
          <h1>Integration suite</h1>
          <p>
            Every AI tool in one place. Pick audio synths, translation engines, and automations that keep your
            experience superior to the rest.
          </p>
        </div>
        <div className={styles.heroAction}>
          <button className={styles.primaryButton}>Connect Cartesia & Gemini</button>
        </div>
      </section>

      <section className={styles.grid}>
        {tools.map((tool) => (
          <article key={tool.title} className={styles.toolCard}>
            <div className={styles.toolIcon}>{tool.icon}</div>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <button className={styles.linkButton}>Learn more</button>
          </article>
        ))}
      </section>
    </main>
  );
}
