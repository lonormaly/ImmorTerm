# Installation Guide

## Quick Install (Recommended)

Run this one-liner in your terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/lonormaly/ImmorTerm/main/install.sh | bash
```

The installer will guide you through:
1. Installing GNU Screen if needed
2. Configuring global screenrc
3. Setting up your project
4. Installing VS Code extensions

## Manual Installation

### Prerequisites

- **macOS**: `brew install screen jq`
- **Ubuntu/Debian**: `sudo apt install screen jq`
- **Fedora/RHEL**: `sudo dnf install screen jq`
- **Arch Linux**: `sudo pacman -S screen jq`
- **openSUSE**: `sudo zypper install screen jq`

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/lonormaly/ImmorTerm.git
   cd ImmorTerm
   ```

2. **Run the installer**:
   ```bash
   bash src/installer.sh
   ```

3. **Follow the prompts** to configure your project.

## What Gets Installed

### Global Configuration
- `~/.screenrc` - Global screen configuration

### Project Files
In your project's `.vscode/terminals/` directory:
- `screen-auto` - Creates/attaches to screen sessions
- `screen-reconcile` - Syncs terminals to JSON
- `screen-cleanup` - Removes stale entries
- `screen-forget` - Removes single terminal
- `screen-forget-all` - Resets all terminals
- `screenrc` - Project-specific screen config
- `logs/` - Terminal log files

### VS Code Settings
- Terminal profile for screen sessions
- Keyboard shortcuts for terminal management
- Recommended extensions

## Uninstallation

To remove ImmorTerm from a project:

1. Run the reset command:
   ```bash
   .vscode/terminals/screen-forget-all
   ```

2. Delete the terminals directory:
   ```bash
   rm -rf .vscode/terminals
   ```

3. Remove the terminal profile from `.vscode/settings.json`

4. Optionally remove global config:
   ```bash
   rm ~/.screenrc
   ```
