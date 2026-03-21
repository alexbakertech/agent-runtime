import { LoopStage, TraceEvent, RuntimeConfig, Message, Override, RequestAssemblyOptions } from './types';
import { assembleRequest } from './assembly';

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

      // Perform the actual call (could be delegated, but implementing here for now)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, message: fullPromptText }),
      });

      if (!response.ok) throw new Error(`API failed: ${response.statusText}`);

      // STAGE 3: Receiving (Streaming)
      // Note: Since streaming involves updating state continuously, 
      // we'll emit 'receiving' events with the current chunk.
      await this.transition('receiving');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available on response body.');

      let accumulated = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        accumulated += chunk;
        
        // Emit update (though transition logic for 'receiving' usually happens once, 
        // we can provide updates through onEvent)
        this.onEvent('receiving', accumulated);
      }

      await this.transition('finished', accumulated);
      return accumulated;
      
    } catch (err: any) {
      await this.transition('error', err.message || 'Unknown error');
      throw err;
    }
  }
}
