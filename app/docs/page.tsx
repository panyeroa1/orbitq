import Link from 'next/link';
import styles from '@/styles/DeveloperDocs.module.css';

export const metadata = {
  title: 'Developer API Documentation | Success Class',
  description: 'Developer API reference for Success Class rooms, recordings, and integrations.',
};

export default function DeveloperDocsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.glow} />
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.badge}>Developer API</span>
          <Link className={styles.backLink} href="/">
            Back to lobby
          </Link>
        </div>
        <h1>Success Class Developer Documentation</h1>
        <p className={styles.docsSubheader}>
          Endpoints, auth, and integration patterns for building on top of Success Class.
          Use these APIs to create rooms, manage participants, and automate
          workflows with your own services.
        </p>
        <div className={styles.heroActions}>
          <a className={styles.primaryButton} href="#quickstart">
            Quickstart
          </a>
          <a className={styles.secondaryButton} href="#endpoints">
            API reference
          </a>
        </div>
      </header>

      <section className={styles.section} id="overview">
        <div className={styles.sectionHeader}>
          <h2>Overview</h2>
          <p>
            Eburon runs on Eburon AI. The server-side APIs are exposed as Next.js
            routes under <code>/api</code> and require the server environment keys to
            access your Eburon AI Project securely.
          </p>
        </div>
        <div className={styles.cardGrid}>
          <article className={styles.card}>
            <h3>Authentication</h3>
            <p>
              Server routes sign requests with <code>EBURON_AI_VIDEO_API_KEY</code> and
              <code>EBURON_AI_VIDEO_API_SECRET</code>. Keep these on the server only.
            </p>
          </article>
          <article className={styles.card}>
            <h3>Base URL</h3>
            <p>
              All endpoints are same-origin. Example:
              <code className={styles.inlineCode}>https://your-domain.com/api</code>
            </p>
          </article>
          <article className={styles.card}>
            <h3>Realtime events</h3>
            <p>
              Room events, track state, and participant changes stream through Eburon AI.
              Client UI reads state from the Eburon AI SDK.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.section} id="quickstart">
        <div className={styles.sectionHeader}>
          <h2>Quickstart</h2>
          <p>Generate connection details, then join a room from the client.</p>
        </div>
        <div className={styles.codeBlock}>
          <pre>
            <code>
{`POST /api/connection-details
{
  "roomName": "class-9a3c",
  "participantName": "Instructor"
}`}
            </code>
          </pre>
        </div>
        <div className={styles.codeBlock}>
          <pre>
            <code>
{`curl -X POST https://your-domain.com/api/connection-details \\
  -H "Content-Type: application/json" \\
  -d '{"roomName":"class-9a3c","participantName":"Instructor"}'`}
            </code>
          </pre>
        </div>
      </section>

      <section className={styles.section} id="endpoints">
        <div className={styles.sectionHeader}>
          <h2>API Endpoints</h2>
          <p>Server-side routes for live operations.</p>
        </div>
        <div className={styles.endpointGrid}>
          <article className={styles.endpointCard}>
            <div className={styles.endpointHeader}>
              <span className={styles.method}>POST</span>
              <span className={styles.path}>/api/connection-details</span>
            </div>
            <p>Create an Eburon AI token and return room connection details.</p>
          </article>
          <article className={styles.endpointCard}>
            <div className={styles.endpointHeader}>
              <span className={styles.method}>POST</span>
              <span className={styles.path}>/api/room/mute</span>
            </div>
            <p>Mute or unmute a participant audio/video track.</p>
          </article>
          <article className={styles.endpointCard}>
            <div className={styles.endpointHeader}>
              <span className={styles.method}>POST</span>
              <span className={styles.path}>/api/room/mute-all</span>
            </div>
            <p>Mute all participants in a room (except host).</p>
          </article>
          <article className={styles.endpointCard}>
            <div className={styles.endpointHeader}>
              <span className={styles.method}>POST</span>
              <span className={styles.path}>/api/room/remove</span>
            </div>
            <p>Remove a participant from the room.</p>
          </article>
          <article className={styles.endpointCard}>
            <div className={styles.endpointHeader}>
              <span className={styles.method}>POST</span>
              <span className={styles.path}>/api/agent</span>
            </div>
            <p>AI assistant powered by Eburon AI.</p>
          </article>
        </div>
      </section>

      <section className={styles.section} id="environment">
        <div className={styles.sectionHeader}>
          <h2>Environment variables</h2>
          <p>Configure these on the server (Vercel or local .env).</p>
        </div>
        <div className={styles.codeBlock}>
          <pre>
            <code>
{`EBURON_AI_VIDEO_API_KEY=...
EBURON_AI_VIDEO_API_SECRET=...
EBURON_AI_URL=wss://your-project.eburon.ai

EBURON_AI_API_KEY=...
EBURON_AI_BASE_URL=https://eburon.ai
EBURON_AI_MODEL=eburon-ai-1
`}
            </code>
          </pre>
        </div>
      </section>

      <section className={styles.section} id="errors">
        <div className={styles.sectionHeader}>
          <h2>Error handling</h2>
          <p>Standard HTTP status codes are returned with a short text body.</p>
        </div>
        <div className={styles.cardGrid}>
          <article className={styles.card}>
            <h3>400</h3>
            <p>Missing or invalid request payload.</p>
          </article>
          <article className={styles.card}>
            <h3>401/403</h3>
            <p>Missing or invalid credentials.</p>
          </article>
          <article className={styles.card}>
            <h3>500</h3>
            <p>Unexpected server error. Check logs for details.</p>
          </article>
        </div>
      </section>


      <footer className={styles.footer}>
        <span>Success Class Developer API</span>
        <a href="https://eburon.ai" target="_blank" rel="noopener noreferrer">
          Powered by Eburon AI
        </a>
      </footer>
    </main>
  );
}
