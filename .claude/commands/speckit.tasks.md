---
description: Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts.
handoffs: 
  - label: Analyze For Consistency
    agent: speckit.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Implement Project (Run)
    agent: speckit.run
    prompt: Start the implementation in phases
    send: true
---

## Delegation

**Run as subagent to keep main context clean.**

If main agent:
1. Get FEATURE_DIR from the previous command output or user input
2. Use the **Task tool** to spawn a subagent, then STOP:

```
Task tool parameters:
  subagent_type: "architect"
  prompt: |
    Read and execute .claude/commands/speckit.tasks.md

    FEATURE_DIR: {absolute path from previous step, e.g., /Users/.../specs/002-model-autocomplete}
    Arguments: $ARGUMENTS

    Follow ALL steps in the Outline. Report: FEATURE_DIR, tasks path, count, parallel opportunities.
```

**How to delegate**: Use the Task tool with `subagent_type: "architect"` (for task breakdown work) and the prompt above.
The Task tool spawns an independent agent that executes the work without polluting main context.

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
   - Set paths: `plan.md`, `spec.md`, `tasks.md` relative to FEATURE_DIR
   - Skip the shell script entirely

   **Option B - No FEATURE_DIR provided (fallback)**:
   - Run `.specify/scripts/bash/check-prerequisites.sh --json` from repo root
   - Parse FEATURE_DIR and AVAILABLE_DOCS list
   - All paths must be absolute
   - For single quotes in args, use escape syntax: e.g 'I'\''m Groot'

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities)
   - **Optional**: data-model.md (entities), contracts/ (API endpoints), research.md (decisions), quickstart.md (test scenarios)
   - Note: Not all projects have all documents. Generate tasks based on what's available.

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure
   - Load spec.md and extract user stories with their priorities (P1, P2, P3, etc.)
   - If data-model.md exists: Extract entities and map to user stories
   - If contracts/ exists: Map endpoints to user stories
   - If research.md exists: Extract decisions for setup tasks
   - Generate tasks organized by user story (see Task Generation Rules below)
   - Generate dependency graph showing user story completion order
   - Create parallel execution examples per user story
   - Validate task completeness (each user story has all needed tasks, independently testable)

4. **Generate initial tasks.md**: Use `.specify/templates/tasks-template.md` as structure, fill with:
   - Correct feature name from plan.md
   - Phase 1: Setup tasks (project initialization)
   - Phase 2: Foundational tasks (blocking prerequisites for all user stories)
   - Phase 3+: One phase per user story (in priority order from spec.md)
   - Each phase includes: story goal, independent test criteria, tests (if requested), implementation tasks
   - Final Phase: Polish & cross-cutting concerns
   - All tasks must follow the strict checklist format (see Task Generation Rules below)
   - Clear file paths for each task
   - Dependencies section showing story completion order
   - Parallel execution examples per story
   - Implementation strategy section (MVP first, incremental delivery)

5. **SPECIALIST REVIEW PHASE** (CRITICAL - enhances tasks with domain expertise):

   After generating initial tasks, spawn specialist agents to enhance them with domain-specific requirements.
   Reference: `.specify/agents/specialist-agents.md` for full agent capabilities.

   ```
   ╔══════════════════════════════════════════════════════════════════════╗
   ║  SPECIALIST REVIEW - PARALLEL AGENT SPAWNING                        ║
   ╠══════════════════════════════════════════════════════════════════════╣
   ║                                                                      ║
   ║  Step 5A: Detect task types in the generated tasks.md               ║
   ║                                                                      ║
   ║  Step 5B: Spawn specialist agents IN PARALLEL based on task types:  ║
   ║                                                                      ║
   ║  IF frontend tasks detected (components, UI, React files):          ║
   ║    → Spawn ALL THREE in parallel:                                   ║
   ║      • ui-designer: Add design system, component specs              ║
   ║      • accessibility-specialist: Add ARIA, keyboard, a11y reqs      ║
   ║      • ux-flow-specialist: Add states, transitions, feedback        ║
   ║                                                                      ║
   ║  IF backend tasks detected (API, database, routes):                 ║
   ║    → Spawn ALL THREE in parallel:                                   ║
   ║      • database-specialist: Add schema, index, migration reqs       ║
   ║      • api-contract-specialist: Add Zod, Bruno, response specs      ║
   ║      • performance-optimizer: Add caching, query optimization       ║
   ║                                                                      ║
   ║  IF auth/security tasks detected:                                   ║
   ║    → Spawn:                                                         ║
   ║      • security-specialist: Add OWASP, sanitization, auth reqs      ║
   ║                                                                      ║
   ║  Step 5C: Merge specialist requirements into task criteria          ║
   ║                                                                      ║
   ╚══════════════════════════════════════════════════════════════════════╝
   ```

   **Specialist Agent Prompts**:

   **For Frontend Specialists** (spawn all 3 in parallel):
   ```
   Task tool call 1 (UI Designer):
     subagent_type: "frontend"
     # Flags: --persona-frontend --magic --c7
     prompt: |
       You are the UI-DESIGNER specialist (--persona-frontend --magic --c7).

       Review these frontend tasks and enhance each with design requirements:
       {FRONTEND_TASKS_FROM_TASKS_MD}

       For EACH frontend task, add these criteria:
       - [ ] Follow design system tokens (colors, spacing, typography)
       - [ ] Responsive: mobile (320px), tablet (768px), desktop (1024px+)
       - [ ] Dark mode support
       - [ ] Component props documented

       Output: Enhanced task criteria in markdown format.

   Task tool call 2 (Accessibility):
     subagent_type: "frontend"
     # Flags: --persona-frontend --focus accessibility --play
     prompt: |
       You are the ACCESSIBILITY specialist (--persona-frontend --focus accessibility --play).

       Review these frontend tasks and add accessibility requirements:
       {FRONTEND_TASKS_FROM_TASKS_MD}

       For EACH frontend task, add these criteria:
       - [ ] Semantic HTML elements
       - [ ] ARIA labels for interactive elements
       - [ ] Keyboard navigation (Tab, Enter, Escape)
       - [ ] Focus visible states
       - [ ] Color contrast WCAG AA (4.5:1)

       Output: Enhanced task criteria in markdown format.

   Task tool call 3 (UX Flow):
     subagent_type: "frontend"
     # Flags: --persona-frontend --magic --play
     prompt: |
       You are the UX-FLOW specialist (--persona-frontend --magic --play).

       Review these frontend tasks and add UX requirements:
       {FRONTEND_TASKS_FROM_TASKS_MD}

       For EACH frontend task, add these criteria:
       - [ ] Loading state (skeleton/spinner)
       - [ ] Error state with recovery action
       - [ ] Empty state with CTA
       - [ ] Success feedback (toast)
       - [ ] Smooth transitions (150-300ms)

       Output: Enhanced task criteria in markdown format.
   ```

   **For Backend Specialists** (spawn all 3 in parallel):
   ```
   Task tool call 1 (Database):
     subagent_type: "backend"
     # Flags: --persona-backend --c7 --seq
     prompt: |
       You are the DATABASE specialist (--persona-backend --c7 --seq).

       Review these backend tasks and add database requirements:
       {BACKEND_TASKS_FROM_TASKS_MD}

       For EACH database/schema task, add these criteria:
       - [ ] Schema follows naming conventions (snake_case)
       - [ ] Indexes on frequently queried columns
       - [ ] Foreign key constraints defined
       - [ ] Migration is reversible
       - [ ] No breaking changes to existing data

       Output: Enhanced task criteria in markdown format.

   Task tool call 2 (API Contract):
     subagent_type: "backend"
     # Flags: --persona-backend --c7 --play
     prompt: |
       You are the API-CONTRACT specialist (--persona-backend --c7 --play).

       Review these backend tasks and add API requirements:
       {BACKEND_TASKS_FROM_TASKS_MD}

       For EACH API endpoint task, add these criteria:
       - [ ] Request validated with Zod schema
       - [ ] Response follows { success, data?, error? } format
       - [ ] HTTP status codes correct (200, 201, 400, 404, 500)
       - [ ] Bruno request file created
       - [ ] Error responses include actionable message

       Output: Enhanced task criteria in markdown format.

   Task tool call 3 (Performance):
     subagent_type: "performance"
     # Flags: --persona-performance --play --chrome
     prompt: |
       You are the PERFORMANCE specialist (--persona-performance --play --chrome).

       Review these backend tasks and add performance requirements:
       {BACKEND_TASKS_FROM_TASKS_MD}

       For EACH task, add these criteria:
       - [ ] API response <200ms p95
       - [ ] Database query <50ms
       - [ ] No N+1 query patterns
       - [ ] Caching strategy defined (if applicable)
       - [ ] Pagination for list endpoints

       Output: Enhanced task criteria in markdown format.
   ```

   **For Security Tasks**:
   ```
   Task tool call (Security):
     subagent_type: "security"
     # Flags: --persona-security --seq --think-hard
     prompt: |
       You are the SECURITY specialist (--persona-security --seq --think-hard).

       Review these tasks for security requirements:
       {ALL_TASKS_WITH_AUTH_OR_SECURITY_MENTIONS}

       For EACH security-relevant task, add these criteria:
       - [ ] Input sanitized (no XSS)
       - [ ] SQL injection prevented
       - [ ] Authentication required
       - [ ] Authorization checked
       - [ ] Secrets from env only
       - [ ] CORS configured

       Output: Enhanced task criteria in markdown format.
   ```

   **Step 5D: Merge specialist output into tasks.md**:

   After all specialists complete:
   1. Collect all enhanced criteria from each specialist
   2. For each task, append the specialist criteria under the task:
   ```markdown
   - [ ] T015 [P] [US2] Create MentionAutocomplete component
     Files: apps/web/src/components/MentionAutocomplete.tsx

     Implementation Criteria:
     - [ ] Dropdown shows trained models
     - [ ] Filtering works when typing

     Design Requirements: (from ui-designer)
     - [ ] Follow design system tokens
     - [ ] Responsive breakpoints

     Accessibility Requirements: (from accessibility-specialist)
     - [ ] ARIA combobox pattern
     - [ ] Keyboard navigation

     UX Requirements: (from ux-flow-specialist)
     - [ ] Loading state while fetching
     - [ ] Empty state if no models
   ```
   3. Save the enhanced tasks.md

6. **Report** with the following format (CRITICAL for workflow continuity):

```
## Tasks Generated

**FEATURE_DIR**: {the absolute path used in step 1}
**Tasks**: {FEATURE_DIR}/tasks.md

Summary:
- Total tasks: [N]
- Execution groups: [N] (each group = 1 subagent)
- Tasks per user story: [breakdown]
- Parallelizable stories: [list stories that can run in parallel]
- MVP scope: User Story 1

Execution Plan:
  Phase 1 (Setup)       → 1 subagent
  Phase 2 (Foundation)  → 1 subagent
  Phase 3-N (Stories)   → [N] subagents (parallel where deps allow)
  Phase N+1 (Polish)    → 1 subagent

  Total subagents: ~[N] (vs [M] tasks = [X]% reduction)

Format validation: ✓ All tasks follow checklist format

---
**Next step**: Run `/speckit.run` or `/speckit.analyze`

**IMPORTANT**: Pass `FEATURE_DIR: {absolute path}` to the next command.
```

The FEATURE_DIR output is critical - subsequent commands need this exact path.

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by user story to enable independent implementation and testing.

**Tests are OPTIONAL**: Only generate test tasks if explicitly requested in the feature specification or if user requests TDD approach.

---

### Execution Group Model

**IMPORTANT**: The runner (`speckit.run`) executes tasks by **groups**, not individually.

#### What is a Group?

A **group** is a set of tasks executed by a **single subagent**. This is more efficient than spawning one subagent per task.

| Phase Type | Group Definition | Subagents |
|------------|------------------|-----------|
| Setup | All tasks OR split by `[G:name]` | 1 (or 1 per group) |
| Foundational | All tasks OR split by `[G:name]` | 1 (or 1 per group) |
| User Story (US1, US2...) | **All tasks with same [USx] = 1 group** | 1 per story |
| Polish | All tasks OR split by `[G:name]` | 1 (or 1 per group) |

#### Group Markers

1. **`[USx]`** - User Story label (e.g., `[US1]`, `[US2]`)
   - All tasks with the same `[USx]` go to ONE subagent
   - The subagent implements the complete user story
   - REQUIRED on all tasks in User Story phases

2. **`[G:name]`** - Explicit group for non-story phases
   - Use in Setup, Foundational, or Polish phases
   - Tasks with same `[G:name]` go to ONE subagent
   - Example: `[G:types]`, `[G:database]`, `[G:api-polish]`
   - OPTIONAL - if omitted, all tasks in that phase form one group

3. **`[P]`** - Parallel marker (DOCUMENTATION ONLY)
   - Indicates task has no dependencies on other tasks in its group
   - Does NOT spawn separate subagents
   - Helps the subagent understand which tasks can be done in any order
   - Useful for documentation and future optimization

#### Phase-Level Parallelism

User Stories can run in **parallel** if they don't depend on each other. Mark this at the phase header:

```markdown
## Phase 3: User Story 1 - Feature Name (Priority: P1)
<!-- depends: foundation -->

## Phase 4: User Story 2 - Feature Name (Priority: P1)
<!-- depends: foundation -->

## Phase 5: User Story 3 - Feature Name (Priority: P2)
<!-- depends: US2 -->
```

**Dependency markers**:
- `<!-- depends: foundation -->` - Can start after Phase 2 completes
- `<!-- depends: US1 -->` - Must wait for US1 to complete
- `<!-- depends: US1, US2 -->` - Must wait for both US1 and US2

**Parallel execution example**:
```
Phase 1 (Setup) ────────────────────► complete
Phase 2 (Foundational) ─────────────► complete
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
     US1 (1 subagent)              US2 (1 subagent)              US4 (1 subagent)
            │                             │                             │
            │                             ▼                             │
            │                      US3 (1 subagent)                     │
            │                       [depends: US2]                      │
            │                             │                             │
            └─────────────────────────────┼─────────────────────────────┘
                                          ▼
                                 Polish (1 subagent)
                                 [depends: US1, US2]
```

---

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [P?] [Group] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[P] marker**: OPTIONAL - documentation that task has no internal dependencies
   - Does NOT affect execution (all tasks in a group go to same subagent)
   - Helps subagent understand task ordering flexibility
4. **[Group] label**: Determines which subagent executes this task
   - `[US1]`, `[US2]`, etc. for User Story phases (REQUIRED)
   - `[G:name]` for Setup/Foundational/Polish phases (OPTIONAL)
   - If no group label in non-story phase: all tasks form one implicit group
5. **Description**: Clear action with exact file path

**Examples**:

- ✅ CORRECT: `- [ ] T001 [G:types] Create project structure per implementation plan`
- ✅ CORRECT: `- [ ] T005 [P] [G:database] Implement auth middleware in src/middleware/auth.py`
- ✅ CORRECT: `- [ ] T012 [P] [US1] Create User model in src/models/user.py`
- ✅ CORRECT: `- [ ] T014 [US1] Implement UserService in src/services/user_service.py`
- ✅ CORRECT: `- [ ] T020 Add logging to all endpoints` (no group = implicit phase group)
- ❌ WRONG: `- [ ] Create User model` (missing ID)
- ❌ WRONG: `T001 [US1] Create model` (missing checkbox)
- ❌ WRONG: `- [ ] [US1] Create User model` (missing Task ID)
- ❌ WRONG: `- [ ] T001 [US1] Create model` (missing file path)

### API Endpoint Tasks

For each API endpoint task, the task description MUST include:
- Implementation file path
- Bruno request file path

Example:
```
- [ ] T015 [P] [US2] Create POST /api/payments endpoint
  Files: services/api/src/routes/payments.ts
  Bruno: bruno/api/payments/create.bru
  Criteria:
  - [ ] Endpoint returns 201 on success
  - [ ] Bruno request file with example body
  - [ ] Bruno tests pass
```

### Task Organization

1. **From User Stories (spec.md)** - PRIMARY ORGANIZATION:
   - Each user story (P1, P2, P3...) gets its own phase
   - Map all related components to their story:
     - Models needed for that story
     - Services needed for that story
     - Endpoints/UI needed for that story
     - If tests requested: Tests specific to that story
   - Mark story dependencies (most stories should be independent)

2. **From Contracts**:
   - Map each contract/endpoint → to the user story it serves
   - If tests requested: Each contract → contract test task [P] before implementation in that story's phase

3. **From Data Model**:
   - Map each entity to the user story(ies) that need it
   - If entity serves multiple stories: Put in earliest story or Setup phase
   - Relationships → service layer tasks in appropriate story phase

4. **From Setup/Infrastructure**:
   - Shared infrastructure → Setup phase (Phase 1)
   - Foundational/blocking tasks → Foundational phase (Phase 2)
   - Story-specific setup → within that story's phase

### Phase Structure

Each phase header MUST include a dependency comment for the runner:

```markdown
## Phase 1: Setup (Shared Infrastructure)
<!-- depends: none -->

## Phase 2: Foundational (Blocking Prerequisites)
<!-- depends: setup -->

## Phase 3: User Story 1 - Name (Priority: P1)
<!-- depends: foundation -->

## Phase 4: User Story 2 - Name (Priority: P1)
<!-- depends: foundation -->

## Phase 5: User Story 3 - Name (Priority: P2)
<!-- depends: US2 -->

## Phase N: Polish & Cross-Cutting Concerns
<!-- depends: US1, US2 -->
```

**Phase types**:
- **Phase 1 (Setup)**: Project initialization, shared types, utilities
  - Use `[G:name]` to split into groups if needed
  - All tasks go to 1 subagent (or 1 per group)
- **Phase 2 (Foundational)**: Blocking prerequisites - MUST complete before user stories
  - Use `[G:name]` to split into groups if needed
  - All tasks go to 1 subagent (or 1 per group)
- **Phase 3+ (User Stories)**: One phase per user story in priority order
  - All tasks with `[USx]` go to 1 subagent
  - Each phase = complete, independently testable increment
  - Within each story: Tests (if requested) → Models → Services → Endpoints → Integration
- **Final Phase (Polish)**: Cross-cutting concerns, accessibility, final touches
  - Use `[G:name]` to split into groups if needed
  - All tasks go to 1 subagent (or 1 per group)
