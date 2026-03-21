'use client';

import { useState, useEffect, useRef, DragEvent } from 'react';
import { toolDefinitions } from '@/lib/tools/definitions';
import { 
  listFiles, 
  deleteFile, 
  readFile, 
  uploadFile, 
  getStorageUsage, 
  canStoreFile, 
  listExistingFiles, 
  MAX_STORAGE_BYTES, 
  FileEntry 
} from '@/lib/tools/file-storage';
import { searchInFiles } from '@/lib/tools/file-walker';

type ExecutionStep = {
  label: string;
  status: 'info' | 'success' | 'error';
  details?: string;
  timestamp: string;
};

type ToolDraft = {
  name: string;
  description: string;
  schemaText: string;
  enabled: boolean;
  code: string;
};

type ToolInvocationDraft = {
  argsText: string;
};

type ToolTraceEntry = {
  id: string;
  timestamp: string;
  toolName: string;
  argsText: string;
  parsedArgs?: unknown;
  validation: {
    ok: boolean;
    errors: string[];
  };
  result?: unknown;
  error?: string;
  steps: ExecutionStep[];
};

type ExecutionPipelineState = {
  rawArgsText: string;
  parsedArgs?: unknown;
  parseError?: string;
  validation: {
    ok: boolean;
    errors: string[];
  };
  result?: unknown;
  error?: string;
  active: boolean;
};

type UploadProgress = {
  current: number;
  total: number;
  currentFile: string;
};

type OverwriteConfirmState = {
  files: string[];
  resolve: (confirm: boolean) => void;
};

const DEFAULT_CODE_TEMPLATE = `async function run({ args, helpers }) {
  const { now, sleep, log } = helpers;
  log("Initializing tool...");
  
  await sleep(100); 
  return { 
    status: "success", 
    received: args,
    time: now() 
  };
}`;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function getFilesFromDataTransfer(items: DataTransferItemList, basePath: string = ''): Promise<File[]> {
  const files: File[] = [];
  
  const processEntry = async (entry: FileSystemEntry, path: string): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      files.push(new File([file], file.name, { type: file.type, lastModified: file.lastModified }));
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      const newPath = path ? `${path}/${entry.name}` : entry.name;
      for (const childEntry of entries) {
        await processEntry(childEntry, newPath);
      }
    }
  };
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        await processEntry(entry, basePath);
      }
    }
  }
  
  return files;
}

export default function ToolsSandbox() {
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [sandboxFiles, setSandboxFiles] = useState<FileEntry[]>([]);
  const [isRefreshingFiles, setIsRefreshingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [overwriteConfirm, setOverwriteConfirm] = useState<OverwriteConfirmState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [toolDrafts, setToolDrafts] = useState<Record<string, ToolDraft>>(() => {
    const initialDrafts: Record<string, ToolDraft> = {};
    toolDefinitions.forEach(def => {
      initialDrafts[def.name] = {
        name: def.name,
        description: def.description,
        schemaText: JSON.stringify(def.parameters, null, 2),
        enabled: true,
        code: DEFAULT_CODE_TEMPLATE
      };
    });
    return initialDrafts;
  });

  const refreshSandboxFiles = async () => {
    setIsRefreshingFiles(true);
    try {
      const files = await listFiles('');
      setSandboxFiles(files);
      const usage = await getStorageUsage();
      setStorageUsed(usage);
    } catch (e) { console.error(e); }
    finally { setIsRefreshingFiles(false); }
  };

  const handleDeleteFile = async (name: string) => {
    try {
      await deleteFile(name);
      refreshSandboxFiles();
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    refreshSandboxFiles();
  }, []);

  const [invocationDrafts, setInvocationDrafts] = useState<Record<string, ToolInvocationDraft>>(() => {
    const initialInvocations: Record<string, ToolInvocationDraft> = {};
    toolDefinitions.forEach(def => {
      initialInvocations[def.name] = {
        argsText: "{}",
      };
    });
    return initialInvocations;
  });

  const [pipeline, setPipeline] = useState<ExecutionPipelineState>({
    rawArgsText: "",
    validation: { ok: true, errors: [] },
    active: false
  });

  const [trace, setTrace] = useState<ToolTraceEntry[]>([]);
  const [expandedTraceIds, setExpandedTraceIds] = useState<Set<string>>(new Set());
  const [lastValidation, setLastValidation] = useState<Record<string, { ok: boolean, errors: string[] }>>({});

  const selectedTool = selectedToolId ? toolDrafts[selectedToolId] : null;
  const selectedInvocation = selectedToolId ? invocationDrafts[selectedToolId] : null;

  const updateToolDraft = (id: string, updates: Partial<ToolDraft>) => {
    setToolDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const updateInvocationDraft = (id: string, updates: Partial<ToolInvocationDraft>) => {
    setInvocationDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const resetToolDraft = (id: string) => {
    const original = toolDefinitions.find(d => d.name === id);
    if (original) {
      setToolDrafts(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          name: original.name,
          description: original.description,
          schemaText: JSON.stringify(original.parameters, null, 2),
          code: DEFAULT_CODE_TEMPLATE
        }
      }));
    }
  };

  const validateArgs = (toolId: string) => {
    const draft = toolDrafts[toolId];
    const invocation = invocationDrafts[toolId];
    let errors: string[] = [];
    let parsedArgs: any = null;

    try {
      parsedArgs = JSON.parse(invocation.argsText);
      const schema = JSON.parse(draft.schemaText);
      if (schema.required) {
        schema.required.forEach((req: string) => {
          if (!(req in parsedArgs)) {
            errors.push(`Missing required parameter: ${req}`);
          }
        });
      }
    } catch (e: any) {
      errors.push(`JSON Parse Error: ${e.message}`);
    }

    return { ok: errors.length === 0, errors, parsedArgs };
  };

  const handleValidate = (toolId: string) => {
    const result = validateArgs(toolId);
    setLastValidation(prev => ({ ...prev, [toolId]: { ok: result.ok, errors: result.errors } }));
  };

  const builtInTools: Record<string, (args: any) => Promise<any>> = {
    get_time: async () => new Date().toISOString(),
    list_files: async (args: { dirPath?: string }) => {
      const files = await listFiles(args.dirPath || '');
      return files.map(f => ({ name: f.name, type: f.type }));
    },
    read_file: async (args: { filePath: string }) => {
      const file = await readFile(args.filePath);
      if (!file) throw new Error('File not found');
      return { name: file.name, content: file.content };
    },
    search_text: async (args: { pattern: string; dirPath?: string }) => {
      return searchInFiles(args.pattern, { dirPath: args.dirPath });
    },
  };

  const handleExecute = async (toolId: string) => {
    const draft = toolDrafts[toolId];
    const invocation = invocationDrafts[toolId];
    const steps: ExecutionStep[] = [];
    const addStep = (label: string, status: 'info' | 'success' | 'error', details?: string) => {
      steps.push({ label, status, details, timestamp: new Date().toLocaleTimeString() });
    };

    const pipelineState: ExecutionPipelineState = {
      rawArgsText: invocation.argsText,
      validation: { ok: true, errors: [] },
      active: true
    };

    addStep("Initializing tool execution", "info");
    addStep("Capturing raw input", "info");

    addStep("Parsing arguments JSON", "info");
    try {
      pipelineState.parsedArgs = JSON.parse(invocation.argsText);
      addStep("Arguments parsed successfully", "success");
    } catch (e: any) {
      pipelineState.parseError = e.message;
      addStep("Failed to parse arguments", "error", e.message);
    }

    const { ok, errors, parsedArgs } = validateArgs(toolId);
    pipelineState.validation = { ok, errors };
    if (!ok) {
      addStep("Argument validation failed", "error", errors.join(", "));
    } else {
      addStep("Argument validation successful", "success");
    }

    const entryId = Math.random().toString(36).substring(7);
    const timestamp = new Date().toLocaleTimeString();

    let result = null;
    let error = null;

    if (pipelineState.parseError || !ok) {
      error = pipelineState.parseError || "Validation failed.";
    } else {
      addStep("Executing client action", "info");
      try {
        const helpers = {
          now: () => new Date().toISOString(),
          sleep: (ms: number) => new Promise(r => setTimeout(r, ms)),
          log: (msg: string) => addStep(`[Action Log] ${msg}`, "info")
        };

        if (builtInTools[toolId]) {
          addStep(`Running built-in: ${toolId}`, "info");
          result = await builtInTools[toolId](parsedArgs);
        } else {
          const runner = new Function('args', 'helpers', `
            ${draft.code}
            return run({ args, helpers });
          `);
          result = await runner(parsedArgs, helpers);
        }
        addStep("Execution complete", "success");
      } catch (e: any) {
        addStep("Runtime error", "error", e.message);
        error = e.message;
      }
    }

    pipelineState.result = result;
    pipelineState.error = error;
    setPipeline(pipelineState);

    addStep("Cycle complete", error ? "error" : "success");

    const newEntry: ToolTraceEntry = {
      id: entryId,
      timestamp,
      toolName: toolId,
      argsText: invocation.argsText,
      parsedArgs,
      validation: { ok, errors },
      result,
      error,
      steps
    };

    setTrace(prev => [newEntry, ...prev]);
    setExpandedTraceIds(prev => new Set(prev).add(entryId));
  };

  const toggleTraceExpansion = (id: string) => {
    setExpandedTraceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearTrace = () => setTrace([]);
  const resetSandbox = () => { 
    setSelectedToolId(null); 
    setTrace([]); 
    setPipeline({ rawArgsText: "", validation: { ok: true, errors: [] }, active: false }); 
  };

  const loadExampleArgs = (id: string) => {
    const original = toolDefinitions.find(d => d.name === id);
    if (original) {
      const example: Record<string, any> = {};
      if (original.parameters.properties) {
        Object.keys(original.parameters.properties).forEach((key: string) => {
          const prop = (original.parameters.properties as Record<string, any>)[key];
          if (prop.type === 'string') example[key] = "example_value";
          if (prop.type === 'number') example[key] = 42;
        });
      }
      updateInvocationDraft(id, { argsText: JSON.stringify(example, null, 2) });
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    try {
      const files = await getFilesFromDataTransfer(items);
      if (files.length > 0) {
        await handleFiles(Array.from(files));
      }
    } catch (err) {
      console.error('Drop error:', err);
      setUploadStatus('Failed to process dropped files');
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files).map(f => {
      return new File([f], f.name, { type: f.type, lastModified: f.lastModified });
    });
    
    await handleFiles(fileArray);
    e.target.value = '';
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setUploadProgress({ current: 0, total: files.length, currentFile: '' });
    setUploadStatus('Uploading...');

    const filePaths = files.map(f => f.name);
    const existingFiles = await listExistingFiles(filePaths);

    if (existingFiles.length > 0) {
      const confirmed = await new Promise<boolean>((resolve) => {
        setOverwriteConfirm({
          files: existingFiles,
          resolve
        });
      });
      setOverwriteConfirm(null);

      if (!confirmed) {
        setUploadProgress(null);
        setUploadStatus('Upload cancelled');
        setTimeout(() => setUploadStatus(''), 3000);
        return;
      }
    }

    let uploaded = 0;
    let skipped = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length, currentFile: file.name });

      if (!(await canStoreFile(file.size))) {
        setUploadStatus(`File "${file.name}" would exceed storage limit. Delete files or try a smaller file.`);
        setTimeout(() => setUploadStatus(''), 5000);
        break;
      }

      try {
        await uploadFile(file);
        uploaded++;
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        skipped++;
      }
    }

    setUploadProgress(null);
    if (skipped > 0) {
      setUploadStatus(`Uploaded ${uploaded} files, ${skipped} failed`);
    } else {
      setUploadStatus(`Uploaded ${uploaded} file${uploaded !== 1 ? 's' : ''}`);
    }
    setTimeout(() => setUploadStatus(''), 3000);
    refreshSandboxFiles();
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', fontFamily: 'system-ui', backgroundColor: '#f8fafc' }}>
      
      {/* LEFT PANEL - TOOL REGISTRY & SANDBOX FILES */}
      <aside style={{ width: '320px', borderRight: '1px solid #e2e8f0', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>TOOLS</h2>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {toolDefinitions.map(def => {
                const isSelected = selectedToolId === def.name;
                return (
                  <div 
                    key={def.name}
                    onClick={() => setSelectedToolId(def.name)}
                    style={{ 
                      padding: '0.75rem', 
                      borderRadius: '8px', 
                      border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                      backgroundColor: isSelected ? '#eff6ff' : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? '#1e40af' : '#1e293b' }}>{def.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{def.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SANDBOX FILES MANAGER */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fcfcfc' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>SANDBOX FILES</h2>
            <button onClick={refreshSandboxFiles} disabled={isRefreshingFiles} style={{ border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: isRefreshingFiles ? 'not-allowed' : 'pointer', fontSize: '0.65rem', padding: '0.2rem 0.4rem', borderRadius: '4px', opacity: isRefreshingFiles ? 0.5 : 1 }}>
              Refresh
            </button>
          </div>
          
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', color: '#64748b', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
            Storage: {formatBytes(storageUsed)} / {formatBytes(MAX_STORAGE_BYTES)}
          </div>
          
          {uploadStatus && (
            <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', color: uploadStatus.includes('would exceed') || uploadStatus.includes('failed') ? '#ef4444' : '#10b981', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
              {uploadStatus}
            </div>
          )}
          
          {uploadProgress && (
            <div style={{ padding: '0.5rem 1rem', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '0.25rem' }}>
                Uploading {uploadProgress.current}/{uploadProgress.total}: {uploadProgress.currentFile}
              </div>
              <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, backgroundColor: '#3b82f6', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sandboxFiles.map(file => (
                <div key={file.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: file.type === 'directory' ? '#fef3c7' : '#dbeafe', color: file.type === 'directory' ? '#92400e' : '#1e40af', borderRadius: '3px', fontWeight: 600 }}>
                      {file.type === 'directory' ? 'DIR' : 'FILE'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                  </div>
                  <button onClick={() => handleDeleteFile(file.name)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem' }}>Delete</button>
                </div>
              ))}
              {sandboxFiles.length === 0 && (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', border: '1px dashed #e2e8f0', borderRadius: '6px' }}>
                  No files in sandbox.
                </div>
              )}
            </div>
          </div>

          {/* DROP ZONE */}
          <div 
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              margin: '1rem',
              padding: '1.5rem',
              border: `2px dashed ${isDragging ? '#3b82f6' : '#e2e8f0'}`,
              borderRadius: '8px',
              backgroundColor: isDragging ? '#eff6ff' : '#fff',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
              Drop files here or click to browse
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
              Supports files and folders
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              multiple
              {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              onChange={handleFileSelect}
              style={{ display: 'none' }} 
            />
          </div>
        </div>
      </aside>

      {/* CENTER PANEL - TOOL WORKSPACE */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', backgroundColor: '#fff', overflow: 'hidden' }}>
        {selectedTool ? (
          <>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fcfcfc' }}>
              <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>{selectedTool.name.toUpperCase()} WORKSPACE</h2>
              <button onClick={() => resetToolDraft(selectedTool.name)} style={{ fontSize: '0.7rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Reset Tool</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* 1. CODE EDITOR */}
              <section>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.75rem' }}>1. CLIENT IMPLEMENTATION</h3>
                <textarea 
                  value={selectedTool.code} 
                  onChange={(e) => updateToolDraft(selectedToolId!, { code: e.target.value })}
                  style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', fontFamily: 'monospace', minHeight: '250px', backgroundColor: '#1e293b', color: '#e2e8f0' }}
                />
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.5rem' }}>Available: args, helpers (now, sleep, log)</div>
              </section>

              {/* 2. INVOCATION SIMULATOR */}
              <section>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.75rem' }}>2. INVOCATION SIMULATOR</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>ARGUMENTS (JSON)</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => loadExampleArgs(selectedToolId!)} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Example</button>
                        <button onClick={() => updateInvocationDraft(selectedToolId!, { argsText: "{}" })} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Empty</button>
                      </div>
                    </div>
                    <textarea 
                      value={selectedInvocation?.argsText} 
                      onChange={(e) => { 
                        updateInvocationDraft(selectedToolId!, { argsText: e.target.value }); 
                        if (lastValidation[selectedToolId!]) {
                          setLastValidation(prev => { const n = {...prev}; delete n[selectedToolId!]; return n; });
                        }
                      }}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8rem', fontFamily: 'monospace', minHeight: '100px' }}
                    />
                    {lastValidation[selectedToolId!] && (
                      <div style={{ fontSize: '0.75rem', color: lastValidation[selectedToolId!].ok ? '#10b981' : '#ef4444' }}>
                        {lastValidation[selectedToolId!].ok ? 'Valid' : `Errors: ${lastValidation[selectedToolId!].errors.join(', ')}`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => handleValidate(selectedToolId!)} style={{ flex: 1, padding: '0.75rem', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: '#1e293b', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>VALIDATE</button>
                    <button onClick={() => handleExecute(selectedToolId!)} style={{ flex: 2, padding: '0.75rem', backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', border: 'none' }}>RUN ACTION</button>
                  </div>
                </div>
              </section>

              {/* 3. PIPELINE & RESULT */}
              <section style={{ opacity: pipeline.active ? 1 : 0.5 }}>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.75rem' }}>3. EXECUTION PIPELINE</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '8px' }}>
                  {[
                    { label: "RAW INPUT", value: pipeline.rawArgsText },
                    { label: "VALIDATION", value: pipeline.validation.ok ? "PASS" : "FAIL", error: pipeline.validation.errors.join(', ') },
                    { label: "RESULT", value: pipeline.result, error: pipeline.error, isJson: true }
                  ].map((s, i) => (
                    <div key={i} style={{ padding: '0.5rem', backgroundColor: '#fff', borderRadius: '4px', borderLeft: `3px solid ${s.error ? '#ef4444' : (s.value !== undefined ? '#10b981' : '#cbd5e1')}` }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8' }}>{s.label}</div>
                      <div style={{ fontSize: '0.75rem' }}>
                        {s.error ? <span style={{ color: '#ef4444' }}>{s.error}</span> : (s.isJson ? <pre style={{ margin: 0, fontSize: '0.7rem' }}>{JSON.stringify(s.value, null, 2)}</pre> : String(s.value ?? '—'))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. DEFINITION (REDUCED) */}
              <section>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.75rem' }}>4. SCHEMA DEFINITION</h3>
                <textarea 
                  value={selectedTool.schemaText} 
                  onChange={(e) => updateToolDraft(selectedToolId!, { schemaText: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontFamily: 'monospace', minHeight: '100px' }}
                />
              </section>

            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Select a tool to begin.</div>
        )}
      </main>

      {/* RIGHT PANEL - TRACE LOG */}
      <aside style={{ width: '350px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', backgroundColor: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>TRACE</h2>
          <button onClick={clearTrace} style={{ fontSize: '0.65rem', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}>Clear</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {trace.map(entry => (
              <div key={entry.id} style={{ backgroundColor: '#fff', borderRadius: '8px', border: `1px solid ${entry.error ? '#fecaca' : '#e2e8f0'}`, overflow: 'hidden' }}>
                <div onClick={() => toggleTraceExpansion(entry.id)} style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{entry.toolName}</span>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{entry.timestamp}</span>
                </div>
                {expandedTraceIds.has(entry.id) && (
                  <div style={{ padding: '0.75rem', borderTop: '1px solid #f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {entry.steps.map((s, idx) => (
                      <div key={idx} style={{ fontSize: '0.65rem', color: s.status === 'error' ? '#ef4444' : (s.status === 'success' ? '#10b981' : '#64748b') }}>
                        <span style={{ fontWeight: 600 }}>{s.label}</span>
                        {s.details && <div style={{ opacity: 0.8, fontFamily: 'monospace' }}>{s.details}</div>}
                      </div>
                    ))}
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8' }}>RESULT</div>
                      <pre style={{ margin: 0, fontSize: '0.7rem', color: entry.error ? '#991b1b' : '#334155' }}>{entry.error || JSON.stringify(entry.result, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* OVERWRITE CONFIRMATION MODAL */}
      {overwriteConfirm && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => overwriteConfirm.resolve(false)}
        >
          <div 
            style={{ 
              backgroundColor: '#fff', 
              padding: '1.5rem', 
              borderRadius: '8px', 
              maxWidth: '400px',
              margin: '1rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700 }}>Overwrite existing files?</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              The following files already exist in the sandbox:
            </p>
            <ul style={{ fontSize: '0.8rem', color: '#1e293b', marginBottom: '1rem', paddingLeft: '1.25rem' }}>
              {overwriteConfirm.files.map((file, i) => (
                <li key={i}>{file}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => overwriteConfirm.resolve(false)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => overwriteConfirm.resolve(true)}
                style={{ padding: '0.5rem 1rem', border: 'none', backgroundColor: '#ef4444', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
