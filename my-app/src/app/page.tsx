'use client';

import { useState, useEffect, useRef } from 'react';

const PROFILES_KEY = 'agent_runtime_profiles';
const PREFIX_KEY = 'agent_runtime_prefix';

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

type LoopStage = 'idle' | 'preparing' | 'calling' | 'receiving' | 'finished' | 'error';

export default function Home() {
  const [activeProfile, setActiveProfile] = useState<Config | null>(null);
  const [prefix, setPrefix] = useState('You are a helpful AI assistant. Answer concisely.');
  const [loopStage, setLoopStage] = useState<LoopStage>('idle');
  
  // Chat state
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatStatus, setChatStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load state on mount
  useEffect(() => {
    const savedProfiles = localStorage.getItem(PROFILES_KEY);
    const savedPrefix = localStorage.getItem(PREFIX_KEY);
    
    if (savedProfiles) {
      try {
        const parsed = JSON.parse(savedProfiles);
        if (parsed.length > 0) setActiveProfile(parsed[0]);
      } catch (e) { console.error(e); }
    }
    if (savedPrefix) setPrefix(savedPrefix);
  }, []);

  // Save prefix when changed
  useEffect(() => {
    localStorage.setItem(PREFIX_KEY, prefix);
  }, [prefix]);

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

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatStatus === 'loading' || !activeProfile) return;

    const currentInput = input;
    setInput('');
    setChatStatus('loading');
    setLoopStage('preparing');
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    
    // Prepare for assistant response
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoopStage('calling');
      // In a real loop, we'd combine prefix + currentInput
      const fullPrompt = `${prefix}\n\nUser: ${currentInput}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...activeProfile, message: fullPrompt }),
        signal: controller.signal
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Chat failed');
      }

      setLoopStage('receiving');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader found');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        
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
      
      setLoopStage('finished');
      setChatStatus('idle');
    } catch (err: any) {
      setLoopStage('error');
      if (err.name === 'AbortError') {
        setChatStatus('idle');
        setLoopStage('finished');
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
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  if (!activeProfile) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2>No Profiles Found</h2>
        <p>Please go to <strong>Configure & Test</strong> to set up a model connection.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', backgroundColor: '#fdfdfd' }}>
      
      {/* LEFT PANEL - Loop Visualizer */}
      <section style={{ 
        flex: 1, 
        borderRight: '1px solid #e2e8f0', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>RUNTIME LOOP</h2>
        </div>

        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Prompt Prefix (System)</label>
            <textarea 
              value={prefix} 
              onChange={(e) => setPrefix(e.target.value)}
              style={{ 
                width: '100%', 
                minHeight: '120px', 
                padding: '0.75rem', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0', 
                fontFamily: 'monospace', 
                fontSize: '0.85rem',
                backgroundColor: '#fff',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Execution Flow</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { stage: 'preparing', label: '1. Preparing Context' },
                { stage: 'calling', label: '2. Calling Model API' },
                { stage: 'receiving', label: '3. Streaming Response' },
                { stage: 'finished', label: '4. Loop Complete' }
              ].map((step, i) => (
                <div key={i} style={{ 
                  padding: '0.75rem', 
                  borderRadius: '6px', 
                  backgroundColor: loopStage === step.stage ? '#fff' : 'transparent',
                  border: `1px solid ${loopStage === step.stage ? '#bfdbfe' : 'transparent'}`,
                  color: loopStage === step.stage ? '#1e40af' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontWeight: loopStage === step.stage ? 600 : 400,
                  fontSize: '0.9rem'
                }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: loopStage === step.stage ? '#3b82f6' : '#e2e8f0' 
                  }} />
                  {step.label}
                  {loopStage === step.stage && <span style={{ fontSize: '0.7rem', marginLeft: 'auto' }}>ACTIVE</span>}
                </div>
              ))}
            </div>
            
            {loopStage === 'error' && (
              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.8rem', fontWeight: 600 }}>
                CRITICAL ERROR IN LOOP
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>ACTIVE PROFILE: <strong>{activeProfile.name}</strong></div>
          <button 
            onClick={() => setMessages([])} 
            style={{ 
              width: '100%', 
              padding: '0.5rem', 
              borderRadius: '6px', 
              border: '1px solid #e2e8f0', 
              background: '#fff', 
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: '#475569'
            }}
          >Reset Execution</button>
        </div>
      </section>

      {/* RIGHT PANEL - Chat View */}
      <section style={{ flex: 1.2, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>CHAT VIEW</h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ 
                  backgroundColor: msg.role === 'user' ? '#3b82f6' : '#1e293b', 
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
                  fontSize: '0.95rem', 
                  color: '#334155'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div style={{ padding: '2rem', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <form onSubmit={handleChat} style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message local agent..."
                rows={1}
                style={{ 
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '1rem 3.5rem 1rem 1rem', 
                  borderRadius: '12px', 
                  border: '1px solid #e2e8f0', 
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  resize: 'none',
                  outline: 'none',
                  backgroundColor: '#fff',
                  minHeight: '52px',
                  maxHeight: '160px',
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
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', borderRadius: '6px', width: '28px', height: '28px' }}
                >■</button>
              ) : (
                <button
                  type="submit"
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', border: 'none', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', borderRadius: '6px', width: '28px', height: '28px' }}
                >↑</button>
              )}
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
