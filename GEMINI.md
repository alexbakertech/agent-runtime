# Agent Runtime - GEMINI Context

## Project Overview

**Agent Runtime** is a transparent, local-first runtime designed for tool-augmented LLM agents. The project focuses on iterative development, system-level control, and deterministic execution over high-level abstraction.

- **Status:** Active Development — Implementation Phase.
- **Goal:** Create a minimal, deterministic agent harness with strict system boundaries and observable behavior.
- **Key Technologies:**
  - Next.js 16 (React 19)
  - Local model integration (OpenAI-compatible)
  - Read-only toolset: `list_files`, `read_file`, `search_text`, `get_time`.

## Building and Running

- **Install dependencies:** `npm install`
- **Development server:** `npm run dev`
- **Production build:** `npm run build`

## Architecture

The system follows a modular design focused on transparency:

- `/src/app/api`: Chat and model API routes.
- `/src/lib/tools`: Tool implementations.
- `/src/app/context-engine`: Context management.
- `/src/app/configure`: Configuration settings.

## Development Conventions

- **Transparency:** Prioritize inspectable execution traces and observable behavior.
- **Control:** Enforce strict validation and execution boundaries (e.g., 5–8 steps per run).
- **Local-First:** Focus on local model integration and avoiding external API dependencies where possible.
- **Read-Only Tools:** Initial tools must be read-only, scoped, and predictable.

## Key Files

- `README.md`: Detailed project objective, scope, architecture, and success criteria.
- `GEMINI.md`: This file, providing context and mandates for Gemini CLI interactions.
- `src/lib/tools/index.ts`: Entry point for the tool system.
