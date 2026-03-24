'use client';

import Link from 'next/link';

const pages = [
  {
    href: '/context-engine',
    title: 'Context Engine',
    description: 'Chat with AI agents. Control context, overrides, and execution flow.',
    icon: '💬',
    color: '#3b82f6',
  },
  {
    href: '/configure',
    title: 'Configure & Test',
    description: 'Manage API profiles, test connections, and configure models.',
    icon: '⚙️',
    color: '#10b981',
  },
  {
    href: '/sandbox/tools',
    title: 'Tools Sandbox',
    description: 'Build, test, and manage custom tools for agent execution.',
    icon: '🛠️',
    color: '#f59e0b',
  },
  {
    href: '/export',
    title: 'State',
    description: 'Export, import, and manage application state.',
    icon: '📦',
    color: '#8b5cf6',
  },
];

export default function Home() {
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', color: '#1a1a1a', backgroundColor: '#fdfdfd' }}>
      <aside style={{ width: '320px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1.5rem', overflowY: 'auto' }}>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem' }}>QUICK START</h2>
          <ol style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8rem', color: '#475569', lineHeight: 1.8 }}>
            <li>Add an API profile in Configure</li>
            <li>Build custom tools in Tools Sandbox</li>
            <li>Start chatting in Context Engine</li>
          </ol>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem' }}>ABOUT</h2>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.6 }}>
            A transparent, local-first runtime for tool-augmented LLM agents. 
            Observe, control, and refine your agent's execution flow.
          </p>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Welcome to Agent Runtime</h1>
        <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.9rem' }}>Select a section to get started</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {pages.map((page) => (
            <Link 
              key={page.href} 
              href={page.href}
              style={{ 
                display: 'block',
                padding: '1.5rem', 
                backgroundColor: '#fff',
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = page.color;
                e.currentTarget.style.boxShadow = `0 4px 12px -2px ${page.color}30`;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{page.icon}</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: page.color }}>{page.title}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>{page.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
