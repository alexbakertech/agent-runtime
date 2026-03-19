# Agent Runtime - GEMINI Context

## Project Overview

**Agent Runtime** is a transparent, local-first runtime designed for tool-augmented LLM agents. The project focuses on iterative development, system-level control, and deterministic execution over high-level abstraction.

- **Status:** Planning — v0.1 Design Phase.
- **Goal:** Create a minimal, deterministic agent harness with strict system boundaries and observable behavior.
- **Key Technologies:**
  - Local model integration (e.g., `llama.cpp`).
  - Read-only toolset (initially `list_files`, `read_file`, `search_text`, `get_time`).
  - Structured run state and full trace logging.

## Architecture Plan (v0.1)

The system is planned to be modular, with the following components:

- `/runtime`: Agent loop and orchestration.
- `/adapters`: Model interface.
- `/tools`: Tool definitions.
- `/executors`: Tool implementations.
- `/state`: Run context tracking.
- `/logging`: Execution trace.
- `/validation`: Guardrails and checks.

## Building and Running

*Note: The project is currently in the planning phase. No source code or build scripts are available yet.*

- **TODO:** Document build and execution commands once implementation begins (e.g., `npm install`, `python -m runtime`, etc.).

## Development Conventions

- **Transparency:** Prioritize inspectable execution traces and observable behavior.
- **Control:** Enforce strict validation and execution boundaries (e.g., 5–8 steps per run).
- **Incremental Development:** Follow a "define → implement → observe → refine" cycle.
- **Local-First:** Focus on local model integration and avoiding external API dependencies for the initial version.
- **Read-Only Tools:** Initial tools must be read-only, scoped, and predictable.

## Key Files

- `README.md`: Detailed project objective, scope, architecture plan, and success criteria.
- `GEMINI.md`: This file, providing context and mandates for Gemini CLI interactions.
