/**
 * Import Logic
 * 
 * Handles importing state from JSON with validation and preview.
 */

import type { AppState, ImportPreview, Profile } from './types';
import { CURRENT_VERSION } from './types';

export interface ImportResult {
  success: boolean;
  preview?: ImportPreview;
  error?: string;
}

export interface ApplyImportResult {
  success: boolean;
  mergedState?: AppState;
  error?: string;
}

/**
 * Validates imported JSON and generates a preview.
 */
export function previewImport(
  importedJson: string,
  currentState: AppState
): ImportResult {
  try {
    const parsed = JSON.parse(importedJson);
    
    // Validate basic structure
    if (typeof parsed !== 'object' || parsed === null) {
      return {
        success: false,
        error: 'Invalid JSON: expected an object',
      };
    }

    const errors: string[] = [];
    
    // Validate version
    if (typeof parsed.version !== 'string') {
      errors.push('Missing or invalid version field');
    }

    // Validate profiles if present
    const newProfiles: Profile[] = [];
    const updatedProfiles: Profile[] = [];
    
    if (parsed.profiles) {
      if (!Array.isArray(parsed.profiles)) {
        errors.push('Profiles must be an array');
      } else {
        for (const p of parsed.profiles) {
          if (typeof p.id !== 'string' || !p.id) {
            errors.push('Profile missing valid id');
            continue;
          }
          if (typeof p.name !== 'string' || !p.name) {
            errors.push('Profile missing valid name');
            continue;
          }
          if (typeof p.baseUrl !== 'string') {
            errors.push(`Profile "${p.name}" missing baseUrl`);
            continue;
          }
          if (typeof p.model !== 'string') {
            errors.push(`Profile "${p.name}" missing model`);
            continue;
          }

          const profile: Profile = {
            id: p.id,
            name: p.name,
            baseUrl: p.baseUrl,
            apiKey: '', // Import doesn't include API keys
            model: p.model,
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
          };

          // Check if profile with same name+baseUrl exists
          const existing = currentState.profiles.find(
            existing => existing.name === profile.name && existing.baseUrl === profile.baseUrl
          );

          if (existing) {
            updatedProfiles.push(profile);
          } else {
            newProfiles.push(profile);
          }
        }
      }
    }

    // Validate global settings if present
    let globalSettingsChanged = false;
    if (parsed.globalSettings) {
      if (typeof parsed.globalSettings !== 'object') {
        errors.push('Global settings must be an object');
      } else {
        globalSettingsChanged = true;
      }
    }

    // Check Chat Agent state
    let chatAgentChanged = false;
    if (parsed.pageAppStates?.chatAgent || parsed.pageStates?.contextEngine) {
      chatAgentChanged = true;
    }

    // Check sandbox state
    let sandboxChanged = false;
    if (parsed.pageAppStates?.sandbox || parsed.pageStates?.sandbox) {
      sandboxChanged = true;
    }

    // Check UI states
    let uiStatesChanged = false;
    if (parsed.pageUIStates) {
      uiStatesChanged = true;
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: errors.join('; '),
      };
    }

    // Generate merged state preview
    const mergedState = generateMergedState(currentState, parsed);

    return {
      success: true,
      preview: {
        valid: true,
        errors: [],
        newProfiles,
        updatedProfiles,
        removedProfileIds: [], // We don't remove profiles on import
        globalSettingsChanged,
        chatAgentChanged,
        sandboxChanged,
        uiStatesChanged,
        mergedState,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse JSON',
    };
  }
}

/**
 * Applies the import and returns the merged state.
 */
export function applyImport(
  currentState: AppState,
  importedJson: string
): ApplyImportResult {
  const previewResult = previewImport(importedJson, currentState);
  
  if (!previewResult.success || !previewResult.preview) {
    return {
      success: false,
      error: previewResult.error,
    };
  }

  if (!previewResult.preview.valid) {
    return {
      success: false,
      error: previewResult.preview.errors.join('; '),
    };
  }

  return {
    success: true,
    mergedState: previewResult.preview.mergedState,
  };
}

/**
 * Generates the merged state for preview.
 */
function generateMergedState(currentState: AppState, imported: Record<string, unknown>): AppState {
  const merged: AppState = {
    version: CURRENT_VERSION,
    profiles: [...currentState.profiles],
    activeProfileId: currentState.activeProfileId,
    browserConsent: currentState.browserConsent,
    retryEnabled: currentState.retryEnabled,
    globalSettings: { ...currentState.globalSettings },
    pageAppStates: { ...currentState.pageAppStates },
    pageUIStates: { ...currentState.pageUIStates },
  };

  // Merge profiles
  if (imported.profiles && Array.isArray(imported.profiles)) {
    for (const p of imported.profiles as Record<string, unknown>[]) {
      const profile: Profile = {
        id: p.id as string,
        name: p.name as string,
        baseUrl: p.baseUrl as string,
        apiKey: '', // Import doesn't include API keys
        model: p.model as string,
        createdAt: (p.createdAt as string) || new Date().toISOString(),
        updatedAt: new Date().toISOString(), // Mark as updated
      };

      const existingIndex = merged.profiles.findIndex(
        existing => existing.name === profile.name && existing.baseUrl === profile.baseUrl
      );

      if (existingIndex >= 0) {
        // Update existing, preserve API key
        profile.apiKey = merged.profiles[existingIndex].apiKey;
        merged.profiles[existingIndex] = profile;
      } else {
        merged.profiles.push(profile);
      }
    }
  }

  // Merge global settings
  if (imported.globalSettings && typeof imported.globalSettings === 'object') {
    merged.globalSettings = {
      ...merged.globalSettings,
      ...(imported.globalSettings as Record<string, unknown>),
    } as AppState['globalSettings'];
  }

  // Handle old pageStates format (backward compatibility)
  const oldPageStates = imported.pageStates as Record<string, unknown> | undefined;
  
  // Merge Chat Agent app state (from new format or old contextEngine)
  const importedChatAgent = (imported.pageAppStates as Record<string, unknown> | undefined)?.chatAgent 
    || oldPageStates?.contextEngine;
  if (importedChatAgent && typeof importedChatAgent === 'object') {
    merged.pageAppStates.chatAgent = {
      ...merged.pageAppStates.chatAgent!,
      ...(importedChatAgent as Record<string, unknown>),
    } as NonNullable<AppState['pageAppStates']['chatAgent']>;
  }

  // Merge sandbox app state
  const importedSandbox = (imported.pageAppStates as Record<string, unknown> | undefined)?.sandbox 
    || oldPageStates?.sandbox;
  if (importedSandbox && typeof importedSandbox === 'object') {
    merged.pageAppStates.sandbox = {
      ...merged.pageAppStates.sandbox!,
      ...(importedSandbox as Record<string, unknown>),
    } as NonNullable<AppState['pageAppStates']['sandbox']>;
  }

  // Merge UI states
  if (imported.pageUIStates && typeof imported.pageUIStates === 'object') {
    merged.pageUIStates = {
      ...merged.pageUIStates,
      ...(imported.pageUIStates as Record<string, unknown>),
    } as AppState['pageUIStates'];
  }

  return merged;
}

/**
 * Validates JSON string without generating preview.
 */
export function validateImportJson(json: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(json);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}
