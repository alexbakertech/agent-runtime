import {
  RuntimeSpec,
  RuntimeBlock,
  RuntimeExecutionState,
  RuntimeEvent,
  RuntimeEventHandler,
  RuntimeBlockStatus,
  BlockResult,
  BlockOutput,
  StartBlock,
  ThinkBlock,
  ToolBlock,
  RespondBlock,
  StopBlock,
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
        type: 'toolResult',
        data: { stage, data },
      });
    });
    this.executionState = this.createInitialExecutionState();
  }

  private createInitialExecutionState(): RuntimeExecutionState {
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

  getExecutionState(): RuntimeExecutionState {
    return this.executionState;
  }

  getBlockStatus(blockId: string): RuntimeBlockStatus {
    return this.executionState.blockStatuses[blockId] || 'pending';
  }

  getBlockOutput(blockId: string): BlockOutput | undefined {
    return this.executionState.blockOutputs[blockId];
  }

  setBlockOutput(blockId: string, output: BlockOutput) {
    this.executionState.blockOutputs[blockId] = output;
  }

  toggleBlockOutputInclusion(blockId: string, included: boolean) {
    if (this.executionState.blockOutputs[blockId]) {
      this.executionState.blockOutputs[blockId].includedInContext = included;
    }
  }

  private updateBlockStatus(blockId: string, status: RuntimeBlockStatus) {
    this.executionState.blockStatuses[blockId] = status;
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
  ): Promise<Record<string, BlockResult>> {
    if (!this.spec) {
      throw new Error('No runtime spec loaded');
    }

    this.executionState.isRunning = true;
    this.executionState.startedAt = new Date().toISOString();
    this.executionState.currentInput = input;
    this.executionState.blockOutputs = {};
    this.executionState.timeline = [];

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
      await this.executeBlocks(this.spec.blocks);
      
      this.executionState.finishedAt = new Date().toISOString();
      this.emit({ type: 'runtimeComplete', data: { results: this.executionState.results } });
    } catch (error) {
      this.emit({
        type: 'blockFailed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    } finally {
      this.executionState.isRunning = false;
    }

    return this.executionState.results;
  }

  private async executeBlocks(blocks: RuntimeBlock[]): Promise<void> {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      if (!block.enabled) {
        this.updateBlockStatus(block.id, 'skipped');
        continue;
      }

      this.executionState.currentBlockIndex = i;
      this.updateBlockStatus(block.id, 'running');
      this.emit({
        type: 'blockStart',
        blockId: block.id,
        blockIndex: i,
      });

      if (block.type === 'tool') {
        this.emit({
          type: 'toolExposed',
          blockId: block.id,
          data: { tools: (block as ToolBlock).allowedTools },
        });
      }

      try {
        await this.executeBlock(block);
        this.updateBlockStatus(block.id, 'completed');
      } catch (error) {
        this.updateBlockStatus(block.id, 'failed');
        throw error;
      }
    }
  }

  private async executeBlock(block: RuntimeBlock): Promise<void> {
    const startTime = Date.now();
    let result: BlockResult;

    try {
      switch (block.type) {
        case 'start':
          result = await this.executeStartBlock(block as StartBlock);
          break;
        case 'think':
          result = await this.executeThinkBlock(block as ThinkBlock);
          break;
        case 'tool':
          result = await this.executeToolBlock(block as ToolBlock);
          break;
        case 'respond':
          result = await this.executeRespondBlock(block as RespondBlock);
          break;
        case 'stop':
          result = await this.executeStopBlock(block as StopBlock);
          break;
        default:
          throw new Error(`Unknown block type: ${(block as RuntimeBlock).type}`);
      }

      result.duration = Date.now() - startTime;
      this.executionState.results[block.id] = result;
    } catch (error) {
      result = {
        blockId: block.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
      this.executionState.results[block.id] = result;
      throw error;
    }
  }

  private async executeStartBlock(block: StartBlock): Promise<BlockResult> {
    if (!this.context) throw new Error('No execution context');

    const previousContext = this.context.input;
    let blockContext = 'Starting runtime';

    if (block.acceptsUserInput) {
      blockContext += `\nUser input will be: ${this.context.input}`;
    }

    if (block.includeDefaults && this.spec?.runtimeDefaults?.globalInstructions) {
      const globalInstructions = this.spec.runtimeDefaults.globalInstructions;
      this.context.options.prefix = globalInstructions;
      this.context.options.prefixEnabled = true;
      blockContext += `\nGlobal instructions: ${globalInstructions}`;
    }

    if (block.startupInstructions) {
      blockContext += `\nStartup instructions: ${block.startupInstructions}`;
    }

    const blockOutput: BlockOutput = {
      blockId: block.id,
      rawOutput: blockContext,
      includedInContext: true,
      previousContext,
      blockContext,
    };
    this.executionState.blockOutputs[block.id] = blockOutput;

    return {
      blockId: block.id,
      success: true,
      output: blockContext,
      duration: 0,
    };
  }

  private async executeThinkBlock(block: ThinkBlock): Promise<BlockResult> {
    if (!this.context) throw new Error('No execution context');

    const previousContext = this.context.input;
    let blockContext = '';
    
    if (block.contextSources.runtimeInstructions && this.context.options.prefix) {
      blockContext += `[Instructions]: ${this.context.options.prefix}\n`;
    }
    if (block.contextSources.userInput) {
      blockContext += `[User Input]: ${this.context.input}\n`;
    }
    if (block.contextSources.toolResults && Object.keys(this.context.toolResults).length > 0) {
      blockContext += `[Tool Results]: ${JSON.stringify(this.context.toolResults, null, 2)}\n`;
    }

    const promptWithInstructions = blockContext + (block.instructionText ? `\n${block.instructionText}\n` : '') + `\nDecide what to do next.`;

    const response = await this.runtimeEngine.run(
      this.context.config,
      promptWithInstructions,
      this.context.transcript,
      this.context.overrides,
      this.context.options
    );

    const blockOutput: BlockOutput = {
      blockId: block.id,
      rawOutput: response.content,
      reasoning: response.reasoning,
      includedInContext: true,
      previousContext,
      blockContext,
    };
    this.executionState.blockOutputs[block.id] = blockOutput;

    if (block.contextSources.priorBlockOutputs) {
      this.context.input += '\n---\n' + response.content;
      this.context.accumulatedContext += response.content;
    }

    return {
      blockId: block.id,
      success: true,
      output: response.content,
      duration: 0,
    };
  }

  private async executeToolBlock(block: ToolBlock): Promise<BlockResult> {
    if (!this.context) throw new Error('No execution context');

    const previousContext = this.context.input;
    let blockContext = '';
    let toolOutput = '';
    let toolCallInfo: { toolName: string; arguments: Record<string, unknown>; result?: string } | undefined;

    if (block.toolAccessMode === 'fixed' && block.allowedTools[0]) {
      this.emit({
        type: 'toolCalled',
        blockId: block.id,
        data: { toolName: block.allowedTools[0], args: block.staticArguments },
      });

      const toolResult = await this.executeTool(block.allowedTools[0], block.staticArguments);
      this.context.toolResults[block.allowedTools[0]] = toolResult;
      
      toolOutput = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
      blockContext = `[TOOL]: ${block.allowedTools[0]}\nResult: ${toolOutput}`;
      
      toolCallInfo = {
        toolName: block.allowedTools[0],
        arguments: block.staticArguments,
        result: toolOutput,
      };
    } else if (block.toolAccessMode === 'modelChoice' && block.allowedTools.length > 0) {
      blockContext = `[TOOL CHOICE]: Model can choose from: ${block.allowedTools.join(', ')}`;
    }

    const blockOutput: BlockOutput = {
      blockId: block.id,
      rawOutput: toolOutput || blockContext,
      includedInContext: block.resultHandling !== 'internal',
      previousContext,
      blockContext,
      toolCall: toolCallInfo,
    };
    this.executionState.blockOutputs[block.id] = blockOutput;

    if (block.resultHandling === 'nextThink' || block.resultHandling === 'blockOutput') {
      this.context.input += '\n---\n' + (toolOutput || blockContext);
      this.context.accumulatedContext += toolOutput || blockContext;
    }

    return {
      blockId: block.id,
      success: true,
      output: toolOutput || blockContext,
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

  private async executeRespondBlock(block: RespondBlock): Promise<BlockResult> {
    if (!this.context) throw new Error('No execution context');

    const previousContext = this.context.input;
    let blockContext = '';
    let output = '';

    if (block.responseSource === 'thinkOutput') {
      const priorOutputs = Object.values(this.executionState.blockOutputs)
        .filter(o => o.blockId !== block.id)
        .map(o => o.rawOutput)
        .join('\n---\n');
      output = priorOutputs || this.context.input;
      blockContext = '[RESPONSE]: From prior Think output';
    } else if (block.responseSource === 'toolResult') {
      const toolOutputs = Object.values(this.executionState.blockOutputs)
        .filter(o => o.toolCall)
        .map(o => o.toolCall?.result)
        .join('\n');
      output = toolOutputs || 'No tool results available';
      blockContext = '[RESPONSE]: From tool results';
    } else if (block.responseSource === 'custom') {
      output = block.responseGuidance || 'Custom response generated';
      blockContext = '[RESPONSE]: Custom generated';
    }

    const blockOutput: BlockOutput = {
      blockId: block.id,
      rawOutput: output,
      includedInContext: false,
      previousContext,
      blockContext,
    };
    this.executionState.blockOutputs[block.id] = blockOutput;

    this.emit({
      type: 'responseEmitted',
      blockId: block.id,
      data: { source: block.responseSource, visibility: block.visibilityMode, output },
    });

    return {
      blockId: block.id,
      success: true,
      output,
      duration: 0,
    };
  }

  private async executeStopBlock(block: StopBlock): Promise<BlockResult> {
    const output = block.stopReason || 'Runtime completed';
    
    const blockOutput: BlockOutput = {
      blockId: block.id,
      rawOutput: output,
      includedInContext: false,
    };
    this.executionState.blockOutputs[block.id] = blockOutput;

    return {
      blockId: block.id,
      success: true,
      output,
      duration: 0,
    };
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