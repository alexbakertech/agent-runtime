'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '80vh', 
      fontFamily: 'system-ui',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
        Agent Runtime
      </h1>
      <p style={{ fontSize: '1.25rem', color: '#64748b', maxWidth: '600px', lineHeight: 1.6, marginBottom: '2.5rem' }}>
        A transparent, local-first runtime for tool-augmented LLM agents. 
        Start by configuring your local model connection.
      </p>
      <Link href="/configure" style={{ 
        backgroundColor: '#0f172a', 
        color: 'white', 
        padding: '1rem 2rem', 
        borderRadius: '8px', 
        textDecoration: 'none', 
        fontWeight: 600,
        fontSize: '1.1rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }}>
        Configure & Test →
      </Link>
    </main>
  );
}
