---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs: 
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: Create a checklist for the following domain...
---

## Delegation

**Run as subagent to keep main context clean.**

If main agent:
1. Get FEATURE_DIR from the previous command output or user input
2. Spawn subagent with this prompt, then STOP:

```
"Read and execute .claude/commands/speckit.plan.md

FEATURE_DIR: {absolute path from previous step, e.g., /Users/.../specs/002-model-autocomplete}
Arguments: $ARGUMENTS

Follow ALL steps in the Outline. Report: FEATURE_DIR, plan path, artifacts created, gate violations."
```

If already a subagent: proceed to Outline below.

---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Resolve feature context** (CRITICAL for subagent continuity):

   **Option A - FEATURE_DIR provided in prompt above**:
   - If you see `FEATURE_DIR: /path/to/specs/NNN-feature-name` in the delegation prompt, use it directly
   - Set `FEATURE_SPEC` = `{FEATURE_DIR}/spec.md`
   - Set `IMPL_PLAN` = `{FEATURE_DIR}/plan.md`
   - Copy plan template to `IMPL_PLAN` if it doesn't exist
   - Skip the shell script entirely

   **Option B - No FEATURE_DIR provided (fallback)**:
   - Run `.specify/scripts/bash/setup-plan.sh --json` from repo root
   - Parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH
   - For single quotes in args, use escape syntax: e.g 'I'\''m Groot'

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Phase 1: Update agent context by running the agent script
   - Re-evaluate Constitution Check post-design

4. **Stop and report** with the following format (CRITICAL for workflow continuity):

```
## Planning Complete

**FEATURE_DIR**: {the absolute path used in step 1}
**Plan**: {IMPL_PLAN path}

Artifacts created:
- research.md (if generated)
- data-model.md (if generated)
- contracts/ (if generated)
- quickstart.md (if generated)

Gate violations: [none or list]

---
**Next step**: Run `/speckit.tasks`

**IMPORTANT**: Pass `FEATURE_DIR: {absolute path}` to the next command.
```

The FEATURE_DIR output is critical - subsequent commands need this exact path.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Agent context update**:
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
