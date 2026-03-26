/**
 * App State Type Definitions
 * 
 * This file defines the authoritative TypeScript interfaces for the application's
 * centralized state management system.
 */

export const CURRENT_VERSION = "1.0.0";

/**
 * Root state object for the entire application.
 * This object is persisted to localStorage and serves as the single source of truth.
 */
export interface AppState {
  /** Schema version for future migrations */
  version: string;
  
  /** All saved API profiles */
  profiles: Profile[];
  
  /** Currently active profile ID */
  activeProfileId: string | null;
  
  /** Browser API consent flag */
  browserConsent: boolean;
  
  /** Retry on failure flag */
  retryEnabled: boolean;
  
  /** Application-wide settings */
  globalSettings: GlobalSettings;
  
  /** Page-specific app state (business data) */
  pageAppStates: PageAppStates;
  
  /** Page-specific UI state (presentation data) */
  pageUIStates: PageUIStates;
}

/**
 * API profile configuration.
 * Represents a saved set of API credentials and settings.
 */
export interface Profile {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Display name for the profile */
  name: string;
  
  /** API base URL (e.g., https://api.openai.com/v1) */
  baseUrl: string;
  
  /** API key for authentication */
  apiKey: string;
  
  /** Model identifier (e.g., gpt-4, claude-3) */
  model: string;
  
  /** ISO timestamp of profile creation */
  createdAt: string;
  
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Global application settings that apply across all pages.
 */
export interface GlobalSettings {
  /** Default system prompt for AI interactions */
  systemPrompt: string;
  
  /** Whether system prompt is enabled */
  systemPromptEnabled: boolean;
  
  /** Whether to include thinking/reasoning in context */
  includeThinkingInContext: boolean;
  
  /** Step-by-step execution mode */
  stepMode: boolean;
}

/**
 * Container for page-specific app state (business data).
 */
export interface PageAppStates {
  /** Chat Agent page app state */
  chatAgent?: ChatAgentAppState;
  
  /** Sandbox page app state */
  sandbox?: SandboxAppState;
  
  /** Runtime Spec page app state */
  runtimeSpec?: RuntimeSpecState;
}

/**
 * Container for page-specific UI state (presentation data).
 */
export interface PageUIStates {
  /** Chat Agent page UI state */
  chatAgent?: ChatAgentUIState;
  
  /** Sandbox page UI state */
  sandbox?: SandboxUIState;
  
  /** Runtime Spec page UI state */
  runtimeSpec?: RuntimeSpecUIState;
}

/**
 * Chat Agent app state (business data) - subset of ContextEngineState.
 */
export type ChatAgentAppState = Pick<ContextEngineState, 'prefix' | 'prefixEnabled' | 'historyEnabled' | 'transcript' | 'overrides'>;

/**
 * Chat Agent UI state (presentation data) - subset of ContextEngineState.
 */
export type ChatAgentUIState = Pick<ContextEngineState, 'showContextPreview' | 'expandedStages' | 'viewingSnapshotIndex' | 'prefixCollapsed' | 'historyCollapsed' | 'expandedThinking' | 'showFullPrompt' | 'expandedContextThinking'>;

/**
 * Sandbox app state (business data) - subset of SandboxState.
 */
export type SandboxAppState = Pick<SandboxState, 'selectedToolId' | 'toolDrafts' | 'invocationDrafts' | 'pipeline' | 'customTools'>;

/**
 * Sandbox UI state (presentation data) - subset of SandboxState.
 */
export type SandboxUIState = Pick<SandboxState, 'expandedTools' | 'builtInToolsExpanded' | 'userToolsExpanded'>;

/**
 * Runtime Spec UI state.
 */
export type RuntimeSpecUIState = Pick<RuntimeSpecState, 'showRawJson' | 'activeRuntimeSpecId' | 'isLocked'>;

/**
 * Context Engine page state.
 * Manages chat transcript, message overrides, and UI state.
 */
export interface ContextEngineState {
  /** Custom prefix/system prompt for this page */
  prefix: string;
  
  /** Whether prefix is enabled */
  prefixEnabled: boolean;
  
  /** Whether to include chat history in context */
  historyEnabled: boolean;
  
  /** Chat transcript entries (stored with IDs) */
  transcript: TranscriptEntry[];
  
  /** Message overrides keyed by entry ID */
  overrides: Record<string, Override>;
  
  /** Whether to show the full context preview */
  showContextPreview: boolean;
  
  /** Which execution stages are expanded */
  expandedStages: Record<string, boolean>;
  
  /** Currently viewing snapshot for a specific entry */
  viewingSnapshotIndex: string | null;
  
  /** Whether prefix section is collapsed */
  prefixCollapsed: boolean;
  
  /** Whether history section is collapsed */
  historyCollapsed: boolean;
  
  /** Expanded thinking states keyed by entry ID */
  expandedThinking: Record<string, boolean>;
  
  /** Whether to show full prompt in inspection view */
  showFullPrompt: boolean;
  
  /** Expanded context thinking states keyed by entry ID */
  expandedContextThinking: Record<string, boolean>;
}

/**
 * A single chat message in the transcript.
 */
export interface TranscriptEntry {
  /** Unique identifier for this entry */
  id: string;
  
  /** Message role (user or assistant) */
  role: "user" | "assistant";
  
  /** Message content */
  content: string;
  
  /** Thinking/reasoning content (if any) */
  reasoningContent?: string;
  
  /** Retry info if request was retried */
  retryInfo?: { retries: number };
  
  /** Full prompt snapshot sent with this message */
  contextSnapshot?: string;
  
  /** ISO timestamp of when message was added */
  timestamp: string;
  
  /** Whether this message was sent as part of the context snapshot */
  sentContextSnapshot?: boolean;
}

/**
 * Override configuration for a transcript entry.
 * Allows modifying or excluding messages from future context.
 */
export interface Override {
  /** ID of the entry being overridden */
  id: string;
  
  /** Overridden message content */
  content?: string;
  
  /** Overridden reasoning content */
  reasoningContent?: string;
  
  /** Whether to exclude this message from context */
  excluded: boolean;
  
  /** Whether to exclude reasoning from context */
  reasoningExcluded: boolean;
}

/**
 * Sandbox page state.
 * Manages tool definitions and execution state.
 */
export interface SandboxState {
  /** Currently selected tool ID */
  selectedToolId: string | null;
  
  /** Tool definitions keyed by tool ID */
  toolDrafts: Record<string, ToolDraft>;
  
  /** Tool invocation drafts keyed by invocation ID */
  invocationDrafts: Record<string, ToolInvocationDraft>;
  
  /** Execution pipeline state */
  pipeline: ExecutionPipelineState;
  
  /** IDs of expanded tool sections */
  expandedTools: string[];
  
  /** Whether built-in tools section is expanded */
  builtInToolsExpanded: boolean;
  
  /** Whether user tools section is expanded */
  userToolsExpanded: boolean;
  
  /** User-defined custom tools */
  customTools: CustomTool[];
}

/**
 * A user-defined custom tool.
 */
export interface CustomTool {
  /** Unique identifier */
  id: string;
  
  /** Tool display name */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** JSON Schema for tool parameters */
  parameters: object;
  
  /** Tool implementation code */
  code: string;
  
  /** Whether tool is enabled */
  enabled: boolean;
  
  /** ISO timestamp of creation */
  createdAt: string;
  
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * A tool definition draft.
 */
export interface ToolDraft {
  /** Unique identifier */
  id: string;
  
  /** Tool display name */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** JSON Schema for tool parameters */
  schemaText: string;
  
  /** Tool implementation code */
  code: string;
  
  /** Whether tool is enabled */
  enabled: boolean;
  
  /** ISO timestamp of creation */
  createdAt: string;
  
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * A draft for invoking a tool with specific arguments.
 */
export interface ToolInvocationDraft {
  /** Unique identifier */
  id: string;
  
  /** JSON string of tool arguments */
  argsText: string;
}

/**
 * Execution pipeline state for tool invocation.
 */
export interface ExecutionPipelineState {
  /** Raw argument input text */
  rawArgsText: string;
  
  /** Parsed arguments object */
  parsedArgs: Record<string, unknown> | null;
  
  /** Error from parsing arguments */
  parseError: string | null;
  
  /** Validation result */
  validation: ValidationResult | null;
  
  /** Execution result */
  result: unknown;
  
  /** Execution error if any */
  error: string | null;
  
  /** Whether pipeline is currently active */
  active: boolean;
}

/**
 * Validation result for tool arguments.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Validation error message if invalid */
  error?: string;
  
  /** Warnings if any (non-blocking) */
  warnings?: string[];
}

import { RuntimeSpec, RuntimeExecutionState, RuntimeBlock } from '@/lib/runtime/spec/types';

/**
 * Runtime Spec page state.
 * Manages runtime specifications and execution state.
 */
export interface RuntimeSpecState {
  /** Whether to show raw JSON view */
  showRawJson: boolean;
  
  /** All saved runtime specifications */
  runtimeSpecs: Record<string, RuntimeSpec>;
  
  /** Currently active/runtime-selected spec ID */
  activeRuntimeSpecId: string | null;
  
  /** Current execution state for active runs */
  runtimeExecution: RuntimeExecutionState;
  
  /** Block draft being edited (not yet saved) */
  blockDraft: RuntimeBlock | null;
  
  /** Whether the runtime is currently locked (running) */
  isLocked: boolean;
}

/**
 * Configuration options for exporting state.
 * Controls which sections are included in the export.
 */
export interface ExportOptions {
  /** Include profiles (apiKey will be stripped) */
  includeProfiles: boolean;
  
  /** Include global settings */
  includeGlobalSettings: boolean;
  
  /** Include Chat Agent app state */
  includeChatAgent: boolean;
  
  /** Include sandbox tool definitions */
  includeSandboxTools: boolean;
  
  /** Include UI states (panel collapses, expanded sections, etc.) */
  includeUIStates: boolean;
}

/**
 * Preview of what will be imported before applying.
 * Shows the diff between current and imported state.
 */
export interface ImportPreview {
  /** Whether the import data is valid */
  valid: boolean;
  
  /** Validation errors if any */
  errors: string[];
  
  /** New profiles that will be added */
  newProfiles: Profile[];
  
  /** Profiles that will be updated */
  updatedProfiles: Profile[];
  
  /** Profile IDs that will be removed */
  removedProfileIds: string[];
  
  /** Whether global settings will change */
  globalSettingsChanged: boolean;
  
  /** Whether Chat Agent state will change */
  chatAgentChanged: boolean;
  
  /** Whether sandbox state will change */
  sandboxChanged: boolean;
  
  /** Whether UI states will change */
  uiStatesChanged: boolean;
  
  /** The merged state preview */
  mergedState: AppState;
}

/**
 * Tool trace entry for execution history.
 */
export interface ToolTraceEntry {
  /** Unique identifier */
  id: string;
  
  /** ISO timestamp */
  timestamp: string;
  
  /** Name of the tool executed */
  toolName: string;
  
  /** Arguments as JSON string */
  argsText: string;
  
  /** Validation result */
  validation: ValidationResult | null;
  
  /** Execution result */
  result: unknown;
  
  /** Error if execution failed */
  error: string | null;
  
  /** Execution steps for debugging */
  steps: ToolTraceStep[];
}

/**
 * A single step in tool execution trace.
 */
export interface ToolTraceStep {
  /** Step name/description */
  name: string;
  
  /** Step data */
  data: unknown;
}
