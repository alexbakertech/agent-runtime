import { OpenAI } from 'openai';

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const BROWSER_CONSENT_KEY = 'allow_browser_api';
export const RETRY_ENABLED_KEY = 'retry_enabled';

export function isBrowserConsentGiven(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BROWSER_CONSENT_KEY) === 'true';
}

export function isRetryEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(RETRY_ENABLED_KEY) === 'true';
}

export function setRetryEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RETRY_ENABLED_KEY, enabled ? 'true' : 'false');
}

export class RetryableError extends Error {
  constructor(message: string, public readonly retries: number = 0) {
    super(message);
    this.name = 'RetryableError';
  }
}

export interface RetryInfo {
  retries: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  onRetry?: (attempt: number, error: string) => void
): Promise<{ data: T; retryInfo: RetryInfo }> {
  let lastError: Error | undefined;
  let retryCount = 0;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn();
      return { data, retryInfo: { retries: retryCount } };
    } catch (error: any) {
      lastError = error;
      
      const isNetworkError = 
        error?.message?.includes('fetch failed') ||
        error?.message?.includes('ERR_EMPTY_RESPONSE') ||
        error?.message?.includes('network error') ||
        error?.cause?.code === 'ECONNREFUSED' ||
        error?.cause?.code === 'ETIMEDOUT';
      
      if (!isNetworkError || attempt === maxRetries) {
        throw error;
      }
      
      retryCount++;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
      
      if (onRetry) {
        onRetry(retryCount, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export function setBrowserConsent(allowed: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BROWSER_CONSENT_KEY, allowed ? 'true' : 'false');
}

export class BrowserConsentRequiredError extends Error {
  constructor() {
    super('Browser API consent required. Please enable "Allow browser API calls" in settings.');
    this.name = 'BrowserConsentRequiredError';
  }
}

export async function testConnection(config: ApiConfig): Promise<{
  success: boolean;
  model?: string;
  error?: string;
}> {
  if (!isBrowserConsentGiven()) {
    return { success: false, error: 'BROWSER_CONSENT_REQUIRED' };
  }

  const testFn = async () => {
    const openai = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });
    return openai.chat.completions.create({
      model: config.model || 'default',
      messages: [{ role: 'user', content: 'Say "hello"' }],
      max_tokens: 5,
    });
  };

  try {
    const response = isRetryEnabled()
      ? (await withRetry(testFn, 3, 1000)).data
      : await testFn();
    return { success: true, model: response.model };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchModels(config: ApiConfig): Promise<{
  success: boolean;
  models?: string[];
  error?: string;
}> {
  if (!isBrowserConsentGiven()) {
    return { success: false, error: 'BROWSER_CONSENT_REQUIRED' };
  }

  const fetchFn = async () => {
    const openai = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });
    return openai.models.list();
  };

  try {
    const response = isRetryEnabled()
      ? (await withRetry(fetchFn, 3, 1000)).data
      : await fetchFn();
    const models = Array.isArray(response) ? response : response.data;
    return { success: true, models: models.map((m: any) => m.id) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function* chatStream(config: ApiConfig, message: string): AsyncGenerator<string, void, unknown> {
  if (!isBrowserConsentGiven()) {
    throw new BrowserConsentRequiredError();
  }

  const createStream = async () => {
    const openai = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });
    return openai.chat.completions.create({
      model: config.model || 'default',
      messages: [{ role: 'user', content: message }],
      stream: true,
    });
  };

  const stream = isRetryEnabled() 
    ? (await withRetry(createStream, 3, 1000)).data
    : await createStream();
    
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta as Record<string, string> | undefined;
    const content = delta?.content || '';
    const reasoning = (delta?.reasoning_content as string | undefined) || '';
    if (content) yield content;
    if (reasoning) yield reasoning;
  }
}

export interface ChatChunk {
  content?: string;
  reasoning?: string;
  retryInfo?: RetryInfo;
}

export async function* chatStreamWithReasoning(config: ApiConfig, message: string): AsyncGenerator<ChatChunk, void, unknown> {
  if (!isBrowserConsentGiven()) {
    throw new BrowserConsentRequiredError();
  }

  let retryCount = 0;

  const createStream = async () => {
    const openai = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });
    return openai.chat.completions.create({
      model: config.model || 'default',
      messages: [{ role: 'user', content: message }],
      stream: true,
    });
  };

  const onRetry = (attempt: number) => {
    retryCount = attempt;
  };

  const stream = isRetryEnabled()
    ? (await withRetry(createStream, 3, 1000, onRetry)).data
    : await createStream();
    
  let isFirstChunk = true;
  for await (const chunk of stream) {
    if (isFirstChunk && retryCount > 0) {
      yield { retryInfo: { retries: retryCount } };
      isFirstChunk = false;
    }
    const delta = chunk.choices[0]?.delta as Record<string, string> | undefined;
    if (delta?.content) {
      yield { content: delta.content };
    }
    const reasoning = delta?.reasoning_content as string | undefined;
    if (reasoning) {
      yield { reasoning };
    }
  }
}
