/**
 * LocalStorage Helpers
 * 
 * Handles reading and writing state to localStorage with error handling.
 */

import type { AppState } from './types';
import { createDefaultState } from './defaults';

const STORAGE_KEY = 'app_state';

export interface StorageResult {
  success: boolean;
  state?: AppState;
  error?: string;
}

export interface ExportableResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * Attempts to load state from localStorage.
 * Returns default state if loading fails or no state exists.
 */
export function loadState(): StorageResult {
  try {
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: 'Cannot access localStorage on server',
        state: createDefaultState(),
      };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (!stored) {
      return {
        success: true,
        state: createDefaultState(),
      };
    }

    const parsed = JSON.parse(stored) as AppState;
    
    // Validate basic structure
    if (!isValidAppState(parsed)) {
      console.warn('Invalid state structure, using defaults');
      return {
        success: true,
        state: createDefaultState(),
      };
    }

    return {
      success: true,
      state: parsed,
    };
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      state: createDefaultState(),
    };
  }
}

/**
 * Saves state to localStorage.
 */
export function saveState(state: AppState): StorageResult {
  try {
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: 'Cannot access localStorage on server',
      };
    }

    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);

    return {
      success: true,
      state,
    };
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Attempts to export current state as JSON string.
 * Useful for recovery when storage operations fail.
 */
export function exportCurrentState(): ExportableResult {
  try {
    const result = loadState();
    if (!result.success || !result.state) {
      return {
        success: false,
        error: result.error || 'Failed to load state',
      };
    }

    // Strip API keys for safety
    const safeExport = JSON.parse(JSON.stringify(result.state)) as AppState;
    safeExport.profiles = safeExport.profiles.map(p => ({
      ...p,
      apiKey: '',
    }));

    return {
      success: true,
      data: JSON.stringify(safeExport, null, 2),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Checks if localStorage is available.
 */
export function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the storage key being used.
 */
export function getStorageKey(): string {
  return STORAGE_KEY;
}

/**
 * Validates that an object has the basic structure of an AppState.
 */
function isValidAppState(obj: unknown): obj is AppState {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const state = obj as Record<string, unknown>;
  
  // Check required top-level fields
  if (typeof state.version !== 'string') return false;
  if (!Array.isArray(state.profiles)) return false;
  if (typeof state.browserConsent !== 'boolean') return false;
  if (typeof state.globalSettings !== 'object') return false;

  // Validate profiles
  for (const profile of state.profiles) {
    if (typeof profile !== 'object' || profile === null) return false;
    const p = profile as Record<string, unknown>;
    if (typeof p.id !== 'string') return false;
    if (typeof p.name !== 'string') return false;
  }

  // Validate global settings
  const settings = state.globalSettings as Record<string, unknown>;
  if (typeof settings.systemPrompt !== 'string') return false;
  if (typeof settings.systemPromptEnabled !== 'boolean') return false;

  return true;
}
