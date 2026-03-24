'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { AppState, Profile, GlobalSettings, ContextEngineState, SandboxState, ChatAgentAppState, ChatAgentUIState, SandboxAppState, SandboxUIState } from './types';
import { createDefaultState, createDefaultProfile, createDefaultContextEngineState, createDefaultSandboxState } from './defaults';
import { loadState, saveState, exportCurrentState } from './storage';
import { exportState, createExportOptions, generateExportFilename, downloadExport } from './export';
import { previewImport, applyImport, validateImportJson } from './import';
import type { ExportOptions, ImportPreview } from './types';
import { setBrowserConsent as setBrowserConsentLocalStorage } from '@/lib/api/client';

interface StateContextValue {
  state: AppState;
  isLoading: boolean;
  error: string | null;
  
  // Profile operations
  profiles: Profile[];
  activeProfile: Profile | null;
  addProfile: (name: string, baseUrl: string, model: string, apiKey?: string) => Profile;
  updateProfile: (id: string, updates: Partial<Omit<Profile, 'id' | 'createdAt'>>) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string | null) => void;
  
  // Global settings
  globalSettings: GlobalSettings;
  updateGlobalSettings: (updates: Partial<GlobalSettings>) => void;
  
  // Browser consent
  browserConsent: boolean;
  setBrowserConsent: (consent: boolean) => void;
  
  // Page state accessors
  contextEngine: ContextEngineState;
  updateContextEngine: (updates: Partial<ContextEngineState>) => void;
  
  sandbox: SandboxState;
  updateSandbox: (updates: Partial<SandboxState>) => void;
  
  // Reset
  resetToDefaults: (keepProfiles?: boolean) => void;
  
  // Export/Import
  getExportData: (options?: ExportOptions) => string;
  downloadExportFile: (options?: ExportOptions) => void;
  previewImportData: (json: string) => ImportPreview | null;
  applyImportData: (json: string) => boolean;
  exportCurrentForRecovery: () => string | null;
}

const StateContext = createContext<StateContextValue | null>(null);

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load state on mount
  useEffect(() => {
    const result = loadState();
    
    if (!result.success && result.error) {
      setError(result.error);
    }
    
    const defaults = createDefaultState();
    let loadedState = result.state || defaults;
    
    // Migrate old pageStates format to new pageAppStates + pageUIStates format
    const stateAny = loadedState as unknown as Record<string, unknown>;
    if ('pageStates' in stateAny && !('pageAppStates' in stateAny)) {
      const oldPageStates = stateAny.pageStates as Record<string, unknown> | undefined;
      
      const newPageAppStates = { ...defaults.pageAppStates };
      const newPageUIStates = { ...defaults.pageUIStates };
      
      if (oldPageStates?.contextEngine) {
        const oldContextEngine = oldPageStates.contextEngine as Record<string, unknown>;
        newPageAppStates.chatAgent = {
          prefix: oldContextEngine.prefix as string,
          prefixEnabled: oldContextEngine.prefixEnabled as boolean,
          historyEnabled: oldContextEngine.historyEnabled as boolean,
          transcript: oldContextEngine.transcript as never[],
          overrides: oldContextEngine.overrides as Record<string, never>,
        };
        newPageUIStates.chatAgent = {
          showContextPreview: oldContextEngine.showContextPreview as boolean,
          expandedStages: oldContextEngine.expandedStages as Record<string, boolean>,
          viewingSnapshotIndex: oldContextEngine.viewingSnapshotIndex as string | null,
          prefixCollapsed: oldContextEngine.prefixCollapsed as boolean,
          historyCollapsed: oldContextEngine.historyCollapsed as boolean,
          expandedThinking: oldContextEngine.expandedThinking as Record<string, boolean>,
          showFullPrompt: oldContextEngine.showFullPrompt as boolean,
          expandedContextThinking: oldContextEngine.expandedContextThinking as Record<string, boolean>,
        };
      }
      
      if (oldPageStates?.sandbox) {
        const oldSandbox = oldPageStates.sandbox as Record<string, unknown>;
        newPageAppStates.sandbox = {
          selectedToolId: oldSandbox.selectedToolId as string | null,
          toolDrafts: oldSandbox.toolDrafts as Record<string, never>,
          invocationDrafts: oldSandbox.invocationDrafts as Record<string, never>,
          pipeline: oldSandbox.pipeline as never,
          customTools: oldSandbox.customTools as never[],
        };
        newPageUIStates.sandbox = {
          expandedTools: oldSandbox.expandedTools as string[],
          builtInToolsExpanded: oldSandbox.builtInToolsExpanded as boolean,
          userToolsExpanded: oldSandbox.userToolsExpanded as boolean,
        };
      }
      
      loadedState = {
        ...loadedState,
        pageAppStates: newPageAppStates,
        pageUIStates: newPageUIStates,
      };
    }
    
    // Sync browser consent from localStorage (it may have been set before our state)
    const storedConsent = localStorage.getItem('allow_browser_api') === 'true';
    if (storedConsent !== loadedState.browserConsent) {
      loadedState.browserConsent = storedConsent;
    }
    
    setState(loadedState);
    setIsLoading(false);
  }, []);

  // Auto-save on state change
  useEffect(() => {
    if (state && !isLoading) {
      const result = saveState(state);
      if (!result.success) {
        setError(`Failed to save: ${result.error}`);
      }
    }
  }, [state, isLoading]);

  // Profile operations
  const profiles = state?.profiles || [];
  
  const activeProfile = useMemo(() => {
    if (!state?.activeProfileId) return null;
    return state.profiles.find(p => p.id === state.activeProfileId) || null;
  }, [state]);

  const addProfile = useCallback((
    name: string,
    baseUrl: string,
    model: string,
    apiKey: string = ""
  ): Profile => {
    const newProfile = createDefaultProfile(name, baseUrl, model, apiKey);
    
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        profiles: [...prev.profiles, newProfile],
        activeProfileId: prev.activeProfileId || newProfile.id,
      };
    });
    
    return newProfile;
  }, []);

  const updateProfile = useCallback((
    id: string,
    updates: Partial<Omit<Profile, 'id' | 'createdAt'>>
  ) => {
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        profiles: prev.profiles.map(p =>
          p.id === id
            ? { ...p, ...updates, updatedAt: new Date().toISOString() }
            : p
        ),
      };
    });
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setState(prev => {
      if (!prev) return prev;
      const newProfiles = prev.profiles.filter(p => p.id !== id);
      return {
        ...prev,
        profiles: newProfiles,
        activeProfileId: prev.activeProfileId === id
          ? (newProfiles[0]?.id || null)
          : prev.activeProfileId,
      };
    });
  }, []);

  const setActiveProfile = useCallback((id: string | null) => {
    setState(prev => {
      if (!prev) return prev;
      return { ...prev, activeProfileId: id };
    });
  }, []);

  // Global settings
  const globalSettings = state?.globalSettings || {
    systemPrompt: "You are a helpful AI assistant. Answer concisely.",
    systemPromptEnabled: true,
    includeThinkingInContext: true,
    stepMode: false,
  };

  const updateGlobalSettings = useCallback((updates: Partial<GlobalSettings>) => {
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        globalSettings: { ...prev.globalSettings, ...updates },
      };
    });
  }, []);

  // Browser consent
  const browserConsent = state?.browserConsent || false;

  const setBrowserConsent = useCallback((consent: boolean) => {
    setBrowserConsentLocalStorage(consent);
    setState(prev => {
      if (!prev) return prev;
      return { ...prev, browserConsent: consent };
    });
  }, []);

  // Context engine state - merge app and UI states
  const defaultContextEngine = createDefaultContextEngineState();
  const contextEngineAppState = state?.pageAppStates?.chatAgent;
  const contextEngineUIState = state?.pageUIStates?.chatAgent;
  const contextEngine: ContextEngineState = contextEngineAppState && contextEngineUIState
    ? { ...contextEngineAppState, ...contextEngineUIState }
    : defaultContextEngine;

  const updateContextEngine = useCallback((updates: Partial<ContextEngineState>) => {
    setState(prev => {
      if (!prev) return prev;
      const appUpdates: ChatAgentAppState = { ...defaultContextEngine, ...prev.pageAppStates?.chatAgent };
      const uiUpdates: ChatAgentUIState = { ...defaultContextEngine, ...prev.pageUIStates?.chatAgent };
      
      if (updates.prefix !== undefined) appUpdates.prefix = updates.prefix;
      if (updates.prefixEnabled !== undefined) appUpdates.prefixEnabled = updates.prefixEnabled;
      if (updates.historyEnabled !== undefined) appUpdates.historyEnabled = updates.historyEnabled;
      if (updates.transcript !== undefined) appUpdates.transcript = updates.transcript;
      if (updates.overrides !== undefined) appUpdates.overrides = updates.overrides;
      
      if (updates.showContextPreview !== undefined) uiUpdates.showContextPreview = updates.showContextPreview;
      if (updates.expandedStages !== undefined) uiUpdates.expandedStages = updates.expandedStages;
      if (updates.viewingSnapshotIndex !== undefined) uiUpdates.viewingSnapshotIndex = updates.viewingSnapshotIndex;
      if (updates.prefixCollapsed !== undefined) uiUpdates.prefixCollapsed = updates.prefixCollapsed;
      if (updates.historyCollapsed !== undefined) uiUpdates.historyCollapsed = updates.historyCollapsed;
      if (updates.expandedThinking !== undefined) uiUpdates.expandedThinking = updates.expandedThinking;
      if (updates.showFullPrompt !== undefined) uiUpdates.showFullPrompt = updates.showFullPrompt;
      if (updates.expandedContextThinking !== undefined) uiUpdates.expandedContextThinking = updates.expandedContextThinking;
      
      return {
        ...prev,
        pageAppStates: {
          ...prev.pageAppStates,
          chatAgent: appUpdates,
        },
        pageUIStates: {
          ...prev.pageUIStates,
          chatAgent: uiUpdates,
        },
      };
    });
  }, [defaultContextEngine]);

  // Sandbox state - merge app and UI states
  const defaultSandbox = createDefaultSandboxState();
  const sandboxAppState = state?.pageAppStates?.sandbox;
  const sandboxUIState = state?.pageUIStates?.sandbox;
  const sandbox: SandboxState = sandboxAppState && sandboxUIState
    ? { ...sandboxAppState, ...sandboxUIState }
    : defaultSandbox;

  const updateSandbox = useCallback((updates: Partial<SandboxState>) => {
    setState(prev => {
      if (!prev) return prev;
      const appUpdates: SandboxAppState = { ...defaultSandbox, ...prev.pageAppStates?.sandbox };
      const uiUpdates: SandboxUIState = { ...defaultSandbox, ...prev.pageUIStates?.sandbox };
      
      if (updates.selectedToolId !== undefined) appUpdates.selectedToolId = updates.selectedToolId;
      if (updates.toolDrafts !== undefined) appUpdates.toolDrafts = updates.toolDrafts;
      if (updates.invocationDrafts !== undefined) appUpdates.invocationDrafts = updates.invocationDrafts;
      if (updates.pipeline !== undefined) appUpdates.pipeline = updates.pipeline;
      if (updates.customTools !== undefined) appUpdates.customTools = updates.customTools;
      
      if (updates.expandedTools !== undefined) uiUpdates.expandedTools = updates.expandedTools;
      if (updates.builtInToolsExpanded !== undefined) uiUpdates.builtInToolsExpanded = updates.builtInToolsExpanded;
      if (updates.userToolsExpanded !== undefined) uiUpdates.userToolsExpanded = updates.userToolsExpanded;
      
      return {
        ...prev,
        pageAppStates: {
          ...prev.pageAppStates,
          sandbox: appUpdates,
        },
        pageUIStates: {
          ...prev.pageUIStates,
          sandbox: uiUpdates,
        },
      };
    });
  }, [defaultSandbox]);

  // Reset
  const resetToDefaults = useCallback((keepProfiles: boolean = true) => {
    setState(prev => {
      if (!prev) return prev;
      const defaults = createDefaultState();
      return {
        ...defaults,
        profiles: keepProfiles ? prev.profiles : [],
        activeProfileId: keepProfiles && prev.profiles.length > 0 ? prev.profiles[0].id : null,
        browserConsent: prev.browserConsent,
      };
    });
  }, []);

  // Export/Import
  const getExportData = useCallback((options?: ExportOptions): string => {
    if (!state) return '{}';
    return exportState(state, options || createExportOptions());
  }, [state]);

  const downloadExportFile = useCallback((options?: ExportOptions) => {
    const data = getExportData(options);
    const filename = generateExportFilename();
    downloadExport(data, filename);
  }, [getExportData]);

  const previewImportData = useCallback((json: string): ImportPreview | null => {
    if (!state) return null;
    const validation = validateImportJson(json);
    if (!validation.valid) return null;
    
    const result = previewImport(json, state);
    return result.preview || null;
  }, [state]);

  const applyImportData = useCallback((json: string): boolean => {
    if (!state) return false;
    
    const result = applyImport(state, json);
    if (result.success && result.mergedState) {
      setState(result.mergedState);
      return true;
    }
    return false;
  }, [state]);

  const exportCurrentForRecovery = useCallback((): string | null => {
    const result = exportCurrentState();
    return result.success ? result.data || null : null;
  }, []);

  const value: StateContextValue = {
    state: state || createDefaultState(),
    isLoading,
    error,
    profiles,
    activeProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
    globalSettings,
    updateGlobalSettings,
    browserConsent,
    setBrowserConsent,
    contextEngine,
    updateContextEngine,
    sandbox,
    updateSandbox,
    resetToDefaults,
    getExportData,
    downloadExportFile,
    previewImportData,
    applyImportData,
    exportCurrentForRecovery,
  };

  return (
    <StateContext.Provider value={value}>
      {children}
    </StateContext.Provider>
  );
}

export function useAppState(): StateContextValue {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within a StateProvider');
  }
  return context;
}

// Convenience hooks for specific state slices
export function useProfiles() {
  const { profiles, activeProfile, addProfile, updateProfile, deleteProfile, setActiveProfile } = useAppState();
  return { profiles, activeProfile, addProfile, updateProfile, deleteProfile, setActiveProfile };
}

export function useGlobalSettings() {
  const { globalSettings, updateGlobalSettings } = useAppState();
  return { globalSettings, updateGlobalSettings };
}

export function useContextEngine() {
  const { contextEngine, updateContextEngine } = useAppState();
  return { contextEngine, updateContextEngine };
}

export function useSandbox() {
  const { sandbox, updateSandbox } = useAppState();
  return { sandbox, updateSandbox };
}

export function useBrowserConsent() {
  const { browserConsent, setBrowserConsent } = useAppState();
  return { browserConsent, setBrowserConsent };
}
