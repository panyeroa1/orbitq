import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import ClientOnlyToaster from '@/components/ClientOnlyToaster';

export const metadata: Metadata = {
  title: {
    default: 'Eburon | AI Meetings',
    template: '%s',
  },
  description:
    'Eburon is a video conferencing platform designed for education, powered by Eburon AI.',
  twitter: {
    creator: '@eburon_ai',
    site: '@eburon_ai',
    card: 'summary_large_image',
  },
  openGraph: {
    url: 'https://eburon.ai',
    images: [
      {
        url: 'https://eburon.ai/images/eburon-open-graph.png',
        width: 2000,
        height: 1000,
        type: 'image/png',
      },
    ],
    siteName: 'Eburon',
  },
  icons: {
    icon: {
      rel: 'icon',
      url: '/images/eburon-open-graph.png',
    },
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/images/eburon-apple-touch.png',
        sizes: '180x180',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
};

import { AuthProvider } from '@/components/AuthProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <AuthProvider>
          <ClientOnlyToaster />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
