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
  const { 
    prefix = '', 
    prefixEnabled = true, 
    historyEnabled = true,
    includeThinkingInContext = true
  } = options;

  // 1. Determine effective history
  const effectiveHistory: Message[] = [];
  if (historyEnabled) {
    transcript.forEach((msg, idx) => {
      const ovr = overrides[idx];

      // If main content is excluded, skip entirely
      if (ovr?.excluded) return;

      let content = ovr?.content !== undefined ? ovr.content : msg.content;
      let reasoningContent = msg.reasoningContent;

      // If thinking is excluded, don't include it
      if (ovr?.reasoningExcluded) {
        reasoningContent = undefined;
      } else if (ovr?.reasoningContent !== undefined) {
        // Use override thinking if provided
        reasoningContent = ovr.reasoningContent;
      }

      // Add thinking tags if enabled and present
      if (includeThinkingInContext && reasoningContent && msg.role === 'assistant') {
        content = `<thinking>\n${reasoningContent}\n</thinking>\n\n${content}`;
      }

      effectiveHistory.push({
        role: msg.role,
        content
      });
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
