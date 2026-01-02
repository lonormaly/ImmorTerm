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
brew tap lonormaly/tap
brew install immorterm
```

Then run `immorterm /path/to/your/project` to set up persistent terminals.

### One-liner

```bash
curl -fsSL https://raw.githubusercontent.com/lonormaly/ImmorTerm/main/install.sh | bash
```

### Manual Installation

```bash
git clone https://github.com/lonormaly/ImmorTerm.git
cd ImmorTerm
./src/installer.sh
```

The interactive installer will:
1. Install GNU Screen (if needed)
2. Set up project-local scripts in `.vscode/terminals/`
3. Configure VS Code settings and keybindings
4. Install the Restore Terminals extension
5. Install the Terminal Name Sync extension

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
| `Ctrl+Shift+Q Q` | Close terminal properly (quits screen session) |
| `Ctrl+Shift+Q A` | Close ALL terminals (reset everything) |
| `Ctrl+Shift+D` | Detach from screen (session keeps running) |

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

1. Run `screen-forget-all` to kill all sessions
2. Delete `.vscode/terminals/` directory
3. Remove terminal profile from VS Code settings
4. Uninstall extensions if desired

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
