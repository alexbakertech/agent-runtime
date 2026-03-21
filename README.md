# Agent Runtime

> A transparent runtime and debugging environment for tool-augmented LLM agents, designed for iterative development and system-level control.

## Status

**Active Development — Implementation Phase**

Core runtime features are implemented as a Next.js application at the repository root. The project is focused on providing a minimal, deterministic agent harness with strict system boundaries and observable behavior.

## Objective

Design and implement a **local-first agent runtime and development environment** that:

- operates through a controlled execution loop  
- enables explicit tool interaction and validation  
- provides full visibility into prompt construction and execution  
- supports step-by-step inspection and intervention  
- exposes internal state for debugging and refinement  

This project prioritizes **control, transparency, and inspectability** over abstraction.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Running the App

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Current Scope (v0.x)

### Included

- single-agent execution loop  
- local and OpenAI-compatible model integration  
- context inspection and modification  
- runtime step-through execution  
- structured run state  
- execution trace visibility  
- integrated UI for chat and runtime interaction  
- **Initial Toolset:** `list_files`, `read_file`, `search_text`, `get_time`

### Explicitly Excluded (for now)

- long-term memory systems  
- vector search / embeddings  
- multi-agent orchestration  
- persistent autonomous execution  
- production deployment infrastructure  

## Architecture Direction

The system is organized into focused, composable components:

- `/src/app/api`  
  API routes for chat, model selection, and connection testing.

- `/src/lib/tools`  
  Tool definition, validation, and implementation.

- `/src/app/context-engine`  
  Context management and inspection interface.

- `/src/app/configure`  
  System configuration and setup.

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

## Repository Structure

- `/src/app`: Next.js application pages and API routes.
- `/src/lib`: Shared libraries and core logic.
- `/src/lib/tools`: Tool implementation modules.
- `/public`: Static assets.
- `package.json`: Project dependencies and scripts.

## License

This project is licensed under the Apache License, Version 2.0.  
See the [LICENSE](LICENSE) file for details.

## Author

**Alex Baker**  
https://alexbakertech.com
