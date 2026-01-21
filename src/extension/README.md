<p align="center">
  <img src="resources/icon.png" alt="ImmorTerm Logo" width="128">
</p>

# ImmorTerm

**Immortal terminals that survive VS Code crashes, restarts, and updates.**

Never lose your terminal session, running processes, or scroll history again. ImmorTerm uses GNU Screen to persist your terminals across VS Code restarts, crashes, and system reboots.

## Features

- **Session Persistence**: Terminals survive VS Code crashes, restarts, and updates
- **Auto-Restore**: Terminals automatically restore when you reopen VS Code
- **Full History**: Scroll history and running processes are preserved
- **Zero Configuration**: Works out of the box with sensible defaults
- **Status Bar**: Quick glance at terminal count and Screen status
- **Graceful Degradation**: Still works without Screen (no persistence)

## Requirements

### GNU Screen (Required for Persistence)

ImmorTerm requires GNU Screen to persist terminals. Install it for your platform:

**macOS:**
```bash
brew install screen
```

**Ubuntu/Debian:**
```bash
sudo apt-get install screen
```

**RHEL/CentOS/Fedora:**
```bash
sudo yum install screen
# or
sudo dnf install screen
```

**Arch Linux:**
```bash
sudo pacman -S screen
```

> **Note**: ImmorTerm works without Screen installed, but terminals will not persist across VS Code restarts.

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "ImmorTerm"
4. Click Install
5. Reload VS Code

That's it! Your terminals are now immortal.

## Usage

### Basic Usage

Simply open terminals as usual. ImmorTerm automatically:
- Creates a Screen session for each terminal
- Persists scroll history and running processes
- Restores terminals when VS Code restarts

### Commands

Open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P) and type "ImmorTerm":

| Command | Description |
|---------|-------------|
| **ImmorTerm: Show Status** | View all terminals and their status |
| **ImmorTerm: Forget Current Terminal** | Stop persisting the active terminal |
| **ImmorTerm: Forget All Terminals** | Stop persisting all terminals |
| **ImmorTerm: Cleanup Stale Sessions** | Remove orphaned Screen sessions |
| **ImmorTerm: Kill All Screen Sessions** | Kill all project Screen sessions |
| **ImmorTerm: Sync Now** | Manually sync terminal names |
| **ImmorTerm: Migrate from v2** | Migrate from previous version |

### Keyboard Shortcuts

| Shortcut | Command | When |
|----------|---------|------|
| `Ctrl+Shift+Q Q` | Forget Current Terminal | Terminal focused |
| `Ctrl+Shift+Q A` | Forget All Terminals | Terminal focused |

## Configuration

Access settings via File > Preferences > Settings > Extensions > ImmorTerm

### Screen Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `immorterm.scrollbackBuffer` | 50000 | Lines in Screen scrollback buffer |
| `immorterm.historyOnAttach` | 20000 | Lines shown when reattaching |

### Terminal Restoration

| Setting | Default | Description |
|---------|---------|-------------|
| `immorterm.restoreOnStartup` | true | Auto-restore terminals on VS Code start |
| `immorterm.terminalRestoreDelay` | 800 | Delay (ms) between terminal restorations |

### Log Management

| Setting | Default | Description |
|---------|---------|-------------|
| `immorterm.maxLogSizeMb` | 300 | Max total log size before cleanup |
| `immorterm.logRetainLines` | 50000 | Lines to keep when truncating |

### Behavior

| Setting | Default | Description |
|---------|---------|-------------|
| `immorterm.closeGracePeriod` | 60000 | Wait (ms) before cleanup on close |
| `immorterm.autoCleanupStale` | true | Auto-cleanup orphaned sessions |
| `immorterm.statusBarEnabled` | true | Show status bar item |
| `immorterm.namingPattern` | `immorterm-${n}` | Pattern for terminal names |

### Debugging

| Setting | Default | Description |
|---------|---------|-------------|
| `immorterm.enableDebugLog` | false | Enable verbose logging |

## Migrating from v2

If you're upgrading from ImmorTerm v2:

1. Open VS Code with your project
2. A migration prompt will appear automatically
3. Click "Migrate Now" to transfer your terminals
4. Your existing Screen sessions are preserved
5. A backup of v2 configuration is created

You can also trigger migration manually:
1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run "ImmorTerm: Migrate from v2"

## Troubleshooting

### Terminals Not Persisting

1. **Check Screen is installed:**
   ```bash
   which screen
   ```
   If not found, install Screen (see Requirements above)

2. **Check status bar:**
   - Should show terminal count if Screen is working
   - Shows warning icon if Screen is missing

3. **View logs:**
   - Open Output panel (View > Output)
   - Select "ImmorTerm" from dropdown
   - Check for error messages

### Screen Sessions Not Restored

1. **Verify Screen sessions exist:**
   ```bash
   screen -ls
   ```

2. **Check restore setting:**
   - Ensure `immorterm.restoreOnStartup` is `true`

3. **Try manual cleanup:**
   - Run "ImmorTerm: Cleanup Stale Sessions"
   - Restart VS Code

### Status Bar Not Showing

1. **Check setting:**
   - Ensure `immorterm.statusBarEnabled` is `true`

2. **Reload VS Code:**
   - Run "Developer: Reload Window"

### Performance Issues

1. **Reduce scrollback:**
   - Lower `immorterm.scrollbackBuffer` (e.g., 10000)

2. **Reduce history on attach:**
   - Lower `immorterm.historyOnAttach` (e.g., 5000)

3. **Increase restore delay:**
   - Increase `immorterm.terminalRestoreDelay` (e.g., 1500)

## How It Works

1. **Terminal Creation**: When you open a terminal, ImmorTerm creates a Screen session
2. **Session Naming**: Sessions are named `{project}-{uniqueId}` for isolation
3. **Persistence**: Screen runs in the background, independent of VS Code
4. **Restoration**: On VS Code restart, ImmorTerm reattaches to existing sessions
5. **Cleanup**: Stale sessions are automatically cleaned up (configurable)

## Data Storage

ImmorTerm stores terminal state in:
- **VS Code workspaceState**: Terminal registry (survives VS Code restarts)
- `.vscode/terminals/`: Scripts and configuration
- `.vscode/terminals/logs/`: Terminal log files

## Known Issues

- Terminal names may not update immediately after rename (use "Sync Now")
- Screen must be installed before extension activation for full functionality
- Windows is not supported (Screen requires Unix-like environment)

## Contributing

Issues and pull requests welcome at [GitHub](https://github.com/lonormaly/ImmorTerm).

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Made with persistence by lonormaly**
