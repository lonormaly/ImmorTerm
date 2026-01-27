---
description: Start a new feature using the spec-driven workflow
---

# Start New Feature

Start a new feature using the spec-driven workflow with mandatory approval gates at each stage.

## Worktree Mode (Recommended for Parallel Development)

For working on multiple features simultaneously, use **worktree mode**:

```bash
# When running /speckit.specify, choose Option A (worktree)
/speckit.specify "my feature description"
# → Choose: [A] Create worktree (Recommended)

# This creates:
# - Branch: feature/NNN-my-feature
# - Worktree: ~/Development/Pexit-NNN-my-feature
# - Spec: ~/Development/Pexit-NNN-my-feature/specs/NNN-my-feature/

# Then open a NEW terminal:
cd ~/Development/Pexit-NNN-my-feature
claude  # Start Claude Code in the worktree

# Continue with /speckit.clarify in the new session
```

**Benefits:**
- Multiple Claude Code sessions can work on different features
- Main repo stays on `main` branch
- Tilt is shared via claim system (automatic during /speckit.run)
- Clean merge workflow when feature is complete

**After Merge:**
```bash
cd ~/Development/Pax
./scripts/worktree/worktree-cleanup.sh ../Pexit-NNN-my-feature
```

See [scripts/worktree/README.md](/scripts/worktree/README.md) for full worktree documentation.

---

## The 9-Stage Feature Workflow

```
╔══════════════════════════════════════════════════════════════════════════╗
║                         FEATURE WORKFLOW                                  ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  1. SPECIFY    Create feature specification                              ║
║       ↓        → Approval Gate: Review spec.md                          ║
║                                                                          ║
║  2. CLARIFY    Resolve ambiguities with Q&A                             ║
║       ↓        → Approval Gate: Confirm clarifications                  ║
║                                                                          ║
║  3. PLAN       Create technical architecture                             ║
║       ↓        → Approval Gate: Review plan.md + artifacts              ║
║                                                                          ║
║  4. ANALYZE    Cross-artifact consistency check                          ║
║       ↓        → Approval Gate: Address any issues                      ║
║                                                                          ║
║  5. TASKS      Generate implementation tasks                             ║
║       ↓        → Approval Gate: Review tasks.md                         ║
║                                                                          ║
║  6. RUN        Execute tasks with subagents                              ║
║       ↓        → Approval Gate: Review implementation                   ║
║                                                                          ║
║  7. TEST       Run comprehensive test suite                              ║
║       ↓        → Approval Gate: Review test results                     ║
║                                                                          ║
║  8. VERIFY     Validate against acceptance criteria                      ║
║       ↓        → Approval Gate: Accept feature                          ║
║                                                                          ║
║  9. RELEASE    Prepare changelog and release notes                       ║
║       ↓        → Product agent prepares release artifacts               ║
║                                                                          ║
║  ✅ COMPLETE   Ready for PR/merge                                        ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Quick Start

**CRITICAL**: Each stage outputs `FEATURE_DIR`. You MUST pass it to subsequent commands.

```bash
# 1. Create specification
/speckit.specify "your feature description"
# → Wait for approval, note FEATURE_DIR from output

# 2. Clarify (after approval)
/speckit.clarify
# Input: FEATURE_DIR: {path from step 1}
# → Answer questions, wait for approval

# 3. Plan (after approval)
/speckit.plan
# Input: FEATURE_DIR: {path from step 1}
# → Wait for approval

# 4. Analyze (after approval)
/speckit.analyze
# Input: FEATURE_DIR: {path from step 1}
# → Wait for approval

# 5. Tasks (after approval)
/speckit.tasks
# Input: FEATURE_DIR: {path from step 1}
# → Wait for approval

# 6. Run (after approval)
/speckit.run
# Input: FEATURE_DIR: {path from step 1}
# → Wait for approval

# 7. Test (after approval)
/sc:test --comprehensive
# Input: FEATURE_DIR: {path from step 1}
# → Wait for approval

# 8. Verify (after approval)
/sc:verify
# Input: FEATURE_DIR: {path from step 1}
# → Accept feature

# 9. Release (after acceptance) - MANDATORY
/speckit.release
# Input: FEATURE_DIR: {path from step 1}
# → Product agent prepares release artifacts
```

## Stage Details

### Stage 1: SPECIFY (Opus)
**Command**: `/speckit.specify "feature description"`
**Creates**: `spec.md` with requirements, user stories, acceptance criteria
**Approval Gate**: Review spec for completeness and accuracy
**Model**: Opus (complex reasoning for requirements analysis)

### Stage 2: CLARIFY (Opus)
**Command**: `/speckit.clarify` with `FEATURE_DIR: {path}`
**Updates**: `spec.md` with clarified requirements
**Process**: Agent presents questions with recommendations, you answer
**Approval Gate**: Confirm all clarifications are accurate
**Model**: Opus (nuanced understanding of requirements)

### Stage 3: PLAN (Opus)
**Command**: `/speckit.plan` with `FEATURE_DIR: {path}`
**Creates**: `plan.md`, `data-model.md`, `contracts/`, `research.md`
**Approval Gate**: Review technical decisions and architecture
**Model**: Opus (architectural decisions)

### Stage 4: ANALYZE (Opus)
**Command**: `/speckit.analyze` with `FEATURE_DIR: {path}`
**Checks**: Consistency across spec, plan, and tasks
**Approval Gate**: Address any inconsistencies or gaps
**Model**: Opus (structured analysis)

### Stage 5: TASKS (Opus)
**Command**: `/speckit.tasks` with `FEATURE_DIR: {path}`
**Creates**: `tasks.md` with phased, dependency-ordered tasks
**Approval Gate**: Review task breakdown and groupings
**Model**: Opus (structured task generation)

### Stage 6: RUN (Opus orchestrator, Opus subagents)
**Command**: `/speckit.run` with `FEATURE_DIR: {path}`
**Executes**: Spawns subagents per group, parallel where possible
**Self-Verification**: Each subagent must pass typecheck, lint, tests before reporting done
**Bruno Requirement**: Any API changes MUST include Bruno files
**Playwright Requirement**: User story subagents MUST visually verify features work (see below)
**Approval Gate**: Review implementation results + Playwright verification evidence
**Model**: Opus orchestrator; all subagents use Opus

#### Playwright E2E Verification (MANDATORY for User Stories)

```
╔══════════════════════════════════════════════════════════════════════════╗
║                PLAYWRIGHT VERIFICATION REQUIREMENT                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  Every User Story subagent (US1, US2, US3, etc.) MUST:                  ║
║                                                                          ║
║  1. DISCOVER PORTS: Run .claude/scripts/get-dev-ports.sh first          ║
║                                                                          ║
║  2. TAKE BEFORE SCREENSHOT:                                              ║
║     - browser_navigate to the feature page                               ║
║     - browser_snapshot to verify initial state                           ║
║     - browser_take_screenshot → save as {USx}-before.png                 ║
║                                                                          ║
║  3. INTERACT WITH FEATURE:                                               ║
║     - browser_click, browser_type to test functionality                  ║
║     - Verify all acceptance criteria from spec.md                        ║
║                                                                          ║
║  4. TAKE AFTER SCREENSHOT:                                               ║
║     - browser_snapshot to verify expected state change                   ║
║     - browser_take_screenshot → save as {USx}-after.png                  ║
║                                                                          ║
║  5. CHECK FOR ERRORS:                                                    ║
║     - browser_console_messages to verify no errors                       ║
║     - Document any warnings or issues                                    ║
║                                                                          ║
║  6. REPORT VERIFICATION TABLE:                                           ║
║     | Step | Action | Expected | Actual | Status |                       ║
║     |------|--------|----------|--------|--------|                       ║
║                                                                          ║
║  ⚠️  ORCHESTRATOR WILL REJECT groups missing this evidence!             ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

**Verification Artifacts Required**:
- `{FEATURE_DIR}/verification/{USx}-before.png` - Screenshot before interaction
- `{FEATURE_DIR}/verification/{USx}-after.png` - Screenshot after interaction
- Verification table in subagent completion report
- "Console Errors: None" confirmation

### Stage 7: TEST (Opus)
**Command**: `/sc:test --comprehensive` with `FEATURE_DIR: {path}`
**Runs**: Unit, integration, E2E, Bruno API, accessibility, performance tests
**Approval Gate**: Review test results and coverage
**Model**: Opus (test execution)

### Stage 8: VERIFY (Opus)
**Command**: `/sc:verify` with `FEATURE_DIR: {path}`
**Validates**: Implementation against spec acceptance criteria
**Approval Gate**: Accept or reject the feature
**Model**: Opus (validation checks)

### Stage 9: RELEASE (Product) - MANDATORY
**Command**: `/speckit.release` with `FEATURE_DIR: {path}`
**Creates**: Changelog entries, release notes, version bumping
**Process**: Product agent analyzes implemented changes and prepares release artifacts
**Artifacts**:
- Changelog entry with user-facing description
- Release notes highlighting key changes
- Version bump suggestions (semver)
- Migration notes (if applicable)
**Approval Gate**: Review release artifacts before merge
**Model**: Product agent (user-centric communication)

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    RELEASE STAGE IS MANDATORY                            ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  After /sc:verify acceptance, you MUST run /speckit.release:            ║
║                                                                          ║
║  1. Product agent reviews all implemented changes                        ║
║  2. Generates user-facing changelog entry                                ║
║  3. Creates release notes with impact summary                            ║
║  4. Suggests appropriate version bump                                    ║
║  5. Documents any breaking changes or migrations                         ║
║                                                                          ║
║  ⚠️  Feature is NOT complete until release artifacts are ready!         ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Approval Response Options

At each gate, respond with:
- **[A] APPROVE** - Proceed to next stage
- **[B] REVISE/FIX** - Make changes before proceeding
- **[C] REJECT** - Go back to earlier stage
- **[D] PAUSE** - Review and return later

## When to Use This Workflow

Use the full spec-driven workflow when:
- Feature spans 3+ files
- Involves database schema changes
- Adds new API endpoints
- Modifies authentication/authorization
- Has complex business logic
- Needs coordination across frontend/backend

## When to Skip Stages

For simpler changes:
- **Skip CLARIFY**: If spec is already clear and unambiguous
- **Skip ANALYZE**: For small features with few artifacts
- **Never skip**: SPECIFY, PLAN, TASKS, RUN, TEST, VERIFY, RELEASE

## Output Location

All artifacts are created in `specs/NNN-feature-name/`:
```
specs/002-model-autocomplete/
├── spec.md           # Requirements and acceptance criteria
├── plan.md           # Technical architecture
├── tasks.md          # Implementation tasks
├── data-model.md     # Database schema (if applicable)
├── contracts/        # API contracts (if applicable)
├── research.md       # Research findings (if applicable)
└── checklists/       # Domain checklists (if applicable)
```

## Troubleshooting

**"FEATURE_DIR not found"**
- Ensure you pass `FEATURE_DIR: /path/to/spec` in the command input
- Check the output of the previous stage for the exact path

**"Tests failing after RUN"**
- Subagents should self-verify before completing
- Check lessons-learned.md for patterns
- Use `/speckit.run --retry {group}` to re-run failed groups

**"Bruno files missing"**
- Any task that modifies `services/api/src/routes/` MUST create Bruno files
- Check `api-collections/` for missing endpoints
- Verification will fail without Bruno files

**"Playwright verification missing"**
- Every User Story group (US1, US2, etc.) MUST have Playwright verification
- Check `{FEATURE_DIR}/verification/` for screenshot files
- Subagent must include verification table in completion report
- Use `/speckit.run --retry {USx}` to re-run with explicit Playwright instructions

**"Console errors in Playwright check"**
- Check `browser_console_messages` output for specific errors
- Common issues: 404 routes, CORS errors, API response mismatches
- Fix the underlying issue and re-run the group

**"Feature works locally but fails in verification"**
- Ensure dev server is running before Playwright verification
- Run `.claude/scripts/get-dev-ports.sh` to get correct URLs
- Never hardcode ports - always discover dynamically

## Context Preservation

Knowledge persists across sessions via:
- **Specs**: `specs/` (git-tracked)
- **Constitution**: `.specify/memory/constitution.md`
- **Lessons Learned**: `.specify/memory/lessons-learned.md`
- **Commands**: `.claude/commands/`

Always read `PROJECT_INDEX.md` at session start for codebase context.
