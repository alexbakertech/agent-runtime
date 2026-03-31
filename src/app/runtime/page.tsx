'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRuntime, useProfiles, useSandbox } from '@/lib/state';
import type { Runtime, RunPhase, TraceItem, RunState, ToolDefinition } from '@/lib/runtime/types';
import { AgentRuntime, type ToolDefinition as AgentToolDefinition } from '@/lib/runtime/agent';
import { listFiles, deleteFile, uploadFile, readFile } from '@/lib/tools/file-storage';
import type { FileEntry } from '@/lib/tools/file-storage';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function ChatWorkspace({
  messages,
  input,
  onInputChange,
  onSubmit,
  isRunning,
  showThinking,
  thinking,
  canSubmit,
}: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isRunning: boolean;
  showThinking: boolean;
  thinking: string;
  canSubmit: boolean;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Runtime Workspace</div>
              <div style={{ fontSize: '0.85rem' }}>Select a runtime and send a message to start</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                
                return (
                  <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ 
                      backgroundColor: isUser ? '#3b82f6' : '#1e293b', 
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
                    }}>
                      {isUser ? 'U' : 'AI'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ 
                          whiteSpace: 'pre-wrap', 
                          lineHeight: 1.6, 
                          fontSize: '0.95rem', 
                          color: '#334155',
                          flex: 1
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {showThinking && thinking && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ 
                    backgroundColor: '#1e293b', 
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
                  }}>
                    AI
                  </div>
                  <div
                    style={{
                      flex: 1,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6,
                      fontSize: '0.95rem',
                      color: '#78350f',
                      fontStyle: 'italic',
                      backgroundColor: '#fef3c7',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                    }}
                  >
                    {thinking}
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '2rem', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSubmit) onSubmit(); } }}
              placeholder="Send message to runtime..."
              disabled={isRunning}
              rows={1}
              style={{
                flex: 1,
                padding: '1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '0.95rem',
                backgroundColor: isRunning ? '#f8fafc' : '#fff',
                resize: 'none',
                outline: 'none',
                minHeight: '52px',
              }}
            />
            <button
              onClick={onSubmit}
              disabled={!canSubmit || isRunning}
              style={{
                padding: '0 1rem',
                backgroundColor: !canSubmit || isRunning ? '#cbd5e1' : '#0f172a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: !canSubmit || isRunning ? 'not-allowed' : 'pointer',
                width: '52px',
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExecutionTrace({
  trace,
  isRunning,
  currentPhase,
}: {
  trace: TraceItem[];
  isRunning: boolean;
  currentPhase: RunPhase | null;
}) {
  const [expandedContexts, setExpandedContexts] = useState<Set<string>>(new Set());

  const getPhaseColor = (phase: RunPhase): string => {
    switch (phase) {
      case 'model_call': return '#6366f1';
      case 'ingest': return '#3b82f6';
      case 'plan': return '#8b5cf6';
      case 'act': return '#10b981';
      case 'evaluate': return '#f59e0b';
      case 'respond': return '#ef4444';
    }
  };

  const toggleContext = (itemId: string) => {
    setExpandedContexts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const formatMessages = (messagesJson: string): string => {
    try {
      const messages = JSON.parse(messagesJson);
      return messages.map((m: { role: string; content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> }, idx: number) => {
        const lines: string[] = [];
        lines.push(`── Message ${idx + 1} [${m.role.toUpperCase()}] ──`);
        
        if (m.content) {
          const truncated = m.content.length > 200 ? m.content.substring(0, 200) + '...' : m.content;
          lines.push(truncated);
        }
        
        if (m.tool_calls && m.tool_calls.length > 0) {
          lines.push('');
          m.tool_calls.forEach((tc, i) => {
            lines.push(`Tool Call ${i + 1}: ${tc.function.name}`);
            try {
              const args = JSON.parse(tc.function.arguments);
              lines.push(`  Arguments: ${JSON.stringify(args, null, 2)}`);
            } catch {
              lines.push(`  Arguments: ${tc.function.arguments}`);
            }
          });
        }
        
        return lines.join('\n');
      }).join('\n\n');
    } catch {
      return messagesJson;
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', padding: '0 1rem' }}>
        EXECUTION TRACE
      </h3>

      {trace.length === 0 && !isRunning && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.8rem' }}>
          Run the runtime to see execution trace.
        </div>
      )}

      {trace.map((item, index) => {
        const isModelCall = item.phase === 'model_call';
        
        return (
        <div
          key={item.id}
          style={{
            marginBottom: '0.75rem',
            padding: '0.75rem',
            backgroundColor: isModelCall ? '#eef2ff' : '#fff',
            borderRadius: '6px',
            border: isModelCall ? '2px solid #6366f1' : '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {isModelCall && (
              <span style={{ fontSize: '0.7rem', color: '#6366f1' }}>&#8594;</span>
            )}
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: getPhaseColor(item.phase),
              }}
            >
              {isModelCall ? 'model call' : item.phase}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
              {isModelCall ? `Send ${index + 1}` : `Step ${index + 1}`}
            </span>
            {isModelCall && item.modelInput && (
              <button
                onClick={() => toggleContext(item.id)}
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: '#4f46e5',
                  backgroundColor: '#e0e7ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '4px',
                  padding: '0.15rem 0.5rem',
                  cursor: 'pointer',
                }}
              >
                {expandedContexts.has(item.id) ? 'Hide Context' : 'View Context'}
              </button>
            )}
          </div>
          
          <div style={{ fontSize: '0.75rem', color: '#374151', marginBottom: '0.5rem' }}>
            {item.contextSummary}
          </div>
          
          {isModelCall && expandedContexts.has(item.id) && item.modelInput && (
            <div style={{ 
              marginBottom: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#f8fafc',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
            }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Messages Sent to Model ({JSON.parse(item.modelInput).length} messages)
              </div>
              <pre style={{ 
                margin: 0, 
                fontSize: '0.7rem', 
                fontFamily: 'monospace', 
                color: '#475569',
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                overflowY: 'auto',
              }}>
                {formatMessages(item.modelInput)}
              </pre>
            </div>
          )}
          
          {item.thinkingStream && (
            <div style={{ fontSize: '0.7rem', color: '#78350f', fontStyle: 'italic', marginBottom: '0.5rem' }}>
              {item.thinkingStream}
            </div>
          )}
          
          {item.toolCall && (
            <div style={{ fontSize: '0.7rem', padding: '0.5rem', backgroundColor: '#dcfce7', borderRadius: '4px', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 600 }}>Tool: {item.toolCall.name}</div>
              <div style={{ fontFamily: 'monospace' }}>{JSON.stringify(item.toolCall.arguments)}</div>
              {item.toolCall.result && <div style={{ marginTop: '0.25rem' }}>Result: {item.toolCall.result}</div>}
            </div>
          )}
          
          {item.responseStream && (
            <div style={{ fontSize: '0.75rem', padding: '0.5rem', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
              {item.responseStream}
            </div>
          )}
          
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.5rem' }}>
            {item.transitionReason}
          </div>
        </div>
        );
      })}

      {isRunning && currentPhase && (
        <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '6px', margin: '0 1rem', fontSize: '0.8rem', color: '#92400e' }}>
          Currently in phase: <strong>{currentPhase}</strong>
        </div>
      )}
    </div>
  );
}

function RuntimeSelector({ 
  runtimes, 
  activeRuntimeId, 
  onSelect,
}: { 
  runtimes: Runtime[]; 
  activeRuntimeId: string | null; 
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', margin: '0 0 0.75rem' }}>
        SELECT RUNTIME
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {runtimes.map((runtime) => (
          <div
            key={runtime.id}
            onClick={() => onSelect(runtime.id)}
            style={{
              padding: '0.6rem',
              backgroundColor: activeRuntimeId === runtime.id ? '#eff6ff' : '#fff',
              border: activeRuntimeId === runtime.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{runtime.name}</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
              {runtime.modelConfig.model} · {runtime.defaultTools.length} tools
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RuntimePage() {
  const { runtime, updateRuntime, setActiveRuntime } = useRuntime();
  const { profiles, activeProfile, setActiveProfile } = useProfiles();
  const { sandbox } = useSandbox();
  
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<RunPhase | null>(null);
  const [thinking, setThinking] = useState('');
  const [sandboxFiles, setSandboxFiles] = useState<FileEntry[]>([]);
  const [liveTrace, setLiveTrace] = useState<TraceItem[]>([]);
  const agentRef = useRef<AgentRuntime | null>(null);
  
  const isGlobalFile = (path: string) => path.startsWith('global/') || path.startsWith('global\\');
  const localFiles = sandboxFiles.filter(f => !isGlobalFile(f.path));
  const globalFiles = sandboxFiles.filter(f => isGlobalFile(f.path));
  
  const runState = runtime.runState;
  const activeRuntime = runtime.activeRuntimeId ? runtime.runtimes[runtime.activeRuntimeId] : null;
  const runtimes = Object.values(runtime.runtimes);
  const allowLocalFiles = activeRuntime?.runtimeFilesAccess !== 'disabled';
  const mountGlobal = activeRuntime?.sharedFilesAccess !== 'disabled';
  const localReadOnly = activeRuntime?.runtimeFilesAccess === 'readonly';
  const sharedReadOnly = activeRuntime?.sharedFilesAccess === 'readonly';

  const builtInTools = [
    { id: 'get_time', name: 'get_time', description: 'Returns the current system time' },
    { id: 'list_files', name: 'list_files', description: 'Lists files in the sandbox directory' },
    { id: 'read_file', name: 'read_file', description: 'Reads file content from sandbox' },
    { id: 'search_text', name: 'search_text', description: 'Searches for text in sandbox files' },
  ];

  const customToolsFromSandbox: ToolDefinition[] = (sandbox.customTools || [])
    .filter((t: { enabled: boolean }) => t.enabled)
    .map((t: { id: string; name: string; description: string }) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      inputSchema: {},
    }));

  const allToolDefinitions = [...builtInTools, ...customToolsFromSandbox];
  const availableToolNames = allToolDefinitions.map(t => t.name);
  const effectiveActiveTools = activeRuntime?.defaultTools || [];

  const loadSandboxFiles = useCallback(async () => {
    try {
      const { getAllFiles } = await import('@/lib/tools/file-storage');
      const files = await getAllFiles();
      setSandboxFiles(files.map(f => ({ path: f.path, name: f.name, type: f.type, lastModified: f.lastModified })));
    } catch (err) {
      console.error('Failed to load sandbox files:', err);
    }
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, isGlobal: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const { uploadFile } = await import('@/lib/tools/file-storage');
      const basePath = isGlobal ? 'global/' : '';
      await uploadFile(file, basePath);
      loadSandboxFiles();
    } catch (err) {
      console.error('Failed to upload file:', err);
      alert('Failed to upload file');
    }
  }, [loadSandboxFiles]);

  const handleFileDelete = useCallback(async (path: string) => {
    if (!confirm(`Delete file "${path}"?`)) return;
    
    try {
      const { deleteFile } = await import('@/lib/tools/file-storage');
      await deleteFile(path);
      loadSandboxFiles();
    } catch (err) {
      console.error('Failed to delete file:', err);
      alert('Failed to delete file');
    }
  }, [loadSandboxFiles]);

  useEffect(() => {
    loadSandboxFiles();
  }, [loadSandboxFiles]);

  useEffect(() => {
    if (activeRuntime?.profileId) {
      setActiveProfile(activeRuntime.profileId);
    }
  }, [activeRuntime?.profileId, setActiveProfile]);

  const simulateRun = useCallback(async () => {
    if (!activeRuntime || !input.trim()) return;
    
    const profile = activeRuntime.profileId 
      ? profiles.find(p => p.id === activeRuntime.profileId)
      : activeProfile;
    if (!profile) {
      alert('Please select a profile in the Connections page first.');
      return;
    }
    
    setIsRunning(true);
    const userInput = input.trim();
    setInput('');
    setLiveTrace([]);
    
    const runId = generateId();
    
    const newRunState: RunState = {
      runId,
      runtimeId: activeRuntime.id,
      messages: [{ role: 'user', content: userInput }],
      phase: 'ingest',
      stepCount: 0,
      toolCallCount: 0,
      activeTools: effectiveActiveTools,
      trace: [],
      sandboxSnapshot: {},
      status: 'running',
    };
    
    updateRuntime({ runState: newRunState });
    
    const toolDescriptions: Record<string, string> = {
      get_time: 'Returns the current system time including timestamp and timezone.',
      list_files: 'Lists all files in the sandbox directory.',
      read_file: 'Reads the content of a file in the sandbox. Requires filePath parameter.',
      search_text: 'Searches for text matching a pattern in sandbox files. Requires pattern parameter.',
      remember_for_next_run: 'Persist context for the next run. Use this to carry forward important information. Requires content parameter.',
    };
    
    const toolDefs: AgentToolDefinition[] = effectiveActiveTools.map(toolName => {
      let params: { type: string; properties: Record<string, object>; required?: string[] } = { type: 'object', properties: {} };
      
      if (toolName === 'read_file') {
        params.properties = { filePath: { type: 'string', description: 'The path to the file to read' } };
        params.required = ['filePath'];
      } else if (toolName === 'search_text') {
        params.properties = { 
          pattern: { type: 'string', description: 'The text pattern to search for' },
          dirPath: { type: 'string', description: 'Optional directory to search in' }
        };
        params.required = ['pattern'];
      } else if (toolName === 'list_files') {
        params.properties = { dirPath: { type: 'string', description: 'Optional directory path to list' } };
      } else if (toolName === 'remember_for_next_run') {
        params.properties = { content: { type: 'string', description: 'The content to remember for the next run' } };
        params.required = ['content'];
      }
      
      return {
        type: 'function',
        function: {
          name: toolName,
          description: toolDescriptions[toolName] || `Execute ${toolName}`,
          parameters: params,
        },
      };
    });
    
    const agent = new AgentRuntime((stage, data) => {
      const phaseMap: Record<string, RunPhase> = {
        preparing: 'ingest',
        calling: 'model_call',
        receiving: 'plan',
        act: 'act',
        evaluate: 'evaluate',
        finished: 'respond',
        error: 'respond',
      };
      setCurrentPhase(phaseMap[stage] || 'ingest');
      
      if (stage === 'calling') {
        const toolCalls = data?.toolCalls as Array<{ id: string; name: string; arguments: string }> | undefined;
        const messages = data?.messages as Array<{ role: string; content?: string }> | undefined;
        const promptType = data?.promptType as string | undefined;
        
        // Model Call block - context being sent to the model
        if (!toolCalls && messages && messages.length > 0) {
          setLiveTrace(prev => {
            const modelCallItem: TraceItem = {
              id: generateId(),
              stepId: generateId(),
              phase: 'model_call',
              previousPhase: 'ingest',
              nextPhase: 'plan',
              contextSummary: promptType === 'plan' 
                ? 'Sending user input to model' 
                : 'Sending tool results to model for evaluation',
              modelInput: JSON.stringify(messages, null, 2),
              transitionReason: promptType === 'plan'
                ? 'Model call with initial context'
                : 'Model call with tool execution results',
              timestamp: new Date().toISOString(),
            };
            return [...prev, modelCallItem];
          });
        }
        
        // Model response with tool_calls - create a plan item showing what model decided
        if (toolCalls && toolCalls.length > 0) {
          const modelResponse = data?.modelResponse as { content: string; toolCalls: Array<{ name: string; arguments: string }> } | undefined;
          setLiveTrace(prev => {
            // Check if we already have a plan item for this step
            if (prev.some(t => t.phase === 'plan')) return prev;
            const planItem: TraceItem = {
              id: generateId(),
              stepId: generateId(),
              phase: 'plan',
              previousPhase: 'model_call',
              nextPhase: 'act',
              contextSummary: `Model decided to use ${toolCalls.length} tool call(s)`,
              transitionReason: 'Model response: tool calls requested',
              timestamp: new Date().toISOString(),
            };
            return [...prev, planItem];
          });
        }
      }
      
      if (stage === 'act' && data) {
        setLiveTrace(prev => {
          if (prev.some(t => t.phase === 'act' && t.toolCall?.name === data.toolCall)) return prev;
          const actItem: TraceItem = {
            id: generateId(),
            stepId: generateId(),
            phase: 'act',
            previousPhase: 'plan',
            nextPhase: 'evaluate',
            contextSummary: `Executing tool: ${data.toolCall}`,
            toolCall: {
              id: generateId(),
              name: data.toolCall,
              arguments: data.arguments || {},
              result: data.result,
            },
            toolResult: data.result,
            transitionReason: 'Tool execution in progress',
            timestamp: new Date().toISOString(),
          };
          return [...prev, actItem];
        });
      }
      
      if (stage === 'evaluate' && data) {
        setLiveTrace(prev => {
          if (prev.some(t => t.phase === 'evaluate' && t.toolCall?.name === data.toolCall)) return prev;
          const evalItem: TraceItem = {
            id: generateId(),
            stepId: generateId(),
            phase: 'evaluate',
            previousPhase: 'act',
            nextPhase: 'model_call',
            contextSummary: `Evaluated result from ${data.toolCall}`,
            evaluationResult: data.result,
            transitionReason: 'Tool result evaluated, ready for next model call',
            timestamp: new Date().toISOString(),
          };
          return [...prev, evalItem];
        });
      }
      
      if (stage === 'receiving' && data) {
        if (data.content) {
          setThinking(data.content);
        }
      }
      
      if (stage === 'finished' && data) {
        setThinking('');
        
        if (data.content) {
          setLiveTrace(prev => {
            const respondItem: TraceItem = {
              id: generateId(),
              stepId: generateId(),
              phase: 'respond',
              contextSummary: 'Generated user-facing response',
              responseStream: data.content,
              transitionReason: data.toolCallCount > 0 
                ? `Completed after ${data.toolCallCount} tool call(s)` 
                : 'Direct response',
              timestamp: new Date().toISOString(),
            };
            return [...prev, respondItem];
          });
        }
      }
    });
    
    const customToolImplementations = (sandbox.customTools || [])
      .filter((t: { enabled: boolean }) => t.enabled)
      .map((t: { name: string; code: string }) => ({
        name: t.name,
        code: t.code,
      }));
    
    agent.setOptions({
      tools: toolDefs,
      customTools: customToolImplementations,
      maxToolCalls: activeRuntime.loopLimits.maxToolCalls,
      prompts: activeRuntime.prompts,
      fileAccess: {
        runtimeFilesAccess: activeRuntime.runtimeFilesAccess || 'readwrite',
        sharedFilesAccess: activeRuntime.sharedFilesAccess || 'readwrite',
      },
    });
    
    agentRef.current = agent;
    
    try {
      const result = await agent.run(
        {
          baseUrl: profile.baseUrl,
          apiKey: profile.apiKey,
          model: profile.model,
          temperature: activeRuntime.modelConfig.temperature,
          maxTokens: activeRuntime.modelConfig.maxTokens,
        },
        userInput,
        [],
        {},
        {
          prefix: activeRuntime.systemPrompt,
          prefixEnabled: true,
          historyEnabled: false,
          includeThinkingInContext: activeRuntime.displayConfig.showThinking,
        },
        sandboxFiles
      );
      
      const finalRunState: RunState = {
        runId,
        runtimeId: activeRuntime.id,
        messages: [
          { role: 'user', content: userInput },
          { role: 'assistant', content: result.content },
        ],
        phase: 'respond',
        stepCount: 1,
        toolCallCount: result.toolCallCount,
        activeTools: effectiveActiveTools,
        trace: liveTrace,
        sandboxSnapshot: {},
        status: 'completed',
        finalOutput: result.content,
      };
      
      updateRuntime({ runState: finalRunState });
      
    } catch (err: any) {
      console.error('[RuntimePage] Error:', err);
      const errorTrace: TraceItem = {
        id: generateId(),
        stepId: generateId(),
        phase: 'respond',
        contextSummary: 'Error occurred',
        responseStream: `Error: ${err.message}`,
        transitionReason: 'Run failed',
        timestamp: new Date().toISOString(),
      };
      setLiveTrace(prev => [...prev, errorTrace]);
      
      const errorRunState: RunState = {
        ...newRunState,
        messages: [
          { role: 'user', content: userInput },
          { role: 'assistant', content: `Error: ${err.message}` },
        ],
        phase: 'respond',
        trace: liveTrace,
        status: 'failed',
        finalOutput: err.message,
      };
      
      updateRuntime({ runState: errorRunState });
    }
    
    setIsRunning(false);
    setCurrentPhase(null);
    agentRef.current = null;
  }, [activeRuntime, input, effectiveActiveTools, profiles, sandboxFiles, updateRuntime]);

  const canSubmit = !!activeProfile && !!input.trim() && !isRunning && !!activeRuntime;

  if (!activeProfile) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2>Set up a profile in Connections first.</h2>
        <p style={{ color: '#64748b' }}>Go to /connections to configure your API profile.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', color: '#1a1a1a', backgroundColor: '#fdfdfd' }}>
      <aside style={{ width: '280px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        {/* First third: Runtime Selector */}
        <div style={{ flex: 1 }}>
          <RuntimeSelector
            runtimes={runtimes}
            activeRuntimeId={runtime.activeRuntimeId}
            onSelect={setActiveRuntime}
          />
          
          {activeRuntime && (
            <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
                ACTIVE RUNTIME
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{activeRuntime.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                {activeRuntime.modelConfig.model}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                {effectiveActiveTools.length} tools enabled
              </div>
            </div>
          )}
        </div>
        
        {/* Second third: Runtime-local files */}
        <div style={{ flex: 1, marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', opacity: allowLocalFiles ? 1 : 0.5 }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', margin: 0 }}>
                RUNTIME FILES
              </h3>
              {!allowLocalFiles && (
                <span style={{ fontSize: '0.6rem', backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 600 }}>
                  DISABLED
                </span>
              )}
              {allowLocalFiles && localReadOnly && (
                <span style={{ fontSize: '0.6rem', backgroundColor: '#fef3c7', color: '#92400e', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 600 }}>
                  READ ONLY
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              Only this runtime can access
            </div>
          </div>
          {allowLocalFiles && !localReadOnly && (
              <label style={{ 
                fontSize: '0.65rem', 
                cursor: 'pointer', 
                backgroundColor: '#3b82f6', 
                color: '#fff', 
                padding: '0.15rem 0.4rem', 
                borderRadius: '4px',
                fontWeight: 600,
              }}>
                + Add
                <input 
                  type="file" 
                  onChange={(e) => handleFileUpload(e, false)} 
                  style={{ display: 'none' }} 
              />
            </label>
            )}

          {localFiles.length === 0 ? (
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', padding: '0.5rem' }}>
              No local files
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflowY: 'auto', flex: 1 }}>
              {localFiles.map((file) => (
                <div 
                  key={file.path}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0.3rem 0.4rem',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.7rem',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                    {file.name}
                  </span>
                  {!localReadOnly && (
                    <button
                      onClick={() => handleFileDelete(file.path)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.65rem',
                        padding: '0.1rem 0.2rem',
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Third: Global files */}
        <div style={{ flex: 1, marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', opacity: mountGlobal ? 1 : 0.5 }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', margin: 0 }}>
                SHARED FILES
              </h3>
              {!mountGlobal && (
                <span style={{ fontSize: '0.6rem', backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 600 }}>
                  DISABLED
                </span>
              )}
              {mountGlobal && sharedReadOnly && (
                <span style={{ fontSize: '0.6rem', backgroundColor: '#fef3c7', color: '#92400e', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 600 }}>
                  READ ONLY
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              All runtimes can access
            </div>
          </div>
          {mountGlobal && !sharedReadOnly && (
              <label style={{ 
                fontSize: '0.65rem', 
                cursor: 'pointer', 
                backgroundColor: '#8b5cf6', 
                color: '#fff', 
                padding: '0.15rem 0.4rem', 
                borderRadius: '4px',
                fontWeight: 600,
              }}>
                + Add
                <input 
                  type="file" 
                  onChange={(e) => handleFileUpload(e, true)} 
                  style={{ display: 'none' }} 
              />
            </label>
            )}

          {globalFiles.length === 0 ? (
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', padding: '0.5rem' }}>
              No shared files
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflowY: 'auto', flex: 1 }}>
              {globalFiles.map((file) => (
                <div 
                  key={file.path}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0.3rem 0.4rem',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.7rem',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                    {file.name}
                  </span>
                  {!sharedReadOnly && (
                    <button
                      onClick={() => handleFileDelete(file.path)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.65rem',
                        padding: '0.1rem 0.2rem',
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0' }}>
        <ChatWorkspace
          messages={runState?.messages || []}
          input={input}
          onInputChange={setInput}
          onSubmit={simulateRun}
          isRunning={isRunning}
          showThinking={!!activeRuntime?.displayConfig.showThinking}
          thinking={thinking}
          canSubmit={canSubmit}
        />
      </main>
      
      <aside style={{ width: '340px', backgroundColor: '#fafafa', padding: '1rem', overflowY: 'auto' }}>
        <ExecutionTrace
          trace={liveTrace}
          isRunning={isRunning}
          currentPhase={currentPhase}
        />
      </aside>
    </div>
  );
}
