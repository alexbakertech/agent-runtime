import type { Metadata } from "next";
import "./globals.css";
import Link from 'next/link';
import { StateProvider } from '@/lib/state';

export const metadata: Metadata = {
  title: "Agent Runtime",
  description: "Local-first agent runtime",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
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
          <Link href="/context-engine" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Context Engine
          </Link>
          <Link href="/sandbox/tools" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Tools Sandbox
          </Link>
          <Link href="/configure" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Configure & Test
          </Link>
          <Link href="/export" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            Export
          </Link>
        </nav>
        <StateProvider>
          {children}
        </StateProvider>
      </body>
    </html>
  );
}
