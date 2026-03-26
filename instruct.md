# Runtime Builder Redesign Implementation Spec

## Purpose

Redesign the current Runtime Builder page into a clearer, more opinionated agent-construction interface centered on:

* a small set of runtime block types
* explicit control-flow visibility
* transparent tool access
* inspectable execution behavior
* consistent conventions for future expansion

This redesign should replace the current prompt-centric builder UI with a runtime-oriented builder UI.

The goal is not to expose every low-level implementation detail. The goal is to let a user construct and understand a runtime as a visible sequence of high-level agent blocks.

Do not preserve the current page structure unless a specific existing pattern remains useful under this new model.

Commit as you go, but do not push changes to the repository without approval.

---

# Core Product Direction

## Design intent

The builder should feel like:

* a runtime composer
* a transparent control-flow editor
* a debug-friendly agent construction surface

It should **not** feel like:

* a prompt list editor
* a raw JSON editor
* a settings dump
* a backend workflow diagram

## Main principle

The page should expose **high-level runtime decisions**, while keeping low-level mechanics internal or configurable through block settings.

In practice, this means:

* context assembly is mostly configuration, not a first-class visual programming element
* control flow is first-class
* tool exposure is first-class
* user-visible response behavior is first-class
* all blocks should be understandable without requiring knowledge of underlying execution internals

---

# Primary UX Shift

## Replace current model

The current page appears to treat runtime construction as a sequence of prompt/tool/loop items.

That should be replaced with a **block-based runtime flow** made up of a small fixed set of runtime blocks.

## New mental model

A runtime is a flow of agent steps such as:

* Start
* Think
* Use Tool
* Respond
* Stop

This becomes the visible language of the page.

Everything else should support that language.

---

# Required Runtime Block Set for V1

The new builder should support exactly these first-class block types in the redesign:

## 1. Start Run

### Purpose

Defines the entry point for a runtime execution.

### Responsibilities

* establishes the run start
* defines what initial input is available
* optionally references startup instructions or defaults
* visually anchors the flow

### Notes

This should be required and singular per runtime.

---

## 2. Think

### Purpose

Represents a model reasoning step.

### Responsibilities

* sends selected context to the model
* asks the model to decide, draft, classify, or select next action
* produces inspectable output

### Notes

This block should not directly execute tools itself.
It should produce a result that downstream flow can react to.

The UI should reinforce that Think is a reasoning step, not a hidden all-in-one agent loop.

---

## 3. Use Tool

### Purpose

Represents a bounded tool-access step.

### Responsibilities

* exposes a selected set of tools to the runtime at this moment
* optionally lets the model choose from allowed tools
* optionally executes a fixed tool deterministically
* records tool selection, arguments, and result in the run timeline

### Notes

This is not merely a “pick a tool” UI.
It is the boundary where capability is granted.

This block should support both:

* fixed-tool mode
* model-choice mode from an allowed subset

The runtime should never implicitly expose all tools everywhere.

---

## 4. Respond

### Purpose

Represents the point where output is emitted to the user.

### Responsibilities

* sends final or interim user-visible output
* clearly marks a user-facing handoff
* distinguishes private reasoning/runtime steps from visible response steps

### Notes

This block must remain distinct from Think.

---

## 5. Stop

### Purpose

Represents explicit runtime termination.

### Responsibilities

* ends the run
* prevents unintended continuation
* makes control flow understandable

### Notes

This should be visually simple and mandatory as a valid end state.

---

# V1 Control Flow Requirements

## Flow structure

The page should support a visible ordered flow made from the blocks above.

Minimum supported patterns:

* Start → Think → Respond → Stop
* Start → Think → Use Tool → Think → Respond → Stop

## Branching

V1 does not need full visual branching logic if that would materially complicate implementation, but the redesign should leave room for it.

If lightweight branching is feasible, support one simple conditional routing pattern:

* Think output determines next block among a limited set

Examples:

* if tool needed → Use Tool
* if ready to answer → Respond
* if done → Stop

If full branching is deferred, the UI and internal conventions should still anticipate future support.

---

# Information Architecture

## Page layout

Redesign the page into four primary regions:

### 1. Runtime List / Navigator

Left sidebar.

Contains:

* list of runtimes
* create new runtime action
* duplicate runtime action
* import/export actions if already part of conventions
* active runtime selection

This should stay visually lightweight.

### 2. Runtime Overview Header

Top of main pane.

Contains:

* runtime name
* short description
* profile or model preset selector if applicable
* run / test entry point
* lock/publish/save affordances as appropriate to existing conventions
* runtime status indicators only if meaningful

This section should be compact.

### 3. Runtime Flow Builder

Main central area.

Contains:

* ordered runtime blocks
* add block controls
* block cards
* block reordering
* block enable/disable
* block settings panels inline or expandable

This is the core of the redesign.

### 4. Run Inspection / Output Panel

Right sidebar or bottom drawer.

Contains:

* execution timeline
* block-by-block outputs
* model reasoning output visibility if available
* tool result visibility
* final response preview

This should act as a debug surface, not as a generic output box.

---

# Replace Current Builder With a Flow Builder

## Remove prompt-first framing

The current page centers around prompt cards with prompt type, position, and context inclusion settings.

That should no longer be the primary interaction model.

Prompt content should become part of block settings where relevant, especially:

* Start block instructions
* Think block instruction template
* Respond block response guidance

## New builder interaction

The user should construct a runtime by adding blocks into a visible ordered flow.

### Add block affordance

Use a single “Add Block” control with explicit block type options:

* Start Run
* Think
* Use Tool
* Respond
* Stop

Do not keep generic `+ Prompt`, `+ Tool`, `+ Loop` buttons in the redesigned UI.

---

# Block Card Design Specification

Each runtime block should render as a structured card.

## Shared block card elements

All block cards should support:

* block type label
* user-editable block title
* enabled/disabled toggle
* drag handle for reorder
* collapse/expand control
* duplicate block action
* delete block action, except where restricted by block validity rules
* optional “locked” indicator if the product still uses lock semantics

## Shared visual conventions

* block type should be immediately recognizable by label and layout
* avoid relying only on color to distinguish type
* cards should remain readable when collapsed
* collapsed cards should still show a compact summary of critical settings

---

# Block-Specific UI Requirements

## Start Run block

### Fields

* block title
* input source mode
* startup instruction or guidance
* optional initial context policy summary

### Recommended settings

* accepts user input: yes/no
* startup notes / instruction text
* include runtime-level defaults: yes/no

### Collapsed summary should show

* whether user input is accepted
* whether startup instructions exist

### Constraints

* required
* exactly one per runtime
* must be the first block in valid flows

---

## Think block

### Fields

* block title
* think mode
* instruction text
* output mode
* allowed next actions
* context settings

### Required settings

#### Think mode

Options may include:

* decide next action
* draft response
* summarize
* classify
* custom

#### Instruction text

Freeform guidance for what this reasoning step is meant to do.

#### Output mode

* freeform text
* structured action selection
* structured object

#### Allowed next actions

This is critical.
The user should be able to constrain what this Think block is allowed to conclude.

Example options:

* may go to Use Tool
* may go to Respond
* may go to Stop

This prevents Think from becoming an unconstrained black box.

#### Context settings

This should be configuration, not a separate visual block.

Recommended toggles:

* include runtime instructions
* include user input
* include prior block outputs
* include tool results
* include prior response draft
* include history summary if available

### Collapsed summary should show

* think mode
* output mode
* allowed next actions
* key context toggles

---

## Use Tool block

### Fields

* block title
* tool access mode
* allowed tools
* argument source
* result handling
* failure behavior

### Required settings

#### Tool access mode

* fixed tool
* model chooses from allowed tools

#### Allowed tools

This must integrate with the app’s tool builder surface.
The block should allow selecting tools from existing available tools.

The UI should support:

* selecting one tool
* selecting multiple tools
* clearly showing which tools are exposed at this point in the runtime

#### Argument source

* static arguments
* generated from prior Think output
* mixed/manual mapping

#### Result handling

* append to timeline
* store as block output
* make available to next Think step
* optionally mark as user-visible or internal-only

#### Failure behavior

* continue with error result
* retry once
* route back to Think
* stop run

### Collapsed summary should show

* fixed vs model-choice mode
* number of exposed tools
* result handling policy

### Important rule

This block should define **which tools are available now**, not globally.

---

## Respond block

### Fields

* block title
* response source
* response guidance
* visibility mode

### Required settings

#### Response source

* prior Think output
* tool result transformed into response
* custom model-generated response at this step

#### Response guidance

Optional instruction field for tone, format, or response constraints.

#### Visibility mode

* final answer
* interim update
* debug/status message

### Collapsed summary should show

* source of response
* final vs interim mode

### Important rule

Respond should clearly indicate that content crosses from runtime-internal processing into user-visible output.

---

## Stop block

### Fields

* block title
* stop reason label optional

### Collapsed summary should show

* stop condition or label if provided

### Constraints

* at least one reachable stop path should exist
* stop should be visually minimal

---

# Runtime-Level Configuration Panel

The new page should include runtime-level configuration separate from the block cards.

This should not be mixed into individual block logic unless necessary.

## Suggested runtime-level fields

* runtime name
* runtime description
* profile / preset selector
* default model/preset settings if supported
* execution mode label
* history usage policy
* debug visibility settings

## Suggested collapsible “Runtime Defaults” section

This can include:

* global instructions
* default context behavior
* default history behavior
* default run limits
* default inspection settings

These defaults should be overridable by blocks where appropriate.

---

# Context Handling Design

## Guiding principle

Context should be handled as **block settings and runtime defaults**, not as first-class visual blocks.

Do not reintroduce the old prompt-position model in disguised form.

## Required context model for UI purposes

Each block that uses context should declare what it wants access to.

At the UI level, context selection should be understandable as toggles or selectors such as:

* runtime instructions
* current user input
* previous block outputs
* selected history
* tool results
* summaries
* prior response draft

## Context UX requirements

* users must be able to understand what a Think block sees
* users should not need to manage raw ordering of context fragments
* advanced controls can exist, but defaults should be sensible
* a block should be able to preview its effective context sources at a high level

## Context preview

Each Think block should include a compact preview or summary such as:

> Includes: runtime instructions, current user input, previous tool results

This is enough for V1.
Full raw context preview can be shown in a debug panel if useful.

---

# Execution and Inspection UX

## Core requirement

The redesigned page must make runtime behavior easier to inspect than the current interface.

## Replace static output pane with execution timeline

The right-side Output area should become an execution inspector that shows, per block:

* block entered
* block inputs summary
* block output
* tool used if applicable
* visible response emitted
* final status

## Timeline design goals

* ordered by execution
* easy to scan
* clearly tied to block cards
* supports expanded inspection per entry

## Minimum timeline event types

* Start entered
* Think completed
* Tool exposed
* Tool called
* Tool result received
* Respond emitted
* Stop reached

## Optional but valuable

If available from the current model call capability, display:

* model thinking stream in a contained debug view
* final response stream separately from internal reasoning view

Keep this inspectable, not overwhelming.

---

# Configure and Test Experience

## Current user query area

The current “User Query” input near the top should be retained in concept but repositioned into a clearer “Test Run” area.

## New test entry pattern

Create a dedicated test input section in the header or in the inspector pane:

* test input field
* run button
* optionally rerun button
* optionally step-through mode later

This should clearly indicate:

* this input starts a test run
* the runtime flow will execute against it
* results appear in the timeline/inspector

## Desired affordances

* run current runtime
* rerun with same input
* clear test output
* inspect per-block execution

---

# Validation Rules

The new builder should enforce structural validity at the UI level.

## Required rules

### Start block rules

* exactly one Start block
* Start must be first

### Stop rules

* at least one Stop block must exist in the flow or in reachable flow definitions

### Respond rules

* Respond should not be the only end state unless intentionally allowed
* Respond should usually be followed by Stop in explicit flows

### Think rules

* Think must declare either output mode or allowed next actions
* Think should not be allowed to silently behave as a tool step

### Use Tool rules

* Use Tool must have at least one allowed tool
* fixed-tool mode must have exactly one selected tool
* model-choice mode may have one or more selected tools

## Validation UX

* invalid blocks should be clearly marked
* runtime-level warnings should appear near Run/Test
* messages should be actionable and concise

Examples:

* “Start Run must be the first block.”
* “Use Tool has no allowed tools selected.”
* “Think block needs at least one allowed next action.”

---

# Suggested V1 Authoring Flow

The page should encourage this authoring sequence:

## Step 1

Create runtime metadata.

## Step 2

Add required block skeleton:

* Start
* Think
* Respond
* Stop

## Step 3

Configure Think behavior.

## Step 4

Optionally insert Use Tool between Think and Respond.

## Step 5

Run test input and inspect execution timeline.

This should feel like a guided progression, not an empty canvas.

---

# UX Recommendations for First-Time Clarity

## Empty state

When a new runtime is created, prepopulate it with:

* Start Run
* Think
* Respond
* Stop

This is the best way to teach the new mental model.

## Inline guidance

Each block type should have a one-line explanatory hint visible until configured.

Examples:

* Start Run: “Defines how a run begins.”
* Think: “Asks the model to decide or draft.”
* Use Tool: “Exposes a selected set of tools at this step.”
* Respond: “Sends visible output to the user.”
* Stop: “Ends the run.”

## Avoid jargon overload

Prefer:

* runtime
* block
* step
* tools available here
* user-visible response

Avoid overly backend-flavored phrasing.

---

# Migration Guidance From Current Page

## Remove or demote these concepts from top-level authoring

The current page appears to emphasize:

* prompt type
* prompt position
* context output include flags on prompt cards

These should no longer define the top-level editing model.

## Preserve only where useful as settings

Equivalent concepts may survive as hidden or advanced block settings, such as:

* instruction text
* include in context
* ordering-derived context access

But they should not dominate the authoring surface.

---

# Styling and Interaction Conventions

## General UI tone

The redesign should feel:

* clean
* deliberate
* inspectable
* modular
* not decorative

## Interaction conventions

* every major action should have a visible result
* block settings should not feel detached from the flow
* drag/reorder should be obvious
* collapsed cards should remain informative
* debug data should be visually distinct from authoring controls

## Conventions to preserve

Follow existing project conventions for:

* component structure
* naming
* spacing
* control patterns
* import/export behavior
* state/history separation
* existing design system primitives

Do not introduce one-off UI paradigms that conflict with established app conventions.

---

# Recommended Page Structure in Final Form

## Left sidebar

**Runtimes**

* new runtime
* runtime list
* duplicate/import/export actions as appropriate

## Main header

**Runtime Overview**

* name
* description
* profile/preset
* test input
* run button
* validation summary

## Main body

**Runtime Flow**

* ordered block cards
* add block menu
* runtime defaults accordion

## Right sidebar

**Execution Inspector**

* timeline
* block outputs
* tool calls/results
* response output
* run status

---

# Non-Goals for This Redesign

The coding agent should avoid adding these unless needed to support the above:

* full backend workflow visualization
* arbitrary low-level context fragment blocks
* unrestricted node graph complexity
* advanced multi-agent orchestration UI
* deeply nested visual programming semantics
* raw backend execution details surfaced in the builder

This redesign is about making a single-agent runtime understandable and extensible, not about exposing every internal mechanism.

---

# Acceptance Criteria

The redesign is successful when all of the following are true:

## Runtime authoring

* a user can create a runtime by assembling visible blocks
* the page no longer feels like a prompt list editor
* the five runtime block types are clearly represented

## Tool handling

* Use Tool exposes only selected tools at that step
* fixed-tool and model-choice modes are both supported in the UI
* tool access is understandable and inspectable

## Context clarity

* Think blocks clearly indicate which context sources they include
* context is configured, not blockified into low-level fragments
* users can understand what each reasoning step sees

## Execution transparency

* test runs are easy to launch
* outputs are shown as a timeline or inspector
* runtime steps, tool usage, and responses are distinguishable

## Structural validity

* invalid flows are caught by UI validation
* Start/Stop rules are enforced
* block-level configuration errors are clear

## Extensibility

* the page structure leaves room for future conditional routing
* the page can later support richer branching without a full redesign
* the conventions remain clean and reusable

---

# Recommended Immediate Build Scope

For the first pass of the redesign, prioritize:

1. replace current prompt-first cards with block cards
2. implement the five core block types
3. implement runtime flow ordering and block settings
4. implement Use Tool with selected-tool exposure
5. replace output panel with execution inspector
6. add structural validation
7. seed new runtimes with a default Start → Think → Respond → Stop flow

That is enough to establish the new architecture and user mental model.

---

# Final Direction Summary

This page should become a **runtime builder**, not a **prompt assembler**.

The redesign should center on a simple visible flow:

* Start Run
* Think
* Use Tool
* Respond
* Stop

The app should expose:

* control flow
* tool access
* response boundaries
* context choices
* execution inspection

It should not expose low-level runtime mechanics as if they were the primary product surface.

That balance is the key to making the builder both educational and usable.