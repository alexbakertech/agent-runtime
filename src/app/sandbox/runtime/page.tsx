'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRuntimeSpec, useProfiles, useSandbox } from '@/lib/state';
import {
  RuntimeSpec,
  RuntimeBlock,
  StartBlock,
  ThinkBlock,
  ToolBlock,
  RespondBlock,
  StopBlock,
  BlockType,
  ThinkMode,
  OutputMode,
  ToolAccessMode,
  ArgumentSource,
  ResultHandling,
  FailureBehavior,
  ResponseSource,
  VisibilityMode,
  createDefaultRuntime,
  createDefaultStartBlock,
  createDefaultThinkBlock,
  createDefaultToolBlock,
  createDefaultRespondBlock,
  createDefaultStopBlock,
  getBlockTypeLabel,
  TimelineEvent,
  BlockResult,
} from '@/lib/runtime/spec/types';

const BUILT_IN_TOOLS = [
  { name: 'get_time', description: 'Returns the current system time' },
  { name: 'list_files', description: 'Lists files in the sandbox directory' },
  { name: 'read_file', description: 'Reads file content from sandbox' },
  { name: 'search_text', description: 'Searches for text in sandbox files' },
];

interface DragItem {
  index: number;
  id: string;
}

function CollapsibleSection({ title, children, defaultExpanded = true }: { title: string; children: React.ReactNode; defaultExpanded?: boolean }) {
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
        <span>▶ {title}</span>
        <span>{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && <div>{children}</div>}
    </div>
  );
}

export default function RuntimeBuilder() {
  const { runtimeSpec, updateRuntimeSpec } = useRuntimeSpec();
  const { profiles, activeProfile, setActiveProfile } = useProfiles();
  const { sandbox } = useSandbox();
  
  const [userQuery, setUserQuery] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [executionResults, setExecutionResults] = useState<Record<string, BlockResult>>({});
  const [blockOutputs, setBlockOutputs] = useState<Record<string, { reasoning?: string; previousContext?: string; blockContext?: string; toolCall?: { name: string; arguments: Record<string, unknown>; result?: string } }>>({});
  const [blockInputs, setBlockInputs] = useState<Record<string, { prompt: string; systemPrompt?: string; userMessage: string }>>({});
  const [blockResponses, setBlockResponses] = useState<Record<string, { response: string; reasoning?: string; toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }> }>>({});
  const [rawContextLog, setRawContextLog] = useState<Array<{ timestamp: string; direction: 'sent' | 'received'; content: string; source: string }>>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(-1);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const { runtimeSpecs, activeRuntimeSpecId, isLocked } = runtimeSpec;
  
  const [editingSpecName, setEditingSpecName] = useState('');
  const [editingSpecDescription, setEditingSpecDescription] = useState('');
  
  const activeSpec = activeRuntimeSpecId ? runtimeSpecs[activeRuntimeSpecId] : null;
  
  const specList = useMemo(() => Object.values(runtimeSpecs), [runtimeSpecs]);
  
  const customTools = sandbox?.customTools || [];
  const allTools = [...BUILT_IN_TOOLS, ...customTools.map((t: { name: string; description?: string }) => ({ name: t.name, description: t.description || '' }))];

  useEffect(() => {
    if (activeSpec) {
      setEditingSpecName(activeSpec.name);
      setEditingSpecDescription(activeSpec.description);
    }
  }, [activeSpec]);

  const handleCreateSpec = () => {
    const newSpec = createDefaultRuntime();
    
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

  const handleDuplicateSpec = (specId: string) => {
    if (isLocked) return;
    const spec = runtimeSpecs[specId];
    if (!spec) return;
    
    const newSpec: RuntimeSpec = {
      ...spec,
      id: `runtime_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: `${spec.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blocks: spec.blocks.map(block => ({
        ...block,
        id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      })),
    };
    
    updateRuntimeSpec({
      runtimeSpecs: { ...runtimeSpecs, [newSpec.id]: newSpec },
      activeRuntimeSpecId: newSpec.id,
    });
    
    setEditingSpecName(newSpec.name);
    setEditingSpecDescription(newSpec.description);
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
  
  const handleAddBlock = (type: BlockType) => {
    if (!activeSpec || isLocked) return;
    
    let newBlock: RuntimeBlock;
    switch (type) {
      case 'start':
        if ((activeSpec.blocks || []).some(b => b.type === 'start')) return;
        newBlock = createDefaultStartBlock();
        break;
      case 'think':
        newBlock = createDefaultThinkBlock();
        break;
      case 'tool':
        newBlock = createDefaultToolBlock();
        break;
      case 'respond':
        newBlock = createDefaultRespondBlock();
        break;
      case 'stop':
        newBlock = createDefaultStopBlock();
        break;
    }
    
    handleUpdateSpec({ blocks: [...(activeSpec.blocks || []), newBlock] });
  };
  
  const handleUpdateBlock = (blockId: string, updates: Partial<RuntimeBlock>) => {
    if (!activeSpec || isLocked) return;
    
    const blocks = (activeSpec.blocks || []).map(block =>
      block.id === blockId ? { ...block, ...updates } as RuntimeBlock : block
    );
    
    handleUpdateSpec({ blocks });
  };
  
  const handleDeleteBlock = (blockId: string) => {
    if (!activeSpec || isLocked) return;
    
    const block = (activeSpec.blocks || []).find(b => b.id === blockId);
    if (!block) return;
    if (block.type === 'start' || block.type === 'stop') return;
    
    const blocks = (activeSpec.blocks || []).filter(block => block.id !== blockId);
    handleUpdateSpec({ blocks });
  };
  
  const handleDuplicateBlock = (blockId: string) => {
    if (!activeSpec || isLocked) return;
    
    const block = (activeSpec.blocks || []).find(b => b.id === blockId);
    if (!block || block.type === 'start' || block.type === 'stop') return;
    
    let newBlock: RuntimeBlock;
    const baseId = `block_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    switch (block.type) {
      case 'think':
        newBlock = { ...block, id: baseId, name: `${block.name} (Copy)` } as ThinkBlock;
        break;
      case 'tool':
        newBlock = { ...block, id: baseId, name: `${block.name} (Copy)` } as ToolBlock;
        break;
      case 'respond':
        newBlock = { ...block, id: baseId, name: `${block.name} (Copy)` } as RespondBlock;
        break;
      default:
        return;
    }
    
    const blockIndex = (activeSpec.blocks || []).findIndex(b => b.id === blockId);
    const newBlocks = [...(activeSpec.blocks || [])];
    newBlocks.splice(blockIndex + 1, 0, newBlock);
    handleUpdateSpec({ blocks: newBlocks });
  };
  
  const handleToggleBlockEnabled = (blockId: string, enabled: boolean) => {
    handleUpdateBlock(blockId, { enabled });
  };

  const handleToggleLock = () => {
    updateRuntimeSpec({ isLocked: !isLocked });
  };
  
  const handleProfileChange = (profileId: string) => {
    setSelectedProfileId(profileId);
    setActiveProfile(profileId);
  };

  const toggleBlockExpanded = (blockId: string) => {
    setExpandedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blockId)) {
        newSet.delete(blockId);
      } else {
        newSet.add(blockId);
      }
      return newSet;
    });
  };

  const handleDragStart = (index: number, id: string) => {
    setDraggedItem({ index, id });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (!activeSpec || !draggedItem || dragOverIndex === null) {
      setDraggedItem(null);
      setDragOverIndex(null);
      return;
    }

    const newBlocks = [...(activeSpec.blocks || [])];
    const [removed] = newBlocks.splice(draggedItem.index, 1);
    newBlocks.splice(dragOverIndex, 0, removed);

    handleUpdateSpec({ blocks: newBlocks });
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const validateRuntime = (spec: RuntimeSpec): string[] => {
    const errors: string[] = [];
    
    if (!spec.blocks || spec.blocks.length === 0) {
      errors.push('Runtime must have at least one block.');
      return errors;
    }
    
    const hasStart = spec.blocks.some(b => b.type === 'start');
    const hasStop = spec.blocks.some(b => b.type === 'stop');
    
    if (!hasStart) {
      errors.push('Runtime must have a Start Run block.');
    }
    
    if (!hasStop) {
      errors.push('Runtime must have a Stop block.');
    }
    
    const startIndex = spec.blocks.findIndex(b => b.type === 'start');
    if (startIndex > 0) {
      errors.push('Start Run must be the first block.');
    }
    
    spec.blocks.forEach((block, index) => {
      if (block.type === 'think') {
        const thinkBlock = block as ThinkBlock;
        if (thinkBlock.allowedNextActions.length === 0) {
          errors.push(`Think block "${block.name}" needs at least one allowed next action.`);
        }
      }
      
      if (block.type === 'tool') {
        const toolBlock = block as ToolBlock;
        if (toolBlock.allowedTools.length === 0) {
          errors.push(`Use Tool block "${block.name}" has no tools selected.`);
        }
        if (toolBlock.toolAccessMode === 'fixed' && toolBlock.allowedTools.length !== 1) {
          errors.push(`Use Tool block "${block.name}" in fixed mode must have exactly one tool selected.`);
        }
      }
    });
    
    return errors;
  };

  const validationErrors = activeSpec ? validateRuntime(activeSpec) : [];

  const [selectedBlockForInspector, setSelectedBlockForInspector] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<'block' | 'state' | 'raw'>('state');

  const handleRun = useCallback(async () => {
    if (!activeSpec || !activeProfile || validationErrors.length > 0) return;

    setIsRunning(true);
    setExecutionResults({});
    setBlockOutputs({});
    setBlockInputs({});
    setBlockResponses({});
    setRawContextLog([]);
    setTimeline([]);
    setCurrentBlockIndex(-1);

    let accumulatedContext = '';

    try {
      for (let i = 0; i < (activeSpec.blocks || []).length; i++) {
        const block = activeSpec.blocks[i];
        if (!block.enabled) continue;

        setCurrentBlockIndex(i);
        
        const startEvent: TimelineEvent = {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          timestamp: new Date().toISOString(),
          type: 'blockStart',
          blockId: block.id,
          blockType: block.type,
        };
        setTimeline(prev => [...prev, startEvent]);

        await new Promise(resolve => setTimeout(resolve, 300));

        let output = '';
        let reasoning: string | undefined;
        let toolCall: { name: string; arguments: Record<string, unknown>; result?: string } | undefined;
        
        let blockInputPrompt = '';
        let blockResponseText = '';
        let blockResponseReasoning: string | undefined;

        if (block.type === 'start') {
          const startBlock = block as StartBlock;
          output = startBlock.acceptsUserInput ? `User input: ${userQuery || '(none)'}` : 'Started';
          if (startBlock.startupInstructions) {
            output += `\nInstructions: ${startBlock.startupInstructions}`;
          }
          blockInputPrompt = output;
          blockResponseText = 'OK, ready to proceed.';
        } else if (block.type === 'think') {
          const thinkBlock = block as ThinkBlock;
          const instructions = thinkBlock.instructionText || 'Decide what to do next.';
          const availableActions = thinkBlock.allowedNextActions.join(', ');
          const contextInfo = thinkBlock.contextSources.userInput ? `User said: ${userQuery}\n` : '';
          const toolInfo = thinkBlock.contextSources.toolResults ? `Previous tool results available.\n` : '';
          
          blockInputPrompt = `[System: ${instructions}]\n${contextInfo}${toolInfo}Available actions: ${availableActions}\n\nWhat should I do?`;
          blockResponseReasoning = `Analyzing request to determine next action from: ${availableActions}`;
          reasoning = blockResponseReasoning;
          output = `Decision: proceed to ${thinkBlock.allowedNextActions.join(', ')}`;
          blockResponseText = output;
          
          accumulatedContext += `\n---\nUser query: ${userQuery}\nAI: ${output}`;
        } else if (block.type === 'tool') {
          const toolBlock = block as ToolBlock;
          if (toolBlock.toolAccessMode === 'fixed' && toolBlock.allowedTools[0]) {
            const toolName = toolBlock.allowedTools[0];
            const args = JSON.stringify(toolBlock.staticArguments || {}, null, 2);
            blockInputPrompt = `Use tool: ${toolName}\nArguments: ${args}\n\nExecute this tool call.`;
            blockResponseReasoning = `Calling tool ${toolName} with provided arguments.`;
            toolCall = {
              name: toolName,
              arguments: toolBlock.staticArguments || {},
              result: `Executed ${toolName} successfully.`,
            };
            output = `Tool result: ${toolCall.result}`;
            blockResponseText = output;
            reasoning = blockResponseReasoning;
          } else {
            blockInputPrompt = `Available tools: ${toolBlock.allowedTools.join(', ')}\n\nChoose a tool to use.`;
            blockResponseText = `Model chose from: ${toolBlock.allowedTools.join(', ')}`;
          }
        } else if (block.type === 'respond') {
          const respondBlock = block as RespondBlock;
          blockInputPrompt = `Context:\n${accumulatedContext}\n\nCreate a user-facing response.`;
          
          if (respondBlock.responseSource === 'thinkOutput') {
            blockResponseText = respondBlock.responseGuidance || `Based on the conversation: ${userQuery || 'No user input'}`;
          } else if (respondBlock.responseSource === 'toolResult') {
            blockResponseText = respondBlock.responseGuidance || 'Here are the results from the tool.';
          } else {
            blockResponseText = respondBlock.responseGuidance || 'Custom response generated.';
          }
          output = blockResponseText;
          reasoning = 'Generating user-facing response.';
          
          const responseEvent: TimelineEvent = {
            id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            timestamp: new Date().toISOString(),
            type: 'responseEmitted',
            blockId: block.id,
            blockType: block.type,
            data: { source: respondBlock.responseSource, visibility: respondBlock.visibilityMode },
          };
          setTimeline(prev => [...prev, responseEvent]);
        } else if (block.type === 'stop') {
          blockInputPrompt = 'Runtime complete. End the session.';
          blockResponseText = 'Runtime stopped.';
          output = 'Runtime stopped';
        }

        const result: BlockResult = {
          blockId: block.id,
          success: true,
          output,
          duration: 300,
        };
        setExecutionResults(prev => ({ ...prev, [block.id]: result }));
        setBlockOutputs(prev => ({ 
          ...prev, 
          [block.id]: { 
            reasoning, 
            previousContext: block.type === 'think' ? `User: ${userQuery}` : undefined,
            blockContext: block.type === 'start' ? output : undefined,
            toolCall 
          } 
        }));
        setBlockInputs(prev => ({ ...prev, [block.id]: { prompt: blockInputPrompt, userMessage: userQuery || '' } }));
        setBlockResponses(prev => ({ ...prev, [block.id]: { response: blockResponseText, reasoning: blockResponseReasoning } }));
        
        setRawContextLog(prev => [...prev, 
          { timestamp: new Date().toISOString(), direction: 'sent', content: blockInputPrompt, source: `${getBlockTypeLabel(block.type)} Input` },
          { timestamp: new Date().toISOString(), direction: 'received', content: blockResponseText, source: `${getBlockTypeLabel(block.type)} Output` }
        ]);

        const completeEvent: TimelineEvent = {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          timestamp: new Date().toISOString(),
          type: 'blockComplete',
          blockId: block.id,
          blockType: block.type,
        };
        setTimeline(prev => [...prev, completeEvent]);
      }

      const runtimeCompleteEvent: TimelineEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'runtimeComplete',
        data: { totalBlocks: activeSpec.blocks?.length || 0 },
      };
      setTimeline(prev => [...prev, runtimeCompleteEvent]);
    } catch (err) {
      console.error('Execution error:', err);
    } finally {
      setIsRunning(false);
      setCurrentBlockIndex(-1);
    }
  }, [activeSpec, activeProfile, userQuery, validationErrors]);

  const getBlockColor = (type: BlockType): string => {
    switch (type) {
      case 'start': return '#3b82f6';
      case 'think': return '#8b5cf6';
      case 'tool': return '#10b981';
      case 'respond': return '#f59e0b';
      case 'stop': return '#ef4444';
    }
  };

  const renderBlockCard = (block: RuntimeBlock, index: number) => {
    const isExpanded = expandedBlocks.has(block.id);
    const isStart = block.type === 'start';
    const isStop = block.type === 'stop';
    const canDelete = !isStart && !isStop;
    const canDuplicate = !isStart && !isStop;
    const hasValidationError = block.type === 'think' && !(block as ThinkBlock).allowedNextActions.length;
    const hasToolError = block.type === 'tool' && !(block as ToolBlock).allowedTools.length;

    return (
      <div
        key={block.id}
        draggable={!isLocked}
        onDragStart={(e) => handleDragStart(index, block.id)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnd={handleDragEnd}
        style={{
          backgroundColor: '#fff',
          border: `2px solid ${hasValidationError || hasToolError ? '#ef4444' : '#e2e8f0'}`,
          borderRadius: '8px',
          marginBottom: '0.75rem',
          overflow: 'hidden',
          opacity: block.enabled ? 1 : 0.6,
          transform: draggedItem?.index === index ? 'scale(0.98)' : 'scale(1)',
          transition: 'transform 0.2s, border-color 0.2s',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            backgroundColor: isRunning && currentBlockIndex === index ? '#fef3c7' : '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            gap: '0.75rem',
            cursor: 'grab',
          }}
        >
          <span
            style={{
              fontSize: '1.2rem',
              cursor: isLocked ? 'not-allowed' : 'grab',
            }}
          >
            ⋮⋮
          </span>
          
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: getBlockColor(block.type),
              width: '70px',
            }}
          >
            {getBlockTypeLabel(block.type)}
          </span>
          
          <input
            type="text"
            value={block.name}
            onChange={(e) => !isLocked && handleUpdateBlock(block.id, { name: e.target.value })}
            disabled={isLocked}
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
              checked={block.enabled}
              onChange={(e) => !isLocked && handleToggleBlockEnabled(block.id, e.target.checked)}
              disabled={isLocked}
            />
            Enabled
          </label>
          
          <button
            onClick={() => toggleBlockExpanded(block.id)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '0.9rem',
              padding: '0.25rem',
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          
          {canDuplicate && (
            <button
              onClick={() => handleDuplicateBlock(block.id)}
              disabled={isLocked}
              style={{
                background: 'none',
                border: 'none',
                color: isLocked ? '#cbd5e1' : '#64748b',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                padding: '0.25rem',
              }}
              title="Duplicate"
            >
              ⧉
            </button>
          )}
          
          {canDelete && (
            <button
              onClick={() => handleDeleteBlock(block.id)}
              disabled={isLocked}
              style={{
                background: 'none',
                border: 'none',
                color: isLocked ? '#cbd5e1' : '#ef4444',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                padding: '0.25rem',
              }}
            >
              ×
            </button>
          )}
        </div>
        
        {isExpanded && (
          <div style={{ padding: '1rem' }}>
            {block.type === 'start' && (
              <StartBlockEditor
                block={block as StartBlock}
                onChange={(updates) => handleUpdateBlock(block.id, updates)}
                disabled={isLocked}
              />
            )}
            {block.type === 'think' && (
              <ThinkBlockEditor
                block={block as ThinkBlock}
                blocks={activeSpec?.blocks || []}
                onChange={(updates) => handleUpdateBlock(block.id, updates)}
                disabled={isLocked}
              />
            )}
            {block.type === 'tool' && (
              <ToolBlockEditor
                block={block as ToolBlock}
                allTools={allTools}
                onChange={(updates) => handleUpdateBlock(block.id, updates)}
                disabled={isLocked}
              />
            )}
            {block.type === 'respond' && (
              <RespondBlockEditor
                block={block as RespondBlock}
                onChange={(updates) => handleUpdateBlock(block.id, updates)}
                disabled={isLocked}
              />
            )}
            {block.type === 'stop' && (
              <StopBlockEditor
                block={block as StopBlock}
                onChange={(updates) => handleUpdateBlock(block.id, updates)}
                disabled={isLocked}
              />
            )}
          </div>
        )}

        {!isExpanded && (
          <div style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', backgroundColor: '#fafafa' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ color: '#64748b' }}>Reads: </span>
                {block.type === 'start' && <span>User Input, Runtime Defaults</span>}
                {block.type === 'think' && (
                  <span>{(block as ThinkBlock).contextSources.userInput ? 'User Input, ' : ''}{(block as ThinkBlock).contextSources.runtimeInstructions ? 'Runtime Instructions, ' : ''}{(block as ThinkBlock).contextSources.toolResults ? 'Tool Results, ' : ''}{(block as ThinkBlock).contextSources.priorBlockOutputs ? 'Prior Outputs' : ''}</span>
                )}
                {block.type === 'tool' && <span>Tool Args, Previous State</span>}
                {block.type === 'respond' && (
                  <span>{(block as RespondBlock).responseSource === 'thinkOutput' ? 'Think Output' : (block as RespondBlock).responseSource === 'toolResult' ? 'Tool Result' : 'Custom'}</span>
                )}
                {block.type === 'stop' && <span>-</span>}
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Writes: </span>
                {block.type === 'start' && <span>Run State</span>}
                {block.type === 'think' && <span>Next Action, Reasoning</span>}
                {block.type === 'tool' && <span>Tool Result</span>}
                {block.type === 'respond' && <span>User Response</span>}
                {block.type === 'stop' && <span>Run Status</span>}
              </div>
              {block.type === 'think' && (
                <div>
                  <span style={{ color: '#64748b' }}>Next: </span>
                  <span>{(block as ThinkBlock).allowedNextActions.map(a => getBlockTypeLabel(a)).join(', ')}</span>
                </div>
              )}
              {block.type === 'tool' && (
                <div>
                  <span style={{ color: '#64748b' }}>Tools: </span>
                  <span>{(block as ToolBlock).allowedTools.length} exposed</span>
                </div>
              )}
            </div>
          </div>
        )}

        {executionResults[block.id] && (
          <div style={{ borderTop: '1px solid #e2e8f0' }}>
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', backgroundColor: '#fafafa' }}>
              <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Output:</div>
              <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', padding: '0.5rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0', maxHeight: '80px', overflowY: 'auto' }}>
                {executionResults[block.id].output || '(no output)'}
              </div>
              {blockOutputs[block.id]?.reasoning && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.7rem', color: '#92400e' }}>Reasoning:</div>
                  <div style={{ fontSize: '0.75rem', color: '#78350f' }}>{blockOutputs[block.id].reasoning}</div>
                </div>
              )}
              {blockOutputs[block.id]?.toolCall && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#dcfce7', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.7rem', color: '#166534' }}>Tool: {blockOutputs[block.id].toolCall?.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#15803d' }}>Result: {blockOutputs[block.id].toolCall?.result}</div>
                </div>
              )}
            </div>
            
            <CollapsibleSection title="Debug: Raw Context" defaultExpanded={false}>
              <div style={{ padding: '0.75rem', fontSize: '0.75rem', backgroundColor: '#f8fafc' }}>
                {blockOutputs[block.id]?.previousContext && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Context Sent:</div>
                    <pre style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.65rem', padding: '0.5rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0', maxHeight: '80px', overflowY: 'auto', margin: 0 }}>
{JSON.stringify(blockOutputs[block.id].previousContext, null, 2)}
                    </pre>
                  </div>
                )}
                {!blockOutputs[block.id]?.previousContext && (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>No raw context available</div>
                )}
              </div>
            </CollapsibleSection>

            {blockOutputs[block.id]?.toolCall && (
              <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.75rem 1rem', fontSize: '0.8rem', backgroundColor: '#f0fdf4' }}>
                <div style={{ fontWeight: 600, color: '#166534', marginBottom: '0.5rem' }}>Tool Call:</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  <div><strong>Tool:</strong> {blockOutputs[block.id].toolCall?.name}</div>
                  <div><strong>Arguments:</strong> {JSON.stringify(blockOutputs[block.id].toolCall?.arguments, null, 2)}</div>
                  {blockOutputs[block.id].toolCall?.result && (
                    <div style={{ marginTop: '0.5rem' }}><strong>Result:</strong> {blockOutputs[block.id].toolCall?.result}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', color: '#1a1a1a', backgroundColor: '#fdfdfd' }}>
      <aside style={{ width: '260px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem' }}>
            RUNTIMES
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
              marginBottom: '0.75rem',
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
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDuplicateSpec(spec.id); }}
                    disabled={isLocked}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      padding: '0.125rem',
                    }}
                    title="Duplicate"
                  >
                    ⧉
                  </button>
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
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                {(spec.blocks?.length || 0)} block{(spec.blocks?.length || 0) !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
          
          {specList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
              No runtimes yet.<br />Create one to get started.
            </div>
          )}
        </div>
      </aside>
      
      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
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
              Test Input
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

        {activeSpec ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
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
                  onClick={handleRun}
                  disabled={!activeProfile || isLocked || isRunning || validationErrors.length > 0}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: !activeProfile || isRunning || validationErrors.length > 0 ? '#cbd5e1' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: !activeProfile || isRunning || validationErrors.length > 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isRunning ? '⏳ Running...' : '▶ Run'}
                </button>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>
                  Validation Errors:
                </div>
                {validationErrors.map((error, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: '0.25rem' }}>
                    • {error}
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Add Block:</span>
                <select
                  onChange={(e) => handleAddBlock(e.target.value as BlockType)}
                  disabled={isLocked}
                  value=""
                  style={{
                    padding: '0.25rem 0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    backgroundColor: '#fff',
                  }}
                >
                  <option value="">Select block type...</option>
                  <option value="start">Start Run</option>
                  <option value="think">Think</option>
                  <option value="tool">Use Tool</option>
                  <option value="respond">Respond</option>
                  <option value="stop">Stop</option>
                </select>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                  Drag blocks to reorder
                </span>
              </div>
            </div>
            
            <div style={{ flex: 1 }}>
              {(activeSpec.blocks || []).map((block, index) => renderBlockCard(block, index))}
              
              {(activeSpec.blocks?.length || 0) === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '8px' }}>
                  No blocks yet. Add a block to start building your runtime.
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Select or create a runtime</h2>
            <p style={{ fontSize: '0.9rem' }}>Choose a runtime from the sidebar or create a new one to get started.</p>
          </div>
        )}
      </main>
      
      <aside style={{ width: '340px', backgroundColor: '#fafafa', borderLeft: '1px solid #e2e8f0', padding: '1rem', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem' }}>
          CONTEXT INSPECTOR
        </h3>
        
        {isRunning && (
          <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e' }}>
            Running block {currentBlockIndex + 1}...
          </div>
        )}
        
        {timeline.length === 0 && !isRunning && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
            Run the runtime to see context inspector.
          </div>
        )}
        
        {timeline.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => setInspectorMode('state')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: inspectorMode === 'state' ? '#3b82f6' : '#fff',
                  color: inspectorMode === 'state' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                State View
              </button>
              <button
                onClick={() => setInspectorMode('block')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: inspectorMode === 'block' ? '#3b82f6' : '#fff',
                  color: inspectorMode === 'block' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Block I/O
              </button>
              <button
                onClick={() => setInspectorMode('raw')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: inspectorMode === 'raw' ? '#3b82f6' : '#fff',
                  color: inspectorMode === 'raw' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Raw Context
              </button>
            </div>
            
            {inspectorMode === 'state' && (
              <>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Runtime State Progression:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activeSpec?.blocks.filter(b => b.enabled).map((block, idx) => (
                    <div
                      key={block.id}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.25rem' }}>
                        {idx + 1}. {getBlockTypeLabel(block.type)}: {block.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        <div><span style={{ fontWeight: 600 }}>Reads:</span> {
                          block.type === 'start' ? 'User Input, Runtime Defaults' :
                          block.type === 'think' ? ((block as ThinkBlock).contextSources.userInput ? 'User Input, ' : '') + ((block as ThinkBlock).contextSources.runtimeInstructions ? 'Runtime Instructions, ' : '') + ((block as ThinkBlock).contextSources.toolResults ? 'Tool Results' : '') :
                          block.type === 'tool' ? 'Tool Args, Previous State' :
                          block.type === 'respond' ? ((block as RespondBlock).responseSource === 'thinkOutput' ? 'Think Output' : (block as RespondBlock).responseSource === 'toolResult' ? 'Tool Result' : 'Custom') :
                          '-'
                        }</div>
                        <div><span style={{ fontWeight: 600 }}>Writes:</span> {
                          block.type === 'start' ? 'Run State' :
                          block.type === 'think' ? 'Next Action, Reasoning' :
                          block.type === 'tool' ? 'Tool Result' :
                          block.type === 'respond' ? 'User Response' :
                          block.type === 'stop' ? 'Run Status' :
                          '-'
                        }</div>
                        {block.type === 'tool' && (
                          <div><span style={{ fontWeight: 600 }}>Exposes:</span> {(block as ToolBlock).allowedTools.join(', ') || 'none'}</div>
                        )}
                        {block.type === 'think' && (
                          <div><span style={{ fontWeight: 600 }}>Allowed Next:</span> {(block as ThinkBlock).allowedNextActions.map(a => getBlockTypeLabel(a)).join(', ')}</div>
                        )}
                      </div>
                      {executionResults[block.id] && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f0fdf4', borderRadius: '4px', fontSize: '0.7rem' }}>
                          <span style={{ fontWeight: 600, color: '#166534' }}>Output: </span>
                          {executionResults[block.id].output}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {(!activeSpec?.blocks || activeSpec.blocks.length === 0) && (
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No blocks in runtime</div>
                )}
              </>
            )}

            {inspectorMode === 'block' && selectedBlockForInspector && blockInputs[selectedBlockForInspector] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <CollapsibleSection title="Input: Prompt to Model" defaultExpanded={true}>
                  <div style={{ padding: '0.75rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <pre style={{ fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
{blockInputs[selectedBlockForInspector].prompt}
                    </pre>
                  </div>
                </CollapsibleSection>
                
                <CollapsibleSection title="Output: Model Response" defaultExpanded={true}>
                  <div style={{ padding: '0.75rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <pre style={{ fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
{blockResponses[selectedBlockForInspector]?.response || '(no response)'}
                    </pre>
                  </div>
                </CollapsibleSection>
                
                {blockOutputs[selectedBlockForInspector]?.toolCall && (
                  <CollapsibleSection title="Tool Call Details" defaultExpanded={true}>
                    <div style={{ padding: '0.75rem', backgroundColor: '#dcfce7', borderRadius: '4px', border: '1px solid #86efac' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Tool: {blockOutputs[selectedBlockForInspector].toolCall?.name}</div>
                      <div style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>Arguments: {JSON.stringify(blockOutputs[selectedBlockForInspector].toolCall?.arguments, null, 2)}</div>
                      {blockOutputs[selectedBlockForInspector].toolCall?.result && (
                        <div style={{ fontSize: '0.7rem' }}>Result: {blockOutputs[selectedBlockForInspector].toolCall?.result}</div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            )}
            
            {inspectorMode === 'raw' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {rawContextLog.map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: entry.direction === 'sent' ? '#dbeafe' : '#dcfce7',
                      borderRadius: '4px',
                      border: `1px solid ${entry.direction === 'sent' ? '#93c5fd' : '#86efac'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: entry.direction === 'sent' ? '#1d4ed8' : '#166534' }}>
                        {entry.direction === 'sent' ? '📤 SENT TO AI' : '📥 RECEIVED FROM AI'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{entry.source}</span>
                    </div>
                    <pre style={{ fontFamily: 'monospace', fontSize: '0.65rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: '120px', overflowY: 'auto' }}>
{entry.content}
                    </pre>
                  </div>
                ))}
                
                {rawContextLog.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                    No context logged yet.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function StartBlockEditor({ block, onChange, disabled }: { block: StartBlock; onChange: (updates: Partial<StartBlock>) => void; disabled: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
          <input
            type="checkbox"
            checked={block.acceptsUserInput}
            onChange={(e) => onChange({ acceptsUserInput: e.target.checked })}
            disabled={disabled}
          />
          Accepts user input
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
          <input
            type="checkbox"
            checked={block.includeDefaults}
            onChange={(e) => onChange({ includeDefaults: e.target.checked })}
            disabled={disabled}
          />
          Include runtime defaults
        </label>
      </div>
      
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Startup Instructions
        </label>
        <textarea
          value={block.startupInstructions}
          onChange={(e) => onChange({ startupInstructions: e.target.value })}
          disabled={disabled}
          rows={3}
          placeholder="Enter instructions for how this runtime should begin..."
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

function ThinkBlockEditor({ block, blocks, onChange, disabled }: { block: ThinkBlock; blocks: RuntimeBlock[]; onChange: (updates: Partial<ThinkBlock>) => void; disabled: boolean }) {
  const nextToolBlocks = blocks.filter(b => b.type === 'tool');
  const nextRespondBlocks = blocks.filter(b => b.type === 'respond');
  const nextStopBlocks = blocks.filter(b => b.type === 'stop');

  const handleActionToggle = (action: BlockType) => {
    const newActions = block.allowedNextActions.includes(action)
      ? block.allowedNextActions.filter(a => a !== action)
      : [...block.allowedNextActions, action];
    onChange({ allowedNextActions: newActions });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Think Mode
          </label>
          <select
            value={block.thinkMode}
            onChange={(e) => onChange({ thinkMode: e.target.value as ThinkMode })}
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
            <option value="decide">Decide next action</option>
            <option value="draft">Draft response</option>
            <option value="summarize">Summarize</option>
            <option value="classify">Classify</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Output Mode
          </label>
          <select
            value={block.outputMode}
            onChange={(e) => onChange({ outputMode: e.target.value as OutputMode })}
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
            <option value="freeform">Freeform text</option>
            <option value="actionSelection">Structured action selection</option>
            <option value="structured">Structured object</option>
          </select>
        </div>
      </div>
      
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Instruction Text
        </label>
        <textarea
          value={block.instructionText}
          onChange={(e) => onChange({ instructionText: e.target.value })}
          disabled={disabled}
          rows={2}
          placeholder="Guidance for what this reasoning step should do..."
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
      
      <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
          Next Actions (Writes To)
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={block.allowedNextActions.includes('tool')}
              onChange={() => handleActionToggle('tool')}
              disabled={disabled}
            />
            Use Tool
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={block.allowedNextActions.includes('respond')}
              onChange={() => handleActionToggle('respond')}
              disabled={disabled}
            />
            Respond
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={block.allowedNextActions.includes('stop')}
              onChange={() => handleActionToggle('stop')}
              disabled={disabled}
            />
            Stop
          </label>
        </div>
        
        {block.allowedNextActions.includes('tool') && nextToolBlocks.length > 0 && (
          <div style={{ marginTop: '0.75rem', marginLeft: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
              Routing Mode
            </label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                <input
                  type="radio"
                  name={`routing-${block.id}`}
                  checked={block.routingMode === 'typeBased'}
                  onChange={() => onChange({ routingMode: 'typeBased', routingTargetId: undefined })}
                  disabled={disabled}
                />
                Type-based (any tool)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                <input
                  type="radio"
                  name={`routing-${block.id}`}
                  checked={block.routingMode === 'blockSpecific'}
                  onChange={() => onChange({ routingMode: 'blockSpecific' })}
                  disabled={disabled}
                />
                Block-specific
              </label>
            </div>
            {block.routingMode === 'blockSpecific' && (
              <select
                value={block.routingTargetId || ''}
                onChange={(e) => onChange({ routingTargetId: e.target.value || undefined })}
                disabled={disabled}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '0.3rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  backgroundColor: '#fff',
                }}
              >
                <option value="">Select specific tool block...</option>
                {nextToolBlocks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
      
      <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
          Reads From (Context Sources)
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={block.contextSources.runtimeInstructions}
              onChange={(e) => onChange({ contextSources: { ...block.contextSources, runtimeInstructions: e.target.checked } })}
              disabled={disabled}
            />
            Runtime instructions
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={block.contextSources.userInput}
              onChange={(e) => onChange({ contextSources: { ...block.contextSources, userInput: e.target.checked } })}
              disabled={disabled}
            />
            User input
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={block.contextSources.priorBlockOutputs}
              onChange={(e) => onChange({ contextSources: { ...block.contextSources, priorBlockOutputs: e.target.checked } })}
              disabled={disabled}
            />
            Prior block outputs
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={block.contextSources.toolResults}
              onChange={(e) => onChange({ contextSources: { ...block.contextSources, toolResults: e.target.checked } })}
              disabled={disabled}
            />
            Tool results
          </label>
        </div>
      </div>
    </div>
  );
}

function ToolBlockEditor({ block, allTools, onChange, disabled }: { block: ToolBlock; allTools: { name: string; description: string }[]; onChange: (updates: Partial<ToolBlock>) => void; disabled: boolean }) {
  const handleToolToggle = (toolName: string) => {
    const newTools = block.allowedTools.includes(toolName)
      ? block.allowedTools.filter(t => t !== toolName)
      : [...block.allowedTools, toolName];
    onChange({ allowedTools: newTools });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Tool Access Mode
          </label>
          <select
            value={block.toolAccessMode}
            onChange={(e) => onChange({ toolAccessMode: e.target.value as ToolAccessMode })}
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
            <option value="fixed">Fixed tool</option>
            <option value="modelChoice">Model chooses from allowed</option>
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Argument Source
          </label>
          <select
            value={block.argumentSource}
            onChange={(e) => onChange({ argumentSource: e.target.value as ArgumentSource })}
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
            <option value="static">Static arguments</option>
            <option value="dynamic">Generated from Think output</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
      </div>

      {block.argumentSource === 'static' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Static Arguments (JSON)
          </label>
          <textarea
            value={JSON.stringify(block.staticArguments || {}, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange({ staticArguments: parsed });
              } catch {}
            }}
            disabled={disabled}
            rows={3}
            placeholder='{"key": "value"}'
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
      )}
      
      <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
          Allowed Tools {block.toolAccessMode === 'fixed' && '(select one)'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '150px', overflowY: 'auto' }}>
          {allTools.map((tool) => (
            <label key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type={block.toolAccessMode === 'fixed' ? 'radio' : 'checkbox'}
                name={block.toolAccessMode === 'fixed' ? `tool-${block.id}` : undefined}
                checked={block.allowedTools.includes(tool.name)}
                onChange={() => handleToolToggle(tool.name)}
                disabled={disabled}
              />
              <span style={{ fontWeight: 500 }}>{tool.name}</span>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>- {tool.description}</span>
            </label>
          ))}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Result Handling
          </label>
          <select
            value={block.resultHandling}
            onChange={(e) => onChange({ resultHandling: e.target.value as ResultHandling })}
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
            <option value="timeline">Append to timeline</option>
            <option value="blockOutput">Store as block output</option>
            <option value="nextThink">Make available to next Think</option>
            <option value="internal">Internal only</option>
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Failure Behavior
          </label>
          <select
            value={block.failureBehavior}
            onChange={(e) => onChange({ failureBehavior: e.target.value as FailureBehavior })}
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
            <option value="continue">Continue with error result</option>
            <option value="retry">Retry once</option>
            <option value="routeBack">Route back to Think</option>
            <option value="stop">Stop run</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function RespondBlockEditor({ block, onChange, disabled }: { block: RespondBlock; onChange: (updates: Partial<RespondBlock>) => void; disabled: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Response Source
          </label>
          <select
            value={block.responseSource}
            onChange={(e) => onChange({ responseSource: e.target.value as ResponseSource })}
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
            <option value="thinkOutput">Prior Think output</option>
            <option value="toolResult">Tool result transformed</option>
            <option value="custom">Custom model-generated</option>
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
            Visibility Mode
          </label>
          <select
            value={block.visibilityMode}
            onChange={(e) => onChange({ visibilityMode: e.target.value as VisibilityMode })}
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
            <option value="final">Final answer</option>
            <option value="interim">Interim update</option>
            <option value="debug">Debug/status message</option>
          </select>
        </div>
      </div>
      
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Response Guidance
        </label>
        <textarea
          value={block.responseGuidance}
          onChange={(e) => onChange({ responseGuidance: e.target.value })}
          disabled={disabled}
          rows={2}
          placeholder="Optional tone, format, or response constraints..."
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

function StopBlockEditor({ block, onChange, disabled }: { block: StopBlock; onChange: (updates: Partial<StopBlock>) => void; disabled: boolean }) {
  return (
    <div>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
        Stop Reason (optional)
      </label>
      <input
        type="text"
        value={block.stopReason}
        onChange={(e) => onChange({ stopReason: e.target.value })}
        disabled={disabled}
        placeholder="e.g., User requested stop, Task complete, etc."
        style={{
          width: '100%',
          padding: '0.4rem 0.6rem',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          fontSize: '0.8rem',
          backgroundColor: '#fff',
        }}
      />
    </div>
  );
}