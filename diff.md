# Discrepancies between README.md and Actual Project Structure

This document outlines the differences between the project structure described in `README.md` and the current state of the repository.

## 1. Planned Repository Structure vs. Actual Layout

### README.md Description
The `README.md` lists the following "Planned" structure:
- `/sandbox`
- `/context`
- `/tools`
- `/runtime`
- `/studio`
- `/lib`
- `/runtime-core`

### Actual Project Layout
The repository contains:
- `my-app/` (A Next.js application containing all implementation details)
  - `src/app/api/chat`
  - `src/app/configure`
  - `src/app/context-engine`

### Suggestion: Update Project
The planned structure reflects a modular design that aligns with the "Architecture Direction" described in the README (decomposing into focused sandboxes). The current project is a single Next.js app in a subdirectory.
**Action:** The project should be restructured to move implementation logic from `my-app/src` into top-level directories or a more modular structure within `my-app` that matches the functional categories (e.g., `src/lib/runtime`, `src/lib/tools`).

---

## 2. Project Status and Source Code Existence

### GEMINI.md / README.md Context
- `GEMINI.md` states: "Note: The project is currently in the planning phase. No source code or build scripts are available yet."
- `README.md` states: "Active Development — Early Runtime + Sandbox Extraction Phase"

### Actual State
Source code exists in the `my-app/` directory, including API routes for chat, models, and connection testing.

### Suggestion: Update README/GEMINI.md
The documentation should be updated to acknowledge that implementation has begun and to describe the current entry point.
**Action:** Update `GEMINI.md` to remove the "No source code available" disclaimer and provide instructions for running the Next.js app.

---

## 3. Toolset Implementation

### README.md Description
Lists an "intentionally minimal and deterministic" toolset:
- `list_files`
- `read_file`
- `search_text`
- `get_time`

### Actual State
The API routes suggest some chat functionality, but there is no explicit evidence of these specific tools being implemented yet (they are not visible in a standard `tools` directory).

### Suggestion: Update Project
The project should implement these tools as described to fulfill the "Success Criteria" defined in the README.
**Action:** Create a `tools` module (potentially in `my-app/src/lib/tools`) to house these implementations.

---

## 4. Sub-folder vs. Root-level App

### README.md Description
The README implies a top-level repository structure.

### Actual State
The entire application is nested inside `my-app/`.

### Suggestion: Update Project
Nesting the primary application in `my-app/` is often a temporary step during bootstrapping.
**Action:** Move the contents of `my-app/` to the root (or consolidate into a `src/` directory) to make the repository cleaner and align with standard monorepo or single-package structures.
