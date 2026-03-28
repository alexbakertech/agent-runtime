'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRuntime, useProfiles, useSandbox } from '@/lib/state';
import type { Runtime, RunPhase, TraceItem, ToolCall, RunState, ToolDefinition } from '@/lib/runtime/types';
import { listFiles, deleteFile, uploadFile, readFile } from '@/lib/tools/file-storage';
import type { FileEntry } from '@/lib/tools/file-storage';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function CollapsibleSection({ title, children, defaultExpanded = false }: { title: string; children: React.ReactNode; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <div style={{ borderTop: '1px solid #e2e8f0' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 1rem',
          backgroundColor: '#f1f5f9',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#475569',
        }}
      >
        <span>{title}</span>
        <span>{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && <div style={{ padding: '0.75rem' }}>{children}</div>}
    </div>
  );
}

function RuntimeSelector({ 
  runtimes, 
  activeRuntimeId, 
  onSelect, 
  onCreate,
  onDelete,
}: { 
  runtimes: Runtime[]; 
  activeRuntimeId: string | null; 
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', margin: 0 }}>
          RUNTIMES
        </h2>
        <button
          onClick={onCreate}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New
        </button>
      </div>
      
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{runtime.name}</div>
              {runtimes.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(runtime.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0 0.25rem',
                  }}
                  title="Delete runtime"
                >
                  ×
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
              {runtime.modelConfig.model} · {runtime.defaultTools.length} tools
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuntimeEditor({ 
  runtime, 
  onChange,
  availableTools,
  disabled,
  profiles,
  activeProfileId,
  onProfileChange,
}: { 
  runtime: Runtime | null; 
  onChange: (updates: Partial<Runtime>) => void;
  availableTools: string[];
  disabled: boolean;
  profiles: { id: string; name: string; model: string }[];
  activeProfileId: string | null;
  onProfileChange: (profileId: string) => void;
}) {
  if (!runtime) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Runtime Name
        </label>
        <input
          type="text"
          value={runtime.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.85rem',
            backgroundColor: '#fff',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Profile
        </label>
        <select
          value={runtime.profileId || ''}
          onChange={(e) => onChange({ profileId: e.target.value || undefined })}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '0.4rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.8rem',
            backgroundColor: '#fff',
          }}
        >
          <option value="">Select a profile...</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name} ({profile.model})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          System Prompt
        </label>
        <textarea
          value={runtime.systemPrompt}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          disabled={disabled}
          rows={3}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            resize: 'vertical',
            backgroundColor: '#fff',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Temperature
          </label>
          <input
            type="number"
            value={runtime.modelConfig.temperature}
            onChange={(e) => onChange({ modelConfig: { ...runtime.modelConfig, temperature: parseFloat(e.target.value) } })}
            disabled={disabled}
            min={0}
            max={2}
            step={0.1}
            style={{
              width: '100%',
              padding: '0.4rem',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              fontSize: '0.8rem',
              backgroundColor: '#fff',
            }}
          />
        </div>
        
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Max Tokens
          </label>
          <input
            type="number"
            value={runtime.modelConfig.maxTokens}
            onChange={(e) => onChange({ modelConfig: { ...runtime.modelConfig, maxTokens: parseInt(e.target.value) } })}
            disabled={disabled}
            min={100}
            max={100000}
            step={100}
            style={{
              width: '100%',
              padding: '0.4rem',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              fontSize: '0.8rem',
              backgroundColor: '#fff',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Max Steps
          </label>
          <input
            type="number"
            value={runtime.loopLimits.maxSteps}
            onChange={(e) => onChange({ loopLimits: { ...runtime.loopLimits, maxSteps: parseInt(e.target.value) } })}
            disabled={disabled}
            min={1}
            max={100}
            style={{
              width: '100%',
              padding: '0.4rem',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              fontSize: '0.8rem',
              backgroundColor: '#fff',
            }}
          />
        </div>
        
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Max Tool Calls
          </label>
          <input
            type="number"
            value={runtime.loopLimits.maxToolCalls}
            onChange={(e) => onChange({ loopLimits: { ...runtime.loopLimits, maxToolCalls: parseInt(e.target.value) } })}
            disabled={disabled}
            min={1}
            max={100}
            style={{
              width: '100%',
              padding: '0.4rem',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              fontSize: '0.8rem',
              backgroundColor: '#fff',
            }}
          />
        </div>
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>
          Default Tools
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {availableTools.map((tool) => (
            <label key={tool} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={runtime.defaultTools.includes(tool)}
                onChange={(e) => {
                  const newTools = e.target.checked
                    ? [...runtime.defaultTools, tool]
                    : runtime.defaultTools.filter(t => t !== tool);
                  onChange({ defaultTools: newTools });
                }}
                disabled={disabled}
              />
              {tool}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={runtime.displayConfig.showThinking}
            onChange={(e) => onChange({ displayConfig: { showThinking: e.target.checked } })}
            disabled={disabled}
          />
          Show Thinking Stream
        </label>
      </div>
    </div>
  );
}

function SandboxView({ 
  files, 
  onUpload, 
  onDeleteFile,
}: { 
  files: FileEntry[];
  onUpload: (files: FileList) => void;
  onDeleteFile: (path: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');

  const handleFileClick = async (path: string) => {
    setSelectedFile(path);
    try {
      const entry = await readFile(path);
      setFileContent(entry?.content || '(binary or unreadable)');
    } catch {
      setFileContent('(binary or unreadable)');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', margin: 0 }}>
          SANDBOX
        </h3>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && onUpload(e.target.files)}
            multiple
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '0.2rem 0.4rem',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Upload
          </button>
        </div>
      </div>
      
      {files.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '1rem', textAlign: 'center' }}>
          No files in sandbox<br />
          <span style={{ fontSize: '0.7rem' }}>Click Upload to add files</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1, fontSize: '0.75rem', fontFamily: 'monospace', maxHeight: '150px', overflowY: 'auto' }}>
            {files.map((file) => (
              <div 
                key={file.path} 
                style={{ 
                  padding: '0.25rem 0', 
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span 
                  onClick={() => handleFileClick(file.path)}
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  {file.type === 'directory' ? '📁 ' : '📄 '}{file.path}
                </span>
                <button
                  onClick={() => onDeleteFile(file.path)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    padding: '0 0.25rem',
                  }}
                  title="Delete file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedFile && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
            {selectedFile}
          </div>
          <textarea
            value={fileContent}
            readOnly
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              resize: 'vertical',
              backgroundColor: '#f8fafc',
            }}
          />
        </div>
      )}
    </div>
  );
}

function ChatWorkspace({
  messages,
  input,
  onInputChange,
  onSubmit,
  isRunning,
  toolRegistry,
  activeTools,
  onToolToggle,
  showThinking,
  thinking,
  canSubmit,
  contextSnapshots,
}: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isRunning: boolean;
  toolRegistry: { name: string; description: string }[];
  activeTools: string[];
  onToolToggle: (toolName: string) => void;
  showThinking: boolean;
  thinking: string;
  canSubmit: boolean;
  contextSnapshots: Record<number, string>;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [viewingSnapshotIndex, setViewingSnapshotIndex] = useState<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Chat Workspace</div>
              <div style={{ fontSize: '0.85rem' }}>Send a message to start a run</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const showSnapshot = viewingSnapshotIndex === i;
                
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
                      <div style={{ 
                        whiteSpace: 'pre-wrap', 
                        lineHeight: 1.6, 
                        fontSize: '0.95rem', 
                        color: '#334155'
                      }}>
                        {msg.content}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: '0.5rem' }}>
                        {isUser && contextSnapshots[i] && (
                          <button 
                            onClick={() => setViewingSnapshotIndex(showSnapshot ? null : i)}
                            style={{ fontSize: '0.65rem', color: '#3b82f6', background: 'none', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.2rem 0.4rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {showSnapshot ? 'HIDE CONTEXT' : 'VIEW CONTEXT'}
                          </button>
                        )}
                      </div>

                      {showSnapshot && isUser && contextSnapshots[i] && (
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Turn Context Snapshot:</div>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.8rem', fontFamily: 'monospace', color: '#475569' }}>
                            {contextSnapshots[i]}
                          </pre>
                        </div>
                      )}
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
                    💭 {thinking}
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <CollapsibleSection title="Tool Controls" defaultExpanded={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {toolRegistry.map((tool) => (
            <label key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={activeTools.includes(tool.name)}
                onChange={() => onToolToggle(tool.name)}
                disabled={isRunning}
              />
              <span style={{ fontWeight: 500 }}>{tool.name}</span>
              <span style={{ color: '#64748b' }}>- {tool.description}</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      <div style={{ padding: '2rem', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSubmit) onSubmit(); } }}
              placeholder="Send message to model..."
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
  const getPhaseColor = (phase: RunPhase): string => {
    switch (phase) {
      case 'ingest': return '#3b82f6';
      case 'plan': return '#8b5cf6';
      case 'act': return '#10b981';
      case 'evaluate': return '#f59e0b';
      case 'respond': return '#ef4444';
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

      {trace.map((item, index) => (
        <div
          key={item.id}
          style={{
            marginBottom: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: getPhaseColor(item.phase),
              }}
            >
              {item.phase}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
              Step {index + 1}
            </span>
          </div>
          
          <div style={{ fontSize: '0.75rem', color: '#374151', marginBottom: '0.5rem' }}>
            {item.contextSummary}
          </div>
          
          {item.thinkingStream && (
            <div style={{ fontSize: '0.7rem', color: '#78350f', fontStyle: 'italic', marginBottom: '0.5rem' }}>
              💭 {item.thinkingStream}
            </div>
          )}
          
          {item.toolCall && (
            <div style={{ fontSize: '0.7rem', padding: '0.5rem', backgroundColor: '#dcfce7', borderRadius: '4px', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 600 }}>🔧 Tool: {item.toolCall.name}</div>
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
      ))}

      {isRunning && currentPhase && (
        <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '6px', margin: '0 1rem', fontSize: '0.8rem', color: '#92400e' }}>
          🔄 Currently in phase: <strong>{currentPhase}</strong>
        </div>
      )}
    </div>
  );
}

export default function RuntimeBuilder() {
  const { runtime, updateRuntime, setActiveRuntime, startRun, stopRun } = useRuntime();
  const { profiles, activeProfile, setActiveProfile } = useProfiles();
  const { sandbox } = useSandbox();
  
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<RunPhase | null>(null);
  const [thinking, setThinking] = useState('');
  const [activeToolsOverride, setActiveToolsOverride] = useState<string[]>([]);
  const [sandboxFiles, setSandboxFiles] = useState<FileEntry[]>([]);
  const [contextSnapshots, setContextSnapshots] = useState<Record<number, string>>({});
  
  const runState = runtime.runState;
  const activeRuntime = runtime.activeRuntimeId ? runtime.runtimes[runtime.activeRuntimeId] : null;
  const runtimes = Object.values(runtime.runtimes);

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
  const toolRegistry = allToolDefinitions.map(t => ({ name: t.name, description: t.description }));
  const availableToolNames = allToolDefinitions.map(t => t.name);

  const effectiveActiveTools = activeToolsOverride.length > 0 ? activeToolsOverride : (activeRuntime?.defaultTools || []);

  const loadSandboxFiles = useCallback(async () => {
    try {
      const files = await listFiles('.');
      setSandboxFiles(files);
    } catch (err) {
      console.error('Failed to load sandbox files:', err);
    }
  }, []);

  useEffect(() => {
    loadSandboxFiles();
  }, [loadSandboxFiles]);

  useEffect(() => {
    if (activeRuntime?.profileId) {
      setActiveProfile(activeRuntime.profileId);
    }
  }, [activeRuntime?.profileId, setActiveProfile]);

  const handleCreateRuntime = () => {
    const now = new Date().toISOString();
    const newRuntime: Runtime = {
      id: generateId(),
      name: 'New Runtime',
      systemPrompt: 'You are a helpful AI assistant.',
      modelConfig: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048,
      },
      defaultTools: [],
      loopLimits: {
        maxSteps: 10,
        maxToolCalls: 20,
      },
      displayConfig: {
        showThinking: true,
      },
      profileId: profiles[0]?.id,
      createdAt: now,
      updatedAt: now,
    };
    updateRuntime({
      runtimes: { ...runtime.runtimes, [newRuntime.id]: newRuntime },
      activeRuntimeId: newRuntime.id,
    });
    if (profiles[0]) {
      setActiveProfile(profiles[0].id);
    }
  };

  const handleDeleteRuntime = (id: string) => {
    if (runtimes.length <= 1) return;
    const newRuntimes = { ...runtime.runtimes };
    delete newRuntimes[id];
    const newActiveId = runtime.activeRuntimeId === id 
      ? Object.keys(newRuntimes)[0] 
      : runtime.activeRuntimeId;
    updateRuntime({
      runtimes: newRuntimes,
      activeRuntimeId: newActiveId,
    });
  };

  const handleRuntimeChange = (updates: Partial<Runtime>) => {
    if (!activeRuntime) return;
    updateRuntime({
      runtimes: {
        ...runtime.runtimes,
        [activeRuntime.id]: { ...activeRuntime, ...updates, updatedAt: new Date().toISOString() },
      },
    });
  };

  const handleToolToggle = (toolName: string) => {
    setActiveToolsOverride(prev => 
      prev.includes(toolName) 
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  const handleUploadFiles = async (files: FileList) => {
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadFile(files[i]);
      }
      await loadSandboxFiles();
    } catch (err) {
      console.error('Failed to upload files:', err);
    }
  };

  const handleDeleteFile = async (path: string) => {
    try {
      await deleteFile(path);
      await loadSandboxFiles();
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const simulateRun = useCallback(async () => {
    if (!activeRuntime || !input.trim()) return;
    
    const profile = profiles.find(p => p.id === activeRuntime.profileId);
    
    setIsRunning(true);
    const userInput = input.trim();
    setInput('');
    
    const newRunState: RunState = {
      runId: generateId(),
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
    
    // Generate context snapshot for user message
    const contextSnapshot = `System: ${activeRuntime.systemPrompt}

Available tools: ${effectiveActiveTools.join(', ')}

User: ${userInput}`;
    const msgIndex = runState?.messages?.length || 0;
    setContextSnapshots({ [msgIndex]: contextSnapshot });
    
    // Ingest phase
    setCurrentPhase('ingest');
    await new Promise(r => setTimeout(r, 300));
    
    const traceIngest: TraceItem = {
      id: generateId(),
      stepId: generateId(),
      phase: 'ingest',
      contextSummary: 'Received user input',
      transitionReason: 'User message received',
      timestamp: new Date().toISOString(),
    };
    
    // Plan phase
    setCurrentPhase('plan');
    if (activeRuntime.displayConfig.showThinking) {
      setThinking('Analyzing the request to determine next action...');
    }
    await new Promise(r => setTimeout(r, 500));
    
    const tracePlan: TraceItem = {
      id: generateId(),
      stepId: generateId(),
      phase: 'plan',
      previousPhase: 'ingest',
      nextPhase: 'act',
      contextSummary: 'Determined need to call a tool',
      thinkingStream: activeRuntime.displayConfig.showThinking ? 'I should use the get_time tool to provide current information.' : undefined,
      transitionReason: 'Model decided to call a tool',
      timestamp: new Date().toISOString(),
    };
    setThinking('');
    
    // Act phase
    setCurrentPhase('act');
    const toolCall: ToolCall = {
      id: generateId(),
      name: 'get_time',
      arguments: {},
      result: new Date().toISOString(),
    };
    
    const traceAct: TraceItem = {
      id: generateId(),
      stepId: generateId(),
      phase: 'act',
      previousPhase: 'plan',
      toolCall,
      toolResult: toolCall.result,
      contextSummary: `Executed tool: ${toolCall.name}`,
      transitionReason: 'Tool execution completed',
      timestamp: new Date().toISOString(),
    };
    
    // Evaluate phase
    setCurrentPhase('evaluate');
    await new Promise(r => setTimeout(r, 300));
    
    const traceEvaluate: TraceItem = {
      id: generateId(),
      stepId: generateId(),
      phase: 'evaluate',
      previousPhase: 'act',
      nextPhase: 'respond',
      evaluationResult: 'Tool result received, ready to respond',
      contextSummary: 'Evaluated tool result',
      transitionReason: 'Continuing to respond phase',
      timestamp: new Date().toISOString(),
    };
    
    // Respond phase
    setCurrentPhase('respond');
    const response = `The current time is ${toolCall.result}. How can I help you further?`;
    
    const traceRespond: TraceItem = {
      id: generateId(),
      stepId: generateId(),
      phase: 'respond',
      previousPhase: 'evaluate',
      responseStream: response,
      contextSummary: 'Generated user-facing response',
      transitionReason: 'Run completed successfully',
      timestamp: new Date().toISOString(),
    };
    
    const allTrace = [traceIngest, tracePlan, traceAct, traceEvaluate, traceRespond];
    
    const finalRunState: RunState = {
      ...newRunState,
      messages: [
        { role: 'user', content: userInput },
        { role: 'assistant', content: response },
      ],
      phase: 'respond',
      stepCount: 1,
      toolCallCount: 1,
      trace: allTrace,
      status: 'completed',
      finalOutput: response,
    };
    
    updateRuntime({ runState: finalRunState });
    setIsRunning(false);
    setCurrentPhase(null);
  }, [activeRuntime, input, effectiveActiveTools, profiles, updateRuntime]);

  const canSubmit = !!activeProfile && !!input.trim() && !isRunning;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', color: '#1a1a1a', backgroundColor: '#fdfdfd' }}>
      {/* Left Panel - Runtime + Sandbox */}
      <aside style={{ width: '300px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1rem', overflowY: 'auto' }}>
        <RuntimeSelector
          runtimes={runtimes}
          activeRuntimeId={runtime.activeRuntimeId}
          onSelect={setActiveRuntime}
          onCreate={handleCreateRuntime}
          onDelete={handleDeleteRuntime}
        />
        
        <RuntimeEditor
          runtime={activeRuntime}
          onChange={handleRuntimeChange}
          availableTools={availableToolNames}
          disabled={isRunning}
          profiles={profiles.map(p => ({ id: p.id, name: p.name, model: p.model }))}
          activeProfileId={activeRuntime?.profileId || null}
          onProfileChange={(id) => handleRuntimeChange({ profileId: id })}
        />
        
        <div style={{ marginTop: '1.5rem' }}>
          <SandboxView 
            files={sandboxFiles} 
            onUpload={handleUploadFiles}
            onDeleteFile={handleDeleteFile}
          />
        </div>
      </aside>
      
      {/* Center Panel - Chat Workspace */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0' }}>
        <ChatWorkspace
          messages={runState?.messages || []}
          input={input}
          onInputChange={setInput}
          onSubmit={simulateRun}
          isRunning={isRunning}
          toolRegistry={toolRegistry}
          activeTools={effectiveActiveTools}
          onToolToggle={handleToolToggle}
          showThinking={!!activeRuntime?.displayConfig.showThinking}
          thinking={thinking}
          canSubmit={canSubmit}
          contextSnapshots={contextSnapshots}
        />
      </main>
      
      {/* Right Panel - Execution Trace */}
      <aside style={{ width: '340px', backgroundColor: '#fafafa', padding: '1rem', overflowY: 'auto' }}>
        <ExecutionTrace
          trace={runState?.trace || []}
          isRunning={isRunning}
          currentPhase={currentPhase}
        />
      </aside>
    </div>
  );
}
