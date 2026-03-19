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
      setStatus({ type: 'idle', message: `Loaded profile: ${name}` });
    }
  };

  const deleteProfile = (name: string) => {
    const newProfiles = profiles.filter(p => p.name !== name);
    setProfiles(newProfiles);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(newProfiles));
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
    setStatus({ type: 'loading', message: `Testing connection with ${config.model}...` });
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: `Success! Connected to backend using ${data.model}.` });
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
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Agent Runtime</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 250px', gap: '2rem' }}>
        <section>
          <h2>Configuration</h2>
          <form onSubmit={handleTest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label>Profile Name</label>
              <input value={config.name} onChange={(e) => updateConfig({ name: e.target.value })} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label>Base URL</label>
              <input value={config.baseUrl} onChange={(e) => updateConfig({ baseUrl: e.target.value })} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label>API Key</label>
              <input type="password" value={config.apiKey} onChange={(e) => updateConfig({ apiKey: e.target.value })} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label>Model</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {availableModels.length > 0 ? (
                  <select value={config.model} onChange={(e) => updateConfig({ model: e.target.value })} style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input value={config.model} onChange={(e) => updateConfig({ model: e.target.value })} placeholder="e.g. gpt-3.5-turbo" style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                )}
                <button type="button" onClick={handleFetchModels} style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #0070f3', color: '#0070f3', cursor: 'pointer', background: 'none' }}>Fetch</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '4px', border: 'none', backgroundColor: '#0070f3', color: 'white', cursor: 'pointer' }}>Test Connection</button>
              <button type="button" onClick={saveProfile} style={{ flex: 1, padding: '0.75rem', borderRadius: '4px', border: '1px solid #0070f3', color: '#0070f3', cursor: 'pointer', background: 'none' }}>Save Profile</button>
            </div>
          </form>

          {status.message && <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '4px', backgroundColor: status.type === 'error' ? '#fee2e2' : '#f0fdf4', color: status.type === 'error' ? '#991b1b' : '#166534' }}>{status.message}</div>}

          <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #eee' }} />

          <h2>Raw Chat</h2>
          <form onSubmit={handleChat} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              rows={3}
              style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'inherit' }}
            />
            <button
              type="submit"
              disabled={chatStatus === 'loading' || !config.baseUrl}
              style={{ padding: '0.75rem', borderRadius: '4px', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: chatStatus === 'loading' ? 'not-allowed' : 'pointer' }}
            >
              {chatStatus === 'loading' ? 'Sending...' : 'Send Message'}
            </button>
          </form>

          {response && (
            <div style={{ marginTop: '1.5rem', whiteSpace: 'pre-wrap', padding: '1rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <strong>Response:</strong><br />
              {response}
            </div>
          )}
        </section>

        <aside>
          <h3>Saved Profiles</h3>
          {profiles.length === 0 ? <p style={{ color: '#666', fontSize: '0.9rem' }}>None.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {profiles.map((p) => (
                <div key={p.name} style={{ padding: '0.5rem', border: '1px solid #eee', borderRadius: '4px', background: config.name === p.name ? '#f0f9ff' : 'white' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#666' }}>{p.model || 'No model'}</div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <button onClick={() => loadProfile(p.name)} style={{ flex: 1, fontSize: '0.7rem', padding: '0.2rem', cursor: 'pointer' }}>Load</button>
                    <button onClick={() => deleteProfile(p.name)} style={{ fontSize: '0.7rem', padding: '0.2rem', cursor: 'pointer', color: 'red' }}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
