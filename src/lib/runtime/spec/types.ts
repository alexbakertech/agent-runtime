export type StepType = 'prompt' | 'tool' | 'loop';

export type PromptType = 'system' | 'user' | 'hidden';

export type LoopCondition = 'maxIterations' | 'untilUserInput' | 'untilToolSucceeds';

export interface BaseStep {
  id: string;
  name: string;
  type: StepType;
  enabled: boolean;
  locked: boolean;
  includeInContext: boolean;
  contextOutputMode: ContextOutputMode;
}

export interface PromptStep extends BaseStep {
  type: 'prompt';
  promptType: PromptType;
  content: string;
  injectionPosition: 'start' | 'end';
}

export type ToolStepMode = 'execute' | 'inject' | 'executeAndInject' | 'present' | 'forceExecute';

export type ContextOutputMode = 'all' | 'responseOnly' | 'thinkingOnly' | 'none';

export interface ToolStep extends BaseStep {
  type: 'tool';
  toolName: string;
  toolStepMode: ToolStepMode;
  toolRefStepId?: string;
  autoExecute: boolean;
  injectionPrompt: string;
  continueOnFailure: boolean;
}

export interface LoopStep extends BaseStep {
  type: 'loop';
  condition: LoopCondition;
  maxIterations: number;
  toolName?: string;
  nestedSteps: RuntimeStep[];
  continueOnFailure: boolean;
}

export type RuntimeStep = PromptStep | ToolStep | LoopStep;

export interface RuntimeSpec {
  id: string;
  name: string;
  description: string;
  steps: RuntimeStep[];
  createdAt: string;
  updatedAt: string;
}

export type RuntimeStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface StepOutput {
  stepId: string;
  rawOutput: string;
  includedInContext: boolean;
  reasoning?: string;
}

export interface RuntimeExecutionState {
  runtimeSpecId: string | null;
  isRunning: boolean;
  currentStepIndex: number;
  currentIteration: number;
  stepStatuses: Record<string, RuntimeStepStatus>;
  results: Record<string, StepResult>;
  stepOutputs: Record<string, StepOutput>;
  stepContexts: Record<string, string>;
  currentInput: string;
  isStepMode: boolean;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

export interface RuntimeEvent {
  type: 'stepStart' | 'stepComplete' | 'stepFailed' | 'iterationStart' | 'iterationComplete' | 'runtimeStart' | 'runtimeComplete';
  stepId?: string;
  stepIndex?: number;
  iteration?: number;
  data?: unknown;
}

export type RuntimeEventHandler = (event: RuntimeEvent) => void;

export function createStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createSpecId(): string {
  return `runtime_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createDefaultPromptStep(): PromptStep {
  return {
    id: createStepId(),
    name: 'New Prompt Step',
    type: 'prompt',
    enabled: true,
    locked: false,
    promptType: 'system',
    content: '',
    injectionPosition: 'start',
    includeInContext: true,
    contextOutputMode: 'responseOnly',
  };
}

export function createDefaultToolStep(): ToolStep {
  return {
    id: createStepId(),
    name: 'New Tool Step',
    type: 'tool',
    enabled: true,
    locked: false,
    toolName: '',
    toolStepMode: 'executeAndInject',
    autoExecute: true,
    injectionPrompt: 'Here are the tool results:\n{{results}}',
    continueOnFailure: false,
    includeInContext: true,
    contextOutputMode: 'responseOnly',
  };
}

export function createDefaultLoopStep(): LoopStep {
  return {
    id: createStepId(),
    name: 'New Loop Step',
    type: 'loop',
    enabled: true,
    locked: false,
    condition: 'maxIterations',
    maxIterations: 5,
    nestedSteps: [],
    continueOnFailure: false,
    includeInContext: true,
    contextOutputMode: 'responseOnly',
  };
}

export function createChatAgentRuntimeSpec(): RuntimeSpec {
  const now = new Date().toISOString();
  
  const systemPromptStep: PromptStep = {
    id: createStepId(),
    name: 'System Prompt',
    type: 'prompt',
    enabled: true,
    locked: false,
    promptType: 'system',
    content: 'You are a helpful AI assistant. Answer concisely.',
    injectionPosition: 'start',
    includeInContext: true,
    contextOutputMode: 'responseOnly',
  };
  
  return {
    id: createSpecId(),
    name: 'Chat Agent',
    description: 'Basic chat agent with system prompt and user input handling.',
    steps: [systemPromptStep],
    createdAt: now,
    updatedAt: now,
  };
}
