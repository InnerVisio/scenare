import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GTA Scénáře',
  description: 'Psaní a schvalování scénářů k videím',
};

// Lets `dvh` units follow the on-screen keyboard (Android Chrome), so bottom sheets stay above it.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, interactiveWidget: 'resizes-content' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" className={plusJakarta.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
