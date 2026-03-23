import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: 'calc(100vh - 60px)', 
      fontFamily: 'system-ui',
      backgroundColor: '#f8fafc',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#0f172a', marginBottom: '1rem' }}>
        Welcome to Agent Runtime
      </h1>
      <p style={{ fontSize: '1.25rem', color: '#64748b', maxWidth: '600px', marginBottom: '2.5rem', lineHeight: 1.6 }}>
        A transparent, local-first runtime for tool-augmented LLM agents. 
        Observe, control, and refine your agent's execution flow.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link href="/context-engine" style={{ 
          padding: '0.75rem 1.5rem', 
          backgroundColor: '#3b82f6', 
          color: 'white', 
          textDecoration: 'none', 
          borderRadius: '8px', 
          fontWeight: 700,
          boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)'
        }}>
          Launch Context Engine
        </Link>
        <Link href="/configure" style={{ 
          padding: '0.75rem 1.5rem', 
          backgroundColor: 'white', 
          color: '#0f172a', 
          textDecoration: 'none', 
          borderRadius: '8px', 
          fontWeight: 700,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          Configure Profiles
        </Link>
      </div>
    </div>
  );
}
