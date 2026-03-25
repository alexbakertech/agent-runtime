import {
  RuntimeSpec,
  RuntimeStep,
  RuntimeExecutionState,
  RuntimeEvent,
  RuntimeEventHandler,
  RuntimeStepStatus,
  StepResult,
  StepOutput,
  PromptStep,
  ToolStep,
  LoopStep,
  ContextOutputMode,
} from './types';
import { RuntimeEngine } from '../engine';
import { RuntimeConfig, Override, RequestAssemblyOptions } from '../types';
import { Message } from '../types';

export interface ExecutorContext {
  config: RuntimeConfig;
  input: string;
  transcript: Message[];
  overrides: Record<number, Override>;
  options: RequestAssemblyOptions;
  accumulatedContext: string;
  toolResults: Record<string, unknown>;
}

export class RuntimeExecutor {
  private runtimeEngine: RuntimeEngine;
  private spec: RuntimeSpec | null = null;
  private context: ExecutorContext | null = null;
  private executionState: RuntimeExecutionState;
  private onEvent: RuntimeEventHandler;

  constructor(onEvent: RuntimeEventHandler) {
    this.onEvent = onEvent;
    this.runtimeEngine = new RuntimeEngine((stage, data) => {
      this.onEvent({
        type: 'stepComplete',
        data: { stage, data },
      });
    });
    this.executionState = this.createInitialExecutionState();
  }

  private createInitialExecutionState(): RuntimeExecutionState {
    return {
      runtimeSpecId: null,
      isRunning: false,
      currentStepIndex: 0,
      currentIteration: 0,
      stepStatuses: {},
      results: {},
      stepOutputs: {},
      stepContexts: {},
      currentInput: '',
      isStepMode: false,
      startedAt: null,
      finishedAt: null,
    };
  }

  getExecutionState(): RuntimeExecutionState {
    return this.executionState;
  }

  getStepStatus(stepId: string): RuntimeStepStatus {
    return this.executionState.stepStatuses[stepId] || 'pending';
  }

  getStepOutput(stepId: string): StepOutput | undefined {
    return this.executionState.stepOutputs[stepId];
  }

  setStepOutput(stepId: string, output: StepOutput) {
    this.executionState.stepOutputs[stepId] = output;
  }

  toggleStepOutputInclusion(stepId: string, included: boolean) {
    if (this.executionState.stepOutputs[stepId]) {
      this.executionState.stepOutputs[stepId].includedInContext = included;
    }
  }

  private updateStepStatus(stepId: string, status: RuntimeStepStatus) {
    this.executionState.stepStatuses[stepId] = status;
  }

  private emit(event: RuntimeEvent) {
    this.onEvent(event);
  }

  async loadSpec(spec: RuntimeSpec) {
    this.spec = spec;
    this.executionState = {
      ...this.createInitialExecutionState(),
      runtimeSpecId: spec.id,
    };
  }

  async execute(
    config: RuntimeConfig,
    input: string,
    transcript: Message[],
    overrides: Record<number, Override> = {},
    options: RequestAssemblyOptions = {}
  ): Promise<Record<string, StepResult>> {
    if (!this.spec) {
      throw new Error('No runtime spec loaded');
    }

    this.executionState.isRunning = true;
    this.executionState.startedAt = new Date().toISOString();
    this.executionState.currentInput = input;
    this.executionState.stepOutputs = {};
    this.executionState.stepContexts = {};

    this.context = {
      config,
      input,
      transcript,
      overrides,
      options: {
        ...options,
        includeThinkingInContext: options.includeThinkingInContext ?? false,
      },
      accumulatedContext: '',
      toolResults: {},
    };

    this.emit({ type: 'runtimeStart', data: { specId: this.spec.id } });

    try {
      await this.executeSteps(this.spec.steps);
      
      this.executionState.finishedAt = new Date().toISOString();
      this.emit({ type: 'runtimeComplete', data: { results: this.executionState.results } });
    } catch (error) {
      this.emit({
        type: 'stepFailed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    } finally {
      this.executionState.isRunning = false;
    }

    return this.executionState.results;
  }

  private async executeSteps(steps: RuntimeStep[]): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      if (!step.enabled) {
        this.updateStepStatus(step.id, 'skipped');
        continue;
      }

      this.executionState.currentStepIndex = i;
      this.updateStepStatus(step.id, 'running');
      this.emit({
        type: 'stepStart',
        stepId: step.id,
        stepIndex: i,
      });

      try {
        await this.executeStep(step);
        this.updateStepStatus(step.id, 'completed');
      } catch (error) {
        this.updateStepStatus(step.id, 'failed');
        throw error;
      }
    }
  }

  private async executeStep(step: RuntimeStep): Promise<void> {
    const startTime = Date.now();
    let result: StepResult;

    try {
      switch (step.type) {
        case 'prompt':
          result = await this.executePromptStep(step);
          break;
        case 'tool':
          result = await this.executeToolStep(step);
          break;
        case 'loop':
          result = await this.executeLoopStep(step);
          break;
        default:
          throw new Error(`Unknown step type: ${(step as RuntimeStep).type}`);
      }

      result.duration = Date.now() - startTime;
      this.executionState.results[step.id] = result;
    } catch (error) {
      result = {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
      this.executionState.results[step.id] = result;
      throw error;
    }
  }

  private async executePromptStep(step: PromptStep): Promise<StepResult> {
    if (!this.context) throw new Error('No execution context');

    const previousContext = this.context.input;
    const promptContent = step.content;
    let stepContext = '';

    if (step.promptType === 'system') {
      this.context.options.prefix = promptContent;
      this.context.options.prefixEnabled = true;
      stepContext = `[SYSTEM PROMPT]: ${promptContent}`;
    } else if (step.promptType === 'user') {
      this.context.input = promptContent + '\n' + this.context.input;
      stepContext = `[USER PROMPT]: ${promptContent}`;
    } else if (step.promptType === 'hidden') {
      this.context.input = promptContent + '\n' + this.context.input;
      stepContext = `[HIDDEN PROMPT]: ${promptContent}`;
    }

    this.context.options.includeThinkingInContext = step.contextOutputMode === 'all' || step.contextOutputMode === 'thinkingOnly';

    const response = await this.runtimeEngine.run(
      this.context.config,
      this.context.input,
      this.context.transcript,
      this.context.overrides,
      this.context.options
    );

    const contentToInclude = this.determineContextContent(response.content, response.reasoning, step.contextOutputMode, step.includeInContext);
    let sentToNext = '';
    if (step.includeInContext && contentToInclude) {
      this.context.input += '\n---\n' + contentToInclude;
      this.context.accumulatedContext += contentToInclude;
      sentToNext = contentToInclude;
    }

    const stepOutput: StepOutput = {
      stepId: step.id,
      rawOutput: response.content,
      includedInContext: step.includeInContext,
      reasoning: response.reasoning,
      previousContext,
      stepContext,
      sentToNext,
    };
    this.executionState.stepOutputs[step.id] = stepOutput;

    return {
      stepId: step.id,
      success: true,
      output: response.content,
      duration: 0,
    };
  }

  private determineContextContent(content: string, reasoning: string | undefined, mode: ContextOutputMode, includeInContext: boolean): string {
    if (!includeInContext) return '';
    
    switch (mode) {
      case 'all':
        return reasoning ? `<thinking>\n${reasoning}\n</thinking>\n\n${content}` : content;
      case 'responseOnly':
        return content;
      case 'thinkingOnly':
        return reasoning ? `<thinking>\n${reasoning}\n</thinking>` : '';
      case 'none':
        return '';
      default:
        return content;
    }
  }

  private async executeToolStep(step: ToolStep): Promise<StepResult> {
    if (!this.context) throw new Error('No execution context');

    const previousContext = this.context.input;
    let stepContext = '';
    let toolOutput = '';
    let toolReasoning: string | undefined;

    if (step.toolStepMode === 'execute' || step.toolStepMode === 'executeAndInject') {
      if (step.autoExecute) {
        const toolResult = await this.executeTool(step.toolName, this.context.toolResults);
        this.context.toolResults[step.toolName] = toolResult;
        
        toolOutput = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
        stepContext = `[TOOL EXECUTE]: ${step.toolName}\nResult: ${toolOutput}`;
        
        if (step.toolStepMode === 'executeAndInject') {
          const injectedContent = step.injectionPrompt.replace('{{results}}', toolOutput);
          this.context.input = this.context.input + '\n' + injectedContent;
          stepContext += `\n[INJECTED]: ${injectedContent}`;
        }
      } else {
        stepContext = `[TOOL EXECUTE]: ${step.toolName} (auto-execute disabled)`;
      }
    }

    if (step.toolStepMode === 'present') {
      const toolInfo = `You have access to the tool: ${step.toolName}. You may use it if needed.`;
      this.context.input = this.context.input + '\n' + toolInfo;
      stepContext = `[PRESENT TO MODEL]: ${step.toolName}`;
    }

    if (step.toolStepMode === 'forceExecute') {
      const forcePrompt = `You must use the tool "${step.toolName}" to complete this task. Please call it now with appropriate arguments.`;
      this.context.input = this.context.input + '\n' + forcePrompt;
      stepContext = `[FORCE TOOL CALL]: ${step.toolName}`;
    }

    if (step.toolStepMode === 'inject' && step.toolRefStepId) {
      const refOutput = this.executionState.stepOutputs[step.toolRefStepId];
      if (refOutput) {
        toolOutput = refOutput.rawOutput;
        const injectedContent = step.injectionPrompt.replace('{{results}}', toolOutput);
        this.context.input = this.context.input + '\n' + injectedContent;
        stepContext = `[INJECT FROM STEP]: ${step.toolRefStepId}`;
      }
    }

    this.context.options.includeThinkingInContext = step.contextOutputMode === 'all' || step.contextOutputMode === 'thinkingOnly';

    const response = await this.runtimeEngine.run(
      this.context.config,
      this.context.input,
      this.context.transcript,
      this.context.overrides,
      this.context.options
    );

    const contentToInclude = this.determineContextContent(response.content, response.reasoning, step.contextOutputMode, step.includeInContext);
    let sentToNext = '';
    if (step.includeInContext && contentToInclude) {
      this.context.input += '\n---\n' + contentToInclude;
      this.context.accumulatedContext += contentToInclude;
      sentToNext = contentToInclude;
    }

    const stepOutput: StepOutput = {
      stepId: step.id,
      rawOutput: response.content,
      includedInContext: step.includeInContext,
      reasoning: response.reasoning,
      previousContext,
      stepContext,
      sentToNext,
    };
    this.executionState.stepOutputs[step.id] = stepOutput;

    return {
      stepId: step.id,
      success: true,
      output: response.content,
      duration: 0,
    };
  }

  private async executeTool(toolName: string, toolArgs: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'get_time':
        return { time: new Date().toISOString() };
      case 'list_files':
        return { files: ['file1.txt', 'file2.txt', 'folder/'], message: 'Sandbox is empty in demo mode' };
      case 'read_file':
        return { content: 'File content placeholder - implement actual file reading', filePath: toolArgs.filePath };
      case 'search_text':
        return { matches: [], message: 'No matches found (demo mode)' };
      default:
        return { toolName, args: toolArgs, executedAt: new Date().toISOString(), note: 'Demo mode - implement actual tool execution' };
    }
  }

  private async executeLoopStep(step: LoopStep): Promise<StepResult> {
    if (!this.context) throw new Error('No execution context');

    let iteration = 0;
    let shouldContinue = true;
    const allOutputs: string[] = [];

    while (shouldContinue) {
      iteration++;
      this.executionState.currentIteration = iteration;
      
      this.emit({
        type: 'iterationStart',
        stepId: step.id,
        iteration,
      });

      try {
        await this.executeSteps(step.nestedSteps);
        
        const stepResult = this.executionState.results[step.nestedSteps[step.nestedSteps.length - 1]?.id];
        if (stepResult) {
          allOutputs.push(stepResult.output || '');
        }
      } catch (error) {
        if (!step.continueOnFailure) {
          throw error;
        }
      }

      shouldContinue = this.evaluateLoopCondition(step, iteration);

      this.emit({
        type: 'iterationComplete',
        stepId: step.id,
        iteration,
      });
    }

    const combinedOutput = allOutputs.join('\n---\n');
    const previousContext = this.context.input;
    const stepContext = `[LOOP]: ${step.condition} (${step.maxIterations} iterations)`;
    
    let sentToNext = '';
    if (step.includeInContext) {
      const contentToInclude = this.determineContextContent(combinedOutput, undefined, step.contextOutputMode, step.includeInContext);
      if (contentToInclude) {
        this.context.input += '\n---\n' + contentToInclude;
        this.context.accumulatedContext += contentToInclude;
        sentToNext = contentToInclude;
      }
    }

    const stepOutput: StepOutput = {
      stepId: step.id,
      rawOutput: combinedOutput,
      includedInContext: step.includeInContext,
      previousContext,
      stepContext,
      sentToNext,
    };
    this.executionState.stepOutputs[step.id] = stepOutput;

    return {
      stepId: step.id,
      success: true,
      output: combinedOutput,
      duration: 0,
    };
  }

  private evaluateLoopCondition(step: LoopStep, currentIteration: number): boolean {
    switch (step.condition) {
      case 'maxIterations':
        return currentIteration < step.maxIterations;
      case 'untilUserInput':
        return false;
      case 'untilToolSucceeds':
        return false;
      default:
        return false;
    }
  }

  reset() {
    this.spec = null;
    this.context = null;
    this.executionState = this.createInitialExecutionState();
    this.runtimeEngine.reset();
  }

  async next() {
    await this.runtimeEngine.next();
  }
}
