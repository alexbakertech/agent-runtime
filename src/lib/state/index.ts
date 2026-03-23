/**
 * State Management Module
 * 
 * Centralized state management for the application.
 */

// Types
export type {
  AppState,
  Profile,
  GlobalSettings,
  PageStates,
  ContextEngineState,
  TranscriptEntry,
  Override,
  SandboxState,
  ToolDraft,
  ToolInvocationDraft,
  ExecutionPipelineState,
  ValidationResult,
  RuntimeSpecState,
  ExportOptions,
  ImportPreview,
  ToolTraceEntry,
  ToolTraceStep,
  CustomTool,
} from './types';

// Constants
export { CURRENT_VERSION } from './types';

// Defaults
export { createDefaultState, createDefaultProfile, generateUUID } from './defaults';

// Storage
export {
  loadState,
  saveState,
  exportCurrentState,
  isStorageAvailable,
  getStorageKey,
} from './storage';
export type { StorageResult, ExportableResult } from './storage';

// Export
export {
  exportState,
  createExportOptions,
  generateExportFilename,
  downloadExport,
  getExportSummary,
} from './export';

// Import
export {
  previewImport,
  applyImport,
  validateImportJson,
} from './import';
export type { ImportResult, ApplyImportResult } from './import';

// Context
export {
  StateProvider,
  useAppState,
  useProfiles,
  useGlobalSettings,
  useContextEngine,
  useSandbox,
  useBrowserConsent,
} from './StateContext';
