import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import ClientOnlyToaster from '@/components/ClientOnlyToaster';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  title: {
    default: 'Success Class | Portal',
    template: '%s',
  },
  description:
    'Success Class is a video conferencing platform designed for high-performance teams, powered by Eburon AI.',
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
    siteName: 'Orbit Conference',
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
    <html lang="en" className={plusJakartaSans.variable}>
      <body className={plusJakartaSans.className} data-lk-theme="default">
        <AuthProvider>
          <ClientOnlyToaster />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
