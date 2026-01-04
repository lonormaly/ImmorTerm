# ImmorTerm

**Terminals that survive VS Code crashes**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20WSL-blue)](https://github.com/lonormaly/ImmorTerm)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.74%2B-007ACC)](https://code.visualstudio.com/)

---

## The Problem

VS Code's terminal has a fatal flaw: **it loses everything when VS Code restarts**.

- AI workflow sessions (Claude Code, Copilot) interrupted mid-task
- Long-running processes killed without warning
- Scroll history vanished forever
- Context lost, productivity destroyed

## The Solution

ImmorTerm wraps each VS Code terminal in a GNU Screen session that **persists through crashes, restarts, and updates**.

```
VS Code Terminal 1  -->  screen session: myproject-12345-abc  (API server)
VS Code Terminal 2  -->  screen session: myproject-12346-def  (Dev watcher)
VS Code Terminal 3  -->  screen session: myproject-12347-ghi  (Tests)
```

When VS Code crashes or restarts:
1. Screen sessions keep running in the background
2. Terminals auto-restore to their exact state
3. Scroll history preserved in log files
4. Pick up exactly where you left off

---

## Quick Install

### Homebrew (macOS/Linux)

```bash
# Install once (adds immorterm CLI + GNU Screen)
brew tap lonormaly/tap
brew install immorterm

# Enable for each project you want persistent terminals
immorterm ~/Development/project1
immorterm ~/Development/project2
```

### One-liner

```bash
curl -fsSL https://raw.githubusercontent.com/lonormaly/ImmorTerm/main/install.sh | bash
```

### Manual Installation

```bash
git clone https://github.com/lonormaly/ImmorTerm.git
cd ImmorTerm
./src/installer.sh /path/to/your/project
```

### What gets installed where?

| Component | Location | Frequency |
|-----------|----------|-----------|
| `immorterm` CLI | System PATH | Once per machine |
| GNU Screen | System PATH | Once per machine |
| VS Code extension | `~/.vscode/extensions/` | Once per machine |
| `~/.screenrc` | Home directory | Once per machine |
| `.vscode/terminals/` | Project directory | **Per project** |
| `restore-terminals.json` | Project directory | **Per project** |

Each project has its own isolated terminal sessions. Opening Project A gives you Project A's terminals, not Project B's.

---

## Features

| Feature | Description |
|---------|-------------|
| **Crash Survival** | Terminals persist through VS Code crashes, restarts, and updates |
| **Auto-Restore** | Terminals automatically reopen on VS Code startup |
| **Scroll History** | Full scroll history saved to log files |
| **Multi-Terminal** | Each VS Code terminal gets its own screen session |
| **Name Sync** | Terminal tab names sync to restore configuration |
| **Zero Config** | Works immediately after installation |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift+Up/Down` | Navigate between terminal tabs |
| `Ctrl+Shift+Q Q` | Close terminal properly (quits screen immediately) |
| `Ctrl+Shift+Q A` | Close ALL terminals (reset everything) |
| `Ctrl+Shift+D` | Detach from screen (session keeps running) |

---

## Terminal Close Behavior

ImmorTerm handles different close scenarios to balance convenience with crash protection:

| Scenario | What Happens | Delay |
|----------|--------------|-------|
| **Ctrl+Shift+Q Q** | Screen killed + JSON updated immediately | None |
| **Click X button** | Screen killed + JSON updated after delay | 60 seconds |
| **Close VS Code normally** | Terminals preserved for next session | — |
| **VS Code crashes** | Terminals preserved (auto-restore on restart) | — |

### Why the 60-second delay for X button?

When you click the X button on a terminal tab, ImmorTerm waits 60 seconds before cleaning up. This protects against accidental data loss:

- **If VS Code quits** (normal close or crash) during those 60 seconds → cleanup timer dies with VS Code → **terminals survive** for next session
- **If VS Code stays open** → cleanup executes after 60 seconds → screen killed + JSON updated

This means if you quit VS Code within 60 seconds of clicking X, your terminal will be restored on next launch.

### Recommended workflows

- **Intentional close**: Use `Ctrl+Shift+Q Q` for instant cleanup
- **Quick close**: Click X (cleanup happens in background after 60s)
- **Temporary close**: Use `Ctrl+Shift+D` to detach (screen keeps running)

---

## How It Works

1. **screen-auto**: Creates a unique screen session for each new terminal
2. **screen-reconcile**: Adds new terminals to the restore list (runs in background)
3. **screen-cleanup**: Removes stale entries for dead sessions
4. **Restore Terminals Extension**: Reopens terminals on VS Code startup
5. **Terminal Name Sync Extension**: Syncs tab names to restore config

### Project Structure (after installation)

```
your-project/
├── .vscode/
│   ├── terminals/
│   │   ├── screen-auto        # Creates/attaches screen sessions
│   │   ├── screen-reconcile   # Updates restore list
│   │   ├── screen-cleanup     # Cleans stale entries
│   │   ├── screen-forget      # Removes single terminal
│   │   ├── screen-forget-all  # Resets all terminals
│   │   ├── screenrc           # Screen configuration
│   │   ├── logs/              # Scroll history logs
│   │   └── pending/           # New terminal queue
│   ├── restore-terminals.json # Auto-generated restore config
│   └── tasks.json             # VS Code tasks
└── ...
```

---

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **macOS** | Full support | Homebrew for screen |
| **Linux** | Full support | apt, dnf, pacman, zypper |
| **Windows (WSL2)** | Full support | Run in WSL2 terminal |
| **Windows (native)** | Not supported | Use WSL2 |

---

## Prerequisites

- **VS Code** 1.74 or later
- **GNU Screen** (installer will set this up)
- **jq** for JSON manipulation
- **zsh** or **bash** shell

---

## VS Code Tasks

Access via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Task | Description |
|------|-------------|
| `screen-forget` | Remove current terminal from restore |
| `screen-forget-all` | Reset all project terminals |
| `screen-cleanup-stale` | Remove orphaned entries |

---

## Troubleshooting

### Terminals not restoring?

1. Ensure the Restore Terminals extension is installed
2. Check that `.vscode/restore-terminals.json` exists
3. Verify screen sessions are running: `screen -ls`

### Screen command not found?

```bash
# macOS
brew install screen

# Ubuntu/Debian
sudo apt-get install screen

# Fedora/RHEL
sudo dnf install screen

# Arch
sudo pacman -S screen
```

### Clean slate reset

```bash
.vscode/terminals/screen-forget-all
```

Then close all terminal tabs manually and open new ones.

---

## Uninstallation

### Remove from a single project

```bash
# Easy way - use the uninstall command
immorterm --uninstall

# Or specify a project
immorterm --uninstall ~/Development/my-project
```

This will:
- Kill all screen sessions for the project
- Remove `.vscode/terminals/` directory
- Remove `restore-terminals.json`

VS Code settings, keybindings, and tasks are left intact (they're shared across projects).

### Full uninstall (all projects + global)

```bash
# 1. Kill ALL ImmorTerm screen sessions
screen -ls | grep -oE '[0-9]+\.[a-z]+-[0-9]+-[A-Za-z0-9]+' | xargs -I {} screen -S {} -X quit

# 2. Remove global screenrc (only if ImmorTerm created it)
# Check first: cat ~/.screenrc | head -5
# If it says "ImmorTerm" or you didn't have one before, remove it:
rm -f ~/.screenrc

# 3. Uninstall Homebrew package (if installed via brew)
brew uninstall immorterm
brew untap lonormaly/tap

# 4. Uninstall VS Code extensions
code --uninstall-extension ethansk.restore-terminals
code --uninstall-extension immorterm.terminal-name-sync

# 5. Remove from each project (repeat for each)
rm -rf /path/to/project/.vscode/terminals/
rm -f /path/to/project/.vscode/restore-terminals.json
```

### Restore VS Code config files

The installer creates backups before modifying VS Code config files:
- `settings.json.backup.YYYYMMDD_HHMMSS`
- `keybindings.json.backup.YYYYMMDD_HHMMSS`
- `tasks.json.backup.YYYYMMDD_HHMMSS`
- `.zshrc.backup.YYYYMMDD_HHMMSS` (if zsh helpers were installed)

To restore, find the backup in the same directory and rename it back.

### Restore original VS Code terminal behavior

After uninstalling, your terminals will work exactly as they did before—no screen wrapping, no persistence. If VS Code crashes, terminals are lost (the default behavior).

---

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Credits

Built with love for developers who've lost one too many terminal sessions.

Inspired by the pain of VS Code crashes during Claude Code sessions.
