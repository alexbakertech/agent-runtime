```markdown
# agent-runtime v0.1 — Implementation Specification

## Overview
This specification defines the initial implementation of an agentic runtime harness with a structured UI, deterministic execution loop, and observable runtime trace.

The system is composed of:
- A three-panel UI (runtime control, chat workspace, execution trace)
- A loop-based agent runtime (Ingest → Plan → Act → Evaluate → Respond)
- A shared sandbox and tool registry
- A strict separation between runtime configuration and run state

---

# 1. Core Concepts

## 1.1 Runtime Config (Persistent)
A saved, reusable configuration object.

**Fields:**
- `id`
- `name`
- `system_prompt`
- `model_config`
  - `model`
  - `temperature`
  - `max_tokens`
- `default_tools` (array of tool IDs)
- `loop_limits`
  - `max_steps`
  - `max_tool_calls`
- `display_config`
  - `show_thinking` (bool)

## 1.2 Run State (Ephemeral)
Created per execution. Not persisted by default.

**Fields:**
- `run_id`
- `runtime_id`
- `messages` (chat history)
- `phase` (current phase)
- `step_count`
- `tool_call_count`
- `active_tools` (resolved from runtime + overrides)
- `trace` (array of trace items)
- `sandbox_snapshot`
- `status` (`running | waiting | completed | failed`)
- `final_output`

---

## 1.3 Tool Registry (Global)
Global list of tools available to the system.

**Tool Definition:**
- `id`
- `name`
- `description`
- `input_schema`
- `handler` (execution binding)

---

## 1.4 Sandbox (Global, Shared)
A unified file/state sandbox accessible across the entire app.

**Requirements:**
- Single source of truth
- Accessible by:
  - runtime panel
  - tools
  - tool sandbox UI
- Supports:
  - read
  - write
  - list
- Mutations must be reflected across all views

---

# 2. UI Specification

## 2.1 Layout
Three-panel layout:

- **Left Panel** → Runtime + Sandbox
- **Center Panel** → Chat Workspace
- **Right Panel** → Execution Trace

---

## 2.2 Left Panel

### Runtime Selector (Top)
- List all saved runtimes
- Allow switching active runtime
- Switching runtime does NOT mutate current run state

### Sandbox View (Bottom)
- Displays global sandbox contents
- Must be the SAME component used everywhere
- Reflects real-time updates from tool execution

---

## 2.3 Center Panel — Chat Workspace

### Chat Interface
- Standard message input/output
- Streams:
  - thinking (optional based on config)
  - final output

### Tool Controls
- Display all tools from Tool Registry
- Allow toggling tools ON/OFF for current run
- This produces `active_tools` in Run State

### Action Indicators
- When a tool is invoked:
  - show inline indicator
  - include tool name and status

---

## 2.4 Right Panel — Execution Trace

### Purpose
Structured, sequential runtime trace for debugging and inspection.

### Trace Item Structure
Each trace item must include:

- `step_id`
- `phase` (Ingest | Plan | Act | Evaluate | Respond)
- `context_summary`
- `model_input` (expandable)
- `thinking_stream` (if enabled)
- `response_stream`
- `tool_call` (optional)
- `tool_result` (optional)
- `evaluation_result` (optional)
- `transition_reason`

### UI Behavior
- Show trace items in order
- Default collapsed view
- Expand to inspect full details
- Prefer diffs/summaries over full payloads where possible

---

# 3. Runtime Execution Model

## 3.1 Phases

### 1. Ingest
- Accept latest user input
- Build execution context:
  - system prompt
  - chat history
  - active tools
  - sandbox state (if relevant)

---

### 2. Plan
- Invoke model to determine next action

**Possible Outputs:**
- `respond`
- `request_user_input`
- `call_tool`
- `continue_reasoning`

---

### 3. Act
- If `call_tool`:
  - validate input
  - execute tool handler
  - capture result
  - update sandbox if needed

---

### 4. Evaluate
- Determine outcome of previous step

**Decisions:**
- continue loop
- call another tool
- ask user for clarification
- finalize response

---

### 5. Respond
- Generate final user-facing message
- Append to chat
- Mark run as `completed` or `waiting`

---

## 3.2 Execution Loop

```

Ingest → Plan → (Act → Evaluate → Plan)* → Respond

```

---

## 3.3 Loop Termination Conditions

Stop loop when ANY is true:

- goal is satisfied
- model requests user input
- max_steps reached
- max_tool_calls reached
- execution error occurs
- blocked by tool or policy

---

# 4. Tool Execution Model

## 4.1 Tool Selection
- Model must choose from `active_tools`
- Tool availability enforced at runtime (not just UI)

## 4.2 Tool Call Flow
1. Model emits tool call
2. Validate against schema
3. Execute handler
4. Capture result
5. Append to trace
6. Return to Evaluate phase

---

## 4.3 Failure Handling
Handle explicitly:

- invalid schema
- execution error
- timeout
- missing tool

On failure:
- record in trace
- transition to Evaluate
- allow retry or fallback

---

# 5. Streaming Behavior

## 5.1 Thinking Stream
- Optional (controlled by runtime config)
- Displayed in:
  - center panel (live)
  - trace item (persisted)

## 5.2 Response Stream
- Always streamed to UI
- Final response persisted in run state

---

# 6. State Separation Rules

## MUST enforce:

### Runtime Config
- Immutable during run
- Can be edited outside execution

### Run State
- Fully isolated per run
- All mutations happen here
- Destroyable / resettable without affecting runtime

---

# 7. Trace System (Critical)

## 7.1 Trace as Source of Truth
- Every phase transition must produce a trace item
- No hidden steps

## 7.2 Transition Recording
Each trace item must include:

- previous phase
- next phase
- reason for transition

---

# 8. Error & Edge Case Handling

## Must support:

- max iteration stop
- tool failure
- model indecision (loop stall)
- empty or malformed model output
- context overflow (if applicable)

All must:
- be recorded in trace
- produce deterministic state transitions

---

# 9. v0.1 Constraints

## Included
- single-agent loop
- synchronous tool execution
- manual runtime selection
- per-run tool toggling
- full trace visibility

## Excluded (for now)
- multi-agent / subagents
- background jobs
- async tool execution
- persistent run storage
- advanced memory systems
- role-based access or permissions

---

# 10. Implementation Priorities (Order)

1. Data models (runtime, run state, tool, trace)
2. Basic UI layout (3 panels)
3. Chat streaming (no tools)
4. Runtime loop (Plan → Respond only)
5. Tool registry + execution
6. Full loop (Act + Evaluate)
7. Trace system
8. Sandbox integration
9. Tool toggling

---

# End of Spec
```
