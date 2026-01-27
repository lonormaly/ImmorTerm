---
description: Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation.
model: opus
handoffs:
  - label: Proceed to Tasks
    agent: speckit.tasks
    prompt: Generate tasks from the plan
  - label: Start Implementation
    agent: speckit.run
    prompt: Begin implementation
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Identify inconsistencies, duplications, ambiguities, and underspecified items across the three core artifacts (`spec.md`, `plan.md`, `tasks.md`) before implementation. This command MUST run only after `/speckit.tasks` has successfully produced a complete `tasks.md`.

## Operating Constraints

**STRICTLY READ-ONLY**: Do **not** modify any files. Output a structured analysis report. Offer an optional remediation plan (user must explicitly approve before any follow-up editing commands would be invoked manually).

**Constitution Authority**: The project constitution (`.specify/memory/constitution.md`) is **non-negotiable** within this analysis scope. Constitution conflicts are automatically CRITICAL and require adjustment of the spec, plan, or tasks—not dilution, reinterpretation, or silent ignoring of the principle. If a principle itself needs to change, that must occur in a separate, explicit constitution update outside `/speckit.analyze`.

## Execution Steps

### 1. Resolve Feature Context (CRITICAL for subagent continuity)

**Option A - FEATURE_DIR provided in input above**:
- If you see `FEATURE_DIR: /path/to/specs/NNN-feature-name` in the User Input section, use it directly
- Derive paths:
  - SPEC = `{FEATURE_DIR}/spec.md`
  - PLAN = `{FEATURE_DIR}/plan.md`
  - TASKS = `{FEATURE_DIR}/tasks.md`
- Skip the shell script entirely

**Option B - No FEATURE_DIR provided (fallback)**:
- Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root
- Parse JSON for FEATURE_DIR and AVAILABLE_DOCS
- Derive absolute paths as above

Abort with an error message if any required file is missing (instruct the user to run missing prerequisite command).
For single quotes in args, use escape syntax: e.g 'I'\''m Groot'

### 2. Load Artifacts (Progressive Disclosure)

Load only the minimal necessary context from each artifact:

**From spec.md:**

- Overview/Context
- Functional Requirements
- Non-Functional Requirements
- User Stories
- Edge Cases (if present)

**From plan.md:**

- Architecture/stack choices
- Data Model references
- Phases
- Technical constraints

**From tasks.md:**

- Task IDs
- Descriptions
- Phase grouping
- Parallel markers [P]
- Referenced file paths

**From constitution:**

- Load `.specify/memory/constitution.md` for principle validation

### 3. Build Semantic Models

Create internal representations (do not include raw artifacts in output):

- **Requirements inventory**: Each functional + non-functional requirement with a stable key (derive slug based on imperative phrase; e.g., "User can upload file" → `user-can-upload-file`)
- **User story/action inventory**: Discrete user actions with acceptance criteria
- **Task coverage mapping**: Map each task to one or more requirements or stories (inference by keyword / explicit reference patterns like IDs or key phrases)
- **Constitution rule set**: Extract principle names and MUST/SHOULD normative statements

### 4. Detection Passes (Token-Efficient Analysis)

Focus on high-signal findings. Limit to 50 findings total; aggregate remainder in overflow summary.

#### A. Duplication Detection

- Identify near-duplicate requirements
- Mark lower-quality phrasing for consolidation

#### B. Ambiguity Detection

- Flag vague adjectives (fast, scalable, secure, intuitive, robust) lacking measurable criteria
- Flag unresolved placeholders (TODO, TKTK, ???, `<placeholder>`, etc.)

#### C. Underspecification

- Requirements with verbs but missing object or measurable outcome
- User stories missing acceptance criteria alignment
- Tasks referencing files or components not defined in spec/plan

#### D. Constitution Alignment

- Any requirement or plan element conflicting with a MUST principle
- Missing mandated sections or quality gates from constitution

#### E. Coverage Gaps

- Requirements with zero associated tasks
- Tasks with no mapped requirement/story
- Non-functional requirements not reflected in tasks (e.g., performance, security)

#### F. Inconsistency

- Terminology drift (same concept named differently across files)
- Data entities referenced in plan but absent in spec (or vice versa)
- Task ordering contradictions (e.g., integration tasks before foundational setup tasks without dependency note)
- Conflicting requirements (e.g., one requires Next.js while other specifies Vue)

### 5. Severity Assignment

Use this heuristic to prioritize findings:

- **CRITICAL**: Violates constitution MUST, missing core spec artifact, or requirement with zero coverage that blocks baseline functionality
- **HIGH**: Duplicate or conflicting requirement, ambiguous security/performance attribute, untestable acceptance criterion
- **MEDIUM**: Terminology drift, missing non-functional task coverage, underspecified edge case
- **LOW**: Style/wording improvements, minor redundancy not affecting execution order

### 6. Produce Compact Analysis Report

Output a Markdown report (no file writes) with the following structure:

## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Duplication | HIGH | spec.md:L120-134 | Two similar requirements ... | Merge phrasing; keep clearer version |

(Add one row per finding; generate stable IDs prefixed by category initial.)

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|

**Constitution Alignment Issues:** (if any)

**Unmapped Tasks:** (if any)

**Metrics:**

- Total Requirements
- Total Tasks
- Coverage % (requirements with >=1 task)
- Ambiguity Count
- Duplication Count
- Critical Issues Count

### 7. Provide Next Actions

At end of report, output a concise Next Actions block:

- If CRITICAL issues exist: Recommend resolving before `/speckit.implement`
- If only LOW/MEDIUM: User may proceed, but provide improvement suggestions
- Provide explicit command suggestions: e.g., "Run /speckit.specify with refinement", "Run /speckit.plan to adjust architecture", "Manually edit tasks.md to add coverage for 'performance-metrics'"

### 8. Offer Remediation

Ask the user: "Would you like me to suggest concrete remediation edits for the top N issues?" (Do NOT apply them automatically.)

### 9. APPROVAL GATE (MANDATORY - DO NOT SKIP)

After presenting the analysis report, present this approval request and **WAIT for user response**:

```
══════════════════════════════════════════════════════════════════
  APPROVAL REQUIRED: Analysis Review
══════════════════════════════════════════════════════════════════

Feature: {FEATURE_NAME}
Analysis: Cross-artifact consistency check

Results Summary:
  - Critical Issues: {count}
  - High Issues: {count}
  - Medium Issues: {count}
  - Low Issues: {count}
  - Coverage: {percentage}%

Key Findings:
  - {Finding 1 - most critical}
  - {Finding 2}
  - {Finding 3}

Recommendation:
  {IF CRITICAL > 0: "STOP - Resolve critical issues before implementation"}
  {IF HIGH > 0: "CAUTION - Consider resolving high issues first"}
  {ELSE: "CLEAR - Safe to proceed with implementation"}

══════════════════════════════════════════════════════════════════
  YOUR ACTION REQUIRED
══════════════════════════════════════════════════════════════════

Then respond with ONE of:
  [A] APPROVE - Proceed to /speckit.tasks (or /speckit.run if tasks exist)
  [B] FIX     - Apply remediation for top issues
  [C] REJECT  - Revisit spec/plan to address issues
  [D] PAUSE   - "I'll review and get back to you"

══════════════════════════════════════════════════════════════════
```

**CRITICAL**: Do NOT suggest running the next command or proceed automatically.
Wait for explicit user approval before suggesting next steps.

**On user approval**:
- If tasks.md doesn't exist, remind them to run `/speckit.tasks` with `FEATURE_DIR: {path}`
- If tasks.md exists, remind them to run `/speckit.run` with `FEATURE_DIR: {path}`

## Operating Principles

### Context Efficiency

- **Minimal high-signal tokens**: Focus on actionable findings, not exhaustive documentation
- **Progressive disclosure**: Load artifacts incrementally; don't dump all content into analysis
- **Token-efficient output**: Limit findings table to 50 rows; summarize overflow
- **Deterministic results**: Rerunning without changes should produce consistent IDs and counts

### Analysis Guidelines

- **NEVER modify files** (this is read-only analysis)
- **NEVER hallucinate missing sections** (if absent, report them accurately)
- **Prioritize constitution violations** (these are always CRITICAL)
- **Use examples over exhaustive rules** (cite specific instances, not generic patterns)
- **Report zero issues gracefully** (emit success report with coverage statistics)

## Context

$ARGUMENTS
