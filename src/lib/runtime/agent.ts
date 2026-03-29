import { LoopStage, RuntimeConfig, Message, Override, RequestAssemblyOptions } from './types';
import { OpenAI } from 'openai';
import { isBrowserConsentGiven } from '@/lib/api/client';

export type AgentEventHandler = (stage: LoopStage, data?: any) => void;

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result: string;
}

export interface AgentOptions {
  tools?: ToolDefinition[];
  maxToolCalls?: number;
  prompts?: {
    system?: string;
    plan?: string;
    evaluate?: string;
    respond?: string;
  };
}

/**
 * Agent runtime with tool calling support.
 * Implements the Ingest → Plan → Act → Evaluate → Respond loop.
 */
export class AgentRuntime {
  private stage: LoopStage = 'idle';
  private stageData: Record<string, any> = {};
  private stepMode: boolean = false;
  private isWaiting: boolean = false;
  private nextResolver: (() => void) | null = null;
  private onEvent: AgentEventHandler;
  private trace: Array<{ stage: LoopStage; data?: any; timestamp: number }> = [];
  private options: AgentOptions = {};

  constructor(onEvent: AgentEventHandler) {
    this.onEvent = onEvent;
  }

  setOptions(options: AgentOptions) {
    this.options = options;
  }

  setStepMode(mode: boolean) {
    this.stepMode = mode;
  }

  getStage() { return this.stage; }
  getTrace() { return this.trace; }
  isWaitingForStep() { return this.isWaiting; }

  private async transition(stage: LoopStage, data?: any) {
    this.stage = stage;
    if (data) this.stageData[stage] = data;
    this.trace.push({ stage, data, timestamp: Date.now() });

    if (this.stepMode && stage !== 'idle' && stage !== 'finished' && stage !== 'error') {
      this.isWaiting = true;
      this.onEvent(stage, data);
      return new Promise<void>(resolve => {
        this.nextResolver = resolve;
      });
    }

    this.onEvent(stage, data);
  }

  async next() {
    if (this.nextResolver) {
      const resolve = this.nextResolver;
      this.nextResolver = null;
      this.isWaiting = false;
      this.onEvent(this.stage, this.stageData[this.stage]);
      resolve();
    }
  }

  reset() {
    this.stage = 'idle';
    this.stageData = {};
    this.trace = [];
    this.isWaiting = false;
    this.nextResolver = null;
    this.onEvent('idle');
  }

  /**
   * Execute a tool by name with the given arguments.
   */
  private async executeTool(toolName: string, args: Record<string, unknown>, sandboxFiles: { path: string; content?: string }[]): Promise<string> {
    switch (toolName) {
      case 'get_time':
        return JSON.stringify({ 
          timestamp: new Date().toISOString(), 
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone 
        });
      
      case 'list_files':
        const files = sandboxFiles.map(f => ({ path: f.path, isDirectory: false }));
        return JSON.stringify({ files, count: files.length });
      
      case 'read_file':
        const filePath = args.filePath as string;
        const file = sandboxFiles.find(f => f.path === filePath);
        if (!file) return JSON.stringify({ error: `File not found: ${filePath}` });
        return JSON.stringify({ content: file.content || '' });
      
      case 'search_text':
        const pattern = args.pattern as string;
        const dirPath = (args.dirPath as string) || '.';
        const regex = new RegExp(pattern, 'g');
        const matches: { file: string; lines: string[] }[] = [];
        for (const file of sandboxFiles) {
          if (file.content && regex.test(file.content)) {
            const lines = file.content.split('\n').filter(line => regex.test(line));
            matches.push({ file: file.path, lines: lines.slice(0, 5) });
          }
        }
        return JSON.stringify({ pattern, matches, matchCount: matches.length });
      
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  }

  /**
   * Run the agent with the given input and tools.
   */
  async run(
    config: RuntimeConfig,
    input: string,
    transcript: Message[],
    overrides: Record<number, Override> = {},
    options: RequestAssemblyOptions = {},
    sandboxFiles: { path: string; content?: string }[] = []
  ) {
    try {
      this.trace = [];
      const tools = this.options.tools || [];
      const maxToolCalls = this.options.maxToolCalls || 10;
      const prompts = this.options.prompts || {};
      let toolCallCount = 0;

      // Get phase-specific prompts
      const systemPrompt = prompts.system || options.prefix || 'You are a helpful AI assistant.';
      const planPrompt = prompts.plan || '';
      const evaluatePrompt = prompts.evaluate || '';
      const respondPrompt = prompts.respond || '';

      // Build initial context
      let contextText = '';
      if (options.prefixEnabled && systemPrompt) {
        contextText += `System: ${systemPrompt}\n\n`;
      }
      
      const effectiveHistory = transcript.filter((_, idx) => {
        const override = overrides[idx];
        return !override?.excluded;
      });

      for (const msg of effectiveHistory) {
        contextText += `${msg.role.toUpperCase()}: ${msg.content}\n\n`;
      }
      contextText += `USER: ${input}`;

      await this.transition('preparing', { context: contextText, tools });

      if (!isBrowserConsentGiven()) {
        throw new Error('Browser API consent required. Please enable "Allow browser API calls" in settings.');
      }

      const openai = new OpenAI({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        dangerouslyAllowBrowser: true,
      });

      // Build messages with tools
      const messages: { role: string; content?: string; tool_calls?: unknown[]; tools?: unknown[]; tool_call_id?: string }[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Add plan prompt as user message if defined
      if (planPrompt) {
        messages.push({ role: 'user', content: planPrompt });
      }

      // Add transcript as conversation history
      for (const msg of effectiveHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }

      // Add current user input
      messages.push({ role: 'user', content: input });

      // Main agent loop
      let currentResponse = '';
      let hasMoreToolCalls = true;

      while (hasMoreToolCalls && toolCallCount < maxToolCalls) {
        await this.transition('calling', { toolCallCount, attempt: toolCallCount + 1 });

        const chatParams: Record<string, unknown> = {
          model: config.model,
          messages,
          stream: true,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 2048,
        };

        // Add tools if available
        if (tools.length > 0) {
          chatParams.tools = tools;
          chatParams.tool_choice = 'auto';
        }

        // @ts-expect-error - OpenAI SDK typing issue with dynamic params
        const stream = await openai.chat.completions.create(chatParams);

        // Debug logging
        console.log('[AgentRuntime] Calling model with tools:', tools.map(t => t.function.name));
        console.log('[AgentRuntime] Messages:', JSON.stringify(messages, null, 2));

        await this.transition('receiving');

        let accumulatedContent = '';
        let toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
        let finishReason: string | null = null;

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          finishReason = chunk.choices[0]?.finish_reason || null;

          if (delta?.content) {
            accumulatedContent += delta.content;
            this.onEvent('receiving', { content: accumulatedContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined });
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                // Check if this tool call already exists
                const existingIdx = toolCalls.findIndex(existing => existing.id === tc.id);
                if (existingIdx >= 0) {
                  // Append to existing tool call
                  toolCalls[existingIdx].arguments += tc.function?.arguments || '';
                } else {
                  // New tool call
                  toolCalls.push({ 
                    id: tc.id, 
                    name: tc.function?.name || '', 
                    arguments: tc.function?.arguments || '' 
                  });
                }
              }
            }
            this.onEvent('receiving', { content: accumulatedContent, toolCalls });
          }
        }

        currentResponse = accumulatedContent;

        console.log('[AgentRuntime] Finish reason:', finishReason);
        console.log('[AgentRuntime] Tool calls received:', toolCalls);
        console.log('[AgentRuntime] Content:', accumulatedContent);

        // Handle tool calls - if model requested tool calls, process them and continue loop
        if (toolCalls.length > 0 && finishReason === 'tool_calls') {
          // Add assistant message with tool calls first
          messages.push({
            role: 'assistant',
            content: accumulatedContent,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments }
            }))
          });

          await this.transition('calling', { toolCalls, message: 'Processing tool calls' });

          const toolResults: ToolCallResult[] = [];

          // Process each tool call
          for (const tc of toolCalls) {
            let args = {};
            try {
              args = JSON.parse(tc.arguments);
            } catch {
              args = {};
            }

            // Act phase - execute the tool
            await this.transition('act', { toolCall: tc.name, arguments: args });

            // Execute the tool
            const result = await this.executeTool(tc.name, args, sandboxFiles);
            toolResults.push({
              toolCallId: tc.id,
              toolName: tc.name,
              arguments: args,
              result,
            });

            // Add tool result message - OpenAI expects specific format
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result
            });

            // Add evaluate prompt if defined
            if (evaluatePrompt) {
              messages.push({ role: 'user', content: evaluatePrompt });
            }

            // Evaluate phase - evaluate the tool result
            await this.transition('evaluate', { toolCall: tc.name, result, toolCallCount: toolCallCount + 1 });

            toolCallCount++;
          }

          // Continue loop to get next response from model
          continue;
        }

        // No more tool calls, we're done
        break;
      }

      // Add respond prompt before final response if defined
      if (respondPrompt && currentResponse) {
        messages.push({ role: 'user', content: respondPrompt });
      }

      await this.transition('finished', { content: currentResponse, toolCallCount });

      return {
        content: currentResponse,
        toolCallCount,
      };

    } catch (err: any) {
      await this.transition('error', err.message || 'Unknown error');
      throw err;
    }
  }
}
