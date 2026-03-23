/**
 * Export Logic
 * 
 * Handles exporting state to JSON with configurable options.
 */

import type { AppState, ExportOptions } from './types';

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeProfiles: true,
  includeGlobalSettings: true,
  includeContextEngine: true,
  includeSandboxTools: true,
};

/**
 * Creates export options with default values.
 */
export function createExportOptions(partial?: Partial<ExportOptions>): ExportOptions {
  return {
    ...DEFAULT_EXPORT_OPTIONS,
    ...partial,
  };
}

/**
 * Exports state to JSON based on options.
 * API keys are always stripped from profiles.
 */
export function exportState(
  state: AppState,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): string {
  const exportData: Partial<AppState> = {
    version: state.version,
  };

  if (options.includeProfiles) {
    // Strip API keys from profiles
    exportData.profiles = state.profiles.map(p => ({
      ...p,
      apiKey: '',
    }));
  }

  if (options.includeGlobalSettings) {
    exportData.globalSettings = { ...state.globalSettings };
  }

  if (options.includeContextEngine && state.pageStates.contextEngine) {
    exportData.pageStates = {
      ...(exportData.pageStates || {}),
      contextEngine: { ...state.pageStates.contextEngine },
    };
  }

  if (options.includeSandboxTools && state.pageStates.sandbox) {
    exportData.pageStates = {
      ...(exportData.pageStates || {}),
      sandbox: {
        ...state.pageStates.sandbox,
        // Don't include pipeline execution state
        pipeline: state.pageStates.sandbox.pipeline,
        invocationDrafts: { ...state.pageStates.sandbox.invocationDrafts },
      },
    };
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generates a filename for export with timestamp.
 */
export function generateExportFilename(): string {
  const date = new Date().toISOString().split('T')[0];
  return `agent-runtime-export-${date}.json`;
}

/**
 * Triggers download of export data as a file.
 */
export function downloadExport(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gets a summary of what would be exported.
 */
export function getExportSummary(
  state: AppState,
  options: ExportOptions
): string {
  const parts: string[] = [];

  if (options.includeProfiles) {
    parts.push(`${state.profiles.length} profile(s)`);
  }

  if (options.includeGlobalSettings) {
    parts.push('global settings');
  }

  if (options.includeContextEngine && state.pageStates.contextEngine) {
    const ce = state.pageStates.contextEngine;
    parts.push(`context engine (${ce.transcript.length} messages)`);
  }

  if (options.includeSandboxTools && state.pageStates.sandbox) {
    const sandbox = state.pageStates.sandbox;
    const toolCount = Object.keys(sandbox.toolDrafts).length;
    parts.push(`sandbox (${toolCount} tool(s))`);
  }

  if (parts.length === 0) {
    return 'Nothing to export';
  }

  return `Export: ${parts.join(', ')}`;
}
