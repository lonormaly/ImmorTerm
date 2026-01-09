# Quickstart: ImmorTerm v3 Development

**Date**: 2026-01-07 | **Plan**: [plan.md](./plan.md)

## Prerequisites

- **Node.js** 18+ (for VS Code extension development)
- **VS Code** 1.74+ (target platform)
- **GNU Screen** (system dependency)
- **TypeScript** 5.x (dev dependency)

## Repository Structure

```
immorterm/
├── src/
│   └── extension/           # VS Code extension (main development area)
│       ├── package.json     # Extension manifest
│       ├── tsconfig.json    # TypeScript config
│       ├── src/             # TypeScript source
│       ├── resources/       # Bundled bash scripts
│       └── test/            # Test files
├── src/scripts/             # Reference bash scripts (v2)
└── docs/                    # Documentation
```

## Quick Start

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/lonormaly/ImmorTerm.git
cd ImmorTerm

# Install extension dependencies
cd src/extension
npm install
```

### 2. Open in VS Code

```bash
# Open the extension folder in VS Code
code src/extension
```

### 3. Compile TypeScript

```bash
# One-time compile
npm run compile

# Watch mode (recommended for development)
npm run watch
```

### 4. Launch Extension Development Host

1. Press `F5` in VS Code (or Run > Start Debugging)
2. A new VS Code window opens with the extension loaded
3. Test extension features in the new window

### 5. Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "workspace storage"
```

## Development Workflow

### Making Changes

1. Edit TypeScript files in `src/extension/src/`
2. Watch mode automatically recompiles
3. Press `Ctrl+Shift+F5` (or `Cmd+Shift+F5` on Mac) to reload extension

### Adding New Commands

1. Add command to `package.json` contributes.commands
2. Register handler in `extension.ts` activate function
3. Add keybinding if needed in contributes.keybindings

### Testing with Real Screen Sessions

```bash
# In Extension Development Host terminal:

# Create a test screen session
screen -S test-session

# List sessions
screen -ls

# Detach (Ctrl+A, D)
# Reattach
screen -r test-session
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/extension.ts` | Extension entry point, activate/deactivate |
| `src/terminal/manager.ts` | Terminal lifecycle management |
| `src/terminal/restoration.ts` | Built-in terminal restoration |
| `src/commands/reconcile.ts` | Terminal registration (converted script) |
| `src/storage/workspace-state.ts` | Persistent storage |
| `src/utils/screen-commands.ts` | Screen CLI wrapper |
| `package.json` | Extension manifest, commands, settings |

## Extension Manifest (package.json)

Key sections to update for v3:

```json
{
  "name": "immorterm",
  "displayName": "ImmorTerm",
  "description": "Terminals that survive VS Code crashes",
  "version": "3.0.0",
  "publisher": "lonormaly",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": ["Other", "Terminal"],
  "keywords": ["terminal", "persistence", "screen", "crash", "restore"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      { "command": "immorterm.forgetTerminal", "title": "ImmorTerm: Forget Current Terminal" },
      { "command": "immorterm.forgetAllTerminals", "title": "ImmorTerm: Forget All Terminals" },
      { "command": "immorterm.cleanupStale", "title": "ImmorTerm: Cleanup Stale Sessions" },
      { "command": "immorterm.killAllScreens", "title": "ImmorTerm: Kill All Screen Sessions" },
      { "command": "immorterm.showStatus", "title": "ImmorTerm: Show Status" },
      { "command": "immorterm.syncNow", "title": "ImmorTerm: Sync Now" },
      { "command": "immorterm.migrateFromV2", "title": "ImmorTerm: Migrate from v2" }
    ],
    "keybindings": [
      { "command": "immorterm.forgetTerminal", "key": "ctrl+shift+q q", "when": "terminalFocus" },
      { "command": "immorterm.forgetAllTerminals", "key": "ctrl+shift+q a", "when": "terminalFocus" }
    ],
    "configuration": {
      "title": "ImmorTerm",
      "properties": {
        "immorterm.scrollbackBuffer": { "type": "number", "default": 50000 },
        "immorterm.historyOnAttach": { "type": "number", "default": 20000 },
        "immorterm.terminalRestoreDelay": { "type": "number", "default": 800 },
        "immorterm.restoreOnStartup": { "type": "boolean", "default": true },
        "immorterm.maxLogSizeMb": { "type": "number", "default": 300 },
        "immorterm.logRetainLines": { "type": "number", "default": 50000 },
        "immorterm.enableDebugLog": { "type": "boolean", "default": false },
        "immorterm.closeGracePeriod": { "type": "number", "default": 60000 },
        "immorterm.autoCleanupStale": { "type": "boolean", "default": true },
        "immorterm.statusBarEnabled": { "type": "boolean", "default": true }
      }
    }
  }
}
```

## Debugging Tips

### View Extension Logs

```typescript
// In your code
const outputChannel = vscode.window.createOutputChannel('ImmorTerm');
outputChannel.appendLine('Debug message here');
outputChannel.show(); // Opens Output panel
```

View in: Output panel > dropdown > "ImmorTerm"

### Debug Screen Commands

```typescript
// Add verbose logging for screen commands
const { stdout, stderr } = await execAsync('screen -ls');
console.log('screen -ls output:', stdout);
console.log('screen -ls stderr:', stderr);
```

### Test Workspace State

```typescript
// Debug workspace state
const state = context.workspaceState.get('immorterm.terminalState');
console.log('Current state:', JSON.stringify(state, null, 2));
```

## Common Tasks

### Add a New Command

1. **package.json**: Add to `contributes.commands`
2. **extension.ts**: Register command handler

```typescript
// In activate()
context.subscriptions.push(
  vscode.commands.registerCommand('immorterm.newCommand', async () => {
    // Implementation
  })
);
```

### Add a New Setting

1. **package.json**: Add to `contributes.configuration.properties`
2. **Code**: Read with `vscode.workspace.getConfiguration('immorterm').get('settingName')`

### Convert a Bash Script

1. Read the original script in `src/scripts/`
2. Create TypeScript module in `src/extension/src/commands/`
3. Replace jq calls with native JSON operations
4. Replace shell commands with `child_process.exec`
5. Add tests in `src/extension/test/`

## Building for Production

```bash
cd src/extension

# Compile TypeScript
npm run compile

# Package VSIX
npx vsce package

# Output: immorterm-3.0.0.vsix
```

## Testing Migration

1. Set up a v2 installation in a test project
2. Install the v3 extension
3. Verify migration prompt appears
4. Check Screen sessions survive migration
5. Verify terminals restore correctly

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [GNU Screen Manual](https://www.gnu.org/software/screen/manual/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
