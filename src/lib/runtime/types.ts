export type LoopStage = 'idle' | 'preparing' | 'calling' | 'receiving' | 'finished' | 'error';

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
