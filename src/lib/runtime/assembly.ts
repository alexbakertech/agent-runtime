import { Message, RequestAssemblyOptions, Override } from './types';

/**
 * Assembles a request prompt string from transcript, overrides, and prefix options.
 */
export function assembleRequest(
  transcript: Message[],
  input: string,
  overrides: Record<number, Override> = {},
  options: RequestAssemblyOptions = {}
) {
  const { prefix = '', prefixEnabled = true, historyEnabled = true } = options;

  // 1. Determine effective history
  const effectiveHistory: Message[] = [];
  if (historyEnabled) {
    transcript.forEach((msg, idx) => {
      const ovr = overrides[idx];
      if (!ovr?.excluded) {
        effectiveHistory.push({
          role: msg.role,
          content: ovr?.content !== undefined ? ovr.content : msg.content
        });
      }
    });
  }

  // 2. Format into single prompt string (simple format for now)
  let fullPromptText = (prefixEnabled && prefix) ? prefix + '\n\n' : '';
  
  effectiveHistory.forEach(m => {
    fullPromptText += `${m.role.toUpperCase()}: ${m.content}\n\n`;
  });
  
  fullPromptText += `USER: ${input}`;

  return {
    fullPromptText,
    effectiveHistory,
  };
}
