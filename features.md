# Agent Runtime - Feature Documentation

## Overview

Agent Runtime is a local-first, transparent runtime for tool-augmented LLM agents. It allows users to observe, control, and refine their agent's execution flow through an intuitive web interface.

## Technology Stack

- **Framework**: Next.js (App Router)
- **State Management**: React Context API with localStorage persistence
- **API Communication**: OpenAI SDK (client-side)
- **Runtime Engine**: Custom agent execution engine with streaming support

---

## Pages Overview

| Route | Page Name | Description |
|-------|-----------|-------------|
| `/` | Home | Navigation hub with quick start guide |
| `/chat-agent` | Chat Agent | Chat with AI agents with full context control |
| `/configure` | Configure & Test | API profile management and connection testing |
| `/export` | State | Export, import, and reset application state |
| `/sandbox/tools` | Tools Sandbox | Build and test custom tools |
| `/sandbox/runtime` | Runtime Builder | Create custom runtimes with tool configurations |
| `/sandbox/prompts` | Prompts Builder | Configure prompts for runtime execution phases |

---

## Detailed Feature List

### Home (`/`)

- **Navigation Links**: Quick access to all application sections
- **Quick Start Guide**: 3-step onboarding instructions
  1. Add an API profile in Configure
  2. Build custom tools in Tools Sandbox
  3. Start chatting in Chat Agent
- **About Section**: Description of the application purpose

---

### Chat Agent (`/chat-agent`)

The Chat Agent is the main interaction point for chatting with AI models with granular control over context.

#### Context Management

- **System Prefix (System Prompt)**
  - Toggleable on/off
  - Editable text area for custom system prompt
  - Collapsible panel

- **Active Context Chain**
  - Toggleable on/off
  - Displays all previous messages in the conversation
  - Each message can be individually managed

- **Per-Message Controls**
  - **Include/Exclude**: Toggle whether individual messages are sent to the model
  - **Content Override**: Edit message content before next API call
  - **Reasoning Override**: Edit reasoning/thinking content (for assistant messages)
  - **Include/Exclude Reasoning**: Toggle thinking inclusion per message

- **Context Preview**
  - "View Context" button shows full context that will be sent
  - Copy context to clipboard functionality

#### Transcript Management

- **Canonical Transcript Display**
  - Shows full conversation history
  - User messages marked with "U", assistant with "AI"

- **Message Features**
  - View context snapshots (what was sent to model for that turn)
  - Visual indicators for overridden content (yellow highlight)
  - Excluded messages shown with strikethrough

- **Actions**
  - Reset overrides (restore all messages to original)
  - Clear entire context
  - Reset individual turns

#### Execution Flow Visualization

Four-stage execution pipeline:
1. **Preparing Context** - Building the request payload
2. **Calling Model API** - Making the API request (inspectable)
3. **Streaming Response** - Receiving and displaying response
4. **Loop Complete** - Final state

- **Step Mode**: Toggle to pause execution between stages
- **Inspect Button**: View raw API request/response details

---

### Configure & Test (`/configure`)

API configuration and testing interface.

#### Profile Management

- **Create Profile**: Add new API configurations
- **Edit Profile**: Modify existing profile settings
- **Delete Profile**: Remove profiles (with confirmation)
- **Switch Profile**: Select active profile for the application
- **Profile Persistence**: Saved to localStorage

#### Configuration Fields

- **Profile Name**: User-defined identifier
- **Base URL**: API endpoint (default: `http://localhost:8080/v1`)
- **API Key**: Authentication token (password-masked input)
- **Model**: Model identifier (dropdown when fetching, text input otherwise)

#### Actions

- **Fetch Models**: Retrieve available models from the API endpoint
- **Test Connection**: Verify profile works with a simple API call
- **Save Profile**: Persist profile configuration

#### Test Chat Interface

- **Message Input**: Send test messages to verify configuration
- **Reasoning Display**: Collapsible section showing model thinking
- **Retry Info**: Shows retry attempts if enabled

#### Settings

- **Browser API Consent**: Allow direct browser-to-API calls (with warning dialog)
- **Retry on Failure**: Enable automatic retry with exponential backoff

---

### State (`/export`)

Application state management for backup and restore.

#### Export Options

- **Include Profiles**: API configurations (keys masked)
- **Include Global Settings**: Application preferences
- **Include Chat Agent State**: Context, overrides, UI state
- **Include Sandbox Tool Definitions**: Custom tools
- **Include UI States**: Panel collapses, expanded sections

#### Export Actions

- **Export to File**: Download as JSON file
- **Copy to Clipboard**: Quick copy for sharing
- **Edit Mode**: Modify JSON before export

#### Import

- **File Upload**: Load state from JSON file
- **Paste JSON**: Direct JSON input
- **Preview**: Shows what will change before applying
- **Apply**: Merge imported state with existing

#### Reset

- **Reset to Defaults**: Clear all state (with confirmation)
- **Option**: Keep profiles when resetting

---

### Tools Sandbox (`/sandbox/tools`)

Tool development and testing environment.

#### Tool Registry

**Built-in Tools (Read-only)**
- `get_time`: Returns current system time and timezone
- `list_files`: Lists files in the sandbox directory
- `read_file`: Reads content from sandbox files
- `search_text`: Searches for text patterns in sandbox files

**Custom Tools (User-defined)**
- Create new tools
- Edit tool properties (name, description, code, parameters)
- Enable/disable tools
- Delete custom tools

#### Tool Editor

- **Name**: Tool identifier
- **Description**: Human-readable description for LLM
- **Client Implementation**: JavaScript function code
  - Available helpers: `args`, `now()`, `sleep()`, `log()`, `listFiles()`, `readFile()`, `searchFiles()`
- **Parameters**: JSON Schema defining required inputs

#### Tool Execution

- **Arguments Input**: JSON text area for tool parameters
- **Validate**: Check arguments against schema
- **Run Action**: Execute the tool
- **Execution Pipeline Display**:
  - Raw input display
  - Validation status (pass/fail)
  - Result output (JSON formatted)

#### Trace Log

- Timestamped execution entries
- Expandable to show execution steps
- Error display for failed executions

#### Sandbox Files

- **File Browser**: List of uploaded files
- **Upload**: Drag-and-drop or click to browse
  - Supports files and folders
  - Progress indicator for multiple files
- **Delete**: Remove files from sandbox
- **Storage Display**: Used/total storage (default: 5MB)
- **Overwrite Confirmation**: Dialog when uploading existing files

---

### Runtime Builder (`/sandbox/runtime`)

Create and configure complete agent runtimes.

#### Runtime Management

- **Create Runtime**: Add new runtime configuration
- **Edit Runtime**: Modify runtime settings
- **Delete Runtime**: Remove runtime (must have at least one)

#### Runtime Configuration

- **Name**: Runtime identifier
- **Profile**: Select API profile to use
- **System Prompt**: Base assistant instructions
- **Model Settings**:
  - Temperature (0-2, default: 0.7)
  - Max Tokens (100-100000, default: 2048)
- **Loop Limits**:
  - Max Steps (1-100, default: 10)
  - Max Tool Calls (1-100, default: 20)
- **Default Tools**: Checkbox selection of available tools
- **Display Options**: Show/hide thinking stream

#### Sandbox Files

Same file management as Tools Sandbox.

#### Chat Workspace

- **Message Input**: Send prompts to the runtime
- **Thinking Stream**: Live display of model reasoning (if enabled)
- **Context Snapshots**: View what was sent to the model

#### Execution Trace

- **Phase Display**: Visual indicator of current phase
  - Ingest (blue): Processing user input
  - Plan (purple): Model deciding action
  - Act (green): Tool execution
  - Evaluate (yellow): Evaluating tool results
  - Respond (red): Generating final response
- **Step Tracking**: Sequential step numbers
- **Tool Calls**: Show tool name, arguments, and results
- **Transition Reasons**: Explanation of phase changes

---

### Prompts Builder (`/sandbox/prompts`)

Fine-tune prompts for each phase of the agentic loop.

#### Runtime Selection

- Select which runtime to configure
- Create/delete runtimes (same as Runtime Builder)

#### Prompt Editor

Four prompt fields for different execution phases:

1. **System Prompt**: Base behavior definition
   - Applied at the start of every interaction
   - Defines overall assistant personality/role

2. **Plan Prompt**: Action decision phase
   - Sent before model decides what action to take
   - Guides tool selection logic

3. **Evaluate Prompt**: Tool result evaluation
   - Sent after each tool execution
   - Guides decision to continue or respond

4. **Respond Prompt**: Final response generation
   - Used when generating user-facing output
   - Controls response style/format

#### Prompt Preview

- Real-time display of prompts by phase
- Color-coded by execution phase

---

## Duplicate Features

| Feature | Pages | Description |
|---------|-------|-------------|
| Sandbox file management | Tools Sandbox, Runtime Builder | Upload, list, delete files |
| Runtime management | Runtime Builder, Prompts Builder | Create, edit, delete runtimes |
| Profile selection | Configure, Runtime Builder | Choose API profile |
| Chat interface | Chat Agent, Configure, Runtime Builder | Send messages, view responses |
| Tool execution/trace | Tools Sandbox, Runtime Builder | Run tools, view execution logs |
| JSON Schema editor | Tools Sandbox | Edit tool parameter schemas |

---

## State Management

The application uses React Context API with the following state domains:

- **Profiles**: API configurations
- **Global Settings**: Application preferences
- **Context Engine**: Chat Agent state
- **Sandbox**: Tools and files
- **Runtime**: Runtime configurations

All state is persisted to localStorage for persistence across sessions.

---

## API Integration

- **Direct Client Calls**: Uses OpenAI SDK from browser
- **Supported APIs**: OpenAI-compatible APIs (OpenAI, Ollama, LM Studio, etc.)
- **Streaming**: Full streaming support for responses and reasoning
- **Reasoning Support**: Handles models with extended thinking (e.g., o1, o3-mini)
