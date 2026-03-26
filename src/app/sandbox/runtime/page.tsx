'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRuntimeSpec, useProfiles } from '@/lib/state';
import {
  RuntimeSpec,
  PromptStep,
  createSpecId,
  createDefaultPromptStep,
} from '@/lib/runtime/spec/types';
import { RuntimeConfig } from '@/lib/runtime/types';
import { RuntimeEngine } from '@/lib/runtime/engine';

export default function RuntimeBuilder() {
  const { runtimeSpec, updateRuntimeSpec } = useRuntimeSpec();
  const { profiles, activeProfile, setActiveProfile } = useProfiles();
  
  const [userQuery, setUserQuery] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [executionComplete, setExecutionComplete] = useState(false);
  const [finalOutput, setFinalOutput] = useState('');
  const [finalReasoning, setFinalReasoning] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const engineRef = useRef<RuntimeEngine | null>(null);
  
  const { runtimeSpecs, activeRuntimeSpecId, isLocked } = runtimeSpec;
  
  const [editingSpecName, setEditingSpecName] = useState('');
  
  const activeSpec = activeRuntimeSpecId ? runtimeSpecs[activeRuntimeSpecId] : null;
  
  const specList = useMemo(() => Object.values(runtimeSpecs), [runtimeSpecs]);
  
  const systemPromptStep = useMemo(() => {
    if (!activeSpec) return null;
    return activeSpec.steps.find(s => s.type === 'prompt' && (s as PromptStep).promptType === 'system') as PromptStep | null;
  }, [activeSpec]);

  const systemPromptEnabled = systemPromptStep?.enabled ?? true;
  const systemPromptContent = systemPromptStep?.content ?? '';

  const needsSystemPrompt = activeSpec && !systemPromptStep;
  
  useEffect(() => {
    if (needsSystemPrompt && activeSpec) {
      const newStep = createDefaultPromptStep();
      const updatedSteps = [newStep, ...activeSpec.steps];
      updateRuntimeSpec({
        runtimeSpecs: { ...runtimeSpecs, [activeSpec.id]: { ...activeSpec, steps: updatedSteps, updatedAt: new Date().toISOString() } },
      });
    }
  }, [needsSystemPrompt]);

  const handleCreateSpec = () => {
    const newSpec: RuntimeSpec = {
      id: createSpecId(),
      name: 'New Runtime',
      description: '',
      steps: [createDefaultPromptStep()],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    updateRuntimeSpec({
      runtimeSpecs: { ...runtimeSpecs, [newSpec.id]: newSpec },
      activeRuntimeSpecId: newSpec.id,
    });
    
    setEditingSpecName(newSpec.name);
  };
  
  const handleSelectSpec = (specId: string) => {
    if (isLocked) return;
    const spec = runtimeSpecs[specId];
    if (spec) {
      updateRuntimeSpec({ activeRuntimeSpecId: specId });
      setEditingSpecName(spec.name);
    }
  };
  
  const handleDeleteSpec = (specId: string) => {
    if (isLocked) return;
    const newSpecs = { ...runtimeSpecs };
    delete newSpecs[specId];
    
    updateRuntimeSpec({
      runtimeSpecs: newSpecs,
      activeRuntimeSpecId: activeRuntimeSpecId === specId ? null : activeRuntimeSpecId,
    });
  };
  
  const handleUpdateSpec = (updates: Partial<RuntimeSpec>) => {
    if (!activeRuntimeSpecId || !activeSpec) return;
    
    const updatedSpec = {
      ...activeSpec,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    updateRuntimeSpec({
      runtimeSpecs: { ...runtimeSpecs, [activeRuntimeSpecId]: updatedSpec },
    });
  };
  
  const handleUpdateSystemPrompt = (content: string) => {
    if (!systemPromptStep || isLocked) return;
    
    const steps = activeSpec?.steps.map(step => {
      if (step.type === 'prompt' && (step as PromptStep).promptType === 'system') {
        return { ...step, content } as PromptStep;
      }
      return step;
    }) ?? [];
    
    handleUpdateSpec({ steps });
  };
  
  const handleToggleSystemPrompt = (enabled: boolean) => {
    if (!systemPromptStep || isLocked) return;
    
    const steps = activeSpec?.steps.map(step => {
      if (step.type === 'prompt' && (step as PromptStep).promptType === 'system') {
        return { ...step, enabled } as PromptStep;
      }
      return step;
    }) ?? [];
    
    handleUpdateSpec({ steps });
  };
  
  const handleProfileChange = (profileId: string) => {
    setSelectedProfileId(profileId);
    setActiveProfile(profileId);
  };

  const handleToggleLock = () => {
    updateRuntimeSpec({ isLocked: !isLocked });
  };

  const handleRun = useCallback(async () => {
    if (!activeSpec || !activeProfile) return;

    setStreamingContent('');
    setStreamingReasoning('');
    setFinalOutput('');
    setFinalReasoning('');
    setExecutionComplete(false);
    setError(null);

    const config: RuntimeConfig = {
      baseUrl: activeProfile.baseUrl,
      apiKey: activeProfile.apiKey,
      model: activeProfile.model,
    };

    if (!engineRef.current) {
      engineRef.current = new RuntimeEngine((stage, data) => {
        if (stage === 'receiving' && typeof data === 'object') {
          const { content, reasoning } = data;
          setStreamingContent(content || '');
          setStreamingReasoning(reasoning || '');
        }
      });
    }

    const engine = engineRef.current;
    engine.reset();

    setIsRunning(true);

    try {
      const systemStep = activeSpec.steps.find(
        s => s.type === 'prompt' && (s as PromptStep).promptType === 'system'
      ) as PromptStep | undefined;
      
      const prefix = systemStep?.enabled ? systemStep.content : '';
      const prefixEnabled = !!systemStep?.enabled;

      await engine.run(
        config,
        userQuery,
        [],
        {},
        { prefix, prefixEnabled, includeThinkingInContext: false }
      );

      setFinalOutput(streamingContent);
      setFinalReasoning(streamingReasoning);
      setExecutionComplete(true);
    } catch (err) {
      console.error('Execution error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  }, [activeSpec, activeProfile, userQuery, streamingContent, streamingReasoning]);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', color: '#1a1a1a', backgroundColor: '#fdfdfd' }}>
      <aside style={{ width: '260px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem' }}>
            RUNTIME SPECS
          </h2>
          
          <button
            onClick={handleCreateSpec}
            style={{
              width: '100%',
              padding: '0.6rem',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + New Runtime
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {specList.map((spec) => (
            <div
              key={spec.id}
              onClick={() => handleSelectSpec(spec.id)}
              style={{
                padding: '0.75rem',
                backgroundColor: activeRuntimeSpecId === spec.id ? '#fff' : '#fff',
                border: activeRuntimeSpecId === spec.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{spec.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSpec(spec.id); }}
                  disabled={isLocked}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          
          {specList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
              No runtime specs yet.<br />Create one to get started.
            </div>
          )}
        </div>
      </aside>
      
      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {activeSpec ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={editingSpecName}
                  onChange={(e) => setEditingSpecName(e.target.value)}
                  onBlur={() => handleUpdateSpec({ name: editingSpecName })}
                  disabled={isLocked}
                  placeholder="Runtime name"
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    border: 'none',
                    borderBottom: isLocked ? 'none' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    padding: '0.25rem 0',
                    width: '100%',
                    marginBottom: '0.5rem',
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                <button
                  onClick={handleToggleLock}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: isLocked ? '#ef4444' : '#64748b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isLocked ? '🔒 Locked' : '🔓 Unlocked'}
                </button>
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                    Profile
                  </label>
                  <select
                    value={selectedProfileId || activeProfile?.id || ''}
                    onChange={(e) => handleProfileChange(e.target.value)}
                    disabled={isLocked}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      backgroundColor: '#fff',
                    }}
                  >
                    <option value="">Select a profile...</option>
                    {Object.values(profiles).map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                  User Query
                </label>
                <textarea
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  disabled={isLocked}
                  rows={2}
                  placeholder="Enter your query or instructions..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    backgroundColor: '#fff',
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  System Prompt
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b', cursor: isLocked ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={systemPromptEnabled}
                    onChange={(e) => handleToggleSystemPrompt(e.target.checked)}
                    disabled={isLocked}
                  />
                  Enabled
                </label>
              </div>
              <textarea
                value={systemPromptContent}
                onChange={(e) => handleUpdateSystemPrompt(e.target.value)}
                disabled={isLocked || !systemPromptEnabled}
                rows={4}
                placeholder="Enter system prompt..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  backgroundColor: systemPromptEnabled ? '#fff' : '#f1f5f9',
                  opacity: systemPromptEnabled ? 1 : 0.6,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleRun}
                disabled={!activeProfile || isLocked || isRunning || !systemPromptEnabled}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: !activeProfile || isRunning || !systemPromptEnabled ? '#cbd5e1' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: !activeProfile || isRunning || !systemPromptEnabled ? 'not-allowed' : 'pointer',
                }}
              >
                {isRunning ? '⏳ Running...' : '▶ Run'}
              </button>
            </div>

            {(isRunning || streamingContent || finalOutput || error) && (
              <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: '0 0 1rem 0' }}>
                  Output
                </h3>
                
                {error && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', color: '#dc2626', fontSize: '0.85rem' }}>
                    Error: {error}
                  </div>
                )}

                {(streamingReasoning || finalReasoning) && (
                  <div style={{ marginBottom: '1rem' }}>
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#7c3aed',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: 0,
                      }}
                    >
                      {streamingReasoning ? '▶' : '▼'} Thinking ({finalReasoning.length || streamingReasoning.length} chars)
                    </button>
                    <pre style={{ 
                      margin: '0.5rem 0 0 0', 
                      padding: '0.75rem', 
                      backgroundColor: '#f5f3ff', 
                      borderRadius: '6px', 
                      fontSize: '0.8rem', 
                      fontFamily: 'monospace',
                      color: '#7c3aed',
                      fontStyle: 'italic',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}>
                      {isRunning ? streamingReasoning : finalReasoning}
                    </pre>
                  </div>
                )}

                {(streamingContent || finalOutput) && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
                      Response
                    </div>
                    <pre style={{ 
                      margin: 0, 
                      padding: '0.75rem', 
                      backgroundColor: '#f8fafc', 
                      borderRadius: '6px', 
                      fontSize: '0.85rem', 
                      fontFamily: 'monospace',
                      color: '#334155',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '300px',
                      overflowY: 'auto',
                    }}>
                      {isRunning ? streamingContent : finalOutput}
                    </pre>
                  </div>
                )}

                {executionComplete && !streamingContent && !finalOutput && !error && (
                  <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '6px', color: '#166534', fontSize: '0.85rem' }}>
                    Execution complete. No output to display.
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Select or create a runtime</h2>
            <p style={{ fontSize: '0.9rem' }}>Choose a runtime spec from the sidebar or create a new one to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}
