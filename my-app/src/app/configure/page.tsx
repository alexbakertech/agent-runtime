'use client';

import { useState, useEffect, useRef } from 'react';

const PROFILES_KEY = 'agent_runtime_profiles';

interface Config {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
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

  // UI State
  const [profilesCollapsed, setProfilesCollapsed] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

  // Chat state
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatStatus, setChatStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem(PROFILES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfiles(parsed);
        if (parsed.length > 0) {
          setConfig(parsed[0]);
          setEditingName(parsed[0].name);
        }
      } catch (e) {
        console.error('Failed to parse saved profiles', e);
      }
    }
  }, []);

  const saveProfile = () => {
    if (availableModels.length > 0 && config.model && !availableModels.includes(config.model)) {
      setStatus({ type: 'error', message: `Invalid model: ${config.model}` });
      return;
    }

    const nameConflict = profiles.find(p => p.name === config.name && p.name !== editingName);
    if (nameConflict) {
      setStatus({ type: 'error', message: 'Profile name already exists.' });
      return;
    }

    let newProfiles;
    if (editingName) {
      const existingIndex = profiles.findIndex(p => p.name === editingName);
      if (existingIndex >= 0) {
        newProfiles = profiles.map((p, i) => i === existingIndex ? config : p);
      } else {
        newProfiles = [...profiles, config];
      }
    } else {
      newProfiles = [...profiles, config];
    }

    setProfiles(newProfiles);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(newProfiles));
    setEditingName(config.name);
    setStatus({ type: 'success', message: `Saved.` });
    setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
  };

  const loadProfile = (name: string) => {
    const profile = profiles.find(p => p.name === name);
    if (profile) {
      setConfig(profile);
      setEditingName(name);
      setAvailableModels([]);
      setMessages([]);
      setStatus({ type: 'idle', message: '' });
    }
  };

  const deleteProfile = (name: string) => {
    const newProfiles = profiles.filter(p => p.name !== name);
    setProfiles(newProfiles);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(newProfiles));
    if (editingName === name) {
      startNewProfile();
    }
  };

  const startNewProfile = () => {
    setConfig({ name: `New Profile`, baseUrl: 'http://localhost:8080/v1', apiKey: '', model: '' });
    setEditingName(null);
    setAvailableModels([]);
    setMessages([]);
    setStatus({ type: 'idle', message: '' });
  };

  const updateConfig = (updates: Partial<Config>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleFetchModels = async () => {
    setStatus({ type: 'loading', message: 'Fetching...' });
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
        setStatus({ type: 'success', message: `Found ${models.length} models.` });
      } else {
        throw new Error(data.error || 'Fetch failed');
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleTest = async () => {
    if (!config.model) {
      setStatus({ type: 'error', message: 'Enter a model first.' });
      return;
    }
    setStatus({ type: 'loading', message: `Testing...` });
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: `Connected: ${data.model}` });
      } else {
        throw new Error(data.error || 'Failed');
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatStatus === 'loading') return;

    const currentInput = input;
    setInput('');
    setChatStatus('loading');
    
    // Add user message to history
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    
    // Create a placeholder for the assistant response
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, message: currentInput }),
        signal: controller.signal
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Chat failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader found on response');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        
        // Update the LAST assistant message in history
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          if (newMessages[lastIdx].role === 'assistant') {
            newMessages[lastIdx] = { 
              ...newMessages[lastIdx], 
              content: newMessages[lastIdx].content + chunk 
            };
          }
          return newMessages;
        });
      }
      
      setChatStatus('idle');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // We don't clear, we just stop. The user already has the partial content.
        setChatStatus('idle');
      } else {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          if (newMessages[lastIdx].role === 'assistant') {
            newMessages[lastIdx] = { 
              ...newMessages[lastIdx], 
              content: newMessages[lastIdx].content + `\n\n**Error:** ${err.message}` 
            };
          }
          return newMessages;
        });
        setChatStatus('error');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const SectionHeader = ({ label, isCollapsed, onToggle }: { label: string, isCollapsed: boolean, onToggle: () => void }) => (
    <div 
      onClick={onToggle}
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '0.75rem', 
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </h3>
      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{isCollapsed ? '▼' : '▲'}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', color: '#1a1a1a', backgroundColor: '#fdfdfd' }}>
      
      {/* LEFT SIDEBAR - Navigation & Settings */}
      <aside style={{ 
        width: '320px', 
        backgroundColor: '#f8fafc', 
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}>
        <div style={{ padding: '1.5rem' }}>
          {/* PROFILES SECTION */}
          <SectionHeader label="Profiles" isCollapsed={profilesCollapsed} onToggle={() => setProfilesCollapsed(!profilesCollapsed)} />
          {!profilesCollapsed && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {profiles.map((p) => (
                  <div 
                    key={p.name} 
                    onClick={() => loadProfile(p.name)}
                    style={{ 
                      padding: '0.6rem 0.75rem', 
                      borderRadius: '6px', 
                      cursor: 'pointer',
                      backgroundColor: editingName === p.name ? '#fff' : 'transparent',
                      border: `1px solid ${editingName === p.name ? '#e2e8f0' : 'transparent'}`,
                      boxShadow: editingName === p.name ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', fontWeight: editingName === p.name ? 600 : 400, color: editingName === p.name ? '#0f172a' : '#475569' }}>{p.name}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteProfile(p.name); }}
                      style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem' }}
                    >✕</button>
                  </div>
                ))}
              </div>
              <button 
                onClick={startNewProfile}
                style={{ 
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#fff', 
                  border: '1px dashed #cbd5e1', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: '#64748b',
                  fontWeight: 500
                }}
              >+ New Profile</button>
            </div>
          )}

          {/* CONFIGURATION SECTION */}
          <SectionHeader label="Configuration" isCollapsed={configCollapsed} onToggle={() => setConfigCollapsed(!configCollapsed)} />
          {!configCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}>PROFILE NAME</label>
                <input value={config.name} onChange={(e) => updateConfig({ name: e.target.value })} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}>BASE URL</label>
                <input value={config.baseUrl} onChange={(e) => updateConfig({ baseUrl: e.target.value })} placeholder="http://..." style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}>API KEY</label>
                <input type="password" value={config.apiKey} onChange={(e) => updateConfig({ apiKey: e.target.value })} placeholder="Optional" style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}>MODEL</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {availableModels.length > 0 ? (
                    <select value={config.model} onChange={(e) => updateConfig({ model: e.target.value })} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                      {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input value={config.model} onChange={(e) => updateConfig({ model: e.target.value })} placeholder="e.g. default" style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
                  )}
                  <button onClick={handleFetchModels} style={{ padding: '0 0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', fontSize: '0.7rem', color: '#64748b', cursor: 'pointer' }}>Fetch</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={handleTest} style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid #0070f3', backgroundColor: '#fff', color: '#0070f3', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Test</button>
                <button onClick={saveProfile} style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: 'none', backgroundColor: '#0070f3', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Save</button>
              </div>
              
              {status.message && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  padding: '0.6rem', 
                  borderRadius: '6px', 
                  textAlign: 'center',
                  backgroundColor: status.type === 'error' ? '#fee2e2' : '#f0fdf4', 
                  color: status.type === 'error' ? '#991b1b' : '#166534' 
                }}>
                  {status.message}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT - Chat Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Chat History View */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '3rem' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {messages.length > 0 ? (
              <>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                    <div style={{ 
                      backgroundColor: msg.role === 'user' ? '#0070f3' : '#0f172a', 
                      color: 'white', 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '4px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontWeight: 800, 
                      fontSize: '0.65rem', 
                      flexShrink: 0,
                      marginTop: '4px'
                    }}>{msg.role === 'user' ? 'U' : 'AI'}</div>
                    <div style={{ 
                      whiteSpace: 'pre-wrap', 
                      lineHeight: 1.6, 
                      fontSize: '1.05rem', 
                      color: '#1e293b'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0' }}>READY</div>
                <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  {chatStatus === 'loading' ? 'Thinking...' : `Connected to ${config.name}`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Input Area */}
        <div style={{ 
          padding: '0 3rem 3rem 3rem',
          maxWidth: '864px', 
          width: '100%', 
          margin: '0 auto',
          boxSizing: 'border-box'
        }}>
          <form onSubmit={handleChat} style={{ position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a raw message..."
              rows={1}
              style={{ 
                width: '100%',
                boxSizing: 'border-box',
                padding: '1.25rem 4rem 1.25rem 1.25rem', 
                borderRadius: '16px', 
                border: '1px solid #e2e8f0', 
                fontFamily: 'inherit',
                fontSize: '1rem',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.04)',
                resize: 'none',
                outline: 'none',
                backgroundColor: '#fff',
                minHeight: '60px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChat(e as any);
                }
              }}
            />
            {chatStatus === 'loading' ? (
              <button
                type="button"
                onClick={handleStop}
                style={{ 
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px', 
                  border: 'none', 
                  backgroundColor: '#ef4444', 
                  color: 'white', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}
                title="Stop generation"
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                disabled={!config.baseUrl}
                style={{ 
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px', 
                  border: 'none', 
                  backgroundColor: '#0f172a', 
                  color: 'white', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ↑
              </button>
            )}
          </form>
          <div style={{ fontSize: '0.7rem', color: '#cbd5e1', textAlign: 'center', marginTop: '0.75rem', letterSpacing: '0.02em' }}>
            RAW INTERACTION MODE • NO MEMORY • NO SYSTEM PROMPT
          </div>
        </div>

      </main>
    </div>
  );
}
