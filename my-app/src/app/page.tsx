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

interface StageData {
  preparing?: string;
  calling?: any;
  receiving?: string;
  error?: string;
}

export default function Home() {
  const [activeProfile, setActiveProfile] = useState<Config | null>(null);
  const [prefix, setPrefix] = useState('You are a helpful AI assistant. Answer concisely.');
  const [historyText, setHistoryText] = useState('');
  
  // Toggles for Loop Components
  const [prefixEnabled, setPrefixEnabled] = useState(true);
  const [prefixMinimized, setPrefixMinimized] = useState(false);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [historyMinimized, setHistoryMinimized] = useState(false);

  const [loopStage, setLoopStage] = useState<LoopStage>('idle');
  const [stageData, setStageData] = useState<StageData>({});
  
  // Debug / Stepping State
  const [stepMode, setStepMode] = useState(false);
  const [isWaitingForNext, setIsWaitingForNext] = useState(false);
  const [nextStepAction, setNextStepAction] = useState<(() => void) | null>(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  
  // UI State
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

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

  const toggleStageExpansion = (stage: string) => {
    setExpandedStages(prev => ({ ...prev, [stage]: !prev[stage] }));
  };

  // Helper to handle stepping logic
  const waitIfStepping = async (stage: LoopStage, data?: any) => {
    setLoopStage(stage);
    if (data) setStageData(prev => ({ ...prev, [stage]: data }));
    
    if (stepMode) {
      setIsWaitingForNext(true);
      return new Promise<void>((resolve) => {
        setNextStepAction(() => () => {
          setIsWaitingForNext(false);
          resolve();
        });
      });
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatStatus === 'loading' || !activeProfile) return;

    const currentInput = input;
    setInput('');
    setChatStatus('loading');
    setStageData({});
    
    // Add user message to history area if enabled
    if (historyEnabled) {
      setHistoryText(prev => prev + (prev ? '\n\n' : '') + `User: ${currentInput}`);
    }

    // Add user message to CHAT VIEW
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    
    // Prepare for assistant response in CHAT VIEW
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // STAGE 1: Preparing
      let finalPrompt = '';
      if (prefixEnabled) finalPrompt += prefix + '\n\n';
      if (historyEnabled && historyText) finalPrompt += historyText + '\n\n';
      finalPrompt += `User: ${currentInput}`;

      await waitIfStepping('preparing', finalPrompt);

      // STAGE 2: Calling
      const callInfo = {
        url: activeProfile.baseUrl,
        model: activeProfile.model,
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: {
          model: activeProfile.model,
          message: finalPrompt
        }
      };
      await waitIfStepping('calling', callInfo);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...activeProfile, message: finalPrompt }),
        signal: controller.signal
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Chat failed');
      }

      // STAGE 3: Receiving
      setLoopStage('receiving');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader found');

      let accumulatedResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        accumulatedResponse += chunk;
        
        setStageData(prev => ({ ...prev, receiving: accumulatedResponse }));
        
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
      
      // Update persistent history box with assistant response
      if (historyEnabled) {
        setHistoryText(prev => prev + '\n\nAssistant: ' + accumulatedResponse);
      }

      setLoopStage('finished');
      setChatStatus('idle');
    } catch (err: any) {
      setLoopStage('error');
      const errMsg = err.name === 'AbortError' ? 'Stopped by user' : err.message;
      setStageData(prev => ({ ...prev, error: errMsg }));
      
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
      setIsWaitingForNext(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  const LoopComponentHeader = ({ label, enabled, onToggleEnable, minimized, onToggleMinimize }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input type="checkbox" checked={enabled} onChange={e => onToggleEnable(e.target.checked)} />
        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: enabled ? '#64748b' : '#cbd5e1', textTransform: 'uppercase' }}>{label}</label>
      </div>
      <button 
        onClick={() => onToggleMinimize(!minimized)}
        style={{ fontSize: '0.65rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {minimized ? 'MAXIMIZE' : 'MINIMIZE'}
      </button>
    </div>
  );

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
        width: '450px', 
        borderRight: '1px solid #e2e8f0', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
        flexShrink: 0
      }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>RUNTIME LOOP</h2>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={stepMode} onChange={e => setStepMode(e.target.checked)} />
            Step Mode
          </label>
        </div>

        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
          {/* PREFIX BOX */}
          <div style={{ marginBottom: '1.5rem', opacity: prefixEnabled ? 1 : 0.5 }}>
            <LoopComponentHeader 
              label="Prompt Prefix" 
              enabled={prefixEnabled} onToggleEnable={setPrefixEnabled} 
              minimized={prefixMinimized} onToggleMinimize={setPrefixMinimized} 
            />
            {!prefixMinimized && (
              <textarea 
                value={prefix} 
                onChange={(e) => setPrefix(e.target.value)}
                disabled={!prefixEnabled}
                style={{ 
                  width: '100%', 
                  height: '80px', 
                  padding: '0.6rem', 
                  borderRadius: '6px', 
                  border: '1px solid #e2e8f0', 
                  fontFamily: 'monospace', 
                  fontSize: '0.8rem',
                  backgroundColor: prefixEnabled ? '#fff' : '#f1f5f9',
                  resize: 'vertical'
                }}
              />
            )}
          </div>

          {/* HISTORY BOX */}
          <div style={{ marginBottom: '2rem', opacity: historyEnabled ? 1 : 0.5 }}>
            <LoopComponentHeader 
              label="Conversation History" 
              enabled={historyEnabled} onToggleEnable={setHistoryEnabled} 
              minimized={historyMinimized} onToggleMinimize={setHistoryMinimized} 
            />
            {!historyMinimized && (
              <textarea 
                value={historyText} 
                onChange={(e) => setHistoryText(e.target.value)}
                disabled={!historyEnabled}
                placeholder="Chat history will accumulate here..."
                style={{ 
                  width: '100%', 
                  height: '150px', 
                  padding: '0.6rem', 
                  borderRadius: '6px', 
                  border: '1px solid #e2e8f0', 
                  fontFamily: 'monospace', 
                  fontSize: '0.8rem',
                  backgroundColor: historyEnabled ? '#fff' : '#f1f5f9',
                  resize: 'vertical'
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Execution Flow</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { id: 'preparing', label: '1. Preparing Context', data: stageData.preparing },
                { id: 'calling', label: '2. Calling Model API', data: stageData.calling },
                { id: 'receiving', label: '3. Streaming Response', data: stageData.receiving },
                { id: 'finished', label: '4. Loop Complete', data: null }
              ].map((step) => {
                const isActive = loopStage === step.id;
                const isExpanded = expandedStages[step.id];
                const hasData = !!step.data;

                return (
                  <div key={step.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ 
                      padding: '0.6rem 0.75rem', 
                      borderRadius: '6px', 
                      backgroundColor: isActive ? '#fff' : 'transparent',
                      border: `1px solid ${isActive ? '#bfdbfe' : '#e2e8f0'}`,
                      color: isActive ? '#1e40af' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: '0.8rem',
                      opacity: loopStage === 'idle' ? 0.5 : 1
                    }}>
                      <div style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        backgroundColor: isActive ? '#3b82f6' : (hasData ? '#10b981' : '#e2e8f0') 
                      }} />
                      {step.label}
                      
                      {hasData && (
                        <button 
                          onClick={() => toggleStageExpansion(step.id)}
                          style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >
                          {isExpanded ? 'HIDE' : 'INSPECT'}
                        </button>
                      )}
                    </div>
                    
                    {isExpanded && hasData && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        {step.id === 'calling' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowFullPrompt(!showFullPrompt); }}
                            style={{ alignSelf: 'flex-start', fontSize: '0.6rem', padding: '0.1rem 0.3rem', backgroundColor: '#334155', color: '#e2e8f0', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                          >
                            {showFullPrompt ? 'HIDE PROMPT CONTENT' : 'SHOW FULL PROMPT'}
                          </button>
                        )}
                        <div style={{ 
                          padding: '0.6rem', 
                          backgroundColor: '#1e293b', 
                          color: '#e2e8f0', 
                          fontSize: '0.7rem', 
                          fontFamily: 'monospace', 
                          borderRadius: '6px',
                          maxHeight: '150px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {step.id === 'calling' ? (
                            JSON.stringify({
                              ...step.data,
                              body: {
                                ...step.data.body,
                                message: showFullPrompt ? step.data.body.message : '[PROMPT_CONTEXT]'
                              }
                            }, null, 2)
                          ) : (
                            typeof step.data === 'string' ? step.data : JSON.stringify(step.data, null, 2)
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#fff', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isWaitingForNext ? (
            <button 
              onClick={() => nextStepAction?.()}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)' }}
            >NEXT STEP →</button>
          ) : (
            <button 
              onClick={() => { setMessages([]); setLoopStage('idle'); setStageData({}); setHistoryText(''); }} 
              style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }}
            >Reset Loop & History</button>
          )}
        </div>
      </section>

      {/* RIGHT PANEL - Chat View */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>CHAT VIEW</h2>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{activeProfile.name} • {activeProfile.model || 'default'}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {messages.length > 0 ? (
              <>
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
                      {msg.content || (chatStatus === 'loading' && i === messages.length - 1 ? '...' : '')}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0' }}>READY</div>
                <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  Send a message to execute the runtime loop.
                </div>
              </div>
            )}
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
                disabled={isWaitingForNext}
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
                  backgroundColor: isWaitingForNext ? '#f8fafc' : '#fff',
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
                  disabled={isWaitingForNext}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', border: 'none', backgroundColor: '#3b82f6', color: 'white', cursor: isWaitingForNext ? 'not-allowed' : 'pointer', borderRadius: '6px', width: '28px', height: '28px' }}
                >↑</button>
              )}
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
