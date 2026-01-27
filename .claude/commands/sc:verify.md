---
name: verify
description: "Verify feature implementation against spec acceptance criteria with manual and automated validation"
model: opus
category: utility
complexity: enhanced
mcp-servers: [playwright, sequential-thinking]
subagent_types: [qa, analyzer]
---

# /sc:verify - Acceptance Validation

Validates that a feature implementation meets all acceptance criteria defined in the spec.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

**REQUIRED**: `FEATURE_DIR:` must be provided to locate the spec with acceptance criteria.

## Triggers
- After `/sc:test --comprehensive` passes
- Final validation before marking feature complete
- User requests acceptance criteria verification

## Usage
```
/sc:verify FEATURE_DIR: /path/to/specs/NNN-feature-name
```

**Flags:**
- `--interactive`: Pause at each criterion for manual verification
- `--skip-manual`: Skip criteria requiring manual verification
- `--report-only`: Generate report without running validations

## E2E Authentication (REQUIRED for Protected Pages)

Before running Playwright verification on authenticated routes:

**Use the `e2e-auth` skill** (`.claude/skills/e2e-auth/SKILL.md`) for authentication setup.

The skill provides step-by-step instructions for:
1. Discovering ports via `.claude/scripts/get-dev-ports.sh --json`
2. Getting a session token via `./scripts/e2e-auth-setup.sh --json`
3. Setting the HttpOnly cookie correctly using `page.context().addCookies()`
4. Navigating to protected pages

**Test User**: `test@pexit.local` / `test-password-123`

## FORBIDDEN E2E Operations (COST PROTECTION)

```
╔════════════════════════════════════════════════════════════════════╗
║  🚫 NEVER trigger these during verification - they cost $$$!       ║
╠════════════════════════════════════════════════════════════════════╣
║  ❌ LoRA training (POST /api/lora/train)                           ║
║  ❌ Model fine-tuning                                               ║
║  ❌ Bulk image generation (>5 images)                               ║
║  ❌ Video generation                                                ║
╠════════════════════════════════════════════════════════════════════╣
║  For training flows: verify UI up to submit, mock the response     ║
╚════════════════════════════════════════════════════════════════════╝
```

## Behavioral Flow

1. **Load Feature Context**:
   - Read `{FEATURE_DIR}/spec.md`
   - Extract acceptance criteria from User Stories
   - Extract functional requirements
   - Load `{FEATURE_DIR}/tasks.md` to check completion status

2. **Categorize Acceptance Criteria**:
   ```
   ╔══════════════════════════════════════════════════════════════════════╗
   ║  ACCEPTANCE CRITERIA CATEGORIES                                      ║
   ╠══════════════════════════════════════════════════════════════════════╣
   ║                                                                      ║
   ║  AUTOMATED (can verify with code/tests):                            ║
   ║  • API endpoints return correct responses                           ║
   ║  • Database records are created/updated correctly                   ║
   ║  • UI components render without errors                              ║
   ║  • Form validation works as specified                               ║
   ║  • Error handling produces expected messages                        ║
   ║                                                                      ║
   ║  SEMI-AUTOMATED (need user observation):                            ║
   ║  • UI looks correct and matches design                              ║
   ║  • Loading states appear appropriately                              ║
   ║  • Animations/transitions work smoothly                             ║
   ║  • Responsive design works across breakpoints                       ║
   ║                                                                      ║
   ║  MANUAL (require human judgment):                                   ║
   ║  • User experience feels intuitive                                  ║
   ║  • Content is clear and understandable                              ║
   ║  • Feature solves the intended problem                              ║
   ║  • Edge cases are handled gracefully                                ║
   ║                                                                      ║
   ╚══════════════════════════════════════════════════════════════════════╝
   ```

## Phase 1: Technical Verification (QA Track)

3. **Execute Technical Validations** (QA Agent):
   Spawn QA subagent for technical verification:

   ```
   Task tool parameters:
     subagent_type: "qa"
     prompt: |
       Execute technical verification for feature at FEATURE_DIR: {path}

       Validate:
       - All tests pass (unit, integration, E2E): `bun run test:integration`
       - API endpoints return correct responses
       - Database operations work correctly
       - No console errors or warnings
       - Performance thresholds met

       For each automated criterion:
       - Capture evidence (test output, response, screenshot, log)
       - Mark PASS/FAIL with evidence

       For semi-automated criteria:
       - Navigate to relevant page with Playwright
       - Take screenshot for visual verification

       Return: Technical verification report with PASS/FAIL per criterion
   ```

4. **Technical Gate**:
   - If technical verification FAILS: Stop and report issues, do not proceed to Phase 2
   - If technical verification PASSES: Proceed to Phase 2

## Phase 2: Product Verification (Acceptance Track)

5. **Execute Product Validations** (Product Agent):
   Spawn Product subagent for acceptance verification:

   ```
   Task tool parameters:
     subagent_type: "product"
     prompt: |
       Execute acceptance verification for feature at FEATURE_DIR: {path}

       Read spec.md and validate:
       - All acceptance criteria satisfied
       - User stories completable end-to-end
       - Success metrics can be measured
       - No scope drift from original specification
       - Edge cases handled as specified
       - User value delivered as promised

       For manual criteria requiring human judgment:
       - Present what to verify
       - Provide steps to test
       - Ask user for PASS/FAIL verdict

       Return: Acceptance verification report with PASS/FAIL per criterion
   ```

6. **Generate Verification Report**

## Verification Report Format

```
══════════════════════════════════════════════════════════════════
                    ACCEPTANCE VALIDATION REPORT
══════════════════════════════════════════════════════════════════

Feature: {FEATURE_NAME}
Spec: {FEATURE_DIR}/spec.md
Date: {DATE}

PHASE 1: TECHNICAL VERIFICATION (QA):
──────────────────────────────────────────────────────────────────
  ✅ Unit tests: 45/45 passed
  ✅ Integration tests: 12/12 passed
  ✅ API responses: Schema validated
  ✅ Database operations: CRUD verified
  ✅ Performance: <200ms avg response time
  ✅ Console: No errors or warnings

PHASE 2: ACCEPTANCE VERIFICATION (Product):
──────────────────────────────────────────────────────────────────

USER STORIES:

US1: {User Story Title}
  Acceptance Criteria:
    ✅ AC1.1: {description} - SATISFIED
       Evidence: User flow verified, screenshots attached
    ✅ AC1.2: {description} - SATISFIED
       Evidence: Edge case handled correctly
    ❌ AC1.3: {description} - NOT MET
       Issue: {specific gap from spec}

US2: {User Story Title}
  Acceptance Criteria:
    ✅ AC2.1: {description} - SATISFIED
    ✅ AC2.2: {description} - SATISFIED
    ⏭️  AC2.3: {description} - DEFERRED (with justification)

FUNCTIONAL REQUIREMENTS:
──────────────────────────────────────────────────────────────────
  ✅ FR1: {requirement} - VERIFIED
  ✅ FR2: {requirement} - VERIFIED
  ❌ FR3: {requirement} - FAILED
     Issue: {details}

NON-FUNCTIONAL REQUIREMENTS:
──────────────────────────────────────────────────────────────────
  ✅ NFR1: Performance - API response <200ms - PASS (avg: 120ms)
  ✅ NFR2: Accessibility - WCAG 2.1 AA - PASS (0 violations)
  ⚠️  NFR3: Mobile responsive - PARTIAL (tablet OK, phone needs work)

SUMMARY:
──────────────────────────────────────────────────────────────────
  Phase 1 (Technical): ✅ PASSED
    - Tests: 57/57 passed
    - Performance: Within thresholds
    - No blocking issues

  Phase 2 (Acceptance): ❌ NEEDS FIXES
    - User Stories: 8/10 satisfied
    - Functional Reqs: 5/6 verified
    - Scope Alignment: OK

  Overall VERDICT: ❌ NEEDS FIXES

  Issues to Address:
    1. AC1.3: {issue description} (Product)
    2. FR3: {issue description} (Product)

══════════════════════════════════════════════════════════════════
```

## APPROVAL GATE (MANDATORY - DO NOT SKIP)

After presenting the verification report, present this approval request and **WAIT for user response**:

```
══════════════════════════════════════════════════════════════════
  APPROVAL REQUIRED: Feature Acceptance
══════════════════════════════════════════════════════════════════

Feature: {FEATURE_NAME}
Implementation: {FEATURE_DIR}

Verification Summary:
  | Phase | Status | Details |
  |-------|--------|---------|
  | Technical (QA) | {PASS/FAIL} | Tests: {X}/{Y}, Performance: {OK/WARN} |
  | Acceptance (Product) | {PASS/FAIL} | Stories: {X}/{Y}, Reqs: {X}/{Y} |

  | Category | Passed | Failed | Skipped |
  |----------|--------|--------|---------|
  | User Stories | {X}/{Y} | {N} | {M} |
  | Functional Reqs | {X}/{Y} | {N} | {M} |
  | Non-Functional | {X}/{Y} | {N} | {M} |

Overall: {PASS / NEEDS FIXES / FAIL}

{IF any failures}
Outstanding Issues:
  1. {Issue 1}: {brief description}
  2. {Issue 2}: {brief description}
{/IF}

══════════════════════════════════════════════════════════════════
  YOUR ACTION REQUIRED
══════════════════════════════════════════════════════════════════

Review the verification results and then respond with ONE of:
  [A] ACCEPT   - Feature is complete and ready for merge/deploy
  [B] FIX      - Address the outstanding issues
  [C] DEFER    - Accept with known issues (document in PR)
  [D] REJECT   - Feature needs significant rework

══════════════════════════════════════════════════════════════════
```

**CRITICAL**: Do NOT mark the feature complete or proceed automatically.
Wait for explicit user acceptance.

**On user acceptance [A]**:
- Update tasks.md to mark all tasks complete
- Suggest creating PR with `/sc:git pr`
- Feature workflow is COMPLETE

**On user fix request [B]**:
- List specific issues to address
- Suggest running `/speckit.run --retry {group}` for implementation fixes
- Or manual fixes for minor issues

## Validation Techniques

### API Endpoint Validation

**Preferred: Run integration tests** (requires API running via Tilt):
```bash
bun run test:integration
# Tests: tests/integration/**/*.integration.test.ts
# Validates endpoints against real running API with database
```

**Fallback: Direct API calls** (for cases not covered by tests):
```typescript
// For each API endpoint in the spec:
const response = await fetch(endpoint, { method, body, headers });
const data = await response.json();

// Validate:
// 1. Status code matches expected
// 2. Response body matches Zod schema
// 3. Required fields are present
// 4. Edge cases handled (empty, invalid input)
```

### UI Component Validation
```typescript
// Using Playwright:
await page.goto(url);

// Validate:
// 1. Component renders without errors
// 2. Required elements are present
// 3. Interactive elements work (click, type)
// 4. Screenshots for visual verification
```

### Database Validation
```typescript
// For each data operation:
// 1. Create record → verify it exists
// 2. Update record → verify changes persisted
// 3. Delete record → verify it's removed
// 4. Validate constraints (unique, foreign keys)
```

## Integration with Spec-Kit Workflow

This is the FINAL stage of the spec-kit workflow:

```
specify → clarify → plan → analyze → tasks → run → test → VERIFY
                                                              ↑
                                                          YOU ARE HERE
```

After successful verification:
- Feature is considered COMPLETE
- Ready for PR creation and merge
- Lessons learned captured in `.specify/memory/lessons-learned.md`

## Boundaries

**Will:**
- Validate implementation against spec acceptance criteria
- Run automated checks where possible
- Guide user through manual verification steps
- Generate comprehensive verification report

**Will Not:**
- Implement fixes (use `/speckit.run --retry` for that)
- Modify the spec or acceptance criteria
- Auto-pass manual verification items
- Mark feature complete without user approval
