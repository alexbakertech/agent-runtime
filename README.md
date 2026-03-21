# Agent Runtime

> A transparent runtime and debugging environment for tool-augmented LLM agents, designed for iterative development and system-level control.

## Status

**Active Development — Early Runtime + Sandbox Extraction Phase**

Core runtime features are implemented and are being refactored into modular sandboxes for improved transparency, debuggability, and composability.
This project is transitioning from a unified runtime interface into a system of focused, reusable components.

## Objective

Design and implement a **local-first agent runtime and development environment** that:

- operates through a controlled execution loop  
- enables explicit tool interaction and validation  
- provides full visibility into prompt construction and execution  
- supports step-by-step inspection and intervention  
- exposes internal state for debugging and refinement  

This project prioritizes **control, transparency, and inspectability** over abstraction.

## Current Scope (v0.x)

### Included

- single-agent execution loop  
- local and OpenAI-compatible model integration  
- context inspection and modification  
- runtime step-through execution  
- structured run state  
- execution trace visibility  
- integrated UI for chat and runtime interaction  

### Explicitly Excluded (for now)

- long-term memory systems  
- vector search / embeddings  
- multi-agent orchestration  
- persistent autonomous execution  
- production deployment infrastructure  

## Architecture Direction

The system is being decomposed into focused, composable sandboxes:

- `/sandbox/context`  
  Prompt construction, message control, and context inspection  

- `/sandbox/tools`  
  Tool definition, validation, and execution simulation  

- `/sandbox/runtime`  
  Step-by-step agent execution loop and trace inspection  

- `/studio`  
  Unified workspace for composing and running agent configurations  

These sandboxes isolate core concerns and will be composed into a cohesive development environment.

## Execution Model

The runtime operates as a bounded, inspectable loop:

1. Receive user input  
2. Compile context (system prompt + messages + tool definitions)  
3. Send request to model  
4. Inspect model output  
5. If a tool is requested:
   - validate the request  
   - execute the tool  
   - append result to state  
6. Repeat until:
   - a final answer is produced, or  
   - a termination condition is met  

This execution flow is exposed directly in the Runtime Sandbox, where each step can be observed, paused, and modified.

## Context Model

The system distinguishes between:

- **Transcript** — the canonical record of actual messages  
- **Runtime Context** — the editable message set used for the next execution  
- **Effective Context** — the final compiled input sent to the model  

This separation enables controlled experimentation without mutating source history.

## Tools

The initial toolset is intentionally minimal and deterministic:

- `list_files`  
- `read_file`  
- `search_text`  
- `get_time`  

All tools are:

- read-only  
- scoped  
- predictable in output  

The Tools Sandbox provides a dedicated interface for inspecting, defining, and testing tool behavior independently of the runtime loop.

## Execution Constraints

- maximum **5–8 steps per run**  
- strict validation of all tool calls  
- bounded tool output  
- no background or recursive execution  

These constraints enforce predictable and debuggable behavior.

## Success Criteria

The current phase is successful when the system can:

- correctly select and invoke tools  
- chain simple tool calls when required  
- avoid hallucinating data not retrieved  
- terminate cleanly without unnecessary looping  
- produce a clear, inspectable execution trace  
- expose the effective context sent to the model  
- allow controlled modification of runtime state for testing  

## Development Approach

Development follows an iterative, systems-oriented approach:

- define → implement → observe → refine  

Each component is designed to be:

- explicit in behavior  
- observable in execution  
- modular in structure  
- reusable across workflows  

The system evolves by increasing visibility and control before increasing capability.

## Product Direction

Agent Runtime is evolving into a **development environment for building and debugging agent systems**.

The focus is not on abstracting complexity away, but on:

- exposing internal state  
- enabling controlled experimentation  
- providing deterministic execution surfaces  
- supporting iterative refinement of agent behavior  

This positions the project as a foundation for higher-level agent systems and workflows.

## Repository Structure (Planned)

- `/sandbox`
- `/context`
- `/tools`
- `/runtime`
- `/studio`
- `/lib`
- `/runtime-core`

## Repository Strategy

- `dev` — active development  
- `main` — curated, stable snapshots  

Future modules may be extracted into reusable libraries as the architecture stabilizes.

## License

This project is licensed under the Apache License, Version 2.0.  
See the [LICENSE](LICENSE) file for details.

## Author

**Alex Baker**  
https://alexbakertech.com