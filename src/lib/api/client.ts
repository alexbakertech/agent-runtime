import { OpenAI } from 'openai';

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const BROWSER_CONSENT_KEY = 'allow_browser_api';

export function isBrowserConsentGiven(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BROWSER_CONSENT_KEY) === 'true';
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

  try {
    const openai = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });
    const response = await openai.chat.completions.create({
      model: config.model || 'default',
      messages: [{ role: 'user', content: 'Say "hello"' }],
      max_tokens: 5,
    });
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

  try {
    const openai = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });
    const response = await openai.models.list();
    return { success: true, models: response.data.map(m => m.id) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function* chatStream(config: ApiConfig, message: string): AsyncGenerator<string, void, unknown> {
  if (!isBrowserConsentGiven()) {
    throw new BrowserConsentRequiredError();
  }

  const openai = new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  });
  const stream = await openai.chat.completions.create({
    model: config.model || 'default',
    messages: [{ role: 'user', content: message }],
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta as Record<string, string> | undefined;
    const content = delta?.content || '';
    const reasoning = (delta?.reasoning_content as string | undefined) || '';
    if (content) yield content;
    if (reasoning) yield reasoning;
  }
}
