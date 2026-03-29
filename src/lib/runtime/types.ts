export type LoopStage = 'idle' | 'preparing' | 'calling' | 'receiving' | 'act' | 'evaluate' | 'finished' | 'error';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  contextSnapshot?: string;
  reasoningContent?: string;
}

export interface RuntimeConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  name?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface TraceEvent {
  stage: LoopStage;
  data?: any;
  timestamp: number;
}

export interface Override {
  content?: string;
  reasoningContent?: string;
  excluded?: boolean;
  reasoningExcluded?: boolean;
}

export interface ExecutionState {
  stage: LoopStage;
  data: Record<string, any>;
  isWaitingForNext: boolean;
}

export interface RequestAssemblyOptions {
  prefix?: string;
  prefixEnabled?: boolean;
  historyEnabled?: boolean;
  includeThinkingInContext?: boolean;
}

// v0.1 Runtime Config (Persistent)
export interface Runtime {
  id: string;
  name: string;
  systemPrompt: string;
  prompts: {
    system: string;
    plan: string;
    evaluate: string;
    respond: string;
  };
  modelConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  defaultTools: string[];
  loopLimits: {
    maxSteps: number;
    maxToolCalls: number;
  };
  displayConfig: {
    showThinking: boolean;
  };
  profileId?: string;
  createdAt: string;
  updatedAt: string;
}

// v0.1 Run State (Ephemeral)
export type RunPhase = 'ingest' | 'plan' | 'act' | 'evaluate' | 'respond';
export type RunStatus = 'running' | 'waiting' | 'completed' | 'failed';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  error?: string;
}

export interface TraceItem {
  id: string;
  stepId: string;
  phase: RunPhase;
  previousPhase?: RunPhase;
  nextPhase?: RunPhase;
  contextSummary: string;
  modelInput?: string;
  thinkingStream?: string;
  responseStream?: string;
  toolCall?: ToolCall;
  toolResult?: string;
  evaluationResult?: string;
  transitionReason: string;
  timestamp: string;
}

export interface RunState {
  runId: string;
  runtimeId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  phase: RunPhase;
  stepCount: number;
  toolCallCount: number;
  activeTools: string[];
  trace: TraceItem[];
  sandboxSnapshot: Record<string, unknown>;
  status: RunStatus;
  finalOutput?: string;
}

// Tool Registry (Global)
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: object;
}

// Sandbox (Global, Shared)
export interface SandboxFile {
  path: string;
  content: string;
  isDirectory: boolean;
}
