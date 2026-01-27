---
description: Identify underspecified areas in the current feature spec by asking up to 5 highly targeted clarification questions and encoding answers back into the spec.
model: opus
handoffs:
  - label: Build Technical Plan
    agent: speckit.plan
    prompt: Create a plan for the spec. I am building with...
---

## Delegation

**Run as subagent to keep main context clean.**

If main agent:
1. Get FEATURE_DIR from the previous command output or user input
2. Use the **Task tool** to spawn a subagent, then STOP:

```
Task tool parameters:
  subagent_type: "product"
  prompt: |
    Read and execute .claude/commands/speckit.clarify.md

    FEATURE_DIR: {absolute path from previous step, e.g., /Users/.../specs/002-model-autocomplete}
    Arguments: $ARGUMENTS

    Follow ALL steps. Present questions one at a time. Report: FEATURE_DIR, updated spec path, sections touched.

    Apply product prioritization when asking questions:
    - User value > Business impact > Technical feasibility > Time to market
    - Only ask about decisions that materially impact user value or scope
    - For each ambiguity, consider: Does this affect the MVP? Does this change user value?
    - Frame recommendations in terms of user outcomes, not technical preferences
```

**How to delegate**: Use the Task tool with `subagent_type: "product"` and the prompt above.
The Task tool spawns an independent agent that executes the work without polluting main context.

If already a subagent: proceed to Outline below.

---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Goal: Detect and reduce ambiguity or missing decision points in the active feature specification and record the clarifications directly in the spec file.

Note: This clarification workflow is expected to run (and be completed) BEFORE invoking `/speckit.plan`. If the user explicitly states they are skipping clarification (e.g., exploratory spike), you may proceed, but must warn that downstream rework risk increases.

Execution steps:

1. **Resolve feature context** (CRITICAL for subagent continuity):

   **Option A - FEATURE_DIR provided in prompt above**:
   - If you see `FEATURE_DIR: /path/to/specs/NNN-feature-name` in the delegation prompt, use it directly
   - Set `FEATURE_SPEC` = `{FEATURE_DIR}/spec.md`
   - Skip the shell script entirely

   **Option B - No FEATURE_DIR provided (fallback)**:
   - Run `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` from repo root
   - Parse: `FEATURE_DIR`, `FEATURE_SPEC`
   - If JSON parsing fails, abort and instruct user to re-run `/speckit.specify`
   - For single quotes in args, use escape syntax: e.g 'I'\''m Groot'

2. Load the current spec file. Perform a structured ambiguity & coverage scan using this taxonomy. For each category, mark status: Clear / Partial / Missing. Produce an internal coverage map used for prioritization (do not output raw map unless no questions will be asked).

   Functional Scope & Behavior:
   - Core user goals & success criteria
   - Explicit out-of-scope declarations
   - User roles / personas differentiation

   Domain & Data Model:
   - Entities, attributes, relationships
   - Identity & uniqueness rules
   - Lifecycle/state transitions
   - Data volume / scale assumptions

   Interaction & UX Flow:
   - Critical user journeys / sequences
   - Error/empty/loading states
   - Accessibility or localization notes

   Non-Functional Quality Attributes:
   - Performance (latency, throughput targets)
   - Scalability (horizontal/vertical, limits)
   - Reliability & availability (uptime, recovery expectations)
   - Observability (logging, metrics, tracing signals)
   - Security & privacy (authN/Z, data protection, threat assumptions)
   - Compliance / regulatory constraints (if any)

   Integration & External Dependencies:
   - External services/APIs and failure modes
   - Data import/export formats
   - Protocol/versioning assumptions

   Edge Cases & Failure Handling:
   - Negative scenarios
   - Rate limiting / throttling
   - Conflict resolution (e.g., concurrent edits)

   Constraints & Tradeoffs:
   - Technical constraints (language, storage, hosting)
   - Explicit tradeoffs or rejected alternatives

   Terminology & Consistency:
   - Canonical glossary terms
   - Avoided synonyms / deprecated terms

   Completion Signals:
   - Acceptance criteria testability
   - Measurable Definition of Done style indicators

   Misc / Placeholders:
   - TODO markers / unresolved decisions
   - Ambiguous adjectives ("robust", "intuitive") lacking quantification

   For each category with Partial or Missing status, add a candidate question opportunity unless:
   - Clarification would not materially change implementation or validation strategy
   - Information is better deferred to planning phase (note internally)

3. Generate (internally) a prioritized queue of candidate clarification questions (maximum 5). Do NOT output them all at once. Apply these constraints:
    - Maximum of 10 total questions across the whole session.
    - Each question must be answerable with EITHER:
       - A short multiple‑choice selection (2–5 distinct, mutually exclusive options), OR
       - A one-word / short‑phrase answer (explicitly constrain: "Answer in <=5 words").
    - Only include questions whose answers materially impact architecture, data modeling, task decomposition, test design, UX behavior, operational readiness, or compliance validation.
    - Ensure category coverage balance: attempt to cover the highest impact unresolved categories first; avoid asking two low-impact questions when a single high-impact area (e.g., security posture) is unresolved.
    - Exclude questions already answered, trivial stylistic preferences, or plan-level execution details (unless blocking correctness).
    - Favor clarifications that reduce downstream rework risk or prevent misaligned acceptance tests.
    - If more than 5 categories remain unresolved, select the top 5 by (Impact * Uncertainty) heuristic.

4. Sequential questioning loop (interactive):
    - Present EXACTLY ONE question at a time.
    - For multiple‑choice questions:
       - **Analyze all options** and determine the **most suitable option** based on:
          - Best practices for the project type
          - Common patterns in similar implementations
          - Risk reduction (security, performance, maintainability)
          - Alignment with any explicit project goals or constraints visible in the spec
       - Present your **recommended option prominently** at the top with clear reasoning (1-2 sentences explaining why this is the best choice).
       - Format as: `**Recommended:** Option [X] - <reasoning>`
       - Then render all options as a Markdown table:

       | Option | Description |
       |--------|-------------|
       | A | <Option A description> |
       | B | <Option B description> |
       | C | <Option C description> (add D/E as needed up to 5) |
       | Short | Provide a different short answer (<=5 words) (Include only if free-form alternative is appropriate) |

       - After the table, add: `You can reply with the option letter (e.g., "A"), accept the recommendation by saying "yes" or "recommended", or provide your own short answer.`
    - For short‑answer style (no meaningful discrete options):
       - Provide your **suggested answer** based on best practices and context.
       - Format as: `**Suggested:** <your proposed answer> - <brief reasoning>`
       - Then output: `Format: Short answer (<=5 words). You can accept the suggestion by saying "yes" or "suggested", or provide your own answer.`
    - After the user answers:
       - If the user replies with "yes", "recommended", or "suggested", use your previously stated recommendation/suggestion as the answer.
       - Otherwise, validate the answer maps to one option or fits the <=5 word constraint.
       - If ambiguous, ask for a quick disambiguation (count still belongs to same question; do not advance).
       - Once satisfactory, record it in working memory (do not yet write to disk) and move to the next queued question.
    - Stop asking further questions when:
       - All critical ambiguities resolved early (remaining queued items become unnecessary), OR
       - User signals completion ("done", "good", "no more"), OR
       - You reach 5 asked questions.
    - Never reveal future queued questions in advance.
    - If no valid questions exist at start, immediately report no critical ambiguities.

5. Integration after EACH accepted answer (incremental update approach):
    - Maintain in-memory representation of the spec (loaded once at start) plus the raw file contents.
    - For the first integrated answer in this session:
       - Ensure a `## Clarifications` section exists (create it just after the highest-level contextual/overview section per the spec template if missing).
       - Under it, create (if not present) a `### Session YYYY-MM-DD` subheading for today.
    - Append a bullet line immediately after acceptance: `- Q: <question> → A: <final answer>`.
    - Then immediately apply the clarification to the most appropriate section(s):
       - Functional ambiguity → Update or add a bullet in Functional Requirements.
       - User interaction / actor distinction → Update User Stories or Actors subsection (if present) with clarified role, constraint, or scenario.
       - Data shape / entities → Update Data Model (add fields, types, relationships) preserving ordering; note added constraints succinctly.
       - Non-functional constraint → Add/modify measurable criteria in Non-Functional / Quality Attributes section (convert vague adjective to metric or explicit target).
       - Edge case / negative flow → Add a new bullet under Edge Cases / Error Handling (or create such subsection if template provides placeholder for it).
       - Terminology conflict → Normalize term across spec; retain original only if necessary by adding `(formerly referred to as "X")` once.
    - If the clarification invalidates an earlier ambiguous statement, replace that statement instead of duplicating; leave no obsolete contradictory text.
    - Save the spec file AFTER each integration to minimize risk of context loss (atomic overwrite).
    - Preserve formatting: do not reorder unrelated sections; keep heading hierarchy intact.
    - Keep each inserted clarification minimal and testable (avoid narrative drift).

6. Validation (performed after EACH write plus final pass):
   - Clarifications session contains exactly one bullet per accepted answer (no duplicates).
   - Total asked (accepted) questions ≤ 5.
   - Updated sections contain no lingering vague placeholders the new answer was meant to resolve.
   - No contradictory earlier statement remains (scan for now-invalid alternative choices removed).
   - Markdown structure valid; only allowed new headings: `## Clarifications`, `### Session YYYY-MM-DD`.
   - Terminology consistency: same canonical term used across all updated sections.

7. Write the updated spec back to `FEATURE_SPEC`.

8. Report completion with the following format (CRITICAL for workflow continuity):

```
## Clarification Complete

**FEATURE_DIR**: {the absolute path used in step 1}
**Spec**: {FEATURE_SPEC}

Questions asked: [N]
Sections touched: [list]

Coverage Summary:
| Category | Status |
|----------|--------|
| ... | Resolved/Deferred/Clear/Outstanding |
```

The FEATURE_DIR output is critical - subsequent commands need this exact path.

9. **APPROVAL GATE** (MANDATORY - DO NOT SKIP):

   After reporting completion, present this approval request and **WAIT for user response**:

   ```
   ══════════════════════════════════════════════════════════════════
     APPROVAL REQUIRED: Clarification Review
   ══════════════════════════════════════════════════════════════════

   Feature: {FEATURE_NAME}
   Spec: {FEATURE_SPEC}

   Clarifications Made:
     | Question | Your Answer | Spec Update |
     |----------|-------------|-------------|
     | Q1: ... | {answer} | Updated {section} |
     | Q2: ... | {answer} | Updated {section} |
     | ... | ... | ... |

   Spec Changes Summary:
     - {Section 1}: {brief description of change}
     - {Section 2}: {brief description of change}

   Deferred Items (if any):
     - {item}: {reason for deferral}

   ══════════════════════════════════════════════════════════════════
     YOUR ACTION REQUIRED
   ══════════════════════════════════════════════════════════════════

   Please review the updated specification at: {FEATURE_SPEC}

   Then respond with ONE of:
     [A] APPROVE - Proceed to /speckit.plan
     [B] REVISE  - Describe what needs to change
     [C] MORE    - Ask additional clarification questions
     [D] PAUSE   - "I'll review and get back to you"

   ══════════════════════════════════════════════════════════════════
   ```

   **CRITICAL**: Do NOT suggest running the next command or proceed automatically.
   Wait for explicit user approval (user says "A", "Approve", "yes", etc.) before suggesting next steps.

   **On user approval**: Remind them to pass `FEATURE_DIR: {path}` to `/speckit.plan`.

Behavior rules:

- If no meaningful ambiguities found (or all potential questions would be low-impact), respond: "No critical ambiguities detected worth formal clarification." and suggest proceeding.
- If spec file missing, instruct user to run `/speckit.specify` first (do not create a new spec here).
- Never exceed 5 total asked questions (clarification retries for a single question do not count as new questions).
- Avoid speculative tech stack questions unless the absence blocks functional clarity.
- Respect user early termination signals ("stop", "done", "proceed").
- If no questions asked due to full coverage, output a compact coverage summary (all categories Clear) then suggest advancing.
- If quota reached with unresolved high-impact categories remaining, explicitly flag them under Deferred with rationale.

Context for prioritization: $ARGUMENTS
