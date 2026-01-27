---
description: Execute tasks from tasks.md with parallel subagent spawning, per-task verification, and lesson capture
model: opus
handoffs:
  - label: Run Full Test Suite
    agent: sc:test
    prompt: Run comprehensive tests for the implementation
  - label: Verify Feature
    agent: sc:verify
    prompt: Verify feature works end-to-end
---

## User Input
```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

**IMPORTANT**: Look for `FEATURE_DIR:` in the input above. If provided, use it directly instead of running the shell script.

## Outline

1. **Resolve feature context** (CRITICAL for subagent continuity):

   **Option A - FEATURE_DIR provided in input above**:
   - If you see `FEATURE_DIR: /path/to/specs/NNN-feature-name` in the input, use it directly
   - Set paths:
     - `TASKS` = `{FEATURE_DIR}/tasks.md`
     - `IMPL_PLAN` = `{FEATURE_DIR}/plan.md`
     - `FEATURE_SPEC` = `{FEATURE_DIR}/spec.md`
   - Skip the shell script entirely

   **Option B - No FEATURE_DIR provided (fallback)**:
   - Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root
   - Parse: `FEATURE_DIR`, `TASKS`, `IMPL_PLAN`, `FEATURE_SPEC`
   - If tasks.md missing, abort and instruct user to run `/speckit.tasks` first
   - For single quotes in args, use escape syntax: e.g `'I'\''m Groot'`

2. **Check checklists status** (if FEATURE_DIR/checklists/ exists):
   - Scan all checklist files in the checklists/ directory
   - For each checklist, count completed vs incomplete items
   - Create status table:
```
     | Checklist   | Total | Done | Incomplete | Status |
     |-------------|-------|------|------------|--------|
     | ux.md       | 12    | 12   | 0          | ✓ PASS |
     | security.md | 6     | 4    | 2          | ✗ FAIL |
```
   - **If any incomplete**: STOP and ask user to proceed or halt
   - **If all complete**: Proceed automatically

3. **Load implementation context**:
   - **REQUIRED**: tasks.md, plan.md
   - **IF EXISTS**: data-model.md, contracts/, research.md, quickstart.md
   - **REQUIRED**: .specify/memory/constitution.md (project rules)

4. **Project setup verification** (from plan.md tech stack):
   - Create/verify .gitignore, .dockerignore, .eslintignore etc. based on detected tech
   - Append missing critical patterns to existing ignore files

5. **Parse tasks.md structure** (CRITICAL - read carefully):

   **A. Extract phases with dependencies:**
   ```
   For each "## Phase N:" header:
     - Extract phase number and name
     - Extract dependency comment: <!-- depends: X -->
     - Map dependencies: "foundation" = Phase 2, "USx" = User Story X
   ```

   **B. Extract execution groups:**
   ```
   GROUP EXTRACTION RULES (in order of precedence):

   1. [USx] label → Group by User Story
      - All tasks with [US1] = one group named "US1"
      - All tasks with [US2] = one group named "US2"
      - etc.

   2. [G:name] label → Explicit group
      - All tasks with [G:types] = one group named "types"
      - All tasks with [G:database] = one group named "database"
      - etc.

   3. No label → Implicit phase group
      - All unlabeled tasks in a phase = one group named "phase-N"
   ```

   **C. Build execution map:**
   ```
   EXECUTION_MAP = {
     "phase-1": { groups: ["setup"], depends: [] },
     "phase-2": { groups: ["foundation"], depends: ["phase-1"] },
     "phase-3": { groups: ["US1"], depends: ["phase-2"] },
     "phase-4": { groups: ["US2"], depends: ["phase-2"] },
     "phase-5": { groups: ["US3"], depends: ["US2"] },
     "phase-6": { groups: ["polish"], depends: ["US1", "US2"] }
   }
   ```

6. **Check completion status and determine resume point** (CRITICAL for resumption):

   **A. Scan tasks.md for completion markers:**
   ```
   For each task line matching pattern: - [x] or - [ ]
     - [x] = completed
     - [ ] = incomplete
     - [x] with ✓ (verified) = verified complete
     - [ ] with ❌ (error: ...) = failed, needs retry
   ```

   **B. Calculate completion per group:**
   ```
   For each group (G:types, US1, US2, etc.):
     - Count total tasks in group
     - Count completed tasks ([x])
     - Calculate percentage: completed/total * 100
     - Status: COMPLETE (100%), PARTIAL (1-99%), NOT_STARTED (0%)
   ```

   **C. Display resume status table:**
   ```
   ══════════════════════════════════════════════════════════════
                    TASK COMPLETION STATUS
   ══════════════════════════════════════════════════════════════

   | Wave | Group      | Total | Done | Status      |
   |------|------------|-------|------|-------------|
   | 1    | G:types    | 10    | 10   | ✅ COMPLETE  |
   | 2    | G:metadata | 9     | 9    | ✅ COMPLETE  |
   | 3    | US1        | 11    | 11   | ✅ COMPLETE  |
   | 3    | US2        | 4     | 2    | 🔄 PARTIAL   |
   | 4    | US3        | 5     | 0    | ⏳ PENDING   |
   | 4    | US4        | 3     | 0    | ⏳ PENDING   |
   | 4    | US5        | 2     | 0    | ⏳ PENDING   |
   | 5    | G:polish   | 6     | 0    | ⏳ PENDING   |

   RESUME POINT: Wave 3 (US2 incomplete - 2/4 tasks done)

   ══════════════════════════════════════════════════════════════
   ```

   **D. Determine resume strategy:**
   ```
   IF all groups COMPLETE:
     → Display "All tasks complete!" and skip to verification summary
     → Offer to run final verification: /sc:test --comprehensive

   IF some groups PARTIAL or NOT_STARTED:
     → Find first wave with incomplete groups
     → For PARTIAL groups: re-run entire group (subagent will skip completed tasks internally)
     → For NOT_STARTED groups in same wave: run in parallel with PARTIAL
     → Resume from that wave

   IF --force-restart flag provided:
     → Ignore completion status, re-run all waves from beginning
   ```

   **E. Handle partial groups:**
   ```
   When a group is PARTIAL (some tasks [x], some [ ]):
     - Include ONLY incomplete tasks in subagent prompt
     - Tell subagent which tasks are already done (for context)
     - Subagent implements remaining tasks only

   Example subagent prompt for partial group:
     "Execute Group: US2 (RESUMING)

      ## Already Completed (DO NOT re-implement)
      - [x] T031: Verify PhotographyParameterEditor uses PARAMETER_CATEGORIES
      - [x] T032: Update PARAMETER_DESCRIPTIONS in prompt-enhancement.ts

      ## Remaining Tasks (implement these)
      - [ ] T033: Update allParams array in buildStructuredSystemPrompt()
      - [ ] T034: Update mergeParameters() to include new params

      ..."
   ```

7. **Handle flags**:
   - `--dry-run`: Display execution map with completion status and exit
   - `--phase N`: Execute only phase N
   - `--retry GROUP`: Retry specific group (e.g., `--retry US2`)
   - `--skip-tests`: Skip per-group verification (not recommended)
   - `--force-restart`: Ignore completion status, re-run ALL waves from beginning
   - `--from-wave N`: Start execution from wave N (skip earlier waves even if incomplete)
   - `--skip-review`: Skip code review step (faster but may leave DRY violations)
   - `--review-only`: Run code review but don't apply fixes (report mode)

8. **Execute by groups** (THE CORE ALGORITHM):

   ```
   ╔══════════════════════════════════════════════════════════════════╗
   ║  CRITICAL EXECUTION RULE                                        ║
   ║                                                                  ║
   ║  ONE SUBAGENT PER GROUP                                         ║
   ║                                                                  ║
   ║  • A group is: all tasks with same [USx] or [G:name]           ║
   ║  • One subagent receives ALL tasks in its group                 ║
   ║  • The subagent implements the COMPLETE group                   ║
   ║  • [P] markers are documentation only - do NOT spawn extra     ║
   ║    subagents for [P] tasks                                      ║
   ╚══════════════════════════════════════════════════════════════════╝
   ```

   **A. Determine execution waves:**

   Groups whose dependencies are satisfied can run in PARALLEL.

   ```
   Wave 1: [Setup] - no dependencies
   Wave 2: [Foundation] - depends on Setup
   Wave 3: [US1], [US2], [US4] - all depend only on Foundation (PARALLEL!)
   Wave 4: [US3] - depends on US2
   Wave 5: [Polish] - depends on US1, US2
   ```

   **B. For each wave, spawn subagents:**

   **Single group in wave** → spawn 1 subagent:
   ```
   Task tool:
     subagent_type: [auto-detect from task content - see section C]
     model: [select based on subagent_type - see MODEL SELECTION below]
     prompt: |
       Execute Group: {GROUP_NAME}

       ## Tasks (implement ALL in order, [P] = no internal dependencies)
       {FULL_TASK_LIST_WITH_IDS_FILES_CRITERIA}

       ## Goal
       {PHASE_GOAL_OR_STORY_DESCRIPTION}

       ## Context
       - Constitution: .specify/memory/constitution.md
       - Plan: {IMPL_PLAN}
       - Spec: {FEATURE_SPEC}

       ## Instructions
       1. Read constitution first (project rules)
       2. Implement ALL tasks in this group
       3. Tasks marked [P] have no internal dependencies - do in any efficient order
       4. Tasks without [P] should be done in listed order
       5. For API endpoints: create Bruno request files in api-collections/
       6. After ALL tasks complete, run SELF-VERIFICATION (MANDATORY)
       7. Report: all files changed, test results, any issues

       ## [IF FRONTEND AGENT] Visual Verification with Playwright
       You MUST visually verify your UI work using Playwright MCP:
       ⚠️ FIRST run: .claude/scripts/get-dev-ports.sh to get current URLs
       1. Ensure dev server is running (or start with: bun run dev)
       2. browser_navigate to the discovered web URL (the page where your component lives)
       3. browser_snapshot to verify it renders correctly
       4. browser_console_messages to check for errors (should be none)
       5. browser_click on buttons/links to test they work
       6. browser_take_screenshot to capture evidence
       DO NOT report done without visual verification!

       ## SELF-VERIFICATION CHECKLIST (MANDATORY before reporting done)

       You MUST complete ALL applicable checks before reporting completion:

       □ Run `bun run typecheck` - ALL errors must be resolved
       □ Run `bun run lint` - ALL errors must be resolved (warnings OK)
       □ Run relevant unit tests for modified areas - ALL must pass
       □ For API endpoints (if API is running):
         □ Run integration tests: `bun run test:integration`
         □ All integration tests must pass
       □ For API endpoints (Bruno verification):
         □ Bruno request file exists in api-collections/{endpoint}.bru
         □ Bruno file has: method, URL, example request body, expected response
         □ Manually verify endpoint works (if dev server running)
       □ For UI components (USE PLAYWRIGHT MCP FOR VERIFICATION):
         □ Navigate to the page/route where component is rendered
         □ Take a snapshot (browser_snapshot) to verify component renders
         □ Check console messages (browser_console_messages) for errors
         □ Click interactive elements (browser_click) to verify they work
         □ Take screenshot (browser_take_screenshot) as evidence
         □ Verify no accessibility violations if component is interactive
       □ For database changes:
         □ Migration runs without errors
         □ Schema matches data-model.md

       ⚠️ DO NOT report "done" if ANY verification fails!
       Instead, fix the issues and re-verify.

       ## [IF USER STORY GROUP (USx)] MANDATORY: Visual Feature Verification

       **This section is CRITICAL for User Story groups (US1, US2, US3, etc.)**

       After implementing your user story, you MUST visually verify the feature
       works end-to-end using Playwright MCP. This is NOT optional!

       Note: Playwright runs in HEADLESS mode (no visible browser window).
       All verification happens programmatically via MCP tools.

       ### CRITICAL: Discover Ports First
       ```bash
       # Run BEFORE any Playwright operations:
       .claude/scripts/get-dev-ports.sh
       # Use the discovered URLs for browser_navigate
       ```

       ### Steps:
       1. **Read the spec.md** to understand the acceptance criteria for your user story
       2. **Ensure dev server is running** (or start with: bun run dev)
       3. **Discover ports**: Run `.claude/scripts/get-dev-ports.sh` to get URLs
       4. **Navigate to the relevant page**: browser_navigate to discovered web URL
       4. **Take BEFORE snapshot**: browser_snapshot() to see initial state
       5. **Interact with the feature**:
          - browser_click() on buttons, links, options
          - browser_type() for text inputs
          - browser_select_option() for dropdowns
       6. **Verify expected behavior occurred**:
          - Take AFTER snapshot: browser_snapshot()
          - Check for expected UI changes
          - Verify data is displayed/updated correctly
       7. **Check for errors**: browser_console_messages() - should be clean!
       8. **Capture evidence**: browser_take_screenshot() before and after

       ### Report Format Required:
       ```
       ## Visual Verification: {User Story ID}

       | Step | Action | Expected | Actual | Status |
       |------|--------|----------|--------|--------|
       | 1 | Navigate to /generate | Page loads | Page loaded | ✅ |
       | 2 | Select Flux 2 model | Dropdown shows Flux 2 | Flux 2 selected | ✅ |
       | 3 | Generate image | JSON prompt sent | ... | ✅/❌ |

       Screenshots:
       - Before: [screenshot path]
       - After: [screenshot path]

       Console Errors: None / [list errors]
       ```

       ⚠️ DO NOT report your user story as complete without visual evidence!
       The orchestrator and user need PROOF that the feature works.

       ## MANDATORY: MARK TASKS COMPLETE IN tasks.md

       After ALL tasks in your group pass verification, you MUST update tasks.md:

       1. Open the tasks.md file at: {TASKS}
       2. For EACH task you completed in this group, change:
          `- [ ] T001` → `- [x] T001`
       3. Add verification marker: `- [x] T001 ✓ (verified)`

       Example - if you completed T001, T002, T003:
       ```
       BEFORE:
       - [ ] T001 [P] [G:types] Add SHOT_DISTANCE_OPTIONS...
       - [ ] T002 [P] [G:types] Add ISO_OPTIONS...
       - [ ] T003 [P] [G:types] Add COMPOSITION_OPTIONS...

       AFTER:
       - [x] T001 [P] [G:types] Add SHOT_DISTANCE_OPTIONS... ✓ (verified)
       - [x] T002 [P] [G:types] Add ISO_OPTIONS... ✓ (verified)
       - [x] T003 [P] [G:types] Add COMPOSITION_OPTIONS... ✓ (verified)
       ```

       ⚠️ This step is CRITICAL for resume/checkpoint functionality!
       The orchestrator uses these markers to determine which waves are complete.

       Implement the COMPLETE group. Do not stop after one task.
   ```

   **MODEL SELECTION FOR SUBAGENTS:**
   ```
   ╔══════════════════════════════════════════════════════════════════════╗
   ║                     MODEL SELECTION RULES                            ║
   ╠══════════════════════════════════════════════════════════════════════╣
   ║                                                                      ║
   ║  USE OPUS FOR ALL SUBAGENTS (preferred for quality):                 ║
   ║  • subagent_type: "security"        → model: "opus"                 ║
   ║  • subagent_type: "architect"       → model: "opus"                 ║
   ║  • subagent_type: "frontend"        → model: "opus"                 ║
   ║  • subagent_type: "backend"         → model: "opus"                 ║
   ║  • subagent_type: "qa"              → model: "opus"                 ║
   ║  • subagent_type: "devops"          → model: "opus"                 ║
   ║  • subagent_type: "performance"     → model: "opus"                 ║
   ║  • subagent_type: "scribe"          → model: "opus"                 ║
   ║  • subagent_type: "general-purpose" → model: "opus"                 ║
   ║                                                                      ║
   ║  RATIONALE:                                                          ║
   ║  • Opus: Latest model with best reasoning, code quality,            ║
   ║    and instruction following for all implementation tasks            ║
   ╚══════════════════════════════════════════════════════════════════════╝
   ```

   **Multiple groups in wave** → spawn ALL subagents in parallel:
   ```
   // Wave 3 example: US1, US2, US4 can run in parallel

   Spawn 3 subagents SIMULTANEOUSLY using Task tool:

   Subagent 1 (US1):
     subagent_type: [auto-detect]
     model: [select based on subagent_type - see MODEL SELECTION above]
     prompt: "Execute Group: US1 ... [include SELF-VERIFICATION CHECKLIST]"

   Subagent 2 (US2):
     subagent_type: [auto-detect]
     model: [select based on subagent_type]
     prompt: "Execute Group: US2 ... [include SELF-VERIFICATION CHECKLIST]"

   Subagent 3 (US4):
     subagent_type: [auto-detect]
     model: [select based on subagent_type]
     prompt: "Execute Group: US4 ... [include SELF-VERIFICATION CHECKLIST]"

   Wait for ALL to complete before next wave.

   IMPORTANT: Every subagent prompt MUST include the SELF-VERIFICATION CHECKLIST.
   ```

   **C. Auto-detect subagent_type from group content:**

   ```
   ╔══════════════════════════════════════════════════════════════════════╗
   ║  SPECIALIST SUBAGENT TYPE DETECTION                                  ║
   ║                                                                      ║
   ║  Scan group tasks for keywords/patterns to select optimal agent.     ║
   ║  Match in order of specificity (most specific wins).                 ║
   ╚══════════════════════════════════════════════════════════════════════╝

   ─────────────────────────────────────────────────────────────────────
   FRONTEND SPECIALISTS (UI/UX domain)
   ─────────────────────────────────────────────────────────────────────

   IF group has specialist criteria: "Design Requirements:" or "Accessibility Requirements:"
     AND mentions: components, design system, shadcn, Tailwind, styling
     → subagent_type: "frontend"
       (Enhanced frontend with design system & a11y awareness)

   IF group tasks mention: accessibility, a11y, ARIA, screen reader, WCAG
     AND primarily accessibility-focused tasks
     → subagent_type: "frontend"
       (Accessibility-enhanced frontend)

   IF group tasks mention: components, UI, React, .tsx, styling, responsive
     AND NOT accessibility/design-system focused
     → subagent_type: "frontend"
       (Standard frontend)

   ─────────────────────────────────────────────────────────────────────
   BACKEND SPECIALISTS (Server/Data domain)
   ─────────────────────────────────────────────────────────────────────

   IF group has specialist criteria: "Database Requirements:"
     AND mentions: schema, migration, Drizzle, SQL, index, foreign key
     → subagent_type: "backend"
       (Database-specialized backend)

   IF group has specialist criteria: "API Contract Requirements:"
     AND mentions: endpoint, route, Zod, Bruno, request/response
     → subagent_type: "backend"
       (API-specialized backend)

   IF group has specialist criteria: "Performance Requirements:"
     AND mentions: optimization, caching, bundle, lazy load
     → subagent_type: "performance"

   IF group tasks mention: API, routes, database, controllers, models
     AND NOT specialized (no specific specialist criteria)
     → subagent_type: "backend"
       (Standard backend)

   ─────────────────────────────────────────────────────────────────────
   SECURITY & QUALITY SPECIALISTS
   ─────────────────────────────────────────────────────────────────────

   IF group has specialist criteria: "Security Requirements:"
     OR mentions: auth, authentication, authorization, OAuth, JWT, vulnerability
     → subagent_type: "security"

   IF group tasks mention: E2E, end-to-end, Playwright, integration test
     → subagent_type: "qa"

   IF group tasks mention: tests, validation, unit test
     AND NOT E2E focused
     → subagent_type: "qa"

   ─────────────────────────────────────────────────────────────────────
   INFRASTRUCTURE SPECIALISTS
   ─────────────────────────────────────────────────────────────────────

   IF group tasks mention: deploy, Docker, k8s, Kubernetes, CI/CD, pipeline
     → subagent_type: "devops"

   IF group tasks mention: logging, monitoring, observability, telemetry
     → subagent_type: "backend"
       (Observability-aware backend)

   ─────────────────────────────────────────────────────────────────────
   ARCHITECTURE & DESIGN
   ─────────────────────────────────────────────────────────────────────

   IF group tasks mention: schema design, data model, system design, architecture
     AND spans multiple services/modules
     → subagent_type: "architect"

   IF group tasks mention: types, interfaces, contracts
     AND primarily type definitions
     → subagent_type: "architect"

   ─────────────────────────────────────────────────────────────────────
   DOCUMENTATION
   ─────────────────────────────────────────────────────────────────────

   IF group tasks mention: documentation, README, API docs, guide
     → subagent_type: "scribe"

   IF group tasks mention: i18n, localization, translation
     → subagent_type: "scribe"

   ─────────────────────────────────────────────────────────────────────
   DEFAULT FALLBACK
   ─────────────────────────────────────────────────────────────────────

   DEFAULT: "general-purpose"
     (Use when no specific domain detected)
   ```

   **Detection Priority Summary:**
   ```
   1. Security tasks      → security
   2. Performance tasks   → performance
   3. E2E testing tasks   → qa
   4. DevOps tasks        → devops
   5. Database tasks      → backend (specialized)
   6. API tasks           → backend (specialized)
   7. UI/Component tasks  → frontend
   8. Architecture tasks  → architect
   9. Documentation tasks → scribe
   10. Default            → general-purpose
   ```

   **D. Wait for wave completion:**

   After spawning all subagents in a wave:
   - Wait for ALL subagents to complete
   - Collect results from each
   - Run code review (step 9) for each group
   - Run verification (step 10) for each group
   - Only proceed to next wave when current wave is fully complete

9. **Per-group code review and cleanup** (after implementation, before verification):

   ```
   ╔══════════════════════════════════════════════════════════════════════╗
   ║  CODE REVIEW STEP - DRY & SIMPLICITY                                 ║
   ║                                                                      ║
   ║  Purpose: Clean up implementation before tests run                   ║
   ║  Timing: After implementation subagent completes, before verification║
   ║  Skip with: --skip-review flag                                       ║
   ╚══════════════════════════════════════════════════════════════════════╝
   ```

   **Skip conditions:**
   - If `--skip-review` flag is set: skip entirely
   - If group has 0 modified files: skip (nothing to review)

   **For each completed group, spawn a refactorer subagent:**

   ```
   Task tool:
     subagent_type: "refactorer"
     model: "opus"
     prompt: |
       ## Code Review & Cleanup: {GROUP_NAME}

       Review and clean up the implementation for DRY principles and simplicity.

       ## Files to Review
       {LIST_OF_FILES_MODIFIED_BY_IMPLEMENTATION_SUBAGENT}

       ## Review Criteria (in priority order)
       1. **DRY Violations**: Extract duplicate code into shared utilities
       2. **Unnecessary Complexity**: Simplify overly nested conditionals/loops
       3. **Dead Code**: Remove unused imports, variables, functions
       4. **Consistency**: Ensure consistent naming and patterns
       5. **Single Responsibility**: Split functions doing multiple things

       ## Mode: {IF --review-only: "REPORT ONLY" ELSE: "FIX"}

       {IF --review-only}
       **REPORT ONLY MODE**: Do NOT modify files. List issues found:
       | File | Line | Issue | Severity | Suggestion |
       |------|------|-------|----------|------------|
       {ELSE}
       **FIX MODE**: Apply fixes directly to the code.
       {ENDIF}

       ## Constraints (CRITICAL)
       - ❌ Do NOT change functionality or behavior
       - ❌ Do NOT add new features
       - ❌ Do NOT refactor unrelated code
       - ❌ Do NOT change public APIs or interfaces
       - ❌ Do NOT rename exported functions/classes (breaks imports)
       - ✅ DO extract duplicates to new private helpers
       - ✅ DO simplify complex expressions
       - ✅ DO remove dead code
       - ✅ DO improve variable/function names (internal only)

       ## Process
       1. Read each modified file
       2. Identify issues matching review criteria
       3. {IF FIX MODE: Apply minimal, focused fixes}
       4. Run `bun run typecheck` to verify no breakage
       5. Run `bun run lint` to ensure code style
       6. Report all changes made

       ## Output Format
       ```
       ## Code Review Report: {GROUP_NAME}

       ### Changes Applied (or Issues Found if report-only)
       | File | Change | Reason |
       |------|--------|--------|
       | libs/utils/api.ts | Extracted fetchWithRetry() | DRY - used in 3 places |
       | components/Form.tsx | Simplified validation logic | Reduced nesting depth |

       ### Verification
       - Typecheck: ✅ PASS
       - Lint: ✅ PASS

       ### Summary
       - Files reviewed: X
       - Changes applied: Y
       - DRY violations fixed: Z
       ```
   ```

   **Parallel review for parallel groups:**
   - If Wave 3 had US1, US2, US4 running in parallel
   - Spawn 3 refactorer subagents in parallel (one per group)
   - Each reviews only the files modified by its corresponding implementation subagent

   **Handle review results:**
   - **FIX MODE + typecheck passes**: Proceed to verification (step 10)
   - **FIX MODE + typecheck fails**: Revert changes, report issue, proceed anyway
   - **REPORT ONLY MODE**: Log issues, proceed to verification (step 10)

10. **Per-group verification** (after code review, on cleaned code):

   Before marking a group complete, verify ALL tasks in the group work:

   **A. Collect modified files from subagent report:**
   - The subagent should report all files it modified
   - Group files by area: api, web, database, types, etc.

   **B. Run verification for all modified areas:**
   ```bash
   # For TypeScript/JavaScript projects:

   # If any services/api/ files modified:
   bun test services/api --bail

   # If any apps/web/ files modified:
   bun test apps/web --bail

   # If any libs/ files modified:
   bun test libs --bail

   # Integration tests (if API endpoints modified and API is running):
   bun run test:integration

   # Always run:
   bun run typecheck
   bun run lint
   ```

   **C. Bruno API verification (MANDATORY for any API changes):**

   **WHEN TO RUN**: If ANY task in the group:
   - Created or modified files in `services/api/src/routes/`
   - Added, changed, or removed an API endpoint
   - Modified request/response schemas for an endpoint
   - Changed API behavior (even if just the handler logic)

   ```
   ╔══════════════════════════════════════════════════════════════════════╗
   ║                  BRUNO VERIFICATION CHECKLIST                        ║
   ╠══════════════════════════════════════════════════════════════════════╣
   ║                                                                      ║
   ║  For EACH API endpoint that was created or modified:                           ║
   ║                                                                      ║
   ║  1. FILE EXISTS CHECK:                                               ║
   ║     □ Bruno file exists at: api-collections/{endpoint-name}.bru     ║
   ║     □ Filename matches endpoint (e.g., create-lora.bru)             ║
   ║                                                                      ║
   ║  2. FILE CONTENT CHECK (each file must have):                       ║
   ║     □ meta { name, type, seq }                                      ║
   ║     □ method (GET, POST, PUT, DELETE, etc.)                         ║
   ║     □ url with correct path and any path params                     ║
   ║     □ headers (Content-Type, Authorization if needed)               ║
   ║     □ body (for POST/PUT - valid JSON matching Zod schema)          ║
   ║     □ script:post-response (for status code assertions)             ║
   ║                                                                      ║
   ║  3. FUNCTIONAL TEST (if dev server running):                        ║
   ║     □ Run: bun run bruno:test --filter {endpoint}                   ║
   ║     □ Request returns expected status code                          ║
   ║     □ Response body matches expected schema                         ║
   ║                                                                      ║
   ║  FAILURE = Group verification fails, task marked ❌                  ║
   ╚══════════════════════════════════════════════════════════════════════╝
   ```

   **Missing Bruno files is a VERIFICATION FAILURE.** The subagent must create them.

   **D. Handle verification results:**
   - **ALL PASS**: Mark ALL tasks in group complete `[x]`, proceed to next wave
   - **FAIL**:
     1. Capture failure in lessons-learned (step 11)
     2. Report which specific task(s) caused the failure
     3. Mark failed tasks ❌, mark passing tasks ✓
     4. Add group to retry queue
     5. Continue to next wave (don't block on one group failure)

   **E. Update tasks.md after group verification:**
   - Mark all verified tasks: `- [x] T001: Title ✓ (verified)`
   - Mark failed tasks: `- [ ] T001: Title ❌ (error: {brief})`
   - Do NOT mark tasks complete before verification passes

11. **Lesson learning** (continuous throughout execution):

   Maintain `.specify/memory/lessons-learned.md` with learnings from this run.
   
   **Capture on task failure:**
```markdown
   ## {DATE} - {FEATURE_NAME}
   
   ### Failed: {TASK_ID} - {TITLE}
   **Error**: {error message}
   **Root cause**: {analysis}
   **Fix applied**: {what was done to fix}
   **Prevention**: {how to avoid in future}
```
   
   **Capture on unexpected success pattern:**
```markdown
   ### Pattern: {pattern name}
   **Context**: {when this applies}
   **What worked**: {description}
   **Reuse**: {how to apply elsewhere}
```
   
   **Capture on phase completion:**
   - Note any tasks that needed retry
   - Note any dependencies that were missing from tasks.md
   - Note any [P] markers that should have been sequential (file conflicts)
   
   **Write lessons incrementally** - don't wait until end.

12. **Update tasks.md** after each verified group:
    - Change `- [ ]` to `- [x]` for ALL verified tasks in the group
    - Add verification note: `- [x] T001: Title ✓ (verified)`
    - For failed tasks: `- [ ] T001: Title ❌ (error: {brief})`
    - Update atomically after group verification, not after each task

13. **Progress reporting**:
```
    ══════════════════════════════════════════════════════════════
    WAVE 1: Setup
    ══════════════════════════════════════════════════════════════
    ● Group: setup (3 tasks) → 1 subagent
      T001, T002, T003 → implemented → reviewed (2 fixes) → verified ✅
    ● Wave 1 Complete

    ══════════════════════════════════════════════════════════════
    WAVE 2: Foundation
    ══════════════════════════════════════════════════════════════
    ● Group: foundation (6 tasks) → 1 subagent
      T004-T009 → implemented → reviewed (0 fixes) → verified ✅
    ● Wave 2 Complete

    ══════════════════════════════════════════════════════════════
    WAVE 3: User Stories (PARALLEL)
    ══════════════════════════════════════════════════════════════
    ● Group: US1 (6 tasks) → subagent 1 → reviewed (1 fix) ✅
    ● Group: US2 (12 tasks) → subagent 2 → reviewed (3 fixes) ✅
    ● Group: US4 (4 tasks) → subagent 3 → reviewed (0 fixes) ✅
    ● Wave 3 Complete (3 groups in parallel)

    ══════════════════════════════════════════════════════════════
    WAVE 4: Dependent Stories
    ══════════════════════════════════════════════════════════════
    ● Group: US3 (4 tasks) → 1 subagent
      T028-T031 → implemented → reviewed → FAILED ❌ (T030 type error)
    ● Wave 4 Complete with errors

    ⚠️ Failed groups: US3 (retry with --retry US3)
```

14. **End-of-run summary**:
```
    ══════════════════════════════════════════════════════════════
                        EXECUTION COMPLETE
    ══════════════════════════════════════════════════════════════

    EXECUTION MODEL:
      Total tasks: 39
      Execution groups: 8
      Subagents spawned: 16 (8 impl + 8 review)

    RESULTS:
      Groups passed: 7/8 ✅
      Groups failed: 1/8 ❌
      Tasks passed: 35/39
      Tasks failed: 4/39

    CODE REVIEW:
      Groups reviewed: 8
      Total fixes applied: 6
      DRY violations fixed: 4
      Complexity reductions: 2
      Files cleaned: 12

    WAVES:
      ✅ Wave 1: Setup (1 group, 3 tasks) - 2 review fixes
      ✅ Wave 2: Foundation (1 group, 6 tasks) - 0 review fixes
      ✅ Wave 3: US1, US2, US4 (3 groups parallel, 22 tasks) - 4 review fixes
      ❌ Wave 4: US3 (1 group, 4 tasks) - FAILED
      ✅ Wave 5: Polish (1 group, 4 tasks) - 0 review fixes

    FAILED GROUPS:
      US3: T030 type error in GenerationPanel.tsx
           → Retry: /speckit.run --retry US3

    LESSONS CAPTURED: 2 entries
      → .specify/memory/lessons-learned.md updated

    VERIFICATION:
      Tests run: 47
      Tests passed: 45
      Typecheck: ✅
      Lint: ✅

    NEXT STEPS:
      1. Fix failed group: /speckit.run --retry US3
      2. Or skip and test: /sc:test --comprehensive
    ══════════════════════════════════════════════════════════════
```

15. **Final lesson learning pass**:

    After all phases, append summary to lessons-learned.md:
```markdown
    ### Run Summary: {DATE}
    **Feature**: {FEATURE_NAME}
    **Success rate**: {X}/{Y} tasks
    **Key learnings**:
    - {learning 1}
    - {learning 2}
    **Recommendations for next run**:
    - {recommendation}
```

16. **APPROVAL GATE** (MANDATORY - DO NOT SKIP):

    After presenting the end-of-run summary, present this approval request and **WAIT for user response**:

    ```
    ══════════════════════════════════════════════════════════════════
      APPROVAL REQUIRED: Implementation Review
    ══════════════════════════════════════════════════════════════════

    Feature: {FEATURE_NAME}
    Implementation: {FEATURE_DIR}

    Execution Summary:
      | Metric | Result |
      |--------|--------|
      | Tasks Completed | {X}/{Y} |
      | Groups Passed | {X}/{Y} |
      | Waves Completed | {X}/{Y} |
      | Tests Passing | {X}/{Y} |
      | Typecheck | {PASS/FAIL} |
      | Lint | {PASS/FAIL} |
      | Bruno Files | {X created/updated} |

    Failed Items (if any):
      - {Group/Task}: {error summary}

    Files Modified:
      - {count} files across {areas}

    Lessons Captured: {count} entries

    ══════════════════════════════════════════════════════════════════
      YOUR ACTION REQUIRED
    ══════════════════════════════════════════════════════════════════

    Review the implementation and then respond with ONE of:
      [A] APPROVE  - Proceed to /sc:test --comprehensive
      [B] RETRY    - Re-run failed groups (specify which)
      [C] FIX      - Manual fixes needed before testing
      [D] PAUSE    - "I'll review and get back to you"

    ══════════════════════════════════════════════════════════════════
    ```

    **CRITICAL**: Do NOT suggest running the next command or proceed automatically.
    Wait for explicit user approval before suggesting next steps.

    **On user approval**: Remind them to run `/sc:test --comprehensive` with `FEATURE_DIR: {path}`

## Key Rules

```
╔══════════════════════════════════════════════════════════════════════╗
║                     EXECUTION MODEL RULES                            ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  RULE 1: ONE SUBAGENT PER GROUP                                     ║
║  ─────────────────────────────────────────────────────────────────  ║
║  • [USx] tasks → ALL go to ONE subagent                             ║
║  • [G:name] tasks → ALL go to ONE subagent                          ║
║  • Unlabeled tasks in phase → ALL go to ONE subagent                ║
║  • NEVER spawn one subagent per task                                ║
║                                                                      ║
║  RULE 2: [P] IS DOCUMENTATION ONLY                                  ║
║  ─────────────────────────────────────────────────────────────────  ║
║  • [P] does NOT spawn separate subagents                            ║
║  • [P] tells the subagent "this task has no internal dependencies"  ║
║  • [P] helps the subagent optimize its execution order              ║
║                                                                      ║
║  RULE 3: PARALLELISM IS AT THE GROUP LEVEL                          ║
║  ─────────────────────────────────────────────────────────────────  ║
║  • Groups with satisfied dependencies run in PARALLEL               ║
║  • US1, US2, US4 can run simultaneously (3 subagents)               ║
║  • This is where the real speedup comes from                        ║
║                                                                      ║
║  RULE 4: VERIFY GROUPS, NOT TASKS                                   ║
║  ─────────────────────────────────────────────────────────────────  ║
║  • Run verification AFTER the group subagent completes              ║
║  • Mark ALL tasks in group as verified if tests pass                ║
║  • Don't verify task-by-task                                        ║
║                                                                      ║
║  RULE 5: CODE REVIEW BEFORE VERIFICATION                            ║
║  ─────────────────────────────────────────────────────────────────  ║
║  • Refactorer subagent reviews AFTER implementation completes       ║
║  • Reviews happen BEFORE verification (tests run on cleaned code)   ║
║  • Focus: DRY violations, complexity, dead code, consistency        ║
║  • Skip with --skip-review flag (not recommended)                   ║
║  • Report-only mode with --review-only flag (no fixes applied)      ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Additional Rules:**
- **Learn from failures**: Every failure gets captured in lessons-learned.md
- **SuperClaude auto-activation**: Don't manually assign personas - auto-detect from task content
- **Atomic updates**: Update tasks.md after each GROUP verification, not task-by-task
- **Wave boundaries**: Complete ALL groups in a wave before proceeding to next wave
- **Dependency respect**: Never start a group until its dependencies are satisfied
- **Code review flow**: Implementation → Review → Verification (tests always run on cleaned code)
- **Review constraints**: Refactorer must NOT change functionality, only clean up DRY/complexity issues

## Specialist-Enhanced Tasks

Tasks from `speckit.tasks` may include **specialist requirements** added during the task generation phase. These requirements are embedded in task criteria blocks:

```markdown
**Example task with specialist enhancements:**

- [ ] T022 [P] [US2] Create MentionAutocomplete component

  **Design Requirements:** (from ui-designer specialist)
  - [ ] Follow design system tokens (colors, spacing, typography)
  - [ ] Responsive: mobile (320px), tablet (768px), desktop (1024px+)
  - [ ] Dark mode support if design system includes it

  **Accessibility Requirements:** (from accessibility-specialist)
  - [ ] Semantic HTML elements (button, nav, main, etc.)
  - [ ] ARIA labels for interactive elements
  - [ ] Keyboard navigation (Tab, Enter, Escape, Arrow keys)
  - [ ] Focus visible states (:focus-visible)

  **UX Flow Requirements:** (from ux-flow-specialist)
  - [ ] Loading state with skeleton/spinner
  - [ ] Error state with recovery action
  - [ ] Empty state with call-to-action
```

**When executing specialist-enhanced tasks:**
1. Include ALL specialist requirements in the subagent prompt
2. The subagent MUST implement all checklist items
3. Verification should check specialist requirements are met
4. Missing specialist requirements = verification failure

## MCP Server Integration

Subagents should leverage MCP servers based on their domain:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MCP SERVER RECOMMENDATIONS                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FRONTEND SUBAGENTS:                                                    │
│  • magic         → UI component generation, design system patterns      │
│  • context7      → React, shadcn, Tailwind documentation               │
│  • playwright    → MANDATORY for visual verification!                   │
│                    - browser_navigate to component page                 │
│                    - browser_snapshot to verify render                  │
│                    - browser_click to test interactions                 │
│                    - browser_take_screenshot as evidence                │
│                    - browser_console_messages for error checking        │
│                                                                         │
│  BACKEND SUBAGENTS:                                                     │
│  • context7      → Hono, Drizzle, Bun, Zod documentation               │
│  • sequential    → Complex API design, database optimization            │
│                                                                         │
│  SECURITY SUBAGENTS:                                                    │
│  • sequential    → Threat modeling, security analysis                   │
│  • context7      → OWASP patterns, security best practices              │
│                                                                         │
│  PERFORMANCE SUBAGENTS:                                                 │
│  • playwright    → Lighthouse, Core Web Vitals measurement              │
│  • sequential    → Bottleneck analysis, optimization planning           │
│                                                                         │
│  QA SUBAGENTS:                                                          │
│  • playwright    → E2E test execution, cross-browser testing            │
│  • sequential    → Test scenario planning, edge case analysis           │
│                                                                         │
│  DEVOPS SUBAGENTS:                                                      │
│  • sequential    → Deployment planning, infrastructure analysis         │
│  • context7      → Docker, k8s, CI/CD patterns                          │
│                                                                         │
│  ARCHITECT SUBAGENTS:                                                   │
│  • sequential    → System design, architectural analysis                │
│  • context7      → Design patterns, best practices                      │
│  • serena        → Codebase semantic analysis, refactoring              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Include MCP guidance in subagent prompts when relevant:**

For **User Story subagents (US1, US2, etc.)**, include:
```
## MCP Servers Available
- Use context7 for library documentation lookup
- Use magic for UI component generation (if frontend work)
- Use playwright for MANDATORY visual verification

## MANDATORY: Visual Feature Verification with Playwright
Your user story must be VISUALLY VERIFIED before completion:

⚠️ DISCOVER PORTS FIRST (never hardcode!):
```bash
.claude/scripts/get-dev-ports.sh
# Returns: web=XXXX, api=YYYY with URLs
```

1. Read spec.md to understand acceptance criteria
2. Ensure dev server is running (bun run dev)
3. browser_navigate to http://localhost:{web_port}/... (the page affected by your user story)
4. browser_snapshot BEFORE interacting with your feature
5. Interact with your feature (browser_click, browser_type, etc.)
6. browser_snapshot AFTER to verify the expected change
7. browser_console_messages to confirm no errors
8. browser_take_screenshot as evidence for both states

REPORT FORMAT:
| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|

DO NOT report done without visual evidence that your user story works!
```

For **frontend** subagents, include:
```
## MCP Servers Available
- Use context7 for React/shadcn/Tailwind documentation
- Use magic for UI component generation and design patterns

## MANDATORY: Visual Verification with Playwright
After implementing UI components, you MUST verify they work:

⚠️ DISCOVER PORTS FIRST (never hardcode!):
```bash
.claude/scripts/get-dev-ports.sh
# Returns: web=XXXX, api=YYYY with URLs
```

1. Ensure dev server is running (or start with: bun run dev)
2. browser_navigate to http://localhost:{web_port}/... (the page where your component lives)
3. browser_snapshot to verify it renders correctly
4. browser_console_messages to check for errors
5. browser_click on interactive elements to test functionality
6. browser_take_screenshot to capture evidence of working UI

DO NOT report done until you have visually verified the component works!
```

For **backend/other** subagents, include:
```
## MCP Servers Available
- Use context7 for library documentation lookup
- Use sequential for complex multi-step analysis
```

## Important: Subagent Delegation

**CRITICAL**: This command orchestrates, it does NOT implement directly.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR RESPONSIBILITIES                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DO:                                                            │
│  ✓ Parse tasks.md and extract groups                           │
│  ✓ Build execution wave map from dependencies                  │
│  ✓ Spawn ONE subagent per GROUP using Task tool                │
│  ✓ Spawn multiple subagents in PARALLEL for same-wave groups   │
│  ✓ Wait for subagents to complete                              │
│  ✓ Run verification after each group completes                 │
│  ✓ Update tasks.md with results                                │
│  ✓ Report progress after each wave                             │
│                                                                 │
│  DO NOT:                                                        │
│  ✗ Implement code directly                                     │
│  ✗ Spawn one subagent per task (WRONG!)                        │
│  ✗ Use [P] marker to spawn separate subagents (WRONG!)         │
│  ✗ Skip verification                                           │
│  ✗ Modify tasks.md before verification                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Subagent spawning:**
- Use the **Task tool** with appropriate `subagent_type` (auto-detect from group content)
- Pass ALL tasks in the group to the subagent in a single prompt
- For parallel groups in the same wave: spawn ALL subagents simultaneously in one tool call batch

**Example - Wave 3 with 3 parallel groups:**
```
// CORRECT: Spawn 3 subagents in ONE message with 3 Task tool calls
Task tool call 1: { subagent_type: "backend", prompt: "Execute Group: US1..." }
Task tool call 2: { subagent_type: "frontend", prompt: "Execute Group: US2..." }
Task tool call 3: { subagent_type: "backend", prompt: "Execute Group: US4..." }

// WRONG: Spawning 12 subagents for US2's 12 tasks
```