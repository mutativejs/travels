import type { Metadata } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import { Provider } from '@/components/provider';
import { assetPath } from '@/lib/assets';
import './global.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const siteUrl = new URL(process.env.SITE_URL ?? 'http://localhost:7100');
const metadataBase = new URL(siteUrl.origin);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: 'Travels — Every change. A way back.',
    template: '%s — Travels',
  },
  description:
    'Patch-based undo/redo for modern applications. Compact history, durable persistence, atomic transactions, and framework-agnostic state integration.',
  applicationName: 'Travels',
  keywords: [
    'undo redo',
    'time travel',
    'JSON Patch',
    'state history',
    'persistence',
    'Mutative',
    'TypeScript',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Travels',
    title: 'Travels — Every change. A way back.',
    description: 'Patch-based undo/redo for modern applications.',
    images: [{ url: assetPath('/og-image.png'), width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Travels — Every change. A way back.',
    description: 'Patch-based undo/redo for modern applications.',
    images: [assetPath('/og-image.png')],
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col antialiased">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
