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

function createDefaultContextEngineState(): ContextEngineState {
  return {
    prefix: DEFAULT_SYSTEM_PROMPT,
    prefixEnabled: true,
    historyEnabled: true,
    transcript: [],
    overrides: {},
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

function createDefaultSandboxState(): SandboxState {
  return {
    selectedToolId: null,
    toolDrafts: {},
    invocationDrafts: {},
    pipeline: createDefaultExecutionPipelineState(),
    expandedTools: [],
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
    globalSettings: createDefaultGlobalSettings(),
    pageStates: {
      contextEngine: createDefaultContextEngineState(),
      sandbox: createDefaultSandboxState(),
    },
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
