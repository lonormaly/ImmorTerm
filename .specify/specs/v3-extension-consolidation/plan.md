# Implementation Plan: ImmorTerm v3 Full Extension Consolidation

**Branch**: `v3-extension-consolidation` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `./spec.md`

## Summary

Convert ImmorTerm from a multi-component system (8 bash scripts + VS Code extension + Restore Terminals dependency + jq dependency) into a single, self-contained VS Code Marketplace extension with zero external dependencies beyond GNU Screen. The extension will:

1. Handle terminal restoration natively using VS Code's `createTerminal` API (replacing Restore Terminals extension)
2. Convert 6 bash scripts to TypeScript within the extension (replacing jq dependency)
3. Bundle 2 bash scripts (screen-auto, screen-mem) that require `exec` or screenrc integration
4. Provide a seamless v2 to v3 migration path

## Technical Context

**Language/Version**: TypeScript 5.x with ES2020 target, strict mode enabled
**Primary Dependencies**:
- VS Code Extension API (`@types/vscode ^1.74.0`)
- Node.js built-in modules (`child_process`, `fs/promises`, `path`)
- GNU Screen (external system dependency - unchanged)

**Storage**: File-based JSON state
- VS Code Workspace State API for terminal metadata
- File system for logs (`/.vscode/terminals/logs/`)
- Bundled bash scripts extracted to `/.vscode/terminals/`

**Testing**:
- VS Code Extension Testing Framework (`@vscode/test-electron`)
- Jest for unit testing TypeScript modules
- Manual E2E testing with various terminal scenarios

**Target Platform**:
- macOS (primary)
- Linux (full support)
- Windows WSL2 (supported)
- Windows native (not supported)

**Project Type**: Single VS Code extension (TypeScript)

**Performance Goals**:
- Terminal creation: <500ms (currently ~200ms)
- Extension activation: <1s
- JSON operations: <10ms
- State sync: <50ms

**Constraints**:
- Extension bundle size: <1MB
- Memory usage: <50MB
- No external dependencies beyond GNU Screen
- Backward compatible with existing Screen sessions

**Scale/Scope**:
- Support up to 50 terminals per workspace
- Log files up to 300MB with automatic truncation
- Multi-root workspace support (per-folder isolation)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: No constitution.md file exists for the immorterm project. Creating with minimal gates for a VS Code extension project.

### Applicable Gates

| Gate | Status | Notes |
|------|--------|-------|
| TypeScript strict mode | PASS | Already enabled in tsconfig.json |
| Single external dependency | PASS | Only GNU Screen required |
| No database needed | PASS | File-based JSON state |
| No API contracts needed | PASS | Local extension, not a server |
| VS Code API version | PASS | Targeting ^1.74.0 (stable) |

### Post-Design Re-Check

To be validated after Phase 1:
- [ ] All scripts converted maintain same behavior
- [ ] Workspace storage schema is complete
- [ ] Migration path preserves existing Screen sessions
- [ ] No new external dependencies introduced

## Project Structure

### Documentation (this feature)

```text
.specify/specs/v3-extension-consolidation/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output - VS Code API patterns
├── quickstart.md        # Phase 1 output - Development setup
└── tasks.md             # Phase 2 output - NOT created by /speckit.plan
```

### Source Code (repository root)

```text
immorterm/
├── src/
│   └── extension/           # VS Code extension (existing, to be expanded)
│       ├── package.json     # Extension manifest (to be enhanced)
│       ├── tsconfig.json    # TypeScript config (existing)
│       ├── src/
│       │   ├── extension.ts           # Entry point (to be expanded)
│       │   ├── activation.ts          # NEW: Screen detection, init
│       │   ├── terminal/
│       │   │   ├── manager.ts         # NEW: Terminal lifecycle
│       │   │   ├── restoration.ts     # NEW: Built-in restoration
│       │   │   ├── naming.ts          # REFACTOR: From existing extension.ts
│       │   │   └── screen-integration.ts  # NEW: Screen CLI wrapper
│       │   ├── commands/
│       │   │   ├── reconcile.ts       # CONVERT: From screen-reconcile
│       │   │   ├── cleanup.ts         # CONVERT: From screen-cleanup
│       │   │   ├── forget.ts          # CONVERT: From screen-forget
│       │   │   ├── forget-all.ts      # CONVERT: From screen-forget-all
│       │   │   ├── log-cleanup.ts     # CONVERT: From log-cleanup
│       │   │   └── kill-all.ts        # CONVERT: From kill-screens
│       │   ├── storage/
│       │   │   ├── workspace-state.ts # NEW: VS Code workspace storage
│       │   │   └── migration.ts       # NEW: v2 -> v3 migration
│       │   ├── claude/
│       │   │   ├── sync.ts            # KEEP: Existing claude-sync.ts
│       │   │   └── resume.ts          # NEW: Auto-resume (P1 - post-MVP)
│       │   ├── ui/
│       │   │   ├── status-bar.ts      # NEW: Status bar item
│       │   │   └── notifications.ts   # NEW: User notifications
│       │   └── utils/
│       │       ├── screen-commands.ts # NEW: Screen CLI wrapper
│       │       ├── process.ts         # NEW: Process detection
│       │       ├── json-utils.ts      # KEEP: Existing json-utils.ts
│       │       └── logger.ts          # NEW: Debug logging
│       ├── resources/
│       │   ├── screen-auto            # BUNDLE: Bash script (requires exec)
│       │   ├── screen-mem             # BUNDLE: Bash script (screenrc dep)
│       │   └── screenrc.template      # BUNDLE: Screen config template
│       └── test/
│           ├── unit/
│           │   ├── storage.test.ts
│           │   ├── reconcile.test.ts
│           │   └── cleanup.test.ts
│           └── integration/
│               └── terminal-lifecycle.test.ts
├── src/scripts/             # LEGACY: Original bash scripts (keep for reference)
├── src/templates/           # Template files for installation
├── docs/                    # Documentation
└── README.md                # Project README
```

**Structure Decision**: Single VS Code extension with modular internal architecture. The extension consolidates all functionality that was previously split across multiple components. Bash scripts are bundled as resources and extracted on first activation.

## Complexity Tracking

No constitution violations requiring justification. The design follows KISS and minimalism principles:

| Design Choice | Rationale |
|--------------|-----------|
| File-based JSON storage | VS Code workspace state + JSON files - simple, debuggable |
| Bundled bash scripts | screen-auto requires `exec`, screen-mem for screenrc backtick |
| No build tooling beyond tsc | Extension is simple enough without webpack/esbuild |
| Sequential activation | Simpler than parallel, activation time <1s is acceptable |

## Script Conversion Matrix

| Script | Lines | jq Usage | TypeScript Module | Priority |
|--------|-------|----------|-------------------|----------|
| screen-reconcile | 54 | Yes (JSON read/write) | commands/reconcile.ts | P0 |
| screen-cleanup | 37 | Yes (JSON filter) | commands/cleanup.ts | P0 |
| screen-forget | 48 | Yes (JSON filter) | commands/forget.ts | P0 |
| screen-forget-all | 54 | Yes (JSON read/write) | commands/forget-all.ts | P0 |
| log-cleanup | 47 | No | commands/log-cleanup.ts | P0 |
| kill-screens | 31 | No | commands/kill-all.ts | P0 |
| screen-auto | 214 | No | resources/screen-auto (keep bash) | N/A |
| screen-mem | 47 | No | resources/screen-mem (keep bash) | N/A |

## Key Implementation Decisions

### D1: Storage Strategy
**Decision**: Hybrid storage - VS Code workspaceState for metadata, file system for logs and scripts

**Rationale**:
- workspaceState: Proper API for cross-session persistence, automatic JSON serialization
- File system: Required for Screen log files and bundled scripts
- No restore-terminals.json dependency (v3 owns terminal restoration)

### D2: Terminal Restoration Approach
**Decision**: Use VS Code `onDidOpenTerminal` event + `createTerminal` API

**Rationale**:
- Built-in API is stable and well-documented
- No dependency on third-party extensions
- Full control over restoration timing and error handling

### D3: Script Bundling
**Decision**: Bundle bash scripts in extension resources, extract to .vscode/terminals/ on activation

**Rationale**:
- Scripts remain visible and editable by users (matches v2 UX)
- Easy to debug and inspect
- screen-auto requires project-relative paths for Screen session naming

### D4: Migration Strategy
**Decision**: Non-destructive migration with backup and rollback capability

**Rationale**:
- v2 users have existing Screen sessions that must survive migration
- restore-terminals.json contains terminal metadata to import
- Backup allows rollback if migration fails
