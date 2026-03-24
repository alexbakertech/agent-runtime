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
} from './types';
import { CURRENT_VERSION } from './types';

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
  };
}

function createDefaultPageAppStates(): PageAppStates {
  return {
    chatAgent: createDefaultChatAgentAppState(),
    sandbox: createDefaultSandboxAppState(),
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
