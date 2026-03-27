# Runtime Builder Context Refactor Instructions

Refactor the Runtime Builder so that blocks operate on a **shared runtime state** rather than rebuilding ad hoc prompt text at each step.

Do not change existing project conventions. Follow current component, naming, and data-shape conventions already used in the app. Do not introduce backend commentary or alternate architecture explanations in the UI.

---

## Goal

Fix the current issue where block execution feels like chained prompt assembly instead of a real runtime.

The builder should move from:

* each block generating its own full prompt text
* runtime rules being manually injected as plain text
* repeated context duplication between blocks

to:

* each block reading from a shared runtime state
* each block writing a clearly defined output back to runtime state
* context being selected as structured sources, not manually restated prompt fragments

---

# Required Direction

## Core rule

A block should not primarily be treated as:

* “a prompt template that gets concatenated”

A block should instead be treated as:

* “a runtime operation that reads selected state and produces a defined output”

---

# Primary Refactor Targets

## 1. Replace prompt-like context assembly with state-oriented block execution

Each block should work from a shared runtime state model.

At minimum, block behavior should conceptually follow this pattern:

* block reads selected fields from runtime state
* block performs its operation
* block writes a defined result back to runtime state
* later blocks reference the result by source, not by repeated full-text reconstruction

This should be reflected in both the UI and the execution behavior.

Do not keep using giant manually assembled text blobs as the main representation of context.

---

## 2. Demote raw prompt/context text to debug-only

The current “Context to Model” area is useful, but it should not be the primary way the builder communicates what is happening.

### Change required

Make the primary block view show:

* what the block reads
* what the block writes
* what mode the block is in
* what downstream choices it enables

### Raw assembled context/prompt

Keep it available only as:

* collapsible debug detail
* inspector detail
* optional raw context tab

It should not dominate block cards.

---

## 3. Stop representing runtime rules as plain injected text

Runtime constraints such as allowed next actions should not be manually restated in the visible prompt text as the primary control mechanism.

Example of what to avoid as the main pattern:

* “Available actions: tool, respond, stop”
* “What should I do?”
* hand-written control-flow framing repeated in block text

### Replace with

These should instead come from block configuration and runtime enforcement.

The UI should present them as structured settings such as:

* allowed next actions
* available tools at this step
* output mode
* response source

These may still be translated into model-facing context internally if needed, but that should not be the authoring model or the main UI representation.

---

# Shared Runtime State Model

Implement the builder and inspector around a minimal shared runtime state concept.

Do not overcomplicate this. Keep it small and readable.

## Minimum state categories to support in the UI

The UI should clearly support blocks reading/writing from categories such as:

* user input
* runtime instructions/defaults
* block outputs
* last decision
* tool results
* final response draft
* run status

These do not need to be exposed as a raw schema editor. They just need to be clearly reflected in block source/target configuration and inspector views.

---

# Block Behavior Changes

## Start Run block

### Current problem

It currently appears to output a text blob that is later reused as if it were a prompt fragment.

### Required change

Start Run should instead populate initial runtime state.

It should clearly define:

* whether user input is accepted
* any startup instructions
* whether runtime defaults are included

### Primary UI for Start block should show

* inputs:

  * test input / user input
  * runtime defaults if enabled
* output:

  * initialized run state

Do not make Start primarily look like a text generator.

---

## Think block

### Current problem

Think currently looks too much like a prompt with inline runtime instructions and text-based decision phrasing.

### Required change

Think must become a structured reasoning step.

It should read from selected state sources and produce a clearly defined output.

### Required UI changes

Think should prominently show:

* mode
* reads from
* writes to
* allowed next actions

### Output requirements

Think output should be treated as structured, even if underlying model responses still need parsing.

At minimum, Think should visibly produce:

* next action
* optional reasoning
* optional draft/decision text

Do not make the primary output a vague sentence blob if the block is acting as a decision step.

### Required authoring direction

Think should allow selection of context sources, such as:

* user input
* runtime instructions
* previous block output
* tool results
* prior response draft

These should be selected as structured sources, not pasted together manually in text fields.

---

## Use Tool block

### Current direction

This block is conceptually correct but needs to plug into shared state cleanly.

### Required behavior

Use Tool should:

* read tool choice or arguments from selected state sources
* expose only the allowed tools configured on the block
* execute according to block mode
* write result back to runtime state in a defined way

### UI should show

* mode:

  * fixed tool
  * model chooses from allowed tools
* reads from
* writes result to
* exposed tools
* failure behavior

### Important rule

Do not treat tool result as just another prompt fragment.
Treat it as a structured runtime artifact that later blocks can reference.

---

## Respond block

### Current problem

Respond currently feels like it is producing output from loosely chained text rather than from a defined state source.

### Required change

Respond should read from a selected source and emit user-visible output.

### UI should show

* response source
* any response guidance
* visibility type:

  * final
  * interim
  * status/debug if supported

### Required behavior

Respond should consume a clearly defined input such as:

* think decision draft
* final response draft
* tool-transformed result
* custom response generation output

Do not make Respond depend on ambiguous freeform block text unless explicitly configured.

---

## Stop block

### Required direction

Keep this simple.

Stop should write run completion status and terminate flow clearly.

UI should show:

* stop label or reason if present
* resulting run status

---

# Context Selection Refactor

## Replace “Context to Model” as a blob-first concept

The current block UX overemphasizes the concatenated context text.

### New requirement

Each applicable block should instead declare context in terms of selected sources.

Examples:

* include user input
* include runtime defaults
* include previous block outputs
* include last decision
* include tool results

### UI format

Use structured source selection UI rather than a raw text-first model.

For example, a compact section like:

* Reads From:

  * [x] User Input
  * [x] Runtime Defaults
  * [ ] Previous Tool Result
  * [x] Previous Think Output

This can be implemented however best fits existing conventions, but the experience should feel source-based, not string-based.

### Raw context preview

Still allow preview of the fully assembled model context, but only in a debug area.

---

# Inspector Refactor

## Current issue

The right-side context inspector still reinforces the idea that blocks are mostly sending text blobs.

## Required change

Refocus the inspector around runtime execution state.

### Primary inspector modes should be something like:

* block view
* state view
* raw context

If preserving the current tabs, make sure the default emphasis is on structured state and block I/O, not raw prompt text.

### Inspector entries should prioritize

* block name
* block type
* inputs read
* outputs written
* user-visible response
* tool activity
* stop state

### Raw sent-to-model / received-from-model data

Keep available, but secondary.

---

# Output Presentation Requirements

Each block card should show a clear separation between:

* configuration
* execution output
* debug/raw context

Do not mix these into one long prompt-style panel.

## Recommended block card structure

### Configuration section

* mode
* sources read
* outputs written
* block-specific settings

### Execution section

* latest output
* latest decision/result
* latest tool result if applicable

### Debug section

* raw context sent
* raw model response
* parse details if useful

This structure should make it obvious that the block is a runtime operation, not a prompt note.

---

# Specific UI Changes Needed

## Remove or reduce these as top-level emphasis

* “Output” as plain text blob where possible
* full prompt-like context assembly displayed inline by default
* repeated natural-language runtime instructions inside block content

## Add or increase emphasis on

* Reads From
* Writes To
* Output Type
* Next Action
* Exposed Tools
* Result Source
* Run State

---

# Validation Additions

Add validation that encourages state-oriented configuration.

## Think block validation

Warn if:

* no readable sources selected
* no defined output target or output mode
* no allowed next actions configured when in decision mode

## Use Tool validation

Warn if:

* no tools exposed
* no argument source or fixed arguments defined where required
* no result destination defined

## Respond validation

Warn if:

* no response source selected

These warnings should be concise and tied to the block card.

---

# New Default Builder Behavior

When creating a new runtime, seed the default flow as:

* Start Run
* Think
* Respond
* Stop

Each seeded block should already reflect the new read/write model.

## Example defaults

### Start Run

* reads:

  * user input
  * runtime defaults
* writes:

  * initialized runtime state

### Think

* reads:

  * user input
  * runtime defaults
* writes:

  * next action
  * reasoning

### Respond

* reads:

  * think output
* writes:

  * user-visible response

### Stop

* writes:

  * run complete

---

# Authoring Model Requirements

The builder should communicate the following mental model clearly:

* blocks do not mainly store prompt fragments
* blocks read selected runtime state
* blocks produce defined outputs
* later blocks consume those outputs
* raw prompt/context is debug information, not the primary design surface

This mental model should be visible from the layout and labels alone.

---

# Conventions

Follow all current project conventions.

Specifically:

* preserve existing naming and structural patterns where compatible
* do not introduce backend-specific exposition into the UI
* do not replace existing conventions with ad hoc local solutions
* keep block behavior modular and inspectable
* keep room for future branching without redesigning this again

---

# Acceptance Criteria

This refactor is complete when:

* the builder no longer feels like chained prompt authoring
* blocks clearly show what they read and write
* Think behaves like a decision step, not a freeform prompt note
* Use Tool cleanly exposes selected tools and writes structured results
* Respond clearly emits from a selected source
* raw context is still inspectable but no longer the primary UI
* the inspector makes runtime state progression easier to understand than raw prompt text alone

---

# Final Direction

Refactor the current runtime builder from a **prompt-fragment builder** into a **shared-state runtime builder**.

The central UX should answer:

* what does this block read?
* what does this block produce?
* what becomes available to the next block?
* what was sent to the model, if I want to inspect it?

That is the target.
