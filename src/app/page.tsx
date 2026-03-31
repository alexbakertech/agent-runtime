'use client';

import Link from 'next/link';

const pages = [
  {
    href: '/runtime',
    title: 'Runtime',
    description: 'Execute agent runs, inspect model calls, and view execution traces.',
    color: '#3b82f6',
  },
  {
    href: '/runtime/edit',
    title: 'Runtime Editor',
    description: 'Configure runtime definitions, prompts, tools, and debug settings.',
    color: '#8b5cf6',
  },
  {
    href: '/tools',
    title: 'Tools',
    description: 'Tool registry, definition, invocation, exposure preview, and parsing inspector.',
    color: '#f59e0b',
  },
  {
    href: '/connections',
    title: 'Connections',
    description: 'Manage API profiles and test endpoint connectivity.',
    color: '#10b981',
  },
  {
    href: '/state',
    title: 'State',
    description: 'Export/import runtime bundles and manage application state.',
    color: '#ec4899',
  },
];

export default function Home() {
  return (
    <div style={{ padding: '3rem', maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Agent Runtime</h1>
      <p style={{ fontSize: '1.1rem', color: '#64748b', marginBottom: '2rem' }}>
        A transparent runtime for tool-augmented agents. Define runtimes, configure prompts, execute agent loops, and inspect every model call.
      </p>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
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
              <span style={{ fontSize: '1rem', fontWeight: 700, color: page.color }}>{page.title}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>{page.description}</p>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: '3rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Quick Start</h2>
        <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.8 }}>
          <li>Set up an API profile in <strong>Connections</strong></li>
          <li>Create or edit a runtime in <strong>Runtime Editor</strong></li>
          <li>Go to <strong>Runtime</strong> to execute agent runs and inspect model calls</li>
        </ol>
      </div>
    </div>
  );
}
