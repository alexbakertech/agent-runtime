# Agent Runtime

> A transparent runtime for tool-augmented LLM agents, designed for iterative development and system-level control.

## Status

**Planning — v0.1 Design Phase**

This repository is currently focused on defining a minimal, deterministic agent harness before implementation begins.

The goal of this phase is to establish:
- a clear execution model
- strict system boundaries
- a small, well-defined tool surface
- observable and debuggable behavior

## Objective

Design and implement a **local-first agent runtime** that:

- operates through a controlled execution loop  
- allows a model to request tools when needed  
- enforces validation and execution boundaries  
- produces fully inspectable execution traces  

This project prioritizes **control and transparency** over abstraction.

## v0.1 Scope

### Included

- single-agent execution loop  
- local model integration (e.g., `llama.cpp`)  
- small, read-only toolset  
- structured run state  
- full trace logging  
- validation and stop logic  

### Explicitly Excluded

- long-term memory  
- vector search / embeddings  
- subagents or planners  
- external APIs  
- write/delete operations  
- autonomous background execution  

## Architecture Plan (v0.1)

The system will be implemented as a small set of explicit components:

- /runtime # agent loop and orchestration
- /adapters # model interface (llama.cpp)
- /tools # tool definitions
- /executors # tool implementations
- /state # run context tracking
- /logging # execution trace
- /validation # guardrails and checks

Each component will be implemented independently to maintain clarity and control.

## Execution Model (Planned)

The runtime will operate as a bounded loop:

1. Receive user input  
2. Send context + tool definitions to the model  
3. Inspect model output  
4. If a tool is requested:
   - validate the request  
   - execute the tool  
   - append result to state  
5. Repeat until:
   - a final answer is produced, or  
   - a termination condition is met  

## Initial Tool Set (Planned)

The first version will include a minimal, deterministic set of tools:

- `list_files`  
- `read_file`  
- `search_text`  
- `get_time`  

All tools will be:
- read-only  
- scoped  
- predictable in output  

## Execution Constraints (v0.1)

- maximum **5–8 steps per run**  
- strict validation of all tool calls  
- bounded tool output  
- no background or recursive execution  

## Success Criteria

v0.1 will be considered complete when the runtime can:

- correctly select and invoke tools  
- chain simple tool calls when required  
- avoid hallucinating data not retrieved  
- terminate cleanly without unnecessary looping  
- produce a clear, inspectable execution trace  

## Development Approach

This project will be developed incrementally:

- define → implement → observe → refine  

The focus is on building a system that is:
- predictable  
- debuggable  
- extensible through iteration  

## Repository Strategy

- `dev` — active development  
- `main` — curated, stable snapshots  

## Author

**Alex Baker**  
https://alexbakertech.com