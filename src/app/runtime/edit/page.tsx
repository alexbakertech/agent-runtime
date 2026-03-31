'use client';

import { useState } from 'react';
import { useRuntime, useProfiles, useSandbox } from '@/lib/state';
import type { Runtime, FileAccessMode } from '@/lib/runtime/types';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

type TabId = 'general' | 'prompts' | 'tools' | 'files';

function TabButton({ id, label, active, onClick }: { id: TabId; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: active ? '#fff' : '#f1f5f9',
        border: 'none',
        borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
        color: active ? '#1e293b' : '#64748b',
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function RuntimeSelector({ 
  runtimes, 
  activeRuntimeId, 
  onSelect,
  onCreate,
  onDelete,
  profiles,
}: { 
  runtimes: Runtime[]; 
  activeRuntimeId: string | null; 
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  profiles: { id: string; name: string; model: string }[];
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
              {runtime.profileId ? (profiles.find(p => p.id === runtime.profileId)?.model || runtime.modelConfig.model) : runtime.modelConfig.model} · {runtime.defaultTools.length} tools
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneralTab({ 
  runtime, 
  onChange,
  profiles,
  disabled,
}: { 
  runtime: Runtime | null; 
  onChange: (updates: Partial<Runtime>) => void;
  profiles: { id: string; name: string; model: string }[];
  disabled: boolean;
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
    </div>
  );
}

function PromptsTab({ 
  runtime, 
  onChange,
  disabled,
}: { 
  runtime: Runtime | null; 
  onChange: (updates: Partial<Runtime>) => void;
  disabled: boolean;
}) {
  if (!runtime) return null;
  
  const prompts = runtime.prompts || {
    system: 'You are a helpful AI assistant with access to tools.',
    plan: 'Analyze the user request and determine the best action. Available actions: respond directly, call a tool, or ask for clarification.',
    evaluate: 'Evaluate the tool result and determine if more actions are needed or if ready to respond.',
    respond: 'Generate a helpful, concise response to the user based on the conversation context.',
  };

  const promptFields: Array<{ key: keyof Runtime['prompts']; label: string; description: string }> = [
    { key: 'system', label: 'System Prompt', description: 'Base prompt that defines the assistant\'s behavior' },
    { key: 'plan', label: 'Plan Prompt', description: 'Prompt sent before model decides what action to take' },
    { key: 'evaluate', label: 'Evaluate Prompt', description: 'Prompt sent after tool execution to evaluate the result' },
    { key: 'respond', label: 'Respond Prompt', description: 'Prompt used when generating the final response' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {promptFields.map((field) => (
        <div key={field.key} style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '0.25rem' }}>
              {field.label}
            </label>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {field.description}
            </div>
          </div>
          <textarea
            value={prompts[field.key]}
            onChange={(e) => onChange({ prompts: { ...prompts, [field.key]: e.target.value } })}
            disabled={disabled}
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              resize: 'vertical',
              backgroundColor: '#f8fafc',
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ToolsTab({ 
  runtime, 
  onChange,
  availableTools,
  disabled,
}: { 
  runtime: Runtime | null; 
  onChange: (updates: Partial<Runtime>) => void;
  availableTools: string[];
  disabled: boolean;
}) {
  if (!runtime) return null;

  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>
        Enabled Tools
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {availableTools.map((tool) => (
          <label key={tool} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', padding: '0.5rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
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
  );
}

function AccessModeSelector({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: FileAccessMode;
  onChange: (mode: FileAccessMode) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.75rem' }}>
        {description}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['disabled', 'readonly', 'readwrite'] as FileAccessMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            disabled={disabled}
            style={{
              flex: 1,
              padding: '0.4rem 0.5rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              border: value === mode ? '2px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: '6px',
              backgroundColor: value === mode ? '#eff6ff' : '#fff',
              color: value === mode ? '#1e40af' : '#64748b',
              cursor: disabled ? 'not-allowed' : 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {mode === 'readonly' ? 'Read Only' : mode === 'readwrite' ? 'Read/Write' : 'Disabled'}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilesTab({ 
  runtime, 
  onChange,
  disabled,
}: { 
  runtime: Runtime | null; 
  onChange: (updates: Partial<Runtime>) => void;
  disabled: boolean;
}) {
  if (!runtime) return null;

  const runtimeFilesAccess: FileAccessMode = runtime.runtimeFilesAccess || 'readwrite';
  const sharedFilesAccess: FileAccessMode = runtime.sharedFilesAccess || 'readwrite';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <AccessModeSelector
        label="Runtime Files"
        description="Files scoped to this specific runtime"
        value={runtimeFilesAccess}
        onChange={(mode) => onChange({ runtimeFilesAccess: mode })}
        disabled={disabled}
      />
      <AccessModeSelector
        label="Shared Files"
        description="Shared scratch space accessible by all runtimes"
        value={sharedFilesAccess}
        onChange={(mode) => onChange({ sharedFilesAccess: mode })}
        disabled={disabled}
      />
    </div>
  );
}

export default function RuntimeEditorPage() {
  const { runtime, updateRuntime, setActiveRuntime } = useRuntime();
  const { profiles } = useProfiles();
  const { sandbox } = useSandbox();
  
  const [activeTab, setActiveTab] = useState<TabId>('general');
  
  const runtimes = Object.values(runtime.runtimes);
  const activeRuntime = runtime.activeRuntimeId ? runtime.runtimes[runtime.activeRuntimeId] : null;

  const builtInTools = [
    'get_time',
    'list_files',
    'read_file',
    'search_text',
    'remember_for_next_run',
  ];
  
  const customToolNames = (sandbox.customTools || []).map((t: { name: string }) => t.name);
  const allTools = [...builtInTools, ...customToolNames];

  const handleCreateRuntime = () => {
    const now = new Date().toISOString();
    const newRuntime: Runtime = {
      id: generateId(),
      name: 'New Runtime',
      systemPrompt: 'You are a helpful AI assistant.',
      prompts: {
        system: 'You are a helpful AI assistant with access to tools.',
        plan: 'Analyze the user request and determine the best action. Available actions: respond directly, call a tool, or ask for clarification.',
        evaluate: 'Evaluate the tool result and determine if more actions are needed or if ready to respond.',
        respond: 'Generate a helpful, concise response to the user based on the conversation context.',
      },
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
      runtimeFilesAccess: 'readwrite',
      sharedFilesAccess: 'readwrite',
      profileId: profiles[0]?.id,
      createdAt: now,
      updatedAt: now,
    };
    updateRuntime({
      runtimes: { ...runtime.runtimes, [newRuntime.id]: newRuntime },
      activeRuntimeId: newRuntime.id,
    });
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

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'tools', label: 'Tools' },
    { id: 'files', label: 'Files' },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', backgroundColor: '#fdfdfd' }}>
      <aside style={{ width: '280px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1rem', overflowY: 'auto' }}>
        <RuntimeSelector
          runtimes={runtimes}
          activeRuntimeId={runtime.activeRuntimeId}
          onSelect={setActiveRuntime}
          onCreate={handleCreateRuntime}
          onDelete={handleDeleteRuntime}
          profiles={profiles.map(p => ({ id: p.id, name: p.name, model: p.model }))}
        />
      </aside>
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 1rem', display: 'flex', gap: '0.25rem' }}>
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              id={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '1.5rem' }}>
          {!activeRuntime ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>Select or create a runtime</div>
              <div style={{ fontSize: '0.85rem' }}>Choose a runtime from the left to edit</div>
            </div>
          ) : (
            <>
              {activeTab === 'general' && (
                <GeneralTab
                  runtime={activeRuntime}
                  onChange={handleRuntimeChange}
                  profiles={profiles.map(p => ({ id: p.id, name: p.name, model: p.model }))}
                  disabled={false}
                />
              )}
              {activeTab === 'prompts' && (
                <PromptsTab
                  runtime={activeRuntime}
                  onChange={handleRuntimeChange}
                  disabled={false}
                />
              )}
              {activeTab === 'tools' && (
                <ToolsTab
                  runtime={activeRuntime}
                  onChange={handleRuntimeChange}
                  availableTools={allTools}
                  disabled={false}
                />
              )}
              {activeTab === 'files' && (
                <FilesTab
                  runtime={activeRuntime}
                  onChange={handleRuntimeChange}
                  disabled={false}
                />
              )}

            </>
          )}
        </div>
      </main>
    </div>
  );
}
