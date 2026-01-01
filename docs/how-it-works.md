# How ImmorTerm Works

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Terminal 1  │  │ Terminal 2  │  │ Terminal 3  │              │
│  │ (api)       │  │ (frontend)  │  │ (tests)     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Terminal Name Sync Extension            │        │
│  │          (syncs names to JSON on change)            │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      screen-auto                                 │
│               (creates/attaches sessions)                        │
└─────────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GNU Screen Daemon                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ proj-123-ab │  │ proj-456-cd │  │ proj-789-ef │              │
│  │  (detached) │  │  (detached) │  │  (detached) │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Log Files                                 │
│     .vscode/terminals/logs/{session-name}.log                   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Terminal Profile

VS Code is configured with a custom terminal profile that runs `screen-auto` instead of your default shell:

```json
{
  "terminal.integrated.profiles.linux": {
    "Project (Screen)": {
      "path": "/bin/zsh",
      "args": ["-c", "exec ${workspaceFolder}/.vscode/terminals/screen-auto"]
    }
  }
}
```

### 2. screen-auto Script

When you open a terminal:

1. **New Terminal**: Generates unique ID (`$$-{random}`)
2. **Creates Pending File**: `.vscode/terminals/pending/{id}`
3. **Spawns Reconciler**: Updates `restore-terminals.json` in background
4. **Creates Screen Session**: With logging enabled
5. **Attaches to Session**: `screen -xRR -S {project}-{id}`

```bash
# Session naming convention
{project-name}-{pid}-{random8chars}
# Example: myproject-12345-a1b2c3d4
```

### 3. screen-reconcile Script

Runs in background to update `restore-terminals.json`:

1. Uses lock file to prevent race conditions
2. Reads pending files from `.vscode/terminals/pending/`
3. Adds entries to JSON (with deduplication)
4. Cleans up pending files

### 4. Restore Terminals Extension

Third-party extension that:
- Reads `restore-terminals.json` on VS Code startup
- Creates terminals with saved configurations
- Runs the configured command (`screen-auto {id}`)

### 5. Terminal Name Sync Extension

Custom extension that:
- Watches for terminal name changes
- Updates `restore-terminals.json` with new names
- Syncs periodically (every 10 minutes)

## Session Lifecycle

### Creation Flow

```
User opens terminal
        │
        ▼
Terminal profile runs screen-auto
        │
        ▼
screen-auto generates unique ID
        │
        ▼
Creates pending file (non-blocking)
        │
        ▼
Spawns screen-reconcile (background)
        │
        ▼
Creates detached screen session
        │
        ▼
Attaches user to session
```

### Restore Flow

```
VS Code starts
        │
        ▼
Restore Terminals extension reads JSON
        │
        ▼
Creates terminal for each entry
        │
        ▼
Runs: screen-auto {saved-id}
        │
        ▼
screen-auto sees existing session
        │
        ▼
Attaches to existing screen session
        │
        ▼
User sees previous output + running commands
```

### Cleanup Flow

```
User runs screen-forget
        │
        ▼
Removes entry from restore-terminals.json
        │
        ▼
Deletes log file
        │
        ▼
Kills screen session
```

## File Locations

| File | Purpose |
|------|---------|
| `~/.screenrc` | Global screen configuration |
| `.vscode/terminals/screenrc` | Project screen configuration |
| `.vscode/terminals/screen-auto` | Main session manager |
| `.vscode/terminals/screen-reconcile` | JSON synchronizer |
| `.vscode/terminals/screen-cleanup` | Stale entry remover |
| `.vscode/terminals/screen-forget` | Single terminal remover |
| `.vscode/terminals/screen-forget-all` | Full reset |
| `.vscode/terminals/pending/` | Pending terminal files |
| `.vscode/terminals/logs/` | Terminal output logs |
| `.vscode/restore-terminals.json` | Restore Terminals config |
| `/tmp/immorterm-{project}.lock` | Lock directory |

## Concurrency Handling

### Lock Files

Operations that modify `restore-terminals.json` use lock directories:

```bash
# Lock acquisition
if mkdir "$LOCKFILE" 2>/dev/null; then
    trap 'rm -rf "$LOCKFILE"' EXIT
    # Safe to modify JSON
fi
```

### Pending Files Pattern

Instead of direct JSON writes, terminals create pending files:

```bash
# Each terminal writes its own file (no contention)
echo "$WINDOW" > "$PENDING_DIR/$WINDOW"

# Reconciler processes all pending files (serialized)
for pending_file in "$PENDING_DIR"/*; do
    # Add to JSON with lock protection
done
```

## Platform Differences

### macOS
- Uses Homebrew for screen installation
- Terminal profile in `terminal.integrated.profiles.osx`

### Linux
- Package manager detection (apt, dnf, pacman, zypper)
- Terminal profile in `terminal.integrated.profiles.linux`

### WSL2
- Uses apt for installation
- Shares configuration with Linux
- Works through VS Code Remote - WSL extension
