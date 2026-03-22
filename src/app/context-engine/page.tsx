'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  RuntimeEngine, 
  Message, 
  Override, 
  LoopStage, 
  RuntimeConfig, 
  assembleRequest 
} from '@/lib/runtime';

const PROFILES_KEY = 'agent_runtime_profiles';
const PREFIX_KEY = 'agent_runtime_prefix';

export default function ContextEngine() {
  const [activeProfile, setActiveProfile] = useState<RuntimeConfig | null>(null);
  const [prefix, setPrefix] = useState('You are a helpful AI assistant. Answer concisely.');
  const [prefixEnabled, setPrefixEnabled] = useState(true);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  
  // DATA STATES
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [overrides, setOverrides] = useState<Record<number, Override>>({});
  
  // UI STATES
  const [loopStage, setLoopStage] = useState<LoopStage>('idle');
  const [stageData, setStageData] = useState<any>({});
  const [stepMode, setStepMode] = useState(false);
  const [isWaitingForNext, setIsWaitingForNext] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [advancedMode, setAdvancedMode] = useState(false);
  const [viewingSnapshotIndex, setViewingSnapshotIndex] = useState<number | null>(null);
  
  // Section Collapse states
  const [prefixCollapsed, setPrefixCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  // Thinking/Reasoning states
  const [includeThinkingInContext, setIncludeThinkingInContext] = useState(false);
  const [expandedContextThinking, setExpandedContextThinking] = useState<Record<number, boolean>>({});
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});

  // Chat input
  const [input, setInput] = useState('');
  const [chatStatus, setChatStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // COMPUTED: Effective Context
  const effectiveContext = useMemo(() => {
    if (!historyEnabled) return [];
    let result: Message[] = [];
    transcript.forEach((msg, idx) => {
      const ovr = overrides[idx];
      if (!ovr?.excluded) {
        result.push({
          role: msg.role,
          content: ovr?.content !== undefined ? ovr.content : msg.content
        });
      }
    });
    return result;
  }, [transcript, overrides, historyEnabled]);

  const overrideCount = useMemo(() => {
    let count = 0;
    transcript.forEach((msg, idx) => {
      const ovr = overrides[idx];
      if (!ovr) return;
      
      if (ovr.excluded) {
        count++;
        return;
      }
      
      if (ovr.content !== undefined && ovr.content !== msg.content) {
        count++;
      }
      
      if (msg.reasoningContent && ovr.reasoningExcluded) {
        count++;
      }
      
      if (ovr.reasoningContent !== undefined && ovr.reasoningContent !== msg.reasoningContent) {
        count++;
      }
    });
    return count;
  }, [transcript, overrides]);
  const isDiffering = useMemo(() => overrideCount > 0, [overrideCount]);

  const engineRef = useRef<RuntimeEngine | null>(null);

  // Persistence
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

    // Initialize Engine
    engineRef.current = new RuntimeEngine((stage, data) => {
      setLoopStage(stage);
      if (stage === 'receiving' && typeof data === 'object') {
        const { content, reasoning, hasThinking } = data;
        setTranscript(prev => {
          const next = [...prev];
          if (next.length > 0) {
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: content,
              reasoningContent: reasoning || next[next.length - 1].reasoningContent
            };
          }
          return next;
        });
        setStageData((prev: any) => ({ ...prev, 
          receiving: content,
          hasThinking
        }));
      } else if (data) {
        setStageData((prev: any) => ({ ...prev, [stage]: data }));
      }
      setIsWaitingForNext(engineRef.current?.isWaitingForStep() || false);
    });
  }, []);

  useEffect(() => { localStorage.setItem(PREFIX_KEY, prefix); }, [prefix]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setStepMode(stepMode);
    }
  }, [stepMode]);

  // Auto-resize / scroll
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  // ACTIONS
  const resetOverrides = () => setOverrides({});
  const resetTurn = (idx: number) => setOverrides(prev => {
    const next = { ...prev };
    delete next[idx];
    return next;
  });
  const toggleStageExpansion = (stage: string) => setExpandedStages(prev => ({ ...prev, [stage]: !prev[stage] }));
  const handleHistoryEnabledChange = (enabled: boolean) => {
    setHistoryEnabled(enabled);
    if (!enabled) {
      setIncludeThinkingInContext(false);
      setHistoryCollapsed(true);
    }
  };
  const handlePrefixEnabledChange = (enabled: boolean) => {
    setPrefixEnabled(enabled);
    if (!enabled) {
      setPrefixCollapsed(true);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatStatus === 'loading' || !activeProfile || !engineRef.current) return;

    const currentInput = input;
    setInput('');
    setChatStatus('loading');
    setStageData({});

    try {
      // Assemble request for snapshot
      const { fullPromptText } = assembleRequest(transcript, currentInput, overrides, {
        prefix,
        prefixEnabled,
        historyEnabled,
        includeThinkingInContext
      });

      // Prepare transcript for streaming
      setTranscript(prev => [
        ...prev,
        { role: 'user', content: currentInput, contextSnapshot: fullPromptText },
        { role: 'assistant', content: '' }
      ]);

      await engineRef.current.run(
        activeProfile,
        currentInput,
        transcript,
        overrides,
        { prefix, prefixEnabled, historyEnabled, includeThinkingInContext }
      );

      setChatStatus('idle');
    } catch (err: any) {
      setChatStatus('error');
    } finally {
      setIsWaitingForNext(false);
    }
  };

  const StepUI = ({ id, label, data }: any) => {
    const isActive = loopStage === id;
    const isExpanded = expandedStages[id];
    const hasData = !!data;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ 
          padding: '0.6rem 0.75rem', borderRadius: '6px', 
          backgroundColor: isActive ? '#fff' : 'transparent',
          border: `1px solid ${isActive ? '#bfdbfe' : '#e2e8f0'}`,
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          opacity: loopStage === 'idle' ? 0.5 : 1
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#3b82f6' : (hasData ? '#10b981' : '#e2e8f0') }} />
          <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 600 : 400, color: isActive ? '#1e40af' : '#64748b' }}>{label}</span>
          {hasData && (
            <button onClick={() => toggleStageExpansion(id)} style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {isExpanded ? 'HIDE' : 'INSPECT'}
            </button>
          )}
        </div>
        {isExpanded && hasData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {id === 'calling' && (
              <button onClick={() => setShowFullPrompt(!showFullPrompt)} style={{ alignSelf: 'flex-start', fontSize: '0.6rem', padding: '0.1rem 0.3rem', backgroundColor: '#334155', color: '#e2e8f0', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                {showFullPrompt ? 'HIDE PROMPT' : 'SHOW PROMPT'}
              </button>
            )}
            <pre style={{ 
              margin: 0, padding: '0.6rem', backgroundColor: '#1e293b', color: '#e2e8f0', 
              fontSize: '0.7rem', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', whiteSpace: 'pre-wrap'
            }}>
              {id === 'calling' ? (
                JSON.stringify({ ...data, body: { ...data.body, message: showFullPrompt ? data.body.message : '[PROMPT_CONTEXT]' } }, null, 2)
              ) : (
                typeof data === 'string' ? data : JSON.stringify(data, null, 2)
              )}
            </pre>
          </div>
        )}
      </div>
    );
  };

  if (!activeProfile) return <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'system-ui' }}><h2>Set up a profile in Configure & Test first.</h2></div>;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', backgroundColor: '#fdfdfd' }}>
      
      {/* LEFT: NEXT RUN CONTEXT */}
      <aside style={{ width: '480px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', flexShrink: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>NEXT RUN CONTEXT</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setAdvancedMode(!advancedMode)} style={{ fontSize: '0.7rem', cursor: 'pointer', background: 'none', border: '1px solid #e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              {advancedMode ? 'Standard' : 'Raw'}
            </button>
            <button onClick={resetOverrides} style={{ fontSize: '0.7rem', cursor: 'pointer', color: '#ef4444', background: 'none', border: '1px solid #fee2e2', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              Reset
            </button>
          </div>
        </div>

        {isDiffering && (
          <div style={{ padding: '0.5rem 1.5rem', backgroundColor: '#eff6ff', borderBottom: '1px solid #dbeafe', fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>
            Using transcript + {overrideCount} runtime overrides
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {/* PREFIX */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={prefixEnabled} onChange={e => handlePrefixEnabledChange(e.target.checked)} />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>PREFIX (SYSTEM PROMPT)</span>
              </div>
              <button onClick={() => setPrefixCollapsed(!prefixCollapsed)} disabled={!prefixEnabled} style={{ background: 'none', border: 'none', cursor: prefixEnabled ? 'pointer' : 'not-allowed', fontSize: '0.7rem', color: prefixEnabled ? '#94a3b8' : '#cbd5e1' }}>
                {prefixCollapsed ? 'EXPAND' : 'COLLAPSE'}
              </button>
            </div>
            {!prefixCollapsed && (
              <textarea 
                value={prefix} 
                onChange={e => setPrefix(e.target.value)} 
                style={{ width: '100%', minHeight: '60px', padding: '0.5rem', fontSize: '0.8rem', fontFamily: 'monospace', borderRadius: '4px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }} 
              />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={historyEnabled} onChange={e => handleHistoryEnabledChange(e.target.checked)} />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>ACTIVE CONTEXT CHAIN</span>
              </div>
              <button onClick={() => setHistoryCollapsed(!historyCollapsed)} disabled={!historyEnabled} style={{ background: 'none', border: 'none', cursor: historyEnabled ? 'pointer' : 'not-allowed', fontSize: '0.7rem', color: historyEnabled ? '#94a3b8' : '#cbd5e1' }}>
                {historyCollapsed ? 'EXPAND' : 'COLLAPSE'}
              </button>
            </div>
            
              {!historyCollapsed && historyEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={includeThinkingInContext} onChange={e => setIncludeThinkingInContext(e.target.checked)} />
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Include thinking in context</span>
                </div>
              )}
              
              {!historyCollapsed && (
                advancedMode ? (
                  <pre style={{ margin: 0, padding: '0.75rem', backgroundColor: '#1e293b', color: '#e2e8f0', borderRadius: '6px', fontSize: '0.7rem', whiteSpace: 'pre-wrap' }}>
                    {effectiveContext.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}
                  </pre>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {transcript.map((msg, idx) => {
                      const ovr = overrides[idx] || {};
                      const isUser = msg.role === 'user';
                      const isThinkingExcluded = !!ovr?.reasoningExcluded;
                      
                      if (isUser) {
                        return (
                          <div key={idx} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: ovr.excluded ? '#f1f5f9' : '#fff', opacity: ovr.excluded ? 0.6 : 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>USER (T-{idx})</span>
                              <button 
                                onClick={() => resetTurn(idx)}
                                style={{ fontSize: '0.7rem', cursor: 'pointer', color: '#ef4444', background: 'none', border: '1px solid #fee2e2', padding: '0.2rem 0.5rem', borderRadius: '4px' }}
                              >
                                Reset
                              </button>
                            </div>
                            <textarea 
                              value={ovr.content !== undefined ? ovr.content : msg.content}
                              onChange={(e) => setOverrides(prev => ({ ...prev, [idx]: { ...prev[idx], content: e.target.value } }))}
                              style={{ width: '100%', border: 'none', background: 'none', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', minHeight: '40px' }}
                            />
                            <button 
                              onClick={() => setOverrides(prev => ({ ...prev, [idx]: { ...prev[idx], excluded: !ovr?.excluded } }))}
                              style={{ fontSize: '0.65rem', cursor: 'pointer', marginTop: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem' }}
                            >
                              {ovr?.excluded ? 'INCLUDE' : 'EXCLUDE'}
                            </button>
                          </div>
                        );
                      }
                      
                      // Assistant message with thinking sub-item
                      return (
                        <div key={idx} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: ovr.excluded ? '#f1f5f9' : '#fff', opacity: ovr.excluded ? 0.6 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>ASSISTANT (T-{idx})</span>
                            <button 
                              onClick={() => resetTurn(idx)}
                              style={{ fontSize: '0.6rem', cursor: 'pointer', color: '#ef4444', background: 'none', border: 'none', fontWeight: 600 }}
                            >
                              Reset
                            </button>
                          </div>
                          
                          {/* Thinking sub-item - grey out when excluded */}
                          {msg.reasoningContent && includeThinkingInContext && (
                            <div style={{ marginBottom: '0.5rem', opacity: isThinkingExcluded ? 0.5 : 1 }}>
                              <button 
                                onClick={() => setExpandedContextThinking(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                style={{ 
                                  fontSize: '0.65rem', 
                                  color: '#94a3b8', 
                                  background: 'none', 
                                  border: 'none', 
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                {expandedContextThinking[idx] ? '▼' : '▶'} Thinking
                              </button>
                              {expandedContextThinking[idx] && (
                                <div style={{ marginTop: '0.25rem' }}>
                                  <textarea
                                    value={ovr.reasoningContent !== undefined ? ovr.reasoningContent : msg.reasoningContent}
                                    onChange={(e) => setOverrides(prev => ({ ...prev, [idx]: { ...prev[idx], reasoningContent: e.target.value } }))}
                                    style={{ 
                                      width: '100%', 
                                      border: 'none', 
                                      background: 'none', 
                                      fontSize: '0.8rem', 
                                      resize: 'vertical', 
                                      outline: 'none', 
                                      fontFamily: 'inherit', 
                                      minHeight: '40px',
                                      color: '#94a3b8',
                                      fontStyle: 'italic'
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        
                        {/* Content sub-item */}
                        <textarea
                          value={ovr.content !== undefined ? ovr.content : msg.content}
                          onChange={(e) => setOverrides(prev => ({ ...prev, [idx]: { ...prev[idx], content: e.target.value } }))}
                          style={{ width: '100%', border: 'none', background: 'none', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', minHeight: '40px' }}
                        />
                        
                          {/* Exclusion buttons */}
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem' }}>
                          <button 
                            onClick={() => setOverrides(prev => ({ ...prev, [idx]: { ...prev[idx], excluded: !ovr?.excluded, reasoningExcluded: !ovr?.excluded ? true : prev[idx]?.reasoningExcluded } }))}
                            style={{ fontSize: '0.65rem', cursor: 'pointer', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem' }}
                          >
                            {ovr?.excluded ? 'INCLUDE' : 'EXCLUDE'}
                          </button>
                          {msg.reasoningContent && includeThinkingInContext && (
                            <button 
                              onClick={() => setOverrides(prev => ({ ...prev, [idx]: { ...prev[idx], reasoningExcluded: !prev[idx]?.reasoningExcluded } }))}
                              style={{ fontSize: '0.65rem', cursor: 'pointer', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem' }}
                            >
                              {ovr?.reasoningExcluded ? 'INCLUDE THINKING' : 'EXCLUDE THINKING'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {transcript.length === 0 && <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No transcript yet.</div>}
                </div>
              )
            )}
          </div>
        </div>

        {/* EXECUTION FLOW */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>EXECUTION FLOW</span>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={stepMode} onChange={e => setStepMode(e.target.checked)} /> Step Mode
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <StepUI id="preparing" label="1. Preparing Context" data={stageData.preparing} />
            <StepUI id="calling" label="2. Calling Model API" data={stageData.calling} />
            <StepUI id="receiving" label="3. Streaming Response" data={stageData.receiving} />
            <StepUI id="finished" label="4. Loop Complete" data={null} />
          </div>
          {isWaitingForNext && (
            <button onClick={() => engineRef.current?.next()} style={{ width: '100%', marginTop: '1rem', padding: '0.6rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
              NEXT STEP →
            </button>
          )}
        </div>
      </aside>

      {/* RIGHT: TRANSCRIPT */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>CANONICAL TRANSCRIPT</h2>
            {(stepMode || !prefixEnabled || !historyEnabled || !includeThinkingInContext) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {stepMode && (
                  <span style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 700, padding: '0.15rem 0.4rem', backgroundColor: '#eff6ff', borderRadius: '4px' }}>
                    STEP MODE
                  </span>
                )}
                {!prefixEnabled && (
                  <span style={{ fontSize: '0.65rem', color: '#7c3aed', fontWeight: 600, padding: '0.15rem 0.4rem', backgroundColor: '#f5f3ff', borderRadius: '4px' }}>
                    System prompt excluded
                  </span>
                )}
                {!historyEnabled && (
                  <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 600, padding: '0.15rem 0.4rem', backgroundColor: '#fef2f2', borderRadius: '4px' }}>
                    History excluded
                  </span>
                )}
                {!includeThinkingInContext && (
                  <span style={{ fontSize: '0.65rem', color: '#d97706', fontWeight: 600, padding: '0.15rem 0.4rem', backgroundColor: '#fffbeb', borderRadius: '4px' }}>
                    Thinking excluded
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{activeProfile.name} • {activeProfile.model}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {transcript.map((msg, i) => {
              const ovr = overrides[i];
              const isUser = msg.role === 'user';
              const showSnapshot = viewingSnapshotIndex === i;
              const isExcluded = !!ovr?.excluded;
              const isContentEdited = ovr?.content !== undefined;
              const isThinkingEdited = ovr?.reasoningContent !== undefined;
              const isThinkingExcluded = !!ovr?.reasoningExcluded;
              const hasContent = msg.content.length > 0;

              return (
                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ backgroundColor: isUser ? '#3b82f6' : '#1e293b', color: 'white', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.65rem', flexShrink: 0, marginTop: '4px' }}>
                    {isUser ? 'U' : 'AI'}
                  </div>
                  <div style={{ flex: 1 }}>
                    {/* REASONING/THINKING - above content, always shown */}
                    {msg.reasoningContent && hasContent && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <button
                          onClick={() => setExpandedThinking(prev => ({ ...prev, [i]: !prev[i] }))}
                          style={{
                            fontSize: '0.7rem',
                            color: '#94a3b8',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            textDecoration: isExcluded || isThinkingEdited || isThinkingExcluded ? 'line-through' : 'none'
                          }}
                        >
                          {expandedThinking[i] ? '▼' : '▶'} Thinking ({msg.reasoningContent.length} chars)
                        </button>
                        {expandedThinking[i] && (
                          <pre style={{
                            margin: '0.5rem 0',
                            padding: '0.5rem',
                            fontSize: '0.8rem',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            color: '#94a3b8',
                            fontStyle: 'italic',
                            textDecoration: isExcluded || isThinkingEdited || isThinkingExcluded ? 'line-through' : 'none'
                          }}>
                            {msg.reasoningContent}
                          </pre>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ 
                        whiteSpace: 'pre-wrap', 
                        lineHeight: 1.6, 
                        fontSize: '0.95rem', 
                        color: isExcluded || isContentEdited ? '#94a3b8' : '#334155',
                        textDecoration: isExcluded || isContentEdited ? 'line-through' : 'none',
                        flex: 1 
                      }}>
                        {msg.content || (chatStatus === 'loading' && i === transcript.length - 1 ? '...' : '')}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginLeft: '1rem' }}>
                        {isUser && msg.contextSnapshot && (
                          <button 
                            onClick={() => setViewingSnapshotIndex(showSnapshot ? null : i)}
                            style={{ fontSize: '0.65rem', color: '#3b82f6', background: 'none', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.2rem 0.4rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {showSnapshot ? 'HIDE CONTEXT' : 'VIEW CONTEXT'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SHOW OVERRIDE CONTENT BELOW CROSSED OUT ORIGINAL */}
                    {isThinkingEdited && !isThinkingExcluded && !isExcluded && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderLeft: '3px solid #d97706', backgroundColor: '#fffbeb', borderRadius: '0 4px 4px 0' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#b45309', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Thinking Override:</div>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          {ovr.reasoningContent}
                        </div>
                      </div>
                    )}

                    {isContentEdited && !isExcluded && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderLeft: '3px solid #f59e0b', backgroundColor: '#fffbeb', borderRadius: '0 4px 4px 0' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#b45309', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Response Override:</div>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.95rem', color: '#334155' }}>
                          {ovr.content}
                        </div>
                      </div>
                    )}

                    {isExcluded && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>
                        [ EXCLUDED FROM NEXT RUN ]
                      </div>
                    )}

                    {!isExcluded && isThinkingExcluded && msg.reasoningContent && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#d97706', fontWeight: 600 }}>
                        [ THINKING EXCLUDED FROM NEXT RUN ]
                      </div>
                    )}

                    {showSnapshot && isUser && msg.contextSnapshot && (
                      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Turn Context Snapshot:</div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.8rem', fontFamily: 'monospace', color: '#475569' }}>
                          {msg.contextSnapshot}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div style={{ padding: '2rem', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <form onSubmit={handleChat} style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Send message to model..."
                disabled={isWaitingForNext}
                rows={1}
                style={{ width: '100%', boxSizing: 'border-box', padding: '1rem 3.5rem 1rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', backgroundColor: isWaitingForNext ? '#f8fafc' : '#fff', minHeight: '52px', resize: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(e as any); } }}
              />
              <button type="submit" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', border: 'none', backgroundColor: '#0f172a', color: 'white', cursor: 'pointer', borderRadius: '6px', width: '28px', height: '28px' }}>↑</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
