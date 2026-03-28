'use client';

import { useState } from 'react';
import { useRuntime } from '@/lib/state';
import type { Runtime } from '@/lib/runtime/types';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const DEFAULT_PROMPTS = {
  system: 'You are a helpful AI assistant with access to tools.',
  plan: 'Analyze the user request and determine the best action. Available actions: respond directly, call a tool, or ask for clarification.',
  evaluate: 'Evaluate the tool result and determine if more actions are needed or if ready to respond.',
  respond: 'Generate a helpful, concise response to the user based on the conversation context.',
};

function getRuntimePrompts(rt: Runtime) {
  return rt.prompts || DEFAULT_PROMPTS;
}

export default function PromptsBuilder() {
  const { runtime, updateRuntime } = useRuntime();
  const runtimes = Object.values(runtime.runtimes);
  const activeRuntime = runtime.activeRuntimeId ? runtime.runtimes[runtime.activeRuntimeId] : null;

  const setActiveRuntime = (id: string) => {
    updateRuntime({ activeRuntimeId: id });
  };

  const handlePromptChange = (key: keyof Runtime['prompts'], value: string) => {
    if (!activeRuntime) return;
    updateRuntime({
      runtimes: {
        ...runtime.runtimes,
        [activeRuntime.id]: { 
          ...activeRuntime, 
          prompts: { ...getRuntimePrompts(activeRuntime), [key]: value },
          updatedAt: new Date().toISOString() 
        },
      },
    });
  };

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

  const promptFields: Array<{ key: keyof Runtime['prompts']; label: string; description: string }> = [
    { key: 'system', label: 'System Prompt', description: 'Base prompt that defines the assistant\'s behavior' },
    { key: 'plan', label: 'Plan Prompt', description: 'Prompt sent before model decides what action to take' },
    { key: 'evaluate', label: 'Evaluate Prompt', description: 'Prompt sent after tool execution to evaluate the result' },
    { key: 'respond', label: 'Respond Prompt', description: 'Prompt used when generating the final response' },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', backgroundColor: '#fdfdfd' }}>
      {/* Left Panel - Runtime Selector */}
      <aside style={{ width: '280px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', margin: 0 }}>
              RUNTIMES
            </h2>
            <button
              onClick={handleCreateRuntime}
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
            {runtimes.map((rt) => (
              <div
                key={rt.id}
                onClick={() => setActiveRuntime(rt.id)}
                style={{
                  padding: '0.6rem',
                  backgroundColor: runtime.activeRuntimeId === rt.id ? '#eff6ff' : '#fff',
                  border: runtime.activeRuntimeId === rt.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{rt.name}</div>
                  {runtimes.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRuntime(rt.id);
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
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Center Panel - Prompt Editor */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {!activeRuntime ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>Select a Runtime</div>
            <div style={{ fontSize: '0.85rem' }}>Choose a runtime from the left to edit its prompts</div>
          </div>
        ) : (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
                Prompt Configuration
              </h1>
              <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                Configure prompts for each phase of the agentic loop. These prompts are sent to the model at different stages of execution.
              </p>
            </div>

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
                    value={getRuntimePrompts(activeRuntime)[field.key]}
                    onChange={(e) => handlePromptChange(field.key, e.target.value)}
                    rows={4}
                    style={{
                      width: '100%',
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
          </div>
        )}
      </main>

      {/* Right Panel - Preview */}
      {activeRuntime && (
        <aside style={{ width: '360px', backgroundColor: '#f8fafc', borderLeft: '1px solid #e2e8f0', padding: '1rem', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem' }}>
            PROMPT PREVIEW
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Ingest Phase
              </div>
              <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#475569' }}>
{getRuntimePrompts(activeRuntime).system}
              </pre>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Plan Phase
              </div>
              <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#475569' }}>
{getRuntimePrompts(activeRuntime).plan}
              </pre>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Evaluate Phase
              </div>
              <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#475569' }}>
{getRuntimePrompts(activeRuntime).evaluate}
              </pre>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Respond Phase
              </div>
              <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#475569' }}>
{getRuntimePrompts(activeRuntime).respond}
              </pre>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
