'use client';

import { useState, useCallback } from 'react';
import { useSandbox, useProfiles } from '@/lib/state';

type TabId = 'registry' | 'definition' | 'invocation' | 'exposure' | 'parser' | 'dryrun';

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
        fontSize: '0.75rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

const BUILT_IN_TOOLS = [
  {
    id: 'get_time',
    name: 'get_time',
    description: 'Returns the current system time including timestamp and timezone.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    id: 'list_files',
    name: 'list_files',
    description: 'Lists all files in the sandbox directory.',
    parameters: { type: 'object', properties: { dirPath: { type: 'string', description: 'Optional directory path to list' } }, required: [] },
  },
  {
    id: 'read_file',
    name: 'read_file',
    description: 'Reads the content of a file in the sandbox. Requires filePath parameter.',
    parameters: { type: 'object', properties: { filePath: { type: 'string', description: 'The path to the file to read' } }, required: ['filePath'] },
  },
  {
    id: 'search_text',
    name: 'search_text',
    description: 'Searches for text matching a pattern in sandbox files.',
    parameters: { type: 'object', properties: { pattern: { type: 'string', description: 'The text pattern to search for' }, dirPath: { type: 'string', description: 'Optional directory to search in' } }, required: ['pattern'] },
  },
  {
    id: 'remember_for_next_run',
    name: 'remember_for_next_run',
    description: 'Persist context for the next run. Use this to carry forward important information.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'The content to remember' } }, required: ['content'] },
  },
];

function ToolRegistry({ 
  customTools,
  onToggle,
  onDelete,
}: { 
  customTools: any[];
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Built-in Tools</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {BUILT_IN_TOOLS.map((tool) => (
            <div key={tool.id} style={{ padding: '0.75rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tool.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{tool.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Custom Tools</h3>
        {customTools.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', border: '1px dashed #e2e8f0', borderRadius: '6px' }}>
            No custom tools yet. Create one below.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {customTools.map((tool) => (
              <div key={tool.id} style={{ padding: '0.75rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tool.name}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={tool.enabled}
                        onChange={(e) => onToggle(tool.id, e.target.checked)}
                      />
                      Enabled
                    </label>
                    <button
                      onClick={() => onDelete(tool.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{tool.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolDefinition({ onSave }: { onSave: (tool: any) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaText, setSchemaText] = useState('{\n  "type": "object",\n  "properties": {}\n}');
  const [code, setCode] = useState('// Tool implementation\nreturn "Hello!";');

  const handleSave = () => {
    if (!name.trim()) return;
    
    try {
      JSON.parse(schemaText);
    } catch {
      alert('Invalid JSON schema');
      return;
    }

    onSave({
      id: `custom_${Date.now()}`,
      name,
      description,
      parameters: JSON.parse(schemaText),
      code,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setName('');
    setDescription('');
    setSchemaText('{\n  "type": "object",\n  "properties": {}\n}');
    setCode('// Tool implementation\nreturn "Hello!";');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Tool Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my_custom_tool"
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.85rem',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this tool do?"
          rows={2}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.85rem',
            resize: 'vertical',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          JSON Schema
        </label>
        <textarea
          value={schemaText}
          onChange={(e) => setSchemaText(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            resize: 'vertical',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Implementation Code
        </label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            resize: 'vertical',
          }}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!name.trim()}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: name.trim() ? '#3b82f6' : '#cbd5e1',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: name.trim() ? 'pointer' : 'not-allowed',
        }}
      >
        Save Tool
      </button>
    </div>
  );
}

function DirectInvocation({ tools }: { tools: any[] }) {
  const [selectedTool, setSelectedTool] = useState('');
  const [argsText, setArgsText] = useState('{}');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const allTools = [...BUILT_IN_TOOLS, ...tools];

  const handleExecute = async () => {
    if (!selectedTool) return;
    
    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      const args = JSON.parse(argsText);
      
      let execResult: any;
      switch (selectedTool) {
        case 'get_time':
          execResult = { time: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
          break;
        case 'list_files':
          execResult = { files: ['file1.txt', 'file2.txt', 'folder/'] };
          break;
        case 'read_file':
          execResult = { content: 'Sample file content' };
          break;
        case 'search_text':
          execResult = { matches: ['line 1', 'line 5'] };
          break;
        case 'remember_for_next_run':
          execResult = { success: true, message: 'Remembered for next run' };
          break;
        default:
          execResult = { message: 'Tool executed (custom tool simulation)' };
      }
      
      setResult(execResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Select Tool
        </label>
        <select
          value={selectedTool}
          onChange={(e) => setSelectedTool(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.85rem',
          }}
        >
          <option value="">Select a tool...</option>
          {allTools.map((tool) => (
            <option key={tool.id} value={tool.name}>
              {tool.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Arguments (JSON)
        </label>
        <textarea
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
          }}
        />
      </div>

      <button
        onClick={handleExecute}
        disabled={!selectedTool || executing}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: selectedTool && !executing ? '#10b981' : '#cbd5e1',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: selectedTool && !executing ? 'pointer' : 'not-allowed',
        }}
      >
        {executing ? 'Executing...' : 'Execute'}
      </button>

      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', color: '#ef4444', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#16a34a', marginBottom: '0.25rem' }}>RESULT:</div>
          <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolExposurePreview({ tools }: { tools: any[] }) {
  const [selectedTool, setSelectedTool] = useState('');
  
  const allTools = [...BUILT_IN_TOOLS, ...tools];
  const tool = allTools.find(t => t.name === selectedTool);

  const getExposurePayload = () => {
    if (!tool) return null;
    
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || { type: 'object', properties: {} },
      },
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Select Tool
        </label>
        <select
          value={selectedTool}
          onChange={(e) => setSelectedTool(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.85rem',
          }}
        >
          <option value="">Select a tool...</option>
          {allTools.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {tool && (
        <>
          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>TOOL NAME</div>
            <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{tool.name}</div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>DESCRIPTION</div>
            <div style={{ fontSize: '0.9rem' }}>{tool.description}</div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>PARAMETER SCHEMA</div>
            <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(tool.parameters || { type: 'object', properties: {} }, null, 2)}
            </pre>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#1e293b', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>FINAL PAYLOAD (what model sees)</div>
            <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
              {JSON.stringify(getExposurePayload(), null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

function ToolCallParser() {
  const [rawOutput, setRawOutput] = useState('');
  const [parseResult, setParseResult] = useState<any>(null);

  const handleParse = () => {
    if (!rawOutput.trim()) return;

    const toolCallPattern = /<tool_call>\s*<tool name="([^"]+)">\s*<parameter name="([^"]+)">([^<]+)<\/parameter>\s*<\/tool>\s*<\/tool_call>/gi;
    const jsonPattern = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
    
    let detectedAction: string = 'respond';
    const toolCalls: any[] = [];
    const parserNotes: string[] = [];
    const parserErrors: string[] = [];

    let match;
    while ((match = toolCallPattern.exec(rawOutput)) !== null) {
      detectedAction = 'tool_call';
      toolCalls.push({
        toolName: match[1],
        rawArgumentsText: match[3],
        parsedArguments: {},
        isValid: false,
        validationErrors: ['Arguments not parsed - XML format detected'],
      });
      parserNotes.push(`Detected XML tool call: ${match[1]}`);
    }

    while ((match = jsonPattern.exec(rawOutput)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.name || parsed.tool) {
          detectedAction = 'tool_call';
          toolCalls.push({
            toolName: parsed.name || parsed.tool,
            rawArgumentsText: match[1],
            parsedArguments: parsed.arguments || parsed.parameters || {},
            isValid: true,
          });
          parserNotes.push(`Detected JSON tool call: ${parsed.name || parsed.tool}`);
        }
      } catch {
        parserErrors.push('Failed to parse JSON tool call');
      }
    }

    if (toolCalls.length === 0 && !rawOutput.includes('tool') && rawOutput.length > 10) {
      detectedAction = 'respond';
      parserNotes.push('No tool calls detected - treating as direct response');
    }

    setParseResult({
      detectedAction,
      toolCalls,
      parserNotes,
      parserErrors,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Raw Model Output
        </label>
        <textarea
          value={rawOutput}
          onChange={(e) => setRawOutput(e.target.value)}
          placeholder="Paste raw model output here..."
          rows={6}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            resize: 'vertical',
          }}
        />
      </div>

      <button
        onClick={handleParse}
        disabled={!rawOutput.trim()}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: rawOutput.trim() ? '#3b82f6' : '#cbd5e1',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: rawOutput.trim() ? 'pointer' : 'not-allowed',
        }}
      >
        Parse Output
      </button>

      {parseResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: parseResult.detectedAction === 'tool_call' ? '#dcfce7' : '#f1f5f9', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>DETECTED ACTION</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: parseResult.detectedAction === 'tool_call' ? '#16a34a' : '#1e293b' }}>
              {parseResult.detectedAction}
            </div>
          </div>

          {parseResult.toolCalls.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>PARSED TOOL CALLS</div>
              {parseResult.toolCalls.map((tc: any, i: number) => (
                <div key={i} style={{ padding: '0.75rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tc.toolName}</div>
                  <div style={{ fontSize: '0.75rem', color: tc.isValid ? '#16a34a' : '#ef4444' }}>
                    {tc.isValid ? 'Valid' : 'Invalid'}
                  </div>
                  {tc.validationErrors?.map((err: string, j: number) => (
                    <div key={j} style={{ fontSize: '0.7rem', color: '#ef4444' }}>{err}</div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {parseResult.parserNotes.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>PARSER NOTES</div>
              {parseResult.parserNotes.map((note: string, i: number) => (
                <div key={i} style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.25rem 0' }}>{note}</div>
              ))}
            </div>
          )}

          {parseResult.parserErrors.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.5rem' }}>ERRORS</div>
              {parseResult.parserErrors.map((err: string, i: number) => (
                <div key={i} style={{ fontSize: '0.75rem', color: '#ef4444', padding: '0.25rem 0' }}>{err}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EndToEndDryRun() {
  const [userPrompt, setUserPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['get_time']);
  const [isLoading, setIsLoading] = useState(false);
  const [rawOutput, setRawOutput] = useState('');
  const [parsedCall, setParsedCall] = useState<any>(null);

  const toggleTool = (toolName: string) => {
    setSelectedTools(prev => 
      prev.includes(toolName) 
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  const handleRun = async () => {
    if (!userPrompt.trim()) return;
    
    setIsLoading(true);
    setRawOutput('');
    setParsedCall(null);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockOutput = `I'll get the current time for you.

<tool_call>
<tool name="get_time">
</tool>
</tool_call>`;

    setRawOutput(mockOutput);
    setParsedCall({
      detectedAction: 'tool_call',
      toolCalls: [{
        toolName: 'get_time',
        rawArgumentsText: '',
        parsedArguments: {},
        isValid: true,
      }],
    });

    setIsLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
          Test Prompt
        </label>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="What would you like the model to do?"
          rows={3}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.85rem',
            resize: 'vertical',
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>
          Exposed Tools
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {BUILT_IN_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => toggleTool(tool.name)}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: selectedTools.includes(tool.name) ? '#3b82f6' : '#fff',
                color: selectedTools.includes(tool.name) ? '#fff' : '#1e293b',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {tool.name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={!userPrompt.trim() || isLoading}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: userPrompt.trim() && !isLoading ? '#10b981' : '#cbd5e1',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: userPrompt.trim() && !isLoading ? 'pointer' : 'not-allowed',
        }}
      >
        {isLoading ? 'Running...' : 'Run Test'}
      </button>

      {rawOutput && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>RAW MODEL OUTPUT</div>
          <pre style={{ margin: 0, padding: '0.75rem', backgroundColor: '#1e293b', color: '#e2e8f0', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {rawOutput}
          </pre>
        </div>
      )}

      {parsedCall && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>PARSED TOOL CALL</div>
          <pre style={{ margin: 0, padding: '0.75rem', backgroundColor: '#dcfce7', color: '#1e293b', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(parsedCall, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function ToolsPage() {
  const { sandbox, updateSandbox } = useSandbox();
  const { profiles } = useProfiles();
  
  const [activeTab, setActiveTab] = useState<TabId>('registry');
  
  const customTools = sandbox.customTools || [];

  const handleToggleTool = useCallback((id: string, enabled: boolean) => {
    const updatedTools = customTools.map(t => 
      t.id === id ? { ...t, enabled } : t
    );
    updateSandbox({ customTools: updatedTools });
  }, [customTools, updateSandbox]);

  const handleDeleteTool = useCallback((id: string) => {
    if (!confirm('Delete this tool?')) return;
    const updatedTools = customTools.filter(t => t.id !== id);
    updateSandbox({ customTools: updatedTools });
  }, [customTools, updateSandbox]);

  const handleSaveTool = useCallback((tool: any) => {
    updateSandbox({ 
      customTools: [...customTools, tool] 
    });
  }, [customTools, updateSandbox]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'registry', label: 'Registry' },
    { id: 'definition', label: 'Create' },
    { id: 'invocation', label: 'Invoke' },
    { id: 'exposure', label: 'Exposure' },
    { id: 'parser', label: 'Parser' },
    { id: 'dryrun', label: 'Dry Run' },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', backgroundColor: '#fdfdfd' }}>
      <aside style={{ width: '280px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '1rem', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', margin: '0 0 1rem' }}>
          TOOLS
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
      </aside>
      
      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        {activeTab === 'registry' && (
          <ToolRegistry
            customTools={customTools}
            onToggle={handleToggleTool}
            onDelete={handleDeleteTool}
          />
        )}
        {activeTab === 'definition' && (
          <ToolDefinition onSave={handleSaveTool} />
        )}
        {activeTab === 'invocation' && (
          <DirectInvocation tools={customTools} />
        )}
        {activeTab === 'exposure' && (
          <ToolExposurePreview tools={customTools} />
        )}
        {activeTab === 'parser' && (
          <ToolCallParser />
        )}
        {activeTab === 'dryrun' && (
          <EndToEndDryRun />
        )}
      </main>
    </div>
  );
}
