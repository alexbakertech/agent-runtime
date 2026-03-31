export type BlockType = 'start' | 'think' | 'tool' | 'respond' | 'stop';

export type ThinkMode = 'decide' | 'draft' | 'summarize' | 'classify' | 'custom';
export type OutputMode = 'freeform' | 'actionSelection' | 'structured';

export type ToolAccessMode = 'fixed' | 'modelChoice';
export type ArgumentSource = 'static' | 'dynamic' | 'mixed';
export type ResultHandling = 'timeline' | 'blockOutput' | 'nextThink' | 'internal';
export type FailureBehavior = 'continue' | 'retry' | 'routeBack' | 'stop';

export type ResponseSource = 'thinkOutput' | 'toolResult' | 'custom';
export type VisibilityMode = 'final' | 'interim' | 'debug';

export type RoutingMode = 'typeBased' | 'blockSpecific';

export interface BaseBlock {
  id: string;
  name: string;
  type: BlockType;
  enabled: boolean;
}

export interface StartBlock extends BaseBlock {
  type: 'start';
  acceptsUserInput: boolean;
  startupInstructions: string;
  includeDefaults: boolean;
}

export interface ThinkBlock extends BaseBlock {
  type: 'think';
  thinkMode: ThinkMode;
  instructionText: string;
  outputMode: OutputMode;
  allowedNextActions: BlockType[];
  routingMode: RoutingMode;
  routingTargetId?: string;
  contextSources: {
    runtimeInstructions: boolean;
    userInput: boolean;
    priorBlockOutputs: boolean;
    toolResults: boolean;
    historySummary: boolean;
  };
}

export interface ToolBlock extends BaseBlock {
  type: 'tool';
  toolAccessMode: ToolAccessMode;
  allowedTools: string[];
  argumentSource: ArgumentSource;
  staticArguments: Record<string, unknown>;
  resultHandling: ResultHandling;
  failureBehavior: FailureBehavior;
  maxRetries: number;
}

export interface RespondBlock extends BaseBlock {
  type: 'respond';
  responseSource: ResponseSource;
  responseGuidance: string;
  visibilityMode: VisibilityMode;
}

export interface StopBlock extends BaseBlock {
  type: 'stop';
  stopReason: string;
}

export type RuntimeBlock = StartBlock | ThinkBlock | ToolBlock | RespondBlock | StopBlock;

export interface RuntimeSpec {
  id: string;
  name: string;
  description: string;
  blocks: RuntimeBlock[];
  runtimeDefaults?: {
    globalInstructions: string;
    defaultContextBehavior: string;
    defaultHistoryBehavior: string;
    defaultRunLimits: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type RuntimeBlockStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface BlockOutput {
  blockId: string;
  rawOutput: string;
  reasoning?: string;
  includedInContext: boolean;
  previousContext?: string;
  blockContext?: string;
  sentToNext?: string;
  toolCall?: {
    toolName: string;
    arguments: Record<string, unknown>;
    result?: string;
  };
}

export interface RuntimeExecutionState {
  runtimeSpecId: string | null;
  isRunning: boolean;
  currentBlockIndex: number;
  blockStatuses: Record<string, RuntimeBlockStatus>;
  results: Record<string, BlockResult>;
  blockOutputs: Record<string, BlockOutput>;
  currentInput: string;
  timeline: TimelineEvent[];
  startedAt: string | null;
  finishedAt: string | null;
}

export interface BlockResult {
  blockId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'blockStart' | 'blockComplete' | 'blockFailed' | 'toolExposed' | 'toolCalled' | 'toolResult' | 'responseEmitted' | 'runtimeStart' | 'runtimeComplete';
  blockId?: string;
  blockType?: BlockType;
  data?: unknown;
}

export interface RuntimeEvent {
  type: 'blockStart' | 'blockComplete' | 'blockFailed' | 'toolExposed' | 'toolCalled' | 'toolResult' | 'responseEmitted' | 'runtimeStart' | 'runtimeComplete';
  blockId?: string;
  blockIndex?: number;
  data?: unknown;
}

export type RuntimeEventHandler = (event: RuntimeEvent) => void;

export function createBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createSpecId(): string {
  return `runtime_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createDefaultStartBlock(): StartBlock {
  return {
    id: createBlockId(),
    name: 'Start Run',
    type: 'start',
    enabled: true,
    acceptsUserInput: true,
    startupInstructions: '',
    includeDefaults: true,
  };
}

export function createDefaultThinkBlock(): ThinkBlock {
  return {
    id: createBlockId(),
    name: 'Think',
    type: 'think',
    enabled: true,
    thinkMode: 'decide',
    instructionText: '',
    outputMode: 'freeform',
    allowedNextActions: ['tool', 'respond', 'stop'],
    routingMode: 'typeBased',
    contextSources: {
      runtimeInstructions: true,
      userInput: true,
      priorBlockOutputs: true,
      toolResults: true,
      historySummary: false,
    },
  };
}

export function createDefaultToolBlock(): ToolBlock {
  return {
    id: createBlockId(),
    name: 'Use Tool',
    type: 'tool',
    enabled: true,
    toolAccessMode: 'fixed',
    allowedTools: [],
    argumentSource: 'static',
    staticArguments: {},
    resultHandling: 'nextThink',
    failureBehavior: 'continue',
    maxRetries: 1,
  };
}

export function createDefaultRespondBlock(): RespondBlock {
  return {
    id: createBlockId(),
    name: 'Respond',
    type: 'respond',
    enabled: true,
    responseSource: 'thinkOutput',
    responseGuidance: '',
    visibilityMode: 'final',
  };
}

export function createDefaultStopBlock(): StopBlock {
  return {
    id: createBlockId(),
    name: 'Stop',
    type: 'stop',
    enabled: true,
    stopReason: '',
  };
}

export function createDefaultRuntime(): RuntimeSpec {
  const now = new Date().toISOString();
  
  return {
    id: createSpecId(),
    name: 'New Runtime',
    description: '',
    blocks: [
      createDefaultStartBlock(),
      createDefaultThinkBlock(),
      createDefaultRespondBlock(),
      createDefaultStopBlock(),
    ],
    runtimeDefaults: {
      globalInstructions: '',
      defaultContextBehavior: 'includeAll',
      defaultHistoryBehavior: 'none',
      defaultRunLimits: '',
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function getBlockTypeLabel(type: BlockType): string {
  switch (type) {
    case 'start': return 'Start Run';
    case 'think': return 'Think';
    case 'tool': return 'Use Tool';
    case 'respond': return 'Respond';
    case 'stop': return 'Stop';
  }
}

export function getBlockTypeDescription(type: BlockType): string {
  switch (type) {
    case 'start': return 'Defines how a run begins.';
    case 'think': return 'Asks the model to decide or draft.';
    case 'tool': return 'Exposes a selected set of tools at this step.';
    case 'respond': return 'Sends visible output to the user.';
    case 'stop': return 'Ends the run.';
  }
}