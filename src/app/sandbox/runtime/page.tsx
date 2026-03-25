'use client';

import { useState, useMemo } from 'react';
import { useRuntimeSpec, useProfiles } from '@/lib/state';
import {
  RuntimeSpec,
  RuntimeStep,
  PromptStep,
  ToolStep,
  LoopStep,
  createSpecId,
  createDefaultPromptStep,
  createDefaultToolStep,
  createDefaultLoopStep,
} from '@/lib/runtime/spec/types';

export default function RuntimeBuilder() {
  const { runtimeSpec, updateRuntimeSpec } = useRuntimeSpec();
  const { activeProfile } = useProfiles();
  
  const { runtimeSpecs, activeRuntimeSpecId, isLocked } = runtimeSpec;
  
  const [editingSpecName, setEditingSpecName] = useState('');
  const [editingSpecDescription, setEditingSpecDescription] = useState('');
  
  const activeSpec = activeRuntimeSpecId ? runtimeSpecs[activeRuntimeSpecId] : null;
  
  const specList = useMemo(() => Object.values(runtimeSpecs), [runtimeSpecs]);
  
  const handleCreateSpec = () => {
    const newSpec: RuntimeSpec = {
      id: createSpecId(),
      name: 'New Runtime',
      description: '',
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    updateRuntimeSpec({
      runtimeSpecs: { ...runtimeSpecs, [newSpec.id]: newSpec },
      activeRuntimeSpecId: newSpec.id,
    });
    
    setEditingSpecName(newSpec.name);
    setEditingSpecDescription(newSpec.description);
  };
  
  const handleSelectSpec = (specId: string) => {
    if (isLocked) return;
    const spec = runtimeSpecs[specId];
    if (spec) {
      updateRuntimeSpec({ activeRuntimeSpecId: specId });
      setEditingSpecName(spec.name);
      setEditingSpecDescription(spec.description);
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
  
  const handleAddStep = (type: 'prompt' | 'tool' | 'loop') => {
    if (!activeSpec || isLocked) return;
    
    let newStep: RuntimeStep;
    switch (type) {
      case 'prompt':
        newStep = createDefaultPromptStep();
        break;
      case 'tool':
        newStep = createDefaultToolStep();
        break;
      case 'loop':
        newStep = createDefaultLoopStep();
        break;
    }
    
    handleUpdateSpec({ steps: [...activeSpec.steps, newStep] });
  };
  
  const handleUpdateStep = (stepId: string, updates: Partial<RuntimeStep>) => {
    if (!activeSpec || isLocked) return;
    
    const steps = activeSpec.steps.map(step =>
      step.id === stepId ? { ...step, ...updates } as RuntimeStep : step
    );
    
    handleUpdateSpec({ steps });
  };
  
  const handleDeleteStep = (stepId: string) => {
    if (!activeSpec || isLocked) return;
    
    const steps = activeSpec.steps.filter(step => step.id !== stepId);
    handleUpdateSpec({ steps });
  };
  
  const handleToggleLock = () => {
    updateRuntimeSpec({ isLocked: !isLocked });
  };
  
  const handleToggleStepEnabled = (stepId: string, enabled: boolean) => {
    handleUpdateStep(stepId, { enabled });
  };
  
  const handleToggleStepLocked = (stepId: string, locked: boolean) => {
    handleUpdateStep(stepId, { locked });
  };
  
  const renderStepEditor = (step: RuntimeStep) => {
    const isStepLocked = step.locked || (isLocked && !step.locked);
    
    return (
      <div
        key={step.id}
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            backgroundColor: step.enabled ? '#f8fafc' : '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            gap: '0.75rem',
          }}
        >
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: step.type === 'prompt' ? '#3b82f6' : step.type === 'tool' ? '#10b981' : '#f59e0b',
              width: '50px',
            }}
          >
            {step.type}
          </span>
          
          <input
            type="text"
            value={step.name}
            onChange={(e) => !isStepLocked && handleUpdateStep(step.id, { name: e.target.value })}
            disabled={isStepLocked}
            style={{
              flex: 1,
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              padding: '0.4rem 0.6rem',
              fontSize: '0.85rem',
              backgroundColor: '#fff',
            }}
          />
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
            <input
              type="checkbox"
              checked={step.enabled}
              onChange={(e) => !isStepLocked && handleToggleStepEnabled(step.id, e.target.checked)}
              disabled={isStepLocked}
            />
            Enabled
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
            <input
              type="checkbox"
              checked={step.locked}
              onChange={(e) => handleToggleStepLocked(step.id, e.target.checked)}
            />
            Lock
          </label>
          
          <button
            onClick={() => !isStepLocked && handleDeleteStep(step.id)}
            disabled={isStepLocked}
            style={{
              background: 'none',
              border: 'none',
              color: isStepLocked ? '#cbd5e1' : '#ef4444',
              cursor: isStepLocked ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              padding: '0.25rem',
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{ padding: '1rem' }}>
          {step.type === 'prompt' && (
            <PromptStepEditor
              step={step}
              onChange={(updates) => handleUpdateStep(step.id, updates)}
              disabled={isStepLocked}
            />
          )}
          {step.type === 'tool' && (
            <ToolStepEditor
              step={step}
              onChange={(updates) => handleUpdateStep(step.id, updates)}
              disabled={isStepLocked}
            />
          )}
          {step.type === 'loop' && (
            <LoopStepEditor
              step={step}
              onChange={(updates) => handleUpdateStep(step.id, updates)}
              disabled={isStepLocked}
            />
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', color: '#1a1a1a', backgroundColor: '#fdfdfd' }}>
      <aside style={{ width: '280px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1rem', overflowY: 'auto' }}>
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
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                {spec.steps.length} step{spec.steps.length !== 1 ? 's' : ''}
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
      
      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        {activeSpec ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
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
                <input
                  type="text"
                  value={editingSpecDescription}
                  onChange={(e) => setEditingSpecDescription(e.target.value)}
                  onBlur={() => handleUpdateSpec({ description: editingSpecDescription })}
                  disabled={isLocked}
                  placeholder="Description (optional)"
                  style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    border: 'none',
                    borderBottom: isLocked ? 'none' : '1px solid #e2e8f0',
                    backgroundColor: 'transparent',
                    padding: '0.25rem 0',
                    width: '100%',
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
                
                <button
                  disabled={!activeProfile || isLocked}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: !activeProfile ? '#cbd5e1' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: !activeProfile ? 'not-allowed' : 'pointer',
                  }}
                >
                  ▶ Run
                </button>
              </div>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Add Step:</span>
                <button
                  onClick={() => handleAddStep('prompt')}
                  disabled={isLocked}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#3b82f620',
                    color: '#3b82f6',
                    border: '1px solid #3b82f640',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                  }}
                >
                  + Prompt
                </button>
                <button
                  onClick={() => handleAddStep('tool')}
                  disabled={isLocked}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#10b98120',
                    color: '#10b981',
                    border: '1px solid #10b98140',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                  }}
                >
                  + Tool
                </button>
                <button
                  onClick={() => handleAddStep('loop')}
                  disabled={isLocked}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#f59e0b20',
                    color: '#f59e0b',
                    border: '1px solid #f59e0b40',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                  }}
                >
                  + Loop
                </button>
              </div>
            </div>
            
            <div>
              {activeSpec.steps.map(renderStepEditor)}
              
              {activeSpec.steps.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '8px' }}>
                  No steps yet. Add a step to start building your runtime.
                </div>
              )}
            </div>
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

function PromptStepEditor({ step, onChange, disabled }: { step: PromptStep; onChange: (updates: Partial<PromptStep>) => void; disabled: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Prompt Type
          </label>
          <select
            value={step.promptType}
            onChange={(e) => onChange({ promptType: e.target.value as 'system' | 'user' | 'hidden' })}
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
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Position
          </label>
          <select
            value={step.injectionPosition}
            onChange={(e) => onChange({ injectionPosition: e.target.value as 'start' | 'end' })}
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
            <option value="start">Start</option>
            <option value="end">End</option>
          </select>
        </div>
      </div>
      
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Prompt Content
        </label>
        <textarea
          value={step.content}
          onChange={(e) => onChange({ content: e.target.value })}
          disabled={disabled}
          rows={3}
          placeholder="Enter prompt content..."
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
    </div>
  );
}

function ToolStepEditor({ step, onChange, disabled }: { step: ToolStep; onChange: (updates: Partial<ToolStep>) => void; disabled: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Tool Name
        </label>
        <input
          type="text"
          value={step.toolName}
          onChange={(e) => onChange({ toolName: e.target.value })}
          disabled={disabled}
          placeholder="Enter tool name..."
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
      
      <div style={{ display: 'flex', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
          <input
            type="checkbox"
            checked={step.autoExecute}
            onChange={(e) => onChange({ autoExecute: e.target.checked })}
            disabled={disabled}
          />
          Auto-execute
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
          <input
            type="checkbox"
            checked={step.continueOnFailure}
            onChange={(e) => onChange({ continueOnFailure: e.target.checked })}
            disabled={disabled}
          />
          Continue on failure
        </label>
      </div>
      
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Injection Prompt
        </label>
        <textarea
          value={step.injectionPrompt}
          onChange={(e) => onChange({ injectionPrompt: e.target.value })}
          disabled={disabled}
          rows={2}
          placeholder="Use {{results}} to inject tool results..."
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
    </div>
  );
}

function LoopStepEditor({ step, onChange, disabled }: { step: LoopStep; onChange: (updates: Partial<LoopStep>) => void; disabled: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Condition
          </label>
          <select
            value={step.condition}
            onChange={(e) => onChange({ condition: e.target.value as 'maxIterations' | 'untilUserInput' | 'untilToolSucceeds' })}
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
            <option value="maxIterations">Max Iterations</option>
            <option value="untilUserInput">Until User Input</option>
            <option value="untilToolSucceeds">Until Tool Succeeds</option>
          </select>
        </div>
        
        {step.condition === 'maxIterations' && (
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
              Max Iterations
            </label>
            <input
              type="number"
              value={step.maxIterations}
              onChange={(e) => onChange({ maxIterations: parseInt(e.target.value) || 1 })}
              disabled={disabled}
              min={1}
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
        )}
        
        {step.condition === 'untilToolSucceeds' && (
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
              Tool Name
            </label>
            <input
              type="text"
              value={step.toolName || ''}
              onChange={(e) => onChange({ toolName: e.target.value })}
              disabled={disabled}
              placeholder="Tool to watch..."
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
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
          <input
            type="checkbox"
            checked={step.continueOnFailure}
            onChange={(e) => onChange({ continueOnFailure: e.target.checked })}
            disabled={disabled}
          />
          Continue on failure
        </label>
      </div>
      
      <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
        Nested steps: {step.nestedSteps.length} (not editable in v1)
      </div>
    </div>
  );
}
