---
name: test
description: "Execute tests with coverage analysis, accessibility audits, and performance validation"
category: utility
complexity: enhanced
mcp-servers: [playwright, sequential-thinking, context7]
subagent_types: [qa, frontend, performance]
---

# /sc:test - Testing and Quality Assurance (Pexit Project Override)

**Note**: This is a project-specific override that extends the global SuperClaude `/sc:test` with specialist agent integration.

## Triggers
- Test execution requests for unit, integration, or e2e tests
- Coverage analysis and quality gate validation needs
- Continuous testing and watch mode scenarios
- Test failure analysis and debugging requirements
- Accessibility audits and WCAG compliance checks
- Performance testing and Core Web Vitals validation

## Usage
```
/sc:test [target] [--type unit|integration|e2e|a11y|perf|all] [--coverage] [--watch] [--fix]
```

**Flags:**
- `--type unit|integration|e2e|a11y|perf|all`: Test type to run
- `--a11y`: Run accessibility audit with axe-core
- `--perf`: Run Lighthouse performance audit
- `--comprehensive`: Run all test types including a11y and perf
- `--coverage`: Generate coverage report
- `--watch`: Continuous test mode
- `--fix`: Auto-fix simple failures

## Behavioral Flow
1. **Discover**: Categorize available tests using runner patterns and conventions
2. **Configure**: Set up appropriate test environment and execution parameters
3. **Execute**: Run tests with monitoring and real-time progress tracking
4. **Analyze**: Generate coverage reports and failure diagnostics
5. **Specialist Audits**: Run accessibility and performance audits if requested
6. **Report**: Provide actionable recommendations and quality metrics

## Specialist Agent Integration

Uses SuperClaude's built-in subagent_types with specialized prompts for testing domains.

```
╔══════════════════════════════════════════════════════════════════════╗
║  TESTING SPECIALISTS (SuperClaude subagent_types)                    ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  qa (--type e2e)                                                    ║
║  ─────────────────────────────────────────────────────────────────  ║
║  • subagent_type: "qa"                                              ║
║  • Execute E2E tests across browsers with Playwright                ║
║  • Validate user flows and critical paths                           ║
║  • Generate visual regression reports                               ║
║  • Quality gates: E2E pass rate >95%, no flaky tests               ║
║                                                                      ║
║  frontend + --focus accessibility (--a11y or --comprehensive)       ║
║  ─────────────────────────────────────────────────────────────────  ║
║  • subagent_type: "frontend" with accessibility-focused prompt      ║
║  • Run axe-core accessibility audit                                 ║
║  • Check WCAG 2.1 AA compliance                                     ║
║  • Validate keyboard navigation                                      ║
║  • Test color contrast (4.5:1 text, 3:1 UI)                        ║
║  • Quality gates: 0 critical violations, 0 serious violations       ║
║                                                                      ║
║  performance (--perf or --comprehensive)                            ║
║  ─────────────────────────────────────────────────────────────────  ║
║  • subagent_type: "performance"                                     ║
║  • Run Lighthouse performance audit                                 ║
║  • Measure Core Web Vitals (LCP, FID, CLS)                         ║
║  • Analyze bundle size and load times                               ║
║  • Quality gates: LCP <2.5s, FID <100ms, CLS <0.1                  ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Agent spawning logic:**
```
IF --comprehensive flag:
  Spawn in PARALLEL using Task tool:
    1. Task(subagent_type="qa", prompt="You are the QA specialist (--persona-qa --play --seq). Execute E2E tests...")
    2. Task(subagent_type="frontend", prompt="You are the ACCESSIBILITY specialist (--persona-frontend --focus accessibility --play). Run axe-core audit...")
    3. Task(subagent_type="performance", prompt="You are the PERFORMANCE specialist (--persona-performance --play --chrome). Run Lighthouse audit...")
  Wait for ALL to complete
  Aggregate results into unified report
```

## MCP Integration
- **Playwright MCP**: E2E browser testing, accessibility audits (axe-core), Lighthouse performance audits
- **Sequential MCP**: Test scenario planning, edge case analysis, failure root cause investigation
- **Context7 MCP**: Testing patterns, framework docs, accessibility best practices

## Tool Coordination
- **Bash**: Test runner execution (`bun test`, `bun run test:e2e`)
- **Glob**: Test discovery and file pattern matching
- **Grep**: Result parsing and failure analysis
- **Write**: Coverage reports and test summaries
- **Task**: Spawn specialist subagents for comprehensive testing

## Examples

### Basic Test Execution
```
/sc:test
# Discovers and runs all tests with standard configuration
# Generates pass/fail summary and basic coverage
```

### Unit Tests with Coverage
```
/sc:test src/components --type unit --coverage
# Unit tests for specific directory with detailed coverage metrics
```

### E2E Browser Testing
```
/sc:test --type e2e
# Activates Playwright MCP for cross-browser testing
# Spawns qa-e2e-specialist subagent
```

### Accessibility Audit
```
/sc:test --a11y
# Spawns accessibility-specialist subagent
# Runs axe-core audit via Playwright
# Reports WCAG 2.1 AA compliance status
```

### Performance Audit
```
/sc:test --perf
# Spawns performance-optimizer subagent
# Runs Lighthouse audit via Playwright
# Reports Core Web Vitals and bundle analysis
```

### Comprehensive Quality Check
```
/sc:test --comprehensive
# Spawns ALL THREE subagents in PARALLEL:
#   1. subagent_type="qa" → E2E tests with Playwright
#   2. subagent_type="frontend" (a11y prompt) → axe-core audit
#   3. subagent_type="performance" → Lighthouse audit
# Aggregates results into unified quality report
```

### Development Watch Mode
```
/sc:test --watch --fix
# Continuous testing with automatic simple failure fixes
# Real-time feedback during development
```

## Quality Report Format

```
══════════════════════════════════════════════════════════════
                    QUALITY ASSURANCE REPORT
══════════════════════════════════════════════════════════════

UNIT TESTS:
  ✅ Passed: 47/50 (94%)
  ❌ Failed: 3
  📊 Coverage: 82%

E2E TESTS:
  ✅ Passed: 12/12 (100%)
  🌐 Browsers: Chrome, Firefox, Safari
  ⏱️  Duration: 45s

ACCESSIBILITY (axe-core):
  ✅ Critical: 0 violations
  ✅ Serious: 0 violations
  ⚠️  Moderate: 2 violations
  📋 WCAG 2.1 AA: PASS

PERFORMANCE (Lighthouse):
  ✅ Performance: 92
  ✅ LCP: 1.8s (<2.5s)
  ✅ FID: 45ms (<100ms)
  ✅ CLS: 0.05 (<0.1)
  📦 Bundle: 420KB (<500KB)

OVERALL: ✅ PASS (with 2 moderate a11y warnings)
══════════════════════════════════════════════════════════════
```

## Approval Gate (MANDATORY for Feature/Spec Workflows)

When `/sc:test` is invoked as part of a feature/spec workflow (e.g., after `/speckit.run`), an **approval gate is MANDATORY** before proceeding to verification.

```
╔══════════════════════════════════════════════════════════════════════╗
║  APPROVAL GATE - Required for Feature/Spec Workflows                 ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  After generating the QA Test Report, you MUST:                     ║
║                                                                      ║
║  1. Present the full test report to the user                        ║
║  2. Clearly show PASS/FAIL status for each test category            ║
║  3. Highlight any issues (even pre-existing ones)                   ║
║  4. Request explicit user approval before continuing                 ║
║                                                                      ║
║  APPROVAL PROMPT FORMAT:                                             ║
║  ────────────────────────────────────────────────────────────────── ║
║  ## Your Decision Required                                           ║
║                                                                      ║
║  **[A] APPROVE** - Proceed to /sc:verify and mark spec complete     ║
║  **[B] REJECT** - List specific issues to address                   ║
║  **[C] APPROVE WITH CONDITIONS** - Approve with follow-up tasks     ║
║  ────────────────────────────────────────────────────────────────── ║
║                                                                      ║
║  DO NOT proceed to /sc:verify until user responds with approval!    ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Detection**: Feature/spec workflow is detected when:
- `--feature` flag is provided
- Running after `/speckit.run` execution
- Evidence directory exists in `specs/{feature}/evidence/`

## Boundaries

**Will:**
- Execute existing test suites using project's configured test runner
- Generate coverage reports and quality metrics
- Spawn specialist subagents for accessibility and performance audits
- Provide intelligent test failure analysis with actionable recommendations
- **Wait for user approval before proceeding to verification (in feature workflows)**

**Will Not:**
- Generate test cases or modify test framework configuration
- Execute tests requiring external services without proper setup
- Make destructive changes to test files without explicit permission
- **Proceed to /sc:verify without explicit user approval (in feature workflows)**
