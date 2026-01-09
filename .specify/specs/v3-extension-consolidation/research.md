# Research: ImmorTerm v3 Extension Consolidation

**Date**: 2026-01-07 | **Plan**: [plan.md](./plan.md)

## Overview

This document captures research findings for converting ImmorTerm from a multi-component system to a single VS Code Marketplace extension. Key areas researched:

1. VS Code Terminal API for terminal creation and restoration
2. VS Code Storage APIs for persistent state
3. TypeScript patterns for converting bash scripts
4. Extension bundling and resource extraction

---

## 1. Terminal Creation and Restoration

### Decision: Use `createTerminal` with `shellPath` pointing to bundled script

### Rationale
VS Code's `createTerminal` API supports specifying a custom shell path, which is exactly what screen-auto needs. The API is stable (since VS Code 1.18+) and well-documented.

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| `createTerminal({ shellPath })` | Simple, direct shell replacement | Script must be executable file | CHOSEN |
| Pseudoterminal API | Full control over I/O | Overkill, would need to reimplement screen-auto in TS | Rejected |
| Terminal Profile Provider | Proper VS Code integration | Requires user to select profile | Rejected for auto-restore |

### Implementation Pattern

```typescript
// Terminal creation with custom shell (screen-auto)
import * as vscode from 'vscode';

interface TerminalState {
  windowId: string;
  name: string;
  screenSession: string;
}

function restoreTerminal(state: TerminalState, scriptsPath: string): vscode.Terminal {
  const terminal = vscode.window.createTerminal({
    name: state.name,
    shellPath: '/bin/zsh',
    shellArgs: ['-c', `exec ${scriptsPath}/screen-auto ${state.windowId} "${state.name}"`],
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  });
  return terminal;
}

// Terminal events for tracking
vscode.window.onDidOpenTerminal((terminal) => {
  // Track new terminal, update workspace state
});

vscode.window.onDidCloseTerminal((terminal) => {
  // Handle terminal close, cleanup if needed
});

// Access all terminals
const allTerminals: readonly vscode.Terminal[] = vscode.window.terminals;
```

### Key APIs

| API | Purpose | Notes |
|-----|---------|-------|
| `vscode.window.createTerminal(options)` | Create terminal with shell | Use `shellPath` + `shellArgs` |
| `vscode.window.terminals` | List all terminals | Read-only array |
| `vscode.window.onDidOpenTerminal` | Track new terminals | Fires for all terminals |
| `vscode.window.onDidCloseTerminal` | Track closed terminals | Fires when tab closes |
| `vscode.window.activeTerminal` | Get focused terminal | May be undefined |

---

## 2. Workspace Storage API

### Decision: Hybrid storage using `workspaceState` + file system

### Rationale
- `workspaceState`: Perfect for terminal metadata (JSON-serializable, automatic persistence)
- File system: Required for log files and extracted bash scripts

### Implementation Pattern

```typescript
import * as vscode from 'vscode';

interface WorkspaceTerminalState {
  version: 3;
  projectName: string;
  terminals: TerminalState[];
  lastCleanup: number;
}

export class WorkspaceStorage {
  private readonly STATE_KEY = 'immorterm.terminalState';

  constructor(private context: vscode.ExtensionContext) {}

  async getState(): Promise<WorkspaceTerminalState | undefined> {
    return this.context.workspaceState.get<WorkspaceTerminalState>(this.STATE_KEY);
  }

  async setState(state: WorkspaceTerminalState): Promise<void> {
    await this.context.workspaceState.update(this.STATE_KEY, state);
  }

  async addTerminal(terminal: TerminalState): Promise<void> {
    const state = await this.getState() || this.createDefaultState();
    state.terminals.push(terminal);
    await this.setState(state);
  }

  async removeTerminal(windowId: string): Promise<void> {
    const state = await this.getState();
    if (state) {
      state.terminals = state.terminals.filter(t => t.windowId !== windowId);
      await this.setState(state);
    }
  }

  private createDefaultState(): WorkspaceTerminalState {
    const projectName = vscode.workspace.workspaceFolders?.[0]?.name || 'unknown';
    return {
      version: 3,
      projectName: projectName.toLowerCase(),
      terminals: [],
      lastCleanup: Date.now()
    };
  }
}
```

### Storage Comparison

| Storage Type | Scope | Use Case | API |
|--------------|-------|----------|-----|
| `workspaceState` | Per workspace folder | Terminal metadata | `context.workspaceState.get/update` |
| `globalState` | All workspaces | Extension settings sync | `context.globalState.get/update` |
| `storageUri` | Per workspace (files) | Complex data, logs | `vscode.workspace.fs` |
| `globalStorageUri` | Global (files) | Shared resources | `vscode.workspace.fs` |

---

## 3. Script Conversion Patterns

### Decision: Direct TypeScript conversion with child_process for Screen CLI

### Rationale
All jq operations can be replaced with native Node.js JSON parsing. Screen CLI interactions use `child_process.exec`.

### Pattern: screen-reconcile conversion

**Original bash** (uses jq):
```bash
jq --arg name "$DISPLAY_NAME" --arg wid "$WINDOW" --arg cmd "exec .vscode/terminals/screen-auto $WINDOW $DISPLAY_NAME" '
  .terminals = (.terminals // []) |
  .terminals += [{"splitTerminals":[{"name":$name,"windowId":$wid,"shellPath":"/bin/zsh","commands":[$cmd]}]}]
' "$JSON" > "$tmp"
```

**TypeScript equivalent**:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RestoreTerminalsJson {
  terminals: Array<{
    splitTerminals: Array<{
      name: string;
      windowId: string;
      shellPath: string;
      commands: string[];
    }>;
  }>;
}

async function reconcileTerminal(
  windowId: string,
  displayName: string,
  jsonPath: string
): Promise<void> {
  const content = await fs.readFile(jsonPath, 'utf-8');
  const data: RestoreTerminalsJson = JSON.parse(content);

  // Check for duplicate
  const exists = data.terminals.some(
    t => t.splitTerminals[0]?.windowId === windowId
  );
  if (exists) return;

  // Add new terminal entry
  data.terminals.push({
    splitTerminals: [{
      name: displayName,
      windowId: windowId,
      shellPath: '/bin/zsh',
      commands: [`exec .vscode/terminals/screen-auto ${windowId} ${displayName}`]
    }]
  });

  await fs.writeFile(jsonPath, JSON.stringify(data, null, 2));
}
```

### Pattern: Screen CLI wrapper

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ScreenCommands {
  /**
   * List all screen sessions
   * Returns: Map of sessionName -> { attached: boolean, pid: number }
   */
  async listSessions(): Promise<Map<string, ScreenSession>> {
    try {
      const { stdout } = await execAsync('screen -ls');
      return this.parseScreenLs(stdout);
    } catch (error) {
      // screen -ls returns exit code 1 when no sessions
      if (error.stdout) {
        return this.parseScreenLs(error.stdout);
      }
      return new Map();
    }
  }

  /**
   * Kill a screen session
   */
  async killSession(sessionName: string): Promise<boolean> {
    try {
      await execAsync(`screen -S "${sessionName}" -X quit`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a session exists
   */
  async sessionExists(sessionName: string): Promise<boolean> {
    const sessions = await this.listSessions();
    return sessions.has(sessionName);
  }

  private parseScreenLs(output: string): Map<string, ScreenSession> {
    const sessions = new Map<string, ScreenSession>();
    // Parse: "12345.project-windowid (Attached)" or "(Detached)"
    const regex = /(\d+)\.([^\s]+)\s+\((Attached|Detached)\)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
      sessions.set(match[2], {
        pid: parseInt(match[1], 10),
        attached: match[3] === 'Attached'
      });
    }
    return sessions;
  }
}

interface ScreenSession {
  pid: number;
  attached: boolean;
}
```

---

## 4. Extension Bundling and Resource Extraction

### Decision: Bundle scripts in extension, extract to .vscode/terminals/ on activation

### Rationale
- Scripts remain visible and editable (matches v2 UX)
- screen-auto requires project-relative paths for Screen session naming
- Easy to debug and inspect

### Implementation Pattern

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export async function extractResources(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder
): Promise<string> {
  const targetDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'terminals');

  // Create directory if needed
  await fs.mkdir(targetDir, { recursive: true });

  // Resources to extract
  const resources = ['screen-auto', 'screen-mem', 'screenrc'];

  for (const resource of resources) {
    const sourcePath = path.join(context.extensionPath, 'resources', resource);
    const targetPath = path.join(targetDir, resource);

    // Check if already exists (don't overwrite user modifications)
    try {
      await fs.access(targetPath);
      continue; // File exists, skip
    } catch {
      // File doesn't exist, extract it
    }

    await fs.copyFile(sourcePath, targetPath);

    // Make executable
    await fs.chmod(targetPath, 0o755);
  }

  // Create logs directory
  await fs.mkdir(path.join(targetDir, 'logs'), { recursive: true });

  return targetDir;
}
```

### Package.json resources configuration

```json
{
  "files": [
    "out/**/*",
    "resources/**/*"
  ]
}
```

---

## 5. Migration from v2

### Decision: Non-destructive migration with backup and import

### Rationale
- Existing Screen sessions must survive (they're running processes)
- restore-terminals.json contains terminal metadata we need
- Backup allows rollback if migration fails

### Migration Flow

```typescript
export async function detectV2Installation(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<V2Installation | null> {
  const vscodePath = path.join(workspaceFolder.uri.fsPath, '.vscode');
  const terminalsPath = path.join(vscodePath, 'terminals');
  const restoreJsonPath = path.join(vscodePath, 'restore-terminals.json');

  const checks = await Promise.all([
    fs.access(terminalsPath).then(() => true).catch(() => false),
    fs.access(path.join(terminalsPath, 'screen-auto')).then(() => true).catch(() => false),
    fs.access(restoreJsonPath).then(() => true).catch(() => false)
  ]);

  if (checks.every(c => c)) {
    return {
      terminalsPath,
      restoreJsonPath,
      isV2: true
    };
  }
  return null;
}

export async function migrateFromV2(
  v2: V2Installation,
  workspaceStorage: WorkspaceStorage
): Promise<MigrationResult> {
  // 1. Backup v2 files
  const backupPath = `${v2.terminalsPath}.v2-backup`;
  await fs.cp(v2.terminalsPath, backupPath, { recursive: true });

  // 2. Parse restore-terminals.json
  const restoreJson = JSON.parse(await fs.readFile(v2.restoreJsonPath, 'utf-8'));

  // 3. Import terminal entries into workspace state
  const terminals: TerminalState[] = restoreJson.terminals.map(entry => {
    const split = entry.splitTerminals[0];
    // Extract windowId from command: "exec .vscode/terminals/screen-auto 12345-abc Name"
    const match = split.commands[0].match(/screen-auto\s+(\S+)/);
    return {
      windowId: match?.[1] || split.windowId,
      name: split.name,
      screenSession: `${projectName}-${match?.[1] || split.windowId}`
    };
  });

  await workspaceStorage.setState({
    version: 3,
    projectName,
    terminals,
    lastCleanup: Date.now()
  });

  // 4. DO NOT kill existing Screen sessions (they're still running)

  return {
    success: true,
    terminalsImported: terminals.length,
    backupPath
  };
}
```

---

## 6. Summary of Decisions

| Area | Decision | Key Rationale |
|------|----------|---------------|
| Terminal Creation | `createTerminal({ shellPath, shellArgs })` | Direct, stable API |
| Storage | `workspaceState` + file system | Best of both worlds |
| Script Conversion | Native JSON + child_process | No jq dependency |
| Resource Bundling | Extract to .vscode/terminals/ | Matches v2 UX |
| Migration | Non-destructive with backup | Preserve running sessions |

## 7. Open Questions Resolved

| Question | Resolution |
|----------|------------|
| How to restore terminals on startup? | Use `onStartupFinished` activation event, read workspaceState, call createTerminal for each |
| How to handle terminal close? | `onDidCloseTerminal` event, optionally clean up with grace period |
| How to detect Screen availability? | `which screen` on activation, show warning if missing |
| How to handle multi-root workspaces? | Per-folder storage using `workspaceState` (automatically scoped) |

---

## References

- [VS Code Terminal API](https://code.visualstudio.com/api/references/vscode-api#Terminal)
- [VS Code Extension Context](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext)
- [VS Code Workspace State](https://code.visualstudio.com/api/extension-capabilities/common-capabilities#data-storage)
- [GNU Screen Manual](https://www.gnu.org/software/screen/manual/screen.html)
