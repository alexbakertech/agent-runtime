import { LoopStage, TraceEvent, RuntimeConfig, Message, Override, RequestAssemblyOptions } from './types';
import { assembleRequest } from './assembly';
import { OpenAI } from 'openai';
import { isBrowserConsentGiven, isRetryEnabled, withRetry } from '@/lib/api/client';

export type RuntimeEventHandler = (stage: LoopStage, data?: any) => void;

/**
 * The core execution loop for tool-augmented agent interaction.
 * Manages stages, stepping, and orchestration.
 */
export class RuntimeEngine {
  private stage: LoopStage = 'idle';
  private stageData: Record<string, any> = {};
  private stepMode: boolean = false;
  private isWaiting: boolean = false;
  private nextResolver: (() => void) | null = null;
  private onEvent: RuntimeEventHandler;
  private trace: TraceEvent[] = [];

  constructor(onEvent: RuntimeEventHandler) {
    this.onEvent = onEvent;
  }

  // CONFIGURATION
  setStepMode(mode: boolean) {
    this.stepMode = mode;
  }

  getStage() { return this.stage; }
  getTrace() { return this.trace; }
  isWaitingForStep() { return this.isWaiting; }

  // STATE MACHINE HELPERS
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

  /**
   * Proceeds to the next step when in stepMode.
   */
  async next() {
    if (this.nextResolver) {
      const resolve = this.nextResolver;
      this.nextResolver = null;
      this.isWaiting = false;
      this.onEvent(this.stage, this.stageData[this.stage]);
      resolve();
    }
  }

  /**
   * Resets the runtime state (trace and current stage).
   */
  reset() {
    this.stage = 'idle';
    this.stageData = {};
    this.trace = [];
    this.isWaiting = false;
    this.nextResolver = null;
    this.onEvent('idle');
  }

  /**
   * The main run loop for a single interaction turn.
   */
  async run(
    config: RuntimeConfig,
    input: string,
    transcript: Message[],
    overrides: Record<number, Override> = {},
    options: RequestAssemblyOptions = {}
  ) {
    try {
      this.trace = [];

      // STAGE 1: Preparing (Request Assembly)
      const { fullPromptText, effectiveHistory } = assembleRequest(transcript, input, overrides, options);
      await this.transition('preparing', { effectiveMessages: effectiveHistory, fullPromptText });

      // STAGE 2: Calling (API Call)
      const callData = {
        url: config.baseUrl,
        model: config.model,
        body: { model: config.model, message: fullPromptText }
      };
      await this.transition('calling', callData);

      if (!isBrowserConsentGiven()) {
        throw new Error('Browser API consent required. Please enable "Allow browser API calls" in settings.');
      }

      const createStream = async () => {
        const openai = new OpenAI({
          baseURL: config.baseUrl,
          apiKey: config.apiKey,
          dangerouslyAllowBrowser: true,
        });
        return openai.chat.completions.create({
          model: config.model,
          messages: [{ role: 'user', content: fullPromptText }],
          stream: true,
        });
      };

      let retryCount = 0;
      const onRetry = (attempt: number) => {
        retryCount = attempt;
      };

      const stream = isRetryEnabled()
        ? (await withRetry(createStream, 3, 1000, onRetry)).data
        : await createStream();

      await this.transition('receiving');

      let accumulatedContent = '';
      let accumulatedReasoning = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as Record<string, string> | undefined;
        const content = delta?.content || '';
        const reasoning = (delta?.reasoning_content as string | undefined) || '';

        if (reasoning) {
          accumulatedReasoning += reasoning;
        }

        if (content) {
          accumulatedContent += content;
        }

        this.onEvent('receiving', {
          content: accumulatedContent,
          reasoning: accumulatedReasoning,
          hasThinking: !!accumulatedReasoning
        });
      }

      await this.transition('finished', {
        content: accumulatedContent,
        reasoning: accumulatedReasoning,
        retryInfo: retryCount > 0 ? { retries: retryCount } : undefined
      });

      return {
        content: accumulatedContent,
        reasoning: accumulatedReasoning,
        retryInfo: retryCount > 0 ? { retries: retryCount } : undefined
      };

    } catch (err: any) {
      await this.transition('error', err.message || 'Unknown error');
      throw err;
    }
  }
}
