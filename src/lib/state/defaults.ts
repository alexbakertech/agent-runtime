/**
 * Default State Factory
 * 
 * Creates safe default state objects for the application.
 */

import type {
  AppState,
  GlobalSettings,
  ContextEngineState,
  SandboxState,
  ExecutionPipelineState,
  PageAppStates,
  PageUIStates,
  ChatAgentAppState,
  ChatAgentUIState,
  SandboxAppState,
  SandboxUIState,
  RuntimeSpecUIState,
  RuntimeSpecState,
  RuntimeState,
} from './types';
import { CURRENT_VERSION } from './types';
import { RuntimeSpec, RuntimeExecutionState, createDefaultRuntime } from '@/lib/runtime/spec/types';
import type { Runtime, RunState, ToolDefinition, SandboxFile } from '@/lib/runtime/types';

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant. Answer concisely.";

function createDefaultGlobalSettings(): GlobalSettings {
  return {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    systemPromptEnabled: true,
    includeThinkingInContext: true,
    stepMode: false,
  };
}

function createDefaultExecutionPipelineState(): ExecutionPipelineState {
  return {
    rawArgsText: "",
    parsedArgs: null,
    parseError: null,
    validation: null,
    result: null,
    error: null,
    active: false,
  };
}

function createDefaultChatAgentAppState(): ChatAgentAppState {
  return {
    prefix: DEFAULT_SYSTEM_PROMPT,
    prefixEnabled: true,
    historyEnabled: true,
    transcript: [],
    overrides: {},
  };
}

function createDefaultChatAgentUIState(): ChatAgentUIState {
  return {
    showContextPreview: false,
    expandedStages: {},
    viewingSnapshotIndex: null,
    prefixCollapsed: false,
    historyCollapsed: false,
    expandedThinking: {},
    showFullPrompt: false,
    expandedContextThinking: {},
  };
}

function createDefaultSandboxAppState(): SandboxAppState {
  return {
    selectedToolId: null,
    toolDrafts: {},
    invocationDrafts: {},
    pipeline: createDefaultExecutionPipelineState(),
    customTools: [],
  };
}

function createDefaultSandboxUIState(): SandboxUIState {
  return {
    expandedTools: [],
    builtInToolsExpanded: true,
    userToolsExpanded: true,
  };
}

function createDefaultRuntimeSpecUIState(): RuntimeSpecUIState {
  return {
    showRawJson: false,
    activeRuntimeSpecId: null,
    isLocked: false,
  };
}

function createDefaultRuntimeExecutionState(): RuntimeExecutionState {
  return {
    runtimeSpecId: null,
    isRunning: false,
    currentBlockIndex: 0,
    blockStatuses: {},
    results: {},
    blockOutputs: {},
    currentInput: '',
    timeline: [],
    startedAt: null,
    finishedAt: null,
  };
}

function createDefaultRuntimeSpecState(): RuntimeSpecState {
  const defaultRuntime = createDefaultRuntime();
  return {
    showRawJson: false,
    runtimeSpecs: { [defaultRuntime.id]: defaultRuntime },
    activeRuntimeSpecId: defaultRuntime.id,
    runtimeExecution: createDefaultRuntimeExecutionState(),
    blockDraft: null,
    isLocked: false,
  };
}

function createDefaultPageAppStates(): PageAppStates {
  return {
    chatAgent: createDefaultChatAgentAppState(),
    sandbox: createDefaultSandboxAppState(),
    runtimeSpec: createDefaultRuntimeSpecState(),
  };
}

function createDefaultPageUIStates(): PageUIStates {
  return {
    chatAgent: createDefaultChatAgentUIState(),
    sandbox: createDefaultSandboxUIState(),
    runtimeSpec: createDefaultRuntimeSpecUIState(),
  };
}

/**
 * Creates the default application state.
 * This is used when no saved state exists in localStorage.
 */
export function createDefaultState(): AppState {
  return {
    version: CURRENT_VERSION,
    profiles: [],
    activeProfileId: null,
    browserConsent: false,
    retryEnabled: false,
    globalSettings: createDefaultGlobalSettings(),
    pageAppStates: createDefaultPageAppStates(),
    pageUIStates: createDefaultPageUIStates(),
  };
}

/**
 * Creates a default profile with the given settings.
 */
export function createDefaultProfile(
  name: string,
  baseUrl: string,
  model: string,
  apiKey: string = ""
): AppState["profiles"][0] {
  const now = new Date().toISOString();
  return {
    id: generateUUID(),
    name,
    baseUrl,
    model,
    apiKey,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generates a UUID v4.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export { generateUUID };

export { createDefaultChatAgentAppState, createDefaultChatAgentUIState, createDefaultSandboxAppState, createDefaultSandboxUIState };

export function createDefaultContextEngineState(): ContextEngineState {
  return {
    ...createDefaultChatAgentAppState(),
    ...createDefaultChatAgentUIState(),
  };
}

export function createDefaultSandboxState(): SandboxState {
  return {
    ...createDefaultSandboxAppState(),
    ...createDefaultSandboxUIState(),
  };
}

export function createDefaultRuntimeSpecAppState(): RuntimeSpecState {
  return createDefaultRuntimeSpecState();
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const BUILT_IN_TOOLS: ToolDefinition[] = [
  { id: 'get_time', name: 'get_time', description: 'Returns the current system time', inputSchema: { type: 'object', properties: {} } },
  { id: 'list_files', name: 'list_files', description: 'Lists files in the sandbox directory', inputSchema: { type: 'object', properties: { dirPath: { type: 'string' } } } },
  { id: 'read_file', name: 'read_file', description: 'Reads file content from sandbox', inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } },
  { id: 'search_text', name: 'search_text', description: 'Searches for text in sandbox files', inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, dirPath: { type: 'string' } }, required: ['pattern'] } },
];

export function createDefaultRuntimeState(): RuntimeState {
  const now = new Date().toISOString();
  const defaultRuntime: Runtime = {
    id: generateId(),
    name: 'Default Runtime',
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
    defaultTools: ['get_time', 'list_files', 'read_file'],
    loopLimits: {
      maxSteps: 10,
      maxToolCalls: 20,
    },
    displayConfig: {
      showThinking: true,
    },
    runtimeFilesAccess: 'readwrite',
    sharedFilesAccess: 'readwrite',
    createdAt: now,
    updatedAt: now,
  };

  return {
    runtimes: { [defaultRuntime.id]: defaultRuntime },
    activeRuntimeId: defaultRuntime.id,
    runState: null,
    toolRegistry: BUILT_IN_TOOLS,
    sandboxFiles: [],
    availableTools: BUILT_IN_TOOLS.map(t => t.name),
  };
}

export function createEmptyRunState(runtimeId: string): RunState {
  return {
    runId: generateId(),
    runtimeId,
    messages: [],
    phase: 'ingest',
    stepCount: 0,
    toolCallCount: 0,
    activeTools: [],
    trace: [],
    sandboxSnapshot: {},
    status: 'running',
    contextSnapshots: {},
  };
}
