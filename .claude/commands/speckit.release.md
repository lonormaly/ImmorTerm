---
description: Prepare feature for release with changelog, version bumping, and release notes
model: opus
handoffs:
  - label: Create PR
    agent: sc:git
    prompt: Create PR for this release
---

## Delegation

**Run as subagent to keep main context clean.**

If main agent: use the **Task tool** to spawn a subagent, then STOP:

```
Task tool parameters:
  subagent_type: "product"
  prompt: |
    Read and execute .claude/commands/speckit.release.md
    FEATURE_DIR: {path}
    Arguments: $ARGUMENTS

    Apply product release principles:
    - Determine version bump scope (major/minor/patch) based on changes
    - Write user-facing changelog entries
    - Ensure release notes communicate user value
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

**REQUIRED**: `FEATURE_DIR:` must be provided to locate the spec and tasks.

**Flags:**
- `--dry-run`: Show what would be changed without modifying files
- `--skip-changelog`: Skip CHANGELOG.md update
- `--skip-version`: Skip version bumping

## Outline

### 1. Load Feature Context

- Read `{FEATURE_DIR}/spec.md` for feature description and user stories
- Read `{FEATURE_DIR}/tasks.md` for completed work
- Identify which packages were modified:
  - Parse tasks.md for file references
  - OR run `git diff --name-only main...HEAD` to detect changed packages

### 2. Determine Version Bump Scope

Analyze the feature scope and determine version bumps:

| Scope | Trigger | Example |
|-------|---------|---------|
| **MAJOR** | Breaking changes, API incompatibility, major overhauls | Auth system redesign |
| **MINOR** | New features, backwards-compatible additions | New endpoint, new UI component |
| **PATCH** | Bug fixes, minor improvements, documentation | Fix validation, update copy |

**Decision Factors**:
- User stories scope (how significant is the user impact?)
- API changes (are there breaking changes?)
- Data model changes (do migrations affect existing data?)
- Dependency updates (are there breaking dependency changes?)

Present recommendation to user:

```
══════════════════════════════════════════════════════════════════
  VERSION BUMP RECOMMENDATION
══════════════════════════════════════════════════════════════════

Feature: {FEATURE_NAME}
Scope Assessment: {MAJOR / MINOR / PATCH}

Current Versions:
  - Root (package.json): 1.2.3
  - @pexit/providers: 0.5.1  [CHANGED]
  - services/api: 0.3.2    [CHANGED]
  - apps/web: 0.2.0        [UNCHANGED]

Recommended Bumps:
  - Root: 1.2.3 → 1.3.0 (MINOR - new feature)
  - @pexit/providers: 0.5.1 → 0.6.0 (MINOR - new capability)
  - services/api: 0.3.2 → 0.4.0 (MINOR - new endpoints)

Reasoning:
  {Explanation based on spec scope, breaking changes, user impact}

══════════════════════════════════════════════════════════════════

Approve version bumps? [Y/n/custom]
```

Wait for user confirmation before proceeding.

### 3. Update CHANGELOG.md

Create or update `CHANGELOG.md` in repo root following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Added
- {Feature description from spec - user-facing language}
- {New capability or functionality}

### Changed
- {Modifications to existing behavior}

### Fixed
- {Bug fixes if any}

### Breaking Changes
- {If major version bump - migration instructions}
```

**Format Guidelines**:
- Write from user perspective, not technical implementation
- Use active voice ("Users can now..." not "Added ability to...")
- Group related changes logically
- Include migration notes for breaking changes
- Link to spec or documentation if helpful

### 4. Update Package Versions

**Root package.json** (always bumped on any feature):
```bash
npm version {major|minor|patch} --no-git-tag-version
```

**Changed packages** (detected from tasks.md file references or git diff):
```bash
cd libs/{package} && npm version {scope} --no-git-tag-version
cd services/{service} && npm version {scope} --no-git-tag-version
cd apps/{app} && npm version {scope} --no-git-tag-version
```

**Important**: Only bump packages that were actually modified by this feature.

### 5. Generate Release Notes

Create `{FEATURE_DIR}/RELEASE_NOTES.md`:

```markdown
# Release Notes: {Feature Name}

**Version**: {X.Y.Z}
**Date**: {YYYY-MM-DD}

## What's New

{1-2 paragraph summary of the feature from user perspective. Focus on the problem solved and value delivered, not technical implementation.}

## Highlights

- **{Benefit 1}**: {Description of user value}
- **{Benefit 2}**: {Description of user value}
- **{Benefit 3}**: {Description of user value}

## Getting Started

{Brief instructions for users to access or use the new feature}

## Technical Notes

{Any migration steps, configuration changes, or breaking changes that developers need to know}

## Known Limitations

{Any known issues or limitations to be addressed in future releases}
```

### 6. Validate Metrics Instrumentation

Check that success metrics from spec are measurable:

- [ ] Analytics events implemented for key user actions
- [ ] Logging in place for KPIs
- [ ] Dashboard or monitoring configured (if applicable)

Report any gaps:
```
Metrics Validation:
  ✅ Analytics: User signup events tracked
  ✅ Logging: Generation completion logged with timing
  ⚠️  Dashboard: Not configured (recommended for v1.1)
```

### 7. Report Completion

```
══════════════════════════════════════════════════════════════════
  RELEASE PREPARATION COMPLETE
══════════════════════════════════════════════════════════════════

Feature: {FEATURE_NAME}
Version: {OLD} → {NEW}

Files Updated:
  ✅ CHANGELOG.md - Added release entry for v{version}
  ✅ package.json - Bumped to {version}
  ✅ libs/providers/package.json - Bumped to {version}
  ✅ services/api/package.json - Bumped to {version}
  ✅ {FEATURE_DIR}/RELEASE_NOTES.md - Created

Metrics Validation:
  ✅ Analytics events implemented
  ✅ Logging in place
  ⚠️  Dashboard not configured (optional)

══════════════════════════════════════════════════════════════════
  NEXT STEPS
══════════════════════════════════════════════════════════════════

1. Review CHANGELOG.md and RELEASE_NOTES.md
2. Run `/sc:git pr` to create pull request
3. After merge, create git tag:
   git tag -a v{version} -m "Release v{version}: {feature name}"
   git push origin v{version}

══════════════════════════════════════════════════════════════════
```

## Boundaries

**Will:**
- Analyze feature scope and recommend version bumps
- Update CHANGELOG.md with user-facing descriptions
- Bump package versions for root and changed packages
- Generate release notes focused on user value
- Validate metrics instrumentation

**Will Not:**
- Push changes or create tags automatically
- Create PR (use `/sc:git pr` for that)
- Merge to main branch
- Deploy to production

## Integration with Spec-Kit Workflow

This is the POST-VERIFY stage of the workflow:

```
specify → clarify → plan → analyze → tasks → run → test → verify → RELEASE
                                                                       ↑
                                                                   YOU ARE HERE
```

After successful release preparation:
- Feature is ready for PR and merge
- All artifacts documented
- Version history maintained
