import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  applicationName: 'The Last Commit',
  title: 'The Last Commit | AI Code Resurrection Lab',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  description: 'Dead Code Deserves a Second Life. An open-source AI-powered resurrection lab for forgotten software powered by Gemma 3.',
};

export const viewport: Viewport = { themeColor: '#0B0E0C' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-void text-textMain min-h-screen flex flex-col font-sans selection:bg-life/30 selection:text-life">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border bg-panel py-6 text-center text-xs font-mono text-textMuted">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-life"></span>
              <span>The Last Commit · Hacktoberfest 2026 DevChallenge</span>
            </div>
            <div>
              Powered by <span className="text-textMain font-medium">Gemma 3</span> & <span className="text-textMain font-medium">Mastra</span> · Local-First On-Device AI
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
