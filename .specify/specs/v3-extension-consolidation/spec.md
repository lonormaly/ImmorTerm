# ImmorTerm v3: Full Extension Consolidation

## Document Control
| Field | Value |
|-------|-------|
| Spec ID | v3-extension-consolidation |
| Version | 1.0.0 |
| Status | Ready for Approval |
| Author | Product Team |
| Created | 2026-01-07 |
| Target Release | v3.0.0 |

---

## Executive Summary

Convert ImmorTerm from a multi-component system (8 bash scripts + VS Code extension + Restore Terminals dependency + jq dependency) into a single, self-contained VS Code Marketplace extension with zero external dependencies beyond GNU Screen.

### Key Scope Items

1. **Remove Restore Terminals dependency** - Extension handles terminal restoration natively using VS Code's createTerminal API
2. **Remove jq dependency** - All JSON manipulation moves to TypeScript (Node.js native JSON)
3. **Convert 6 scripts to TypeScript** - screen-reconcile, screen-cleanup, screen-forget, screen-forget-all, log-cleanup, kill-screens
4. **Keep 2 scripts as bash** - screen-auto (requires `exec screen`), screen-mem (used by screenrc backtick)
5. **Single Marketplace install** - No external dependencies except GNU Screen itself

**Business Impact**: Reduce installation friction from ~15 minutes to 1-click install, enabling 10x growth in adoption.

---

## Problem Statement

### The User Problem

**Who**: Developers using VS Code who lose terminal state on crashes/restarts, particularly AI workflow users (Claude Code, Copilot Chat) who lose expensive context.

**Pain Points (Severity: 1-5)**:

| Pain Point | Severity | Frequency | Current Workaround |
|------------|----------|-----------|-------------------|
| VS Code crashes kill all terminal sessions | 5 | Weekly | Manual restarting, context loss |
| AI conversation context lost on restart | 5 | Daily | Copy-paste history, re-explain context |
| Scroll history vanishes | 4 | Daily | None effective |
| Long-running processes interrupted | 4 | Weekly | External terminal apps |
| Complex installation process | 4 | One-time | Skip installation |
| Dependency on Restore Terminals extension | 3 | Ongoing | Hope it keeps working |
| jq dependency breaks on some systems | 3 | One-time | Manual JSON editing |

### Current State Analysis (v2.0.0)

**Architecture**:
```
User Machine
├── GNU Screen (system dependency)
├── jq (system dependency) ──────────────────► REMOVING
├── ~/.screenrc (global config)
├── VS Code
│   ├── Restore Terminals extension ─────────► REMOVING
│   └── ImmorTerm Name Sync extension (local)
└── Per-Project
    └── .vscode/terminals/
        ├── screen-auto (bash) ──────────────► KEEP (requires exec)
        ├── screen-reconcile (bash) ─────────► CONVERT TO TS
        ├── screen-cleanup (bash) ───────────► CONVERT TO TS
        ├── screen-forget (bash) ────────────► CONVERT TO TS
        ├── screen-forget-all (bash) ────────► CONVERT TO TS
        ├── screen-mem (bash) ───────────────► KEEP (screenrc backtick)
        ├── log-cleanup (bash) ──────────────► CONVERT TO TS
        ├── kill-screens (bash) ─────────────► CONVERT TO TS
        ├── screenrc (config)
        ├── logs/ (output)
        └── pending/ (queue)
```

**Installation Complexity (v2)**:
1. Install GNU Screen (brew/apt)
2. Install jq (brew/apt)
3. Clone repository
4. Run installer.sh interactively (7 steps)
5. Install Restore Terminals extension
6. Configure terminal profile in settings.json
7. Configure keybindings
8. Restart VS Code

**Dependencies (v2)**:
- GNU Screen (required, system-level) - KEEPING
- jq (required for JSON manipulation) - REMOVING
- Restore Terminals extension (required) - REMOVING
- zsh or bash (required for scripts) - KEEPING (for screen-auto/screen-mem only)

### Target State (v3.0.0)

**Architecture**:
```
User Machine
├── GNU Screen (system dependency - unchanged)
└── VS Code
    └── ImmorTerm Extension (marketplace)
        ├── Built-in terminal restoration (replaces Restore Terminals)
        ├── TypeScript implementations (replaces 6 bash scripts)
        ├── Native JSON parsing (replaces jq)
        ├── Bundled bash scripts (screen-auto, screen-mem)
        └── Configurable settings UI
```

**Installation (v3)**:
1. Install GNU Screen (if not present)
2. Install ImmorTerm from VS Code Marketplace
3. Done

---

## User Personas

### Primary: AI Workflow Developer (Alex)
- **Role**: Full-stack developer using Claude Code or GitHub Copilot Chat daily
- **Tech Level**: Advanced
- **Pain**: Loses expensive AI context when VS Code restarts/crashes
- **Goal**: Never lose a Claude Code session again
- **Willingness to Pay**: Would pay $10/month to solve this problem
- **Current Solution**: Keeps VS Code open 24/7, loses work when laptop restarts

### Secondary: DevOps Engineer (Sam)
- **Role**: Infrastructure engineer with multiple long-running processes
- **Tech Level**: Expert
- **Pain**: Terminal processes die when VS Code updates
- **Goal**: Persistent terminals that survive everything
- **Willingness to Pay**: Time investment acceptable if solution is reliable
- **Current Solution**: Uses tmux/screen in external terminal, loses integration

### Tertiary: Junior Developer (Jordan)
- **Role**: New developer learning from AI assistants
- **Tech Level**: Beginner to Intermediate
- **Pain**: Doesn't understand why terminals disappear
- **Goal**: Things should "just work"
- **Willingness to Pay**: Prefers free solutions
- **Current Solution**: Closes VS Code rarely, loses work often

---

## Feature Prioritization (RICE Framework)

### Scoring Legend
- **Reach**: Users affected in 6 months (1-5 scale: 1=<100, 5=>10K)
- **Impact**: Value delivered (1-5 scale: 1=minimal, 5=transformative)
- **Confidence**: Certainty we can deliver (0.5-1.0)
- **Effort**: Person-weeks (lower is better)

| Feature | Reach | Impact | Confidence | Effort | RICE Score | Priority |
|---------|-------|--------|------------|--------|------------|----------|
| Marketplace publishing | 5 | 4 | 0.8 | 1 | 16.0 | P0 - MVP |
| Built-in terminal restoration | 5 | 5 | 0.9 | 3 | 7.5 | P0 - MVP |
| VS Code settings UI | 5 | 3 | 0.9 | 2 | 6.75 | P0 - MVP |
| TypeScript script conversion | 4 | 4 | 0.95 | 4 | 3.8 | P0 - MVP |
| Claude session auto-resume | 3 | 5 | 0.7 | 3 | 3.5 | P1 - Post-MVP |
| Auto-install GNU Screen | 2 | 2 | 0.6 | 2 | 1.2 | P2 - Future |
| Web-based terminal sync | 2 | 3 | 0.4 | 6 | 0.4 | P3 - Explore |

### MVP Scope Definition

**In Scope (P0)**:
1. Single VS Code extension installable from Marketplace
2. Built-in terminal restoration (replace Restore Terminals dependency)
3. 6 scripts converted to TypeScript (no jq dependency)
4. Bundled bash scripts (screen-auto, screen-mem)
5. VS Code settings contribution for all configurable options
6. Commands for manual operations (forget, cleanup, kill-all)
7. v2 to v3 migration tooling

**Out of Scope for MVP**:
- Auto-installation of GNU Screen
- Cross-machine sync
- Web dashboard
- Windows native support (WSL only)

---

## User Stories & Acceptance Criteria

### Epic 1: One-Click Installation

#### US-1.1: Marketplace Installation
```
As a VS Code user
I want to install ImmorTerm from the VS Code Marketplace
So that I can get persistent terminals without complex setup
```

**Acceptance Criteria**:
```gherkin
Given I am in VS Code Extensions view
When I search for "ImmorTerm"
Then I should see the extension in search results
And the extension should have a verified publisher badge
And I should be able to click "Install" to install it

Given ImmorTerm is installed
When VS Code restarts
Then the extension should activate automatically
And no additional configuration should be required

Given I have ImmorTerm installed
When I open a project that previously had ImmorTerm v2 files
Then a migration prompt should appear
And I should be able to migrate with one click
```

**Technical Notes**:
- Publisher: `lonormaly` or `immorterm`
- Categories: ["Other", "Terminal"]
- Keywords: ["terminal", "persistence", "screen", "crash", "restore"]

#### US-1.2: Zero-Config Default Experience
```
As a developer who just installed ImmorTerm
I want terminals to persist automatically
So that I don't have to configure anything
```

**Acceptance Criteria**:
```gherkin
Given ImmorTerm is installed and enabled
And GNU Screen is available in PATH
When I open a new terminal
Then it should automatically use a Screen session
And I should see a status bar indicator showing ImmorTerm is active

Given ImmorTerm is installed
And GNU Screen is NOT available
When I open a new terminal
Then I should see a warning notification
And the notification should explain how to install Screen
And the terminal should still work (without persistence)
```

#### US-1.3: No jq Dependency
```
As a user installing ImmorTerm
I want the extension to work without jq
So that I don't need to install additional system tools
```

**Acceptance Criteria**:
```gherkin
Given I have ImmorTerm v3 installed
And jq is NOT installed on my system
When I use any ImmorTerm feature
Then all features should work correctly
And no "jq not found" errors should appear

Given I have terminal state stored
When the extension reads or writes terminal configuration
Then it should use Node.js native JSON parsing
And JSON operations should complete in <10ms
```

---

### Epic 2: Built-in Terminal Restoration (Replaces Restore Terminals)

#### US-2.1: Automatic Terminal Restoration
```
As a developer
I want my terminals to automatically restore when VS Code opens
So that I can continue where I left off without Restore Terminals extension
```

**Acceptance Criteria**:
```gherkin
Given I had 3 terminals open when I closed VS Code
And Restore Terminals extension is NOT installed
When I reopen VS Code in the same project
Then all 3 terminals should automatically restore
And each terminal should reconnect to its Screen session
And scroll history should be available
And any running processes should still be running

Given a terminal was running a long process
When VS Code crashed unexpectedly
Then on restart the terminal should restore
And the process should still be running in the Screen session
And output since the crash should be visible
```

**Technical Notes**:
- Use VS Code's `vscode.window.createTerminal()` API
- Implement `TerminalOptions.shellPath` pointing to bundled screen-auto script
- Store terminal state in workspace-scoped storage (not restore-terminals.json)
- Restore delay configurable via `immorterm.terminalRestoreDelay`

#### US-2.2: Terminal State Persistence
```
As a developer
I want terminal names and positions to be preserved
So that my workspace layout is consistent
```

**Acceptance Criteria**:
```gherkin
Given I renamed a terminal to "API Server"
When VS Code restarts
Then the terminal should restore with the name "API Server"
And the terminal should appear in the same tab position

Given I have split terminals (horizontal/vertical)
When VS Code restarts
Then the split layout should be preserved
And each split should reconnect to the correct Screen session
```

#### US-2.3: Graceful Degradation
```
As a developer
I want ImmorTerm to work even if Screen sessions are lost
So that I never have a broken terminal experience
```

**Acceptance Criteria**:
```gherkin
Given a Screen session was terminated externally (e.g., system restart)
When VS Code tries to restore the terminal
Then a new Screen session should be created
And a notification should inform the user
And the terminal should be functional

Given Screen is not installed
When I open a terminal
Then a standard terminal should open (no Screen)
And a persistent warning should show in status bar
```

---

### Epic 3: TypeScript Script Conversion

#### US-3.1: screen-reconcile Conversion
```
As the extension
I want to handle terminal registration in TypeScript
So that I don't need bash or jq for JSON manipulation
```

**Acceptance Criteria**:
```gherkin
Given a new terminal is created
When the terminal connects to its Screen session
Then the terminal should be registered in workspace storage
And the terminal metadata should include windowId, name, and sessionId
And no external scripts should be called for JSON operations

Given the extension detects a terminal state change
When the terminal is renamed or closed
Then workspace storage should be updated immediately
And updates should complete in <50ms
```

**Implementation Notes**:
- Replace file-based pending directory with in-memory queue
- Use VS Code workspace storage API instead of JSON files
- Implement debouncing for rapid state changes

#### US-3.2: screen-cleanup Conversion
```
As the extension
I want to automatically clean up stale terminal entries
So that orphaned Screen sessions don't accumulate
```

**Acceptance Criteria**:
```gherkin
Given there are Screen sessions without corresponding terminals
When the cleanup routine runs (on activation and periodically)
Then orphaned sessions should be identified
And orphaned sessions should be terminated
And stale entries should be removed from storage

Given a Screen session was terminated externally
When the extension activates
Then the corresponding terminal entry should be removed
And log files for dead sessions should be cleaned up
```

**Implementation Notes**:
- Parse `screen -ls` output in TypeScript
- Match against workspace storage entries
- Configurable via `immorterm.autoCleanupStale`

#### US-3.3: screen-forget Conversion
```
As a developer
I want to remove a terminal from persistence
So that it won't restore on next VS Code launch
```

**Acceptance Criteria**:
```gherkin
Given I run "ImmorTerm: Forget Current Terminal" command
When the command executes
Then the Screen session should be terminated
And the terminal entry should be removed from storage
And the log file should be deleted
And the terminal tab should close

Given I press Ctrl+Shift+Q Q in a terminal
Then the same behavior should occur
```

#### US-3.4: screen-forget-all Conversion
```
As a developer
I want to reset all terminals for a project
So that I can start fresh
```

**Acceptance Criteria**:
```gherkin
Given I run "ImmorTerm: Forget All Terminals" command
When I confirm the action
Then all Screen sessions for this project should be terminated
And all terminal entries should be removed from storage
And all log files should be deleted
And all terminal tabs should close
```

#### US-3.5: log-cleanup Conversion
```
As the extension
I want to manage log file sizes
So that disk space is not exhausted
```

**Acceptance Criteria**:
```gherkin
Given a log file exceeds immorterm.maxLogSizeMb
When the log cleanup routine runs
Then the log should be truncated to immorterm.logRetainLines
And the oldest lines should be removed

Given log cleanup is enabled (default)
When the extension activates
Then log cleanup should run automatically
And it should run periodically (every hour)
```

#### US-3.6: kill-screens Conversion
```
As a developer
I want to kill all Screen sessions for a project
So that I can reset completely
```

**Acceptance Criteria**:
```gherkin
Given I run "ImmorTerm: Kill All Screen Sessions" command
When I confirm the action
Then all Screen sessions matching the project pattern should be killed
And a confirmation notification should appear

Given there are 5 Screen sessions for the project
When I run the command
Then all 5 should be terminated
And the count should be shown in the notification
```

---

### Epic 4: Configurable Settings

#### US-4.1: Settings UI Configuration
```
As a developer
I want to configure ImmorTerm through VS Code settings
So that I can customize behavior without editing files
```

**Acceptance Criteria**:
```gherkin
Given I open VS Code Settings
When I search for "immorterm"
Then I should see all configurable options
And each option should have a description
And default values should be shown

When I change immorterm.scrollbackBuffer to 100000
Then new terminals should use the new buffer size
And existing terminals should continue with their current settings
```

**Settings Schema**:
```typescript
interface ImmorTermSettings {
  // Screen Configuration
  "immorterm.scrollbackBuffer": number;       // default: 50000
  "immorterm.historyOnAttach": number;        // default: 20000

  // Terminal Restoration
  "immorterm.terminalRestoreDelay": number;   // default: 800ms
  "immorterm.restoreOnStartup": boolean;      // default: true

  // Log Management
  "immorterm.maxLogSizeMb": number;           // default: 300
  "immorterm.logRetainLines": number;         // default: 50000
  "immorterm.enableDebugLog": boolean;        // default: false

  // Claude Integration
  "immorterm.claudeAutoResume": boolean;      // default: true
  "immorterm.claudeSyncInterval": number;     // default: 30000ms

  // Behavior
  "immorterm.closeGracePeriod": number;       // default: 60000ms
  "immorterm.autoCleanupStale": boolean;      // default: true
  "immorterm.statusBarEnabled": boolean;      // default: true

  // Naming
  "immorterm.namingPattern": string;          // default: "${project}-${n}"
}
```

---

### Epic 5: Commands & Keyboard Shortcuts

#### US-5.1: Command Palette Integration
```
As a developer
I want ImmorTerm commands available in the Command Palette
So that I can manage terminals without keyboard shortcuts
```

**Acceptance Criteria**:
```gherkin
Given I open Command Palette (Cmd/Ctrl+Shift+P)
When I type "ImmorTerm"
Then I should see these commands:
  - ImmorTerm: Forget Current Terminal
  - ImmorTerm: Forget All Terminals
  - ImmorTerm: Cleanup Stale Sessions
  - ImmorTerm: Kill All Screen Sessions
  - ImmorTerm: Show Status
  - ImmorTerm: Sync Now
  - ImmorTerm: Migrate from v2
```

#### US-5.2: Default Keybindings
```
As a power user
I want keyboard shortcuts for common operations
So that I can manage terminals efficiently
```

**Acceptance Criteria**:
```gherkin
Given I am in a terminal with focus
When I press Ctrl+Shift+Q Q
Then the current terminal should be closed properly
And the Screen session should be terminated
And the terminal should be removed from restore list

Given I am in VS Code
When I press Ctrl+Shift+Q A
Then a confirmation prompt should appear
When I confirm
Then all terminals should be closed
And all Screen sessions should be terminated
```

**Default Keybindings**:
| Shortcut | Command | Context |
|----------|---------|---------|
| Shift+Up | Focus previous terminal | terminalFocus |
| Shift+Down | Focus next terminal | terminalFocus |
| Ctrl+Shift+Q Q | Forget current terminal | terminalFocus |
| Ctrl+Shift+Q A | Forget all terminals | terminalFocus |
| Ctrl+Shift+D | Detach from Screen | terminalFocus |

---

### Epic 6: Migration from v2

#### US-6.1: Automatic Migration Detection
```
As a v2 user
I want the extension to detect my existing installation
So that I can migrate seamlessly
```

**Acceptance Criteria**:
```gherkin
Given I have ImmorTerm v2 installed (`.vscode/terminals/` exists)
When I install ImmorTerm v3 extension
Then a migration prompt should appear
And the prompt should explain what will happen
And I should be able to accept or defer migration

Given I defer migration
When I open VS Code again
Then the prompt should appear again
And I should be able to dismiss permanently
```

#### US-6.2: Migration Execution
```
As a v2 user
I want my existing terminals to be preserved
So that I don't lose my work
```

**Acceptance Criteria**:
```gherkin
Given I accept migration from v2 to v3
When migration executes
Then existing Screen sessions should be preserved
And terminal names should be imported from restore-terminals.json
And v2 files should be archived to .vscode/terminals.v2-backup/
And workspace storage should be populated with terminal state

Given migration completes successfully
Then a notification should show migration summary
And terminals should restore correctly on next VS Code launch
And Restore Terminals extension can be safely uninstalled
```

---

## Technical Architecture

### Extension Structure
```
immorterm/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── activation.ts             # Activation logic, Screen detection
│   ├── terminal/
│   │   ├── manager.ts            # Terminal lifecycle management
│   │   ├── restoration.ts        # Built-in terminal restoration
│   │   ├── naming.ts             # Auto-naming and sync
│   │   └── screen-integration.ts # Screen session handling
│   ├── commands/
│   │   ├── reconcile.ts          # Converted from screen-reconcile
│   │   ├── cleanup.ts            # Converted from screen-cleanup
│   │   ├── forget.ts             # Converted from screen-forget
│   │   ├── forget-all.ts         # Converted from screen-forget-all
│   │   ├── log-cleanup.ts        # Converted from log-cleanup
│   │   └── kill-all.ts           # Converted from kill-screens
│   ├── storage/
│   │   ├── workspace-state.ts    # Workspace-scoped storage
│   │   └── migration.ts          # v2 -> v3 migration
│   ├── claude/
│   │   ├── sync.ts               # Claude session detection
│   │   └── resume.ts             # Auto-resume functionality
│   ├── ui/
│   │   ├── status-bar.ts         # Status bar item
│   │   └── notifications.ts      # User notifications
│   └── utils/
│       ├── screen-commands.ts    # Screen CLI wrapper
│       ├── process.ts            # Process detection (ps)
│       └── logger.ts             # Debug logging
├── resources/
│   ├── screen-auto               # Bash script (bundled, requires exec)
│   ├── screen-mem                # Bash script (bundled, screenrc dep)
│   └── screenrc.template         # Screen configuration template
├── package.json                  # Extension manifest
├── tsconfig.json
└── webpack.config.js             # Bundle configuration
```

### Data Flow
```
┌────────────────────────────────────────────────────────────────────┐
│                         VS Code Extension Host                      │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐ │
│  │ Terminal Events │───▶│ Terminal Manager │───▶│ Workspace      │ │
│  │ (VS Code API)   │    │ (TypeScript)     │    │ Storage        │ │
│  └─────────────────┘    └────────┬─────────┘    └────────────────┘ │
│                                  │                                  │
│                                  ▼                                  │
│                         ┌────────────────┐                         │
│                         │ Screen Commands│                         │
│                         │ (child_process)│                         │
│                         └────────┬───────┘                         │
└──────────────────────────────────┼─────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Operating System                          │
│                                                                   │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐ │
│  │ screen-auto │───▶│ GNU Screen Daemon │◀───│ Screen Sessions │ │
│  │ (bundled)   │    │                   │    │ (per-terminal)  │ │
│  └─────────────┘    └──────────────────┘    └─────────────────┘ │
│                                                                   │
│                           ┌─────────────┐                        │
│                           │  Log Files  │                        │
│                           │ (.log)      │                        │
│                           └─────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

### Scripts Disposition Summary

| Script | Disposition | Reason |
|--------|-------------|--------|
| screen-auto | **Keep as bash** (bundled) | Requires `exec screen` which cannot be done from Node.js |
| screen-mem | **Keep as bash** (bundled) | Used by screenrc backtick command for status bar |
| screen-reconcile | **Convert to TypeScript** | JSON manipulation, use Node.js native JSON |
| screen-cleanup | **Convert to TypeScript** | File operations, screen -ls parsing |
| screen-forget | **Convert to TypeScript** | JSON manipulation, screen CLI calls |
| screen-forget-all | **Convert to TypeScript** | Batch version of forget |
| log-cleanup | **Convert to TypeScript** | File operations, log truncation |
| kill-screens | **Convert to TypeScript** | Screen CLI calls, process listing |
| screenrc | **Keep as config** (bundled) | Screen configuration template |

### Storage Schema

**Workspace State** (replaces restore-terminals.json):
```typescript
interface TerminalState {
  windowId: string;           // Unique ID: "${pid}-${random8}"
  name: string;               // Display name
  screenSession: string;      // Screen session name
  createdAt: number;          // Unix timestamp
  lastAttached: number;       // Unix timestamp
  claudeSessionId?: string;   // Claude session ID if linked
  position?: {
    tabIndex: number;
    splitDirection?: 'horizontal' | 'vertical';
    splitIndex?: number;
  };
}

interface WorkspaceState {
  version: 3;
  projectName: string;
  terminals: TerminalState[];
  lastCleanup: number;
}
```

---

## Success Metrics

### Primary KPI (North Star)
**Terminal Survival Rate**: % of terminals that successfully restore after VS Code restart
- Current (v2): ~90%
- Target (v3): >98%
- Measurement: Telemetry on restore success/failure

### Secondary KPIs

| Metric | Current (v2) | Target (v3) | Measurement |
|--------|--------------|-------------|-------------|
| Installation time | ~15 min | <2 min | User survey |
| Installation success rate | ~70% | >95% | Telemetry |
| Dependencies required | 4 (Screen, jq, Restore Terminals, bash) | 1 (Screen only) | Code audit |
| Weekly active users | ~100 | >1000 | Marketplace stats |
| Extension rating | N/A | >4.5 stars | Marketplace |
| Support tickets | ~5/week | <2/week | GitHub issues |
| Uninstall rate | Unknown | <10% | Marketplace stats |

### Counter Metrics (Should NOT Degrade)
- Terminal creation latency: <500ms (currently ~200ms)
- Memory usage: <50MB (currently ~30MB with extension)
- Extension activation time: <1s

### Validation Plan

1. **Alpha Testing** (Week 1-2)
   - Internal dogfooding with 5 developers
   - Test migration from v2
   - Collect crash reports and logs
   - Iterate on critical bugs

2. **Beta Testing** (Week 3-4)
   - Release to 50 beta users via pre-release channel
   - Test without Restore Terminals extension
   - Test without jq installed
   - Collect NPS scores

3. **Public Launch** (Week 5)
   - Marketplace publication
   - Monitor installation success rate
   - Support ticket triage
   - Announce deprecation of v2

---

## Dependencies & Risks

### Technical Dependencies
| Dependency | Type | Status | Risk | Mitigation |
|------------|------|--------|------|------------|
| GNU Screen | System | KEEPING | Medium - User must install | Clear error messages, installation guide |
| jq | System | REMOVING | N/A | Using Node.js native JSON |
| Restore Terminals | Extension | REMOVING | N/A | Built-in restoration |
| VS Code Terminal API | Platform | USING | Low - Stable API | Version compatibility testing |
| Node.js child_process | Platform | USING | Low - Core API | No mitigation needed |

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Restore Terminals users resist migration | Medium | Medium | Provide seamless migration, parallel support period |
| Screen installation issues on Windows | High | Medium | Clear documentation, WSL-only support |
| Performance regression from TypeScript conversion | Low | High | Benchmark testing, code review |
| VS Code API changes | Low | Medium | Version pinning, compatibility layer |
| Migration loses terminal state | Medium | High | Backup v2 files, rollback option |

---

## Migration Strategy (v2 to v3)

### Detection
Extension checks for:
1. `.vscode/terminals/` directory exists
2. `.vscode/terminals/screen-auto` is executable
3. `.vscode/restore-terminals.json` exists

### Migration Steps
1. **Backup**: Copy `.vscode/terminals/` to `.vscode/terminals.v2-backup/`
2. **Import**: Parse `restore-terminals.json` and populate workspace storage
3. **Preserve Sessions**: Do NOT kill existing Screen sessions
4. **Install Scripts**: Extract bundled screen-auto/screen-mem to project
5. **Configure Profile**: Update terminal profile to use bundled scripts
6. **Cleanup**: Optionally remove v2 files after successful restore

### Rollback
If migration fails:
1. Restore from `.vscode/terminals.v2-backup/`
2. Re-enable Restore Terminals extension
3. Report issue to GitHub

---

## Design Decisions

### D1: Script Bundling Strategy
**Decision**: Bundle scripts in VSIX, extract to project `.vscode/terminals/` directory on first activation

**Rationale**:
- Scripts remain visible and editable by users
- Matches v2 behavior - familiar location
- Users can customize screen-auto if needed
- Easy to debug and inspect

### D2: Multi-Root Workspace Handling
**Decision**: Per-folder terminal state (each workspace folder has its own terminals)

**Rationale**:
- Matches current v2 behavior
- Each project has isolated terminal sessions
- Avoids confusion about which folder a terminal belongs to
- Status bar shows active folder's terminal count

### D3: Restore Terminals Interoperability
**Decision**: No export support needed - import only during migration

**Rationale**:
- restore-terminals.json format is already compatible
- Users migrating from v2 already have the JSON file
- No ongoing maintenance burden for dual format support
- Users can simply uninstall Restore Terminals extension after migration

---

## Appendix

### Competitive Analysis

| Feature | ImmorTerm v3 | ImmorTerm v2 | Restore Terminals | Remote SSH | Terminal Keeper |
|---------|--------------|--------------|-------------------|------------|-----------------|
| Crash survival | Yes | Yes | No | Yes (remote) | No |
| Process persistence | Yes | Yes | No | Yes | No |
| Scroll history | Yes | Yes | No | Partial | No |
| Dependencies | Screen only | Screen, jq, RT ext | None | SSH server | None |
| Installation | 1-click | ~15 min | 1-click | 1-click | 1-click |
| Marketplace | Yes | No | Yes | Built-in | Yes |
| Configuration UI | Yes | No | Limited | Built-in | Limited |

### Related Documentation
- [GNU Screen Manual](https://www.gnu.org/software/screen/manual/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Terminal API Reference](https://code.visualstudio.com/api/references/vscode-api#Terminal)
- [Workspace State API](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.workspaceState)

### Checklist for Spec Completion
- [x] Problem statement defined
- [x] User personas identified
- [x] Features prioritized with RICE
- [x] MVP scope defined
- [x] User stories with acceptance criteria
- [x] Technical architecture documented
- [x] Scripts disposition clarified
- [x] Success metrics defined
- [x] Risks identified
- [x] Migration strategy documented
- [x] Design decisions documented (D1, D2, D3)
- [ ] Review with stakeholders
- [ ] Plan document created
- [ ] Tasks document created
