import type { Metadata } from "next";
import "./globals.css";
import Link from 'next/link';
import { StateProvider } from '@/lib/state';

/**
 * Application Metadata
 */
export const metadata: Metadata = {
  title: "Agent Runtime",
  description: "Transparent runtime for tool-augmented agents",
};

/**
 * Root Layout - Application Shell
 * 
 * Provides:
 * - Navigation bar with links to all pages
 * - StateProvider for global state management
 * - Consistent layout across all pages
 */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {/* ========================================
             NAVIGATION BAR
             Links to all application pages
             ======================================== */}
        <nav style={{ 
          height: '60px', 
          backgroundColor: '#0f172a', 
          color: 'white', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 2rem', 
          gap: '2rem',
          fontFamily: 'system-ui',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <Link href="/" style={{ 
            fontWeight: 800, 
            color: 'white', 
            textDecoration: 'none', 
            fontSize: '1.1rem',
            marginRight: 'auto'
          }}>
            AGENT RUNTIME
          </Link>
          <Link href="/" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Home
          </Link>
          <Link href="/runtime" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Runtime
          </Link>
          <Link href="/runtime/edit" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Runtime Editor
          </Link>
          <Link href="/tools" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Tools
          </Link>
          <Link href="/connections" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Connections
          </Link>
          <Link href="/state" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            State
          </Link>
        </nav>
        <StateProvider>
          {children}
        </StateProvider>
      </body>
    </html>
  );
}
