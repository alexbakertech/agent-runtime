'use client';

import { useState, useEffect } from 'react';

const PROFILES_KEY = 'agent_runtime_profiles';

interface Config {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export default function Home() {
  const [config, setConfig] = useState<Config>({
    name: 'Default',
    baseUrl: 'http://localhost:8080/v1',
    apiKey: 'sk-no-key-required',
    model: '',
  });
  const [profiles, setProfiles] = useState<Config[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  // Chat state
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [chatStatus, setChatStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    const saved = localStorage.getItem(PROFILES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfiles(parsed);
        if (parsed.length > 0) {
          setConfig(parsed[0]);
        }
      } catch (e) {
        console.error('Failed to parse saved profiles', e);
      }
    }
  }, []);

  const saveProfile = () => {
    if (availableModels.length > 0 && config.model && !availableModels.includes(config.model)) {
      setStatus({ type: 'error', message: `Invalid model selected: ${config.model}` });
      return;
    }
    const existingIndex = profiles.findIndex(p => p.name === config.name);
    const newProfiles = existingIndex >= 0 
      ? profiles.map((p, i) => i === existingIndex ? config : p)
      : [...profiles, config];
    setProfiles(newProfiles);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(newProfiles));
    setStatus({ type: 'success', message: `Profile "${config.name}" saved.` });
  };

  const loadProfile = (name: string) => {
    const profile = profiles.find(p => p.name === name);
    if (profile) {
      setConfig(profile);
      setAvailableModels([]);
      setResponse('');
      setStatus({ type: 'idle', message: `Loaded profile: ${name}` });
    }
  };

  const deleteProfile = (name: string) => {
    const newProfiles = profiles.filter(p => p.name !== name);
    setProfiles(newProfiles);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(newProfiles));
    if (config.name === name) {
      setConfig({ name: 'New Profile', baseUrl: 'http://localhost:8080/v1', apiKey: '', model: '' });
    }
  };

  const startNewProfile = () => {
    setConfig({ name: `Profile ${profiles.length + 1}`, baseUrl: 'http://localhost:8080/v1', apiKey: '', model: '' });
    setAvailableModels([]);
    setResponse('');
    setStatus({ type: 'idle', message: 'Enter details for a new profile.' });
  };

  const updateConfig = (updates: Partial<Config>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleFetchModels = async () => {
    setStatus({ type: 'loading', message: 'Fetching models...' });
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: config.baseUrl, apiKey: config.apiKey }),
      });
      const data = await response.json();
      if (response.ok) {
        const models = (data.models || []).map((m: any) => m.id);
        setAvailableModels(models);
        if (models.length > 0 && !models.includes(config.model)) {
          updateConfig({ model: models[0] });
        }
        setStatus({ type: 'success', message: `Fetched ${models.length} models.` });
      } else {
        throw new Error(data.error || 'Failed to fetch models');
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.model) {
      setStatus({ type: 'error', message: 'Please select or enter a model to test.' });
      return;
    }
    setStatus({ type: 'loading', message: `Testing connection...` });
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: `Success! Connected using ${data.model}.` });
      } else {
        throw new Error(data.error || 'Failed to connect');
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatStatus === 'loading') return;
    setChatStatus('loading');
    setResponse('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, message: input }),
      });
      const data = await res.json();
      if (res.ok) {
        setResponse(data.content);
        setChatStatus('idle');
      } else {
        throw new Error(data.error || 'Chat failed');
      }
    } catch (err: any) {
      setResponse(`Error: ${err.message}`);
      setChatStatus('error');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui', color: '#1a1a1a' }}>
      {/* SIDEBAR */}
      <aside style={{ 
        width: '280px', 
        backgroundColor: '#f8fafc', 
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Agent Runtime</h1>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.875rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Profiles</h3>
            <button 
              onClick={startNewProfile}
              style={{ fontSize: '1.2rem', cursor: 'pointer', border: 'none', background: 'none', color: '#0070f3' }}
              title="Add New Profile"
            >+</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {profiles.map((p) => (
              <div 
                key={p.name} 
                onClick={() => loadProfile(p.name)}
                style={{ 
                  padding: '0.75rem', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  backgroundColor: config.name === p.name ? '#eff6ff' : 'transparent',
                  border: `1px solid ${config.name === p.name ? '#bfdbfe' : 'transparent'}`,
                  position: 'relative',
                  group: 'profile-item'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: config.name === p.name ? '#1e40af' : '#334155' }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.model || 'No model selected'}</div>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteProfile(p.name); }}
                  style={{ 
                    position: 'absolute', 
                    right: '0.5rem', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    border: 'none', 
                    background: 'none', 
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
        {/* TOP BAR / CONFIG */}
        <section style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <input 
                value={config.name} 
                onChange={(e) => updateConfig({ name: e.target.value })} 
                style={{ fontSize: '1.5rem', fontWeight: 700, border: 'none', outline: 'none', padding: 0, width: '100%' }}
                placeholder="Profile Name"
              />
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>Configuration Details</div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handleTest} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #0070f3', backgroundColor: 'white', color: '#0070f3', cursor: 'pointer', fontWeight: 500 }}>Test Connection</button>
              <button onClick={saveProfile} style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', backgroundColor: '#0070f3', color: 'white', cursor: 'pointer', fontWeight: 500 }}>Save Profile</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>BASE URL</label>
              <input value={config.baseUrl} onChange={(e) => updateConfig({ baseUrl: e.target.value })} placeholder="http://..." style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>API KEY</label>
              <input type="password" value={config.apiKey} onChange={(e) => updateConfig({ apiKey: e.target.value })} placeholder="sk-..." style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>MODEL</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {availableModels.length > 0 ? (
                  <select value={config.model} onChange={(e) => updateConfig({ model: e.target.value })} style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input value={config.model} onChange={(e) => updateConfig({ model: e.target.value })} placeholder="e.g. gpt-3.5-turbo" style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }} />
                )}
                <button type="button" onClick={handleFetchModels} style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', background: '#f8fafc', fontSize: '0.8rem' }}>Fetch</button>
              </div>
            </div>
          </div>

          {status.message && (
            <div style={{ 
              marginTop: '1rem', 
              fontSize: '0.8rem', 
              padding: '0.5rem 1rem', 
              borderRadius: '4px', 
              display: 'inline-block',
              backgroundColor: status.type === 'error' ? '#fee2e2' : '#f0fdf4', 
              color: status.type === 'error' ? '#991b1b' : '#166534' 
            }}>
              {status.message}
            </div>
          )}
        </section>

        {/* CHAT AREA */}
        <section style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {response ? (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ backgroundColor: '#10b981', color: 'white', width: '2rem', height: '2rem', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>AI</div>
                    <div style={{ whiteSpace: 'pre-wrap', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', lineHeight: 1.5, fontSize: '1rem' }}>
                      {response}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  {chatStatus === 'loading' ? 'Model is thinking...' : 'Send a message to start a raw chat interaction.'}
                </div>
              )}
            </div>

            <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>
              <form onSubmit={handleChat} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything..."
                    rows={3}
                    style={{ 
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '1rem 4.5rem 1rem 1rem', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0', 
                      fontFamily: 'inherit',
                      fontSize: '1rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      resize: 'none',
                      outline: 'none'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChat(e as any);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={chatStatus === 'loading' || !config.baseUrl}
                    style={{ 
                      position: 'absolute',
                      right: '0.75rem',
                      bottom: '0.75rem',
                      padding: '0.5rem 1rem', 
                      borderRadius: '8px', 
                      border: 'none', 
                      backgroundColor: '#10b981', 
                      color: 'white', 
                      cursor: chatStatus === 'loading' ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}
                  >
                    {chatStatus === 'loading' ? '...' : 'Send'}
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                  Raw output mode. No system prompt or memory included.
                </div>
              </form>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}
