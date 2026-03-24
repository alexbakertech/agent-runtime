# Application State Documentation

This document describes the centralized state management system for the Agent Runtime application.

## Overview

The application uses a single JSON state object as the authoritative source of truth for all client-side data. This state is persisted to `localStorage` and provides a structured, documented, and exportable/importable format for:

- API profile configurations
- Global settings
- Page-specific state (context engine, sandbox, etc.)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    localStorage                              │
│                   ┌────────────────┐                        │
│                   │   app_state    │  ← Full AppState JSON │
│                   └────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              ↑
                    ┌─────────────────┐
                    │  StateContext   │
                    │   (Provider)    │
                    └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ↓               ↓               ↓
        ┌──────────┐   ┌───────────┐   ┌──────────┐
        │Configure │   │ Context   │   │ Sandbox  │
        │  Page    │   │  Engine   │   │  Tools   │
        └──────────┘   └───────────┘   └──────────┘
```

## State Schema

### AppState (Root)

The root object containing all application state.

| Field | Type | Description |
|-------|------|-------------|
| `version` | `string` | Schema version for future migrations (e.g., "1.0.0") |
| `profiles` | `Profile[]` | Array of saved API profiles |
| `activeProfileId` | `string \| null` | ID of the currently selected profile |
| `browserConsent` | `boolean` | Whether user has consented to browser API usage |
| `globalSettings` | `GlobalSettings` | Application-wide settings |
| `pageStates` | `PageStates` | Page-specific state containers |

### Profile

Represents an API configuration profile.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Unique identifier for the profile |
| `name` | `string` | Display name (e.g., "OpenAI GPT-4") |
| `baseUrl` | `string` | API base URL (e.g., "https://api.openai.com/v1") |
| `apiKey` | `string` | API authentication key (never exported) |
| `model` | `string` | Model identifier (e.g., "gpt-4", "claude-3-opus") |
| `createdAt` | `string` (ISO) | Profile creation timestamp |
| `updatedAt` | `string` (ISO) | Last modification timestamp |

### GlobalSettings

Application-wide settings that apply across all pages.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `systemPrompt` | `string` | "You are a helpful AI assistant. Answer concisely." | Default system prompt |
| `systemPromptEnabled` | `boolean` | `true` | Whether system prompt is active |
| `includeThinkingInContext` | `boolean` | `true` | Include reasoning/thinking in context |
| `stepMode` | `boolean` | `false` | Enable step-by-step execution mode |

### PageStates

Container for page-specific state objects.

| Field | Type | Description |
|-------|------|-------------|
| `contextEngine` | `ContextEngineState` | State for the Chat Agent page |
| `sandbox` | `SandboxState` | State for the Tools Sandbox page |
| `runtimeSpec` | `RuntimeSpecState` | State for the Runtime Spec page |

### ContextEngineState

Manages chat transcript, message overrides, and UI state for the Chat Agent.

| Field | Type | Description |
|-------|------|-------------|
| `prefix` | `string` | Custom system prompt for this page |
| `prefixEnabled` | `boolean` | Whether prefix is active |
| `historyEnabled` | `boolean` | Include chat history in context |
| `transcript` | `TranscriptEntry[]` | Chat message history |
| `overrides` | `Record<string, Override>` | Message modifications keyed by entry ID |
| `showContextPreview` | `boolean` | Show full context preview panel |
| `expandedStages` | `Record<string, boolean>` | Which execution stages are expanded |
| `viewingSnapshotIndex` | `string \| null` | ID of entry being inspected |
| `prefixCollapsed` | `boolean` | UI state: prefix section collapsed |
| `historyCollapsed` | `boolean` | UI state: history section collapsed |
| `expandedThinking` | `Record<string, boolean>` | Which thinking sections are expanded |
| `showFullPrompt` | `boolean` | Show full prompt in inspection view |
| `expandedContextThinking` | `Record<string, boolean>` | UI state: expanded context thinking sections |

### TranscriptEntry

A single chat message in the transcript.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Unique identifier |
| `role` | `"user" \| "assistant"` | Message sender role |
| `content` | `string` | Message text content |
| `reasoningContent` | `string?` | Thinking/reasoning content (if any) |
| `contextSnapshot` | `string?` | Full prompt sent with this message |
| `timestamp` | `string` (ISO) | When message was added |
| `sentContextSnapshot` | `boolean?` | Whether snapshot was sent |

### Override

Configuration for modifying or excluding a transcript entry.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | ID of the entry being overridden |
| `content` | `string?` | Overridden message content |
| `reasoningContent` | `string?` | Overridden reasoning content |
| `excluded` | `boolean` | Exclude this message from context |
| `reasoningExcluded` | `boolean` | Exclude reasoning from context |

### SandboxState

Manages tool definitions and execution state for the Sandbox.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `selectedToolId` | `string \| null` | `null` | Currently selected tool |
| `toolDrafts` | `Record<string, ToolDraft>` | `{}` | Tool definitions keyed by ID |
| `invocationDrafts` | `Record<string, ToolInvocationDraft>` | `{}` | Invocation drafts |
| `pipeline` | `ExecutionPipelineState` | - | Current execution state |
| `expandedTools` | `string[]` | `[]` | IDs of expanded tool sections |
| `builtInToolsExpanded` | `boolean` | `true` | Whether built-in tools section is expanded |
| `userToolsExpanded` | `boolean` | `true` | Whether user tools section is expanded |
| `customTools` | `CustomTool[]` | `[]` | User-defined custom tools |

### CustomTool

A user-defined custom tool.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Unique identifier |
| `name` | `string` | Tool display name |
| `description` | `string` | Human-readable description |
| `parameters` | `object` | JSON Schema for tool parameters |
| `code` | `string` | Tool implementation code |
| `enabled` | `boolean` | Whether tool is enabled |
| `createdAt` | `string` (ISO) | Creation timestamp |
| `updatedAt` | `string` (ISO) | Last modification timestamp |

### ToolDraft

A tool definition.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Unique identifier |
| `name` | `string` | Tool display name |
| `description` | `string` | Human-readable description |
| `schemaText` | `string` | JSON Schema for parameters |
| `code` | `string` | Tool implementation code |
| `enabled` | `boolean` | Whether tool is active |
| `createdAt` | `string` (ISO) | Creation timestamp |
| `updatedAt` | `string` (ISO) | Last modification timestamp |

### ToolInvocationDraft

A draft for invoking a tool with specific arguments.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `argsText` | `string` | JSON string of tool arguments |

### ExecutionPipelineState

Tracks the state of tool invocation execution.

| Field | Type | Description |
|-------|------|-------------|
| `rawArgsText` | `string` | Raw argument input |
| `parsedArgs` | `Record<string, unknown> \| null` | Parsed arguments |
| `parseError` | `string \| null` | JSON parsing error |
| `validation` | `ValidationResult \| null` | Schema validation result |
| `result` | `unknown` | Execution result |
| `error` | `string \| null` | Execution error message |
| `active` | `boolean` | Whether execution is in progress |

### ValidationResult

Result of validating tool arguments against schema.

| Field | Type | Description |
|-------|------|-------------|
| `valid` | `boolean` | Whether validation passed |
| `error` | `string?` | Error message if invalid |
| `warnings` | `string[]?` | Non-blocking warnings |

### RuntimeSpecState

Minimal state for the Runtime Spec page.

| Field | Type | Description |
|-------|------|-------------|
| `showRawJson` | `boolean` | Show raw JSON view |

## Export/Import

### Export Options

When exporting, you can configure which sections to include:

| Option | Description |
|--------|-------------|
| `includeProfiles` | Include profile configurations (API keys always excluded) |
| `includeGlobalSettings` | Include global settings |
| `includeContextEngine` | Include context engine state |
| `includeSandboxTools` | Include sandbox tool definitions |

### Import Behavior

Imports use a **preview merge** strategy:

1. **Profiles**: Added if no profile with same `name` + `baseUrl` exists. Updated if duplicate found. API keys are never imported.
2. **Global Settings**: Merged (imported values override existing).
3. **Page States**: Replaced entirely (imported values overwrite existing).

### Security

- **API keys are never exported** - They must be re-entered after import
- **localStorage only** - State is browser-local, not synced to any server
- **Manual transfer** - Export to file, import on another browser/device

## API Reference

### Hooks

```typescript
// Full state access
const { state, isLoading, error } = useAppState();

// Profile management
const { profiles, activeProfile, addProfile, updateProfile, deleteProfile, setActiveProfile } = useProfiles();

// Global settings
const { globalSettings, updateGlobalSettings } = useGlobalSettings();

// Context engine state
const { contextEngine, updateContextEngine } = useContextEngine();

// Sandbox state
const { sandbox, updateSandbox } = useSandbox();

// Browser consent
const { browserConsent, setBrowserConsent } = useBrowserConsent();
```

### Key Methods

```typescript
// Export current state
downloadExportFile(options);

// Preview import without applying
const preview = previewImportData(jsonString);

// Apply import
const success = applyImportData(jsonString);

// Reset to defaults (keepProfiles = true)
resetToDefaults(true);

// Get export string for manual handling
const json = getExportData(options);
```

## Default Values

When no state exists in localStorage, the following defaults are created:

```javascript
{
  version: "1.0.0",
  profiles: [],
  activeProfileId: null,
  browserConsent: false,
  globalSettings: {
    systemPrompt: "You are a helpful AI assistant. Answer concisely.",
    systemPromptEnabled: true,
    includeThinkingInContext: true,
    stepMode: false
  },
  pageStates: {
    contextEngine: {
      prefix: "You are a helpful AI assistant. Answer concisely.",
      prefixEnabled: true,
      historyEnabled: true,
      transcript: [],
      overrides: {},
      showContextPreview: false,
      expandedStages: {},
      viewingSnapshotIndex: null,
      prefixCollapsed: false,
      historyCollapsed: false,
      expandedThinking: {},
      showFullPrompt: false,
      expandedContextThinking: {}
    },
    sandbox: {
      selectedToolId: null,
      toolDrafts: {},
      invocationDrafts: {},
      pipeline: { /* empty state */ },
      expandedTools: [],
      builtInToolsExpanded: true,
      userToolsExpanded: true,
      customTools: []
    }
  }
}
```

## Error Handling

If localStorage operations fail:

1. Attempt to export current state for recovery
2. If export succeeds, prompt user to save
3. If export fails, offer to restore defaults with confirmation
4. Never silently lose user data

## Migration Guide

### Schema Versioning

The `version` field enables future migrations. To migrate:

1. Check `state.version` on load
2. Apply migration functions if version differs from `CURRENT_VERSION`
3. Update version field after migration
4. Save migrated state

### Adding New Fields

When adding new fields to the schema:

1. Add field with default value to types
2. Update `createDefaultState()` in `defaults.ts`
3. Update documentation
4. No migration needed for optional fields with defaults

### Breaking Changes

For breaking schema changes:

1. Implement migration function
2. Increment `CURRENT_VERSION`
3. Document migration steps
4. Test migration from previous versions
