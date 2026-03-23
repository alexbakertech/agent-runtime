'use client';

import { useState, useEffect, useRef } from 'react';
import { testConnection, fetchModels, chatStreamWithReasoning, isBrowserConsentGiven, BrowserConsentRequiredError } from '@/lib/api/client';
import { useProfiles, useBrowserConsent } from '@/lib/state';

interface Config {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoningContent?: string;
}

export default function Home() {
  const { profiles, activeProfile, addProfile, updateProfile, deleteProfile, setActiveProfile } = useProfiles();
  const { browserConsent, setBrowserConsent } = useBrowserConsent();

  const [config, setConfig] = useState<Config>({
    name: 'Default',
    baseUrl: 'http://localhost:8080/v1',
    apiKey: 'sk-no-key-required',
    model: '',
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  const [editingName, setEditingName] = useState<string | null>(null);
  const [showConsentWarning, setShowConsentWarning] = useState(false);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatStatus, setChatStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeProfile) {
      setConfig({
        name: activeProfile.name,
        baseUrl: activeProfile.baseUrl,
        apiKey: activeProfile.apiKey,
        model: activeProfile.model,
      });
      setEditingName(activeProfile.name);
    } else if (profiles.length > 0) {
      setActiveProfile(profiles[0].id);
    }
  }, [activeProfile, profiles, setActiveProfile]);

  const saveProfile = () => {
    if (availableModels.length > 0 && config.model && !availableModels.includes(config.model)) {
      setStatus({ type: 'error', message: `Invalid model: ${config.model}` });
      return;
    }

    const nameConflict = profiles.find(p => p.name === config.name && p.id !== activeProfile?.id);
    if (nameConflict) {
      setStatus({ type: 'error', message: 'Profile name already exists.' });
      return;
    }

    if (editingName && activeProfile && editingName === activeProfile.name) {
      updateProfile(activeProfile.id, {
        name: config.name,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
      });
    } else {
      const newProfile = addProfile(config.name, config.baseUrl, config.model, config.apiKey);
      setActiveProfile(newProfile.id);
    }

    setEditingName(config.name);
    setStatus({ type: 'success', message: `Saved.` });
    setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
  };

  const loadProfile = (profileId: string) => {
    setActiveProfile(profileId);
    setAvailableModels([]);
    setMessages([]);
    setStatus({ type: 'idle', message: '' });
  };

  const handleDeleteProfile = (profileId: string) => {
    deleteProfile(profileId);
    if (activeProfile?.id === profileId) {
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
    if (!isBrowserConsentGiven()) {
      setShowConsentWarning(true);
      return;
    }
    setStatus({ type: 'loading', message: 'Fetching...' });
    try {
      const result = await fetchModels(config);
      if (result.success && result.models) {
        setAvailableModels(result.models);
        if (result.models.length > 0 && !result.models.includes(config.model)) {
          updateConfig({ model: result.models[0] });
        }
        setStatus({ type: 'success', message: `Found ${result.models.length} models.` });
      } else {
        if (result.error === 'BROWSER_CONSENT_REQUIRED') {
          setShowConsentWarning(true);
        } else {
          throw new Error(result.error || 'Fetch failed');
        }
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleTest = async () => {
    if (!isBrowserConsentGiven()) {
      setShowConsentWarning(true);
      return;
    }
    if (!config.model) {
      setStatus({ type: 'error', message: 'Enter a model first.' });
      return;
    }
    setStatus({ type: 'loading', message: `Testing...` });
    try {
      const result = await testConnection(config);
      if (result.success) {
        setStatus({ type: 'success', message: `Connected: ${result.model}` });
      } else {
        if (result.error === 'BROWSER_CONSENT_REQUIRED') {
          setShowConsentWarning(true);
        } else {
          throw new Error(result.error || 'Failed');
        }
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatStatus === 'loading') return;

    if (!isBrowserConsentGiven()) {
      setShowConsentWarning(true);
      return;
    }

    const currentInput = input;
    setInput('');
    setChatStatus('loading');
    
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '', reasoningContent: '' }]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      for await (const chunk of chatStreamWithReasoning(config, currentInput)) {
        if (controller.signal.aborted) break;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          if (newMessages[lastIdx].role === 'assistant') {
            const updated = { ...newMessages[lastIdx] };
            if (chunk.content) {
              updated.content = updated.content + chunk.content;
            }
            if (chunk.reasoning) {
              updated.reasoningContent = (updated.reasoningContent || '') + chunk.reasoning;
            }
            newMessages[lastIdx] = updated;
          }
          return newMessages;
        });
      }
      
      setChatStatus('idle');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setChatStatus('idle');
      } else if (err instanceof BrowserConsentRequiredError) {
        setMessages(prev => prev.slice(0, -1));
        setShowConsentWarning(true);
        setChatStatus('idle');
      } else {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            ...newMessages[newMessages.length - 1],
            content: `Error: ${err.message}`,
          };
          return newMessages;
        });
        setChatStatus('error');
      }
    }
  };

  const SectionHeader = ({ label, isCollapsed, onToggle }: { label: string; isCollapsed: boolean; onToggle: () => void }) => (
    <div 
      onClick={onToggle}
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '0.75rem 0',
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
      
      <aside style={{ 
        width: '320px', 
        backgroundColor: '#f8fafc', 
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}>
        <div style={{ padding: '1.5rem' }}>
          <SectionHeader label="Profiles" isCollapsed={false} onToggle={() => {}} />
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {profiles.map((p) => (
                <div 
                  key={p.id} 
                  onClick={() => loadProfile(p.id)}
                  style={{ 
                    padding: '0.6rem 0.75rem', 
                    borderRadius: '6px', 
                    cursor: 'pointer',
                    backgroundColor: activeProfile?.id === p.id ? '#fff' : 'transparent',
                    border: `1px solid ${activeProfile?.id === p.id ? '#e2e8f0' : 'transparent'}`,
                    boxShadow: activeProfile?.id === p.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '0.875rem', fontWeight: activeProfile?.id === p.id ? 600 : 400, color: activeProfile?.id === p.id ? '#0f172a' : '#475569' }}>{p.name}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}
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

          <SectionHeader label="Configuration" isCollapsed={false} onToggle={() => {}} />
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                id="browser-consent"
                checked={browserConsent ?? false}
                onChange={(e) => setBrowserConsent(e.target.checked)}
              />
              <label htmlFor="browser-consent" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Allow browser API calls
              </label>
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
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
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
                    <div style={{ flex: 1 }}>
                      {msg.role === 'assistant' && msg.reasoningContent && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <button
                            onClick={() => setExpandedThinking(prev => ({ ...prev, [i]: !prev[i] }))}
                            style={{
                              fontSize: '0.75rem',
                              color: '#94a3b8',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: 0,
                              marginBottom: '0.25rem'
                            }}
                          >
                            {expandedThinking[i] ? '▼' : '▶'} Thinking ({msg.reasoningContent.length} chars)
                          </button>
                          {expandedThinking[i] && (
                            <pre style={{
                              margin: 0,
                              padding: '0.75rem',
                              fontSize: '0.85rem',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'monospace',
                              color: '#94a3b8',
                              fontStyle: 'italic',
                              backgroundColor: '#f8fafc',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0'
                            }}>
                              {msg.reasoningContent}
                            </pre>
                          )}
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
                <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Configure a profile and send a message to start chatting.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div style={{ padding: '2rem', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
            <form onSubmit={handleChat} style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a raw message..."
                rows={1}
                disabled={chatStatus === 'loading'}
                className="hide-scrollbar"
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
              {input.trim() && (
                <button 
                  type="submit"
                  disabled={chatStatus === 'loading'}
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
          </div>
        </div>
      </main>

      {showConsentWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            maxWidth: '400px',
            margin: '1rem'
          }}>
            <h3 style={{ marginTop: 0 }}>Browser API Access Required</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
              To use this feature, you must allow browser-based API calls. 
              This means your API key will be stored in your browser and 
              API calls will be made directly from your browser.
            </p>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
              <strong>You are responsible for:</strong>
            </p>
            <ul style={{ fontSize: '0.9rem', color: '#64748b', paddingLeft: '1.5rem' }}>
              <li>Securing your browser and device</li>
              <li>Not using this on shared or public computers</li>
              <li>Understanding that API calls will originate from your IP</li>
            </ul>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                onClick={() => setShowConsentWarning(false)}
                style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setBrowserConsent(true);
                  setShowConsentWarning(false);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                I Understand, Enable
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
