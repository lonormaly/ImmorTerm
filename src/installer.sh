#!/bin/bash

set -e

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║              ImmorTerm - Terminal Persistence Installer (v1.0)             ║
# ║                 Multi-Terminal Persistent Sessions Setup                   ║
# ╚════════════════════════════════════════════════════════════════════════════╝
#
# This installer sets up the multi-terminal approach:
#   - Each VS Code terminal gets its own screen session
#   - Sessions persist across VS Code restarts
#   - Restore Terminals extension auto-reopens terminals on reload
#   - Project-local scripts in .vscode/terminals/

# Version
VERSION="1.0.0"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Support both development and Homebrew installation layouts
if [[ -d "$SCRIPT_DIR/../src/scripts" ]]; then
    # Development: running from repo (src/installer.sh)
    IMMORTERM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
    SCRIPTS_DIR="$IMMORTERM_DIR/src/scripts"
    TEMPLATES_DIR="$IMMORTERM_DIR/src/templates"
    EXTENSION_DIR="$IMMORTERM_DIR/src/extension"
elif [[ -d "$SCRIPT_DIR/scripts" ]]; then
    # Homebrew: libexec layout (scripts are siblings)
    IMMORTERM_DIR="$SCRIPT_DIR"
    SCRIPTS_DIR="$IMMORTERM_DIR/scripts"
    TEMPLATES_DIR="$IMMORTERM_DIR/templates"
    EXTENSION_DIR="$IMMORTERM_DIR/extension"
else
    # Fallback: assume we're in src/
    IMMORTERM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
    SCRIPTS_DIR="$IMMORTERM_DIR/src/scripts"
    TEMPLATES_DIR="$IMMORTERM_DIR/src/templates"
    EXTENSION_DIR="$IMMORTERM_DIR/src/extension"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Colors and Formatting
# ─────────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Icons
ICON_CHECK="✓"
ICON_CROSS="✗"
ICON_ARROW="→"
ICON_STAR="★"
ICON_WARN="⚠"
ICON_INFO="ℹ"
ICON_FOLDER="📁"
ICON_FILE="📄"
ICON_TERM="💻"
ICON_MAGIC="✨"
ICON_GEAR="⚙"

# Tracking what was installed
INSTALLED_SCREEN=false
INSTALLED_SCREENRC=false
INSTALLED_ZSHRC=false
INSTALLED_PROJECT_SCRIPTS=false
INSTALLED_VSCODE=false
INSTALLED_EXTENSION=false
INSTALLED_NAME_SYNC=false

# User choice from ask_continue
USER_CHOICE=""

# Project directory (where to install .vscode/terminals/)
PROJECT_DIR=""
PROJECT_NAME=""
UNINSTALL_MODE=false

# ─────────────────────────────────────────────────────────────────────────────
# OS Detection
# ─────────────────────────────────────────────────────────────────────────────
detect_os() {
    case "$(uname -s)" in
        Darwin)
            DETECTED_OS="macos"
            PACKAGE_MANAGER="brew"
            INSTALL_CMD="brew install screen"
            VSCODE_SETTINGS_PATH="$HOME/Library/Application Support/Code/User"
            ;;
        Linux)
            DETECTED_OS="linux"
            if command -v apt-get &> /dev/null; then
                PACKAGE_MANAGER="apt"
                INSTALL_CMD="sudo apt-get install -y screen"
            elif command -v dnf &> /dev/null; then
                PACKAGE_MANAGER="dnf"
                INSTALL_CMD="sudo dnf install -y screen"
            elif command -v pacman &> /dev/null; then
                PACKAGE_MANAGER="pacman"
                INSTALL_CMD="sudo pacman -S --noconfirm screen"
            elif command -v zypper &> /dev/null; then
                PACKAGE_MANAGER="zypper"
                INSTALL_CMD="sudo zypper install -y screen"
            else
                PACKAGE_MANAGER="unknown"
                INSTALL_CMD="# Please install screen manually"
            fi
            VSCODE_SETTINGS_PATH="$HOME/.config/Code/User"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            DETECTED_OS="windows"
            PACKAGE_MANAGER="manual"
            INSTALL_CMD="# Windows: Install screen via WSL or Git Bash"
            VSCODE_SETTINGS_PATH="$APPDATA/Code/User"
            ;;
        *)
            DETECTED_OS="unknown"
            PACKAGE_MANAGER="unknown"
            INSTALL_CMD="# Please install screen manually"
            VSCODE_SETTINGS_PATH="$HOME/.config/Code/User"
            ;;
    esac
}

# Run OS detection immediately
detect_os

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

print_header() {
    echo ""
    echo -e "${MAGENTA}${BOLD}"
    echo "  ╔══════════════════════════════════════════════════════════════════╗"
    echo "  ║                                                                  ║"
    echo -e "  ║    ${WHITE}🖥  ImmorTerm - Terminal Persistence Installer  🖥${MAGENTA}             ║"
    echo "  ║                                                                  ║"
    echo -e "  ║      ${CYAN}Multi-Terminal • Persistent • Auto-Restore${MAGENTA}                 ║"
    echo "  ║                                                                  ║"
    echo "  ╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
}

print_pain_points() {
    echo ""
    echo -e "${RED}${BOLD}  😤 The Problem with VS Code's Terminal:${RESET}"
    echo ""
    echo -e "     ${RED}✗${RESET}  ${WHITE}AI workflows broken${RESET} - Claude Code sessions interrupted by VS Code"
    echo -e "     ${RED}✗${RESET}  ${WHITE}No persistence${RESET} - Terminal state lost when VS Code closes/crashes"
    echo -e "     ${RED}✗${RESET}  ${WHITE}Lost context${RESET} - Scroll history disappears on restart"
    echo ""
    echo -e "${GREEN}${BOLD}  ✨ The Solution - Multi-Terminal Screen Sessions:${RESET}"
    echo ""
    echo -e "     ${GREEN}✓${RESET}  ${WHITE}Each VS Code terminal${RESET} → its own screen session"
    echo -e "     ${GREEN}✓${RESET}  ${WHITE}Survives everything${RESET} - VS Code crashes? Sessions keep running"
    echo -e "     ${GREEN}✓${RESET}  ${WHITE}Auto-restore${RESET} - Terminals reopen exactly as they were"
    echo -e "     ${GREEN}✓${RESET}  ${WHITE}Never lose context${RESET} - Pick up exactly where you left off"
    echo -e "     ${GREEN}✓${RESET}  ${WHITE}Scroll history preserved${RESET} - Full log file per terminal"
    echo ""
}

print_feature_box() {
    echo ""
    echo -e "${CYAN}  ┌────────────────────────────────────────────────────────────────┐${RESET}"
    echo -e "${CYAN}  │${RESET}  ✨ ${WHITE}Multi-Terminal Persistent Sessions${RESET}                         ${CYAN}│${RESET}"
    echo -e "${CYAN}  ├────────────────────────────────────────────────────────────────┤${RESET}"
    echo -e "${CYAN}  │${RESET}                                                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}   ${GREEN}Terminal 1${RESET}  →  session: ${YELLOW}project-12345-abc${RESET} (API server)     ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}   ${GREEN}Terminal 2${RESET}  →  session: ${YELLOW}project-12346-def${RESET} (Web dev)        ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}   ${GREEN}Terminal 3${RESET}  →  session: ${YELLOW}project-12347-ghi${RESET} (Tests)          ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}                                                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}   ${DIM}Each VS Code terminal gets its own persistent session!${RESET}       ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}   ${DIM}Terminals auto-restore on VS Code restart.${RESET}                   ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}                                                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  └────────────────────────────────────────────────────────────────┘${RESET}"
    echo ""
}

print_step() {
    local step_num=$1
    local total=$2
    local title=$3
    local padding=$((49 - ${#title}))
    [[ $padding -lt 0 ]] && padding=0
    echo ""
    echo -e "${CYAN}${BOLD}  ┌────────────────────────────────────────────────────────────────┐${RESET}"
    echo -e "${CYAN}${BOLD}  │  ${YELLOW}Step $step_num/$total${CYAN}  │  ${WHITE}$title${RESET}$(printf '%*s' $padding '')${CYAN}${BOLD}│${RESET}"
    echo -e "${CYAN}${BOLD}  └────────────────────────────────────────────────────────────────┘${RESET}"
}

print_info() {
    echo -e "     ${BLUE}${ICON_INFO}${RESET}  ${GRAY}$1${RESET}"
}

print_detail() {
    echo -e "        ${DIM}$1${RESET}"
}

print_file() {
    echo -e "     ${YELLOW}${ICON_FILE}${RESET}  ${WHITE}$1${RESET}"
}

print_success() {
    echo -e "     ${GREEN}${ICON_CHECK}${RESET}  ${GREEN}$1${RESET}"
}

print_warning() {
    echo -e "     ${YELLOW}${ICON_WARN}${RESET}  ${YELLOW}$1${RESET}"
}

print_error() {
    echo -e "     ${RED}${ICON_CROSS}${RESET}  ${RED}$1${RESET}"
}

print_action() {
    echo -e "     ${MAGENTA}${ICON_ARROW}${RESET}  $1"
}

# Sets USER_CHOICE to "yes", "skip", or "quit"
ask_continue() {
    echo ""
    echo -e "     ${CYAN}${BOLD}Continue with this step?${RESET}"
    echo -e "     ${DIM}[Y]es / [S]kip / [Q]uit${RESET}"
    echo -n "     > "
    read -r response
    case "$response" in
        [yY]|[yY][eE][sS]|"")
            USER_CHOICE="yes"
            ;;
        [sS]|[sS][kK][iI][pP])
            USER_CHOICE="skip"
            ;;
        [qQ]|[qQ][uU][iI][tT]|[nN]|[nN][oO])
            USER_CHOICE="quit"
            ;;
        *)
            USER_CHOICE="skip"
            ;;
    esac
}

press_enter() {
    echo ""
    echo -e "     ${DIM}Press Enter to continue...${RESET}"
    read -r
}

backup_file() {
    local file=$1
    if [[ -f "$file" ]]; then
        local backup="${file}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$file" "$backup"
        print_info "Backed up to: ${backup##*/}"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Project Directory Selection
# ─────────────────────────────────────────────────────────────────────────────

select_project_directory() {
    print_step "0" "7" "Select Project Directory"
    echo ""
    print_info "This installer sets up persistent terminals for a project."
    print_info "Scripts will be installed in: ${WHITE}.vscode/terminals/${RESET}"
    echo ""

    # If PROJECT_DIR was set via CLI argument, validate and use it
    if [[ -n "$PROJECT_DIR" ]]; then
        PROJECT_DIR="${PROJECT_DIR/#\~/$HOME}"
        if [[ ! -d "$PROJECT_DIR" ]]; then
            print_error "Directory does not exist: $PROJECT_DIR"
            exit 1
        fi
        echo -e "     ${GREEN}${ICON_FOLDER}${RESET}  Using specified directory: ${WHITE}$PROJECT_DIR${RESET}"
        PROJECT_NAME=$(basename "$PROJECT_DIR")
        echo ""
        return
    fi

    # Check if we're in a git repo or have a .vscode folder
    local suggested_dir="$PWD"
    if [[ -d "$PWD/.vscode" ]] || [[ -d "$PWD/.git" ]]; then
        echo -e "     ${GREEN}${ICON_FOLDER}${RESET}  Detected project: ${WHITE}$PWD${RESET}"
    else
        echo -e "     ${YELLOW}${ICON_WARN}${RESET}  No .vscode or .git folder detected in current directory"
    fi

    echo ""
    echo -e "     ${WHITE}Where should I install?${RESET}"
    echo -e "     ${DIM}[Enter] Use current directory: $suggested_dir${RESET}"
    echo -e "     ${DIM}[Path]  Enter a different path${RESET}"
    echo -n "     > "
    read -r response

    if [[ -z "$response" ]]; then
        PROJECT_DIR="$suggested_dir"
    else
        PROJECT_DIR="${response/#\~/$HOME}"
        if [[ ! -d "$PROJECT_DIR" ]]; then
            print_error "Directory does not exist: $PROJECT_DIR"
            exit 1
        fi
    fi

    PROJECT_NAME=$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]')

    echo ""
    print_success "Installing to: $PROJECT_DIR"
    print_info "Project name: $PROJECT_NAME"
}

# ─────────────────────────────────────────────────────────────────────────────
# Installation Steps
# ─────────────────────────────────────────────────────────────────────────────

install_screen() {
    print_step "1" "7" "Install GNU Screen"
    echo ""
    print_info "GNU Screen is a terminal multiplexer that provides:"
    print_detail "• Persistent sessions that survive VS Code restarts"
    print_detail "• Scrollback buffer with logging"
    print_detail "• Auto-detach on connection loss"
    echo ""

    if [[ "$DETECTED_OS" == "windows" ]]; then
        print_warning "Windows detected - screen works best via WSL or Git Bash"
        print_info "For WSL2, run: sudo apt-get install screen"
        INSTALLED_SCREEN=true
        return 0
    fi

    if command -v screen &> /dev/null; then
        local version=$(screen --version 2>&1 | head -1)
        print_success "Screen is already installed"
        print_detail "$version"
        INSTALLED_SCREEN=true
        return 0
    fi

    print_action "Will run: ${WHITE}${INSTALL_CMD}${RESET}"

    ask_continue
    if [[ "$USER_CHOICE" == "yes" ]]; then
        print_info "Installing screen via ${PACKAGE_MANAGER}..."
        eval "$INSTALL_CMD"
        if command -v screen &> /dev/null; then
            print_success "Screen installed successfully!"
            INSTALLED_SCREEN=true
        else
            print_error "Screen installation failed"
            print_info "Please install screen manually and re-run this installer"
            exit 1
        fi
    elif [[ "$USER_CHOICE" == "skip" ]]; then
        print_warning "Skipped - you'll need to install screen manually"
    else
        print_error "Installation cancelled"
        exit 1
    fi
}

install_global_screenrc() {
    print_step "2" "7" "Configure Global Screen (~/.screenrc)"
    echo ""
    print_info "Optional global configuration provides:"
    print_detail "• Default scrollback buffer"
    print_detail "• 256 color and truecolor support"
    print_detail "• UTF-8 support"
    echo ""
    print_info "Note: Project-specific config will be in .vscode/terminals/screenrc"
    echo ""
    print_file "~/.screenrc"

    # Check if already exists
    if [[ -f ~/.screenrc ]]; then
        print_success "~/.screenrc already exists"
        INSTALLED_SCREENRC=true
        return 0
    fi

    print_action "Will create: ${WHITE}~/.screenrc${RESET}"

    ask_continue
    if [[ "$USER_CHOICE" == "yes" ]]; then
        cp "$TEMPLATES_DIR/screenrc.global" ~/.screenrc
        print_success "Created ~/.screenrc"
        INSTALLED_SCREENRC=true
    elif [[ "$USER_CHOICE" == "skip" ]]; then
        print_warning "Skipped global screenrc (project config will still work)"
    else
        print_error "Configuration cancelled"
        exit 1
    fi
}

install_project_scripts() {
    print_step "3" "7" "Install Project Scripts (.vscode/terminals/)"
    echo ""
    print_info "This is the core of the multi-terminal system:"
    print_detail "• screen-auto     - Creates/attaches to screen sessions"
    print_detail "• screen-reconcile - Auto-adds terminals to restore list"
    print_detail "• screen-cleanup  - Removes stale terminal entries"
    print_detail "• screen-forget   - Remove current terminal from restore"
    print_detail "• screen-forget-all - Reset all terminals for project"
    print_detail "• screenrc        - Project-specific screen config"
    echo ""

    local terminals_dir="$PROJECT_DIR/.vscode/terminals"
    local logs_dir="$terminals_dir/logs"
    local pending_dir="$terminals_dir/pending"

    # Check if already exists
    if [[ -d "$terminals_dir" ]] && [[ -x "$terminals_dir/screen-auto" ]]; then
        print_success "Project scripts already installed"
        INSTALLED_PROJECT_SCRIPTS=true
        return 0
    fi

    print_action "Will create: ${WHITE}$terminals_dir/${RESET}"

    ask_continue
    if [[ "$USER_CHOICE" == "yes" ]]; then
        # Create directories
        mkdir -p "$terminals_dir" "$logs_dir" "$pending_dir"

        # Copy all scripts from ImmorTerm
        cp "$SCRIPTS_DIR/screen-auto" "$terminals_dir/"
        cp "$SCRIPTS_DIR/screen-reconcile" "$terminals_dir/"
        cp "$SCRIPTS_DIR/screen-cleanup" "$terminals_dir/"
        cp "$SCRIPTS_DIR/screen-forget" "$terminals_dir/"
        cp "$SCRIPTS_DIR/screen-forget-all" "$terminals_dir/"
        cp "$TEMPLATES_DIR/screenrc.project" "$terminals_dir/screenrc"

        # Make scripts executable
        chmod +x "$terminals_dir/screen-auto"
        chmod +x "$terminals_dir/screen-reconcile"
        chmod +x "$terminals_dir/screen-cleanup"
        chmod +x "$terminals_dir/screen-forget"
        chmod +x "$terminals_dir/screen-forget-all"

        # Create restore-terminals.json if it doesn't exist
        local restore_file="$PROJECT_DIR/.vscode/restore-terminals.json"
        if [[ ! -f "$restore_file" ]]; then
            cp "$TEMPLATES_DIR/restore-terminals.json" "$restore_file"
        fi

        print_success "Created .vscode/terminals/ with all scripts"
        print_success "Created restore-terminals.json"
        INSTALLED_PROJECT_SCRIPTS=true
    elif [[ "$USER_CHOICE" == "skip" ]]; then
        print_warning "Skipped project scripts installation"
    else
        print_error "Installation cancelled"
        exit 1
    fi
}

install_vscode_tasks() {
    print_step "4" "7" "Configure VS Code Tasks (.vscode/tasks.json)"
    echo ""
    print_info "Adds useful tasks to VS Code Command Palette:"
    print_detail "• screen-forget       - Remove current terminal"
    print_detail "• screen-forget-all   - Reset all terminals"
    print_detail "• screen-cleanup-stale - Remove orphaned entries"
    echo ""

    local tasks_file="$PROJECT_DIR/.vscode/tasks.json"

    if [[ -f "$tasks_file" ]] && grep -q "screen-forget" "$tasks_file" 2>/dev/null; then
        print_success "VS Code tasks already configured"
        return 0
    fi

    print_action "Will create/update: ${WHITE}.vscode/tasks.json${RESET}"

    ask_continue
    if [[ "$USER_CHOICE" == "yes" ]]; then
        mkdir -p "$PROJECT_DIR/.vscode"

        if [[ -f "$tasks_file" ]]; then
            backup_file "$tasks_file"
            print_warning "Existing tasks.json found - please manually merge"
            print_info "Add these tasks to your existing configuration:"
        fi

        cp "$TEMPLATES_DIR/tasks.json" "$tasks_file"

        print_success "Created .vscode/tasks.json"
    elif [[ "$USER_CHOICE" == "skip" ]]; then
        print_warning "Skipped VS Code tasks configuration"
    else
        print_error "Configuration cancelled"
        exit 1
    fi
}

install_vscode_settings() {
    print_step "5" "7" "Configure VS Code Settings & Extension"
    echo ""

    local settings_file="$VSCODE_SETTINGS_PATH/settings.json"
    local keybindings_file="$VSCODE_SETTINGS_PATH/keybindings.json"

    print_info "Will configure:"
    print_detail "• Terminal profile (settings.json)"
    print_detail "• Keyboard shortcuts (keybindings.json)"
    print_detail "• Restore Terminals extension"
    echo ""

    # Check current state
    local settings_ok=false
    local keybindings_ok=false

    if [[ -f "$settings_file" ]] && grep -q "screen-auto" "$settings_file" 2>/dev/null; then
        print_success "Terminal profile already configured"
        settings_ok=true
    fi

    if [[ -f "$keybindings_file" ]] && grep -q "ctrl+shift+q q" "$keybindings_file" 2>/dev/null; then
        print_success "Keybindings already configured"
        keybindings_ok=true
    fi

    if $settings_ok && $keybindings_ok; then
        # Still try to install extension
        if command -v code &> /dev/null; then
            if code --list-extensions 2>/dev/null | grep -q "EthanSK.restore-terminals"; then
                print_success "Restore Terminals extension already installed"
                INSTALLED_VSCODE=true
                return 0
            fi
        fi
    fi

    print_action "Will configure VS Code settings and install extension"

    ask_continue
    if [[ "$USER_CHOICE" == "yes" ]]; then
        mkdir -p "$VSCODE_SETTINGS_PATH"

        # ─────────────────────────────────────────────────────────────────
        # Update settings.json
        # ─────────────────────────────────────────────────────────────────
        if ! $settings_ok; then
            if [[ -f "$settings_file" ]]; then
                backup_file "$settings_file"
                # Try to merge with existing settings using jq
                if command -v jq &> /dev/null; then
                    local tmp
                    tmp=$(mktemp)
                    jq '. + {
                        "terminal.integrated.defaultProfile.osx": "screen",
                        "terminal.integrated.profiles.osx": ((.["terminal.integrated.profiles.osx"] // {}) + {
                            "screen": {
                                "path": "/bin/zsh",
                                "args": ["-lc", "exec .vscode/terminals/screen-auto"],
                                "icon": "terminal"
                            },
                            "zsh (no screen)": {
                                "path": "/bin/zsh"
                            }
                        }),
                        "terminal.integrated.defaultProfile.linux": "screen",
                        "terminal.integrated.profiles.linux": ((.["terminal.integrated.profiles.linux"] // {}) + {
                            "screen": {
                                "path": "/bin/bash",
                                "args": ["-lc", "exec .vscode/terminals/screen-auto"],
                                "icon": "terminal"
                            },
                            "bash (no screen)": {
                                "path": "/bin/bash"
                            }
                        })
                    }' "$settings_file" > "$tmp" && mv "$tmp" "$settings_file"
                    print_success "Merged terminal profile into settings.json"
                else
                    print_warning "jq not found - please add terminal profile manually"
                    print_info "Add to settings.json:"
                    echo -e "        ${GREEN}\"terminal.integrated.defaultProfile.osx\"${RESET}: ${CYAN}\"screen\"${RESET}"
                fi
            else
                cat > "$settings_file" << 'SETTINGS_JSON'
{
    "terminal.integrated.defaultProfile.osx": "screen",
    "terminal.integrated.profiles.osx": {
        "screen": {
            "path": "/bin/zsh",
            "args": ["-lc", "exec .vscode/terminals/screen-auto"],
            "icon": "terminal"
        },
        "zsh (no screen)": {
            "path": "/bin/zsh"
        }
    },
    "terminal.integrated.defaultProfile.linux": "screen",
    "terminal.integrated.profiles.linux": {
        "screen": {
            "path": "/bin/bash",
            "args": ["-lc", "exec .vscode/terminals/screen-auto"],
            "icon": "terminal"
        },
        "bash (no screen)": {
            "path": "/bin/bash"
        }
    }
}
SETTINGS_JSON
                print_success "Created settings.json with terminal profile"
            fi
        fi

        # ─────────────────────────────────────────────────────────────────
        # Update keybindings.json
        # ─────────────────────────────────────────────────────────────────
        if ! $keybindings_ok; then
            local keybindings_content keybindings_tmp
            keybindings_tmp=$(mktemp)
            cat > "$keybindings_tmp" << 'KEYBINDINGS'
[
    // ════════════════════════════════════════════════════════════════════
    // ImmorTerm - Screen Terminal Integration Shortcuts
    // ════════════════════════════════════════════════════════════════════

    // Navigate between VS Code terminal tabs (Shift+Up/Down)
    {
        "key": "shift+up",
        "command": "workbench.action.terminal.focusPrevious",
        "when": "terminalFocus"
    },
    {
        "key": "shift+down",
        "command": "workbench.action.terminal.focusNext",
        "when": "terminalFocus"
    },

    // Kill current terminal and cleanup (Ctrl+Shift+Q Q)
    // Runs screen-forget INSIDE the terminal so $STY is available
    // Uses git root to work from any subdirectory
    {
        "key": "ctrl+shift+q q",
        "command": "workbench.action.terminal.sendSequence",
        "args": { "text": "$(git rev-parse --show-toplevel)/.vscode/terminals/screen-forget\n" },
        "when": "terminalFocus"
    },

    // Kill ALL terminals (Ctrl+Shift+Q A)
    // Runs screen-forget-all to reset everything
    {
        "key": "ctrl+shift+q a",
        "command": "workbench.action.tasks.runTask",
        "args": "screen-forget-all",
        "when": "terminalFocus"
    },

    // Detach from screen (Ctrl+Shift+D)
    // Session keeps running in background
    {
        "key": "ctrl+shift+d",
        "command": "workbench.action.terminal.sendSequence",
        "args": { "text": "\u0001d" },
        "when": "terminalFocus"
    },

    // ════════════════════════════════════════════════════════════════════
    // Screen Internal Shortcuts (rarely needed with multi-terminal setup)
    // ════════════════════════════════════════════════════════════════════

    // New screen window within session (Ctrl+Shift+`)
    {
        "key": "ctrl+shift+`",
        "command": "workbench.action.terminal.sendSequence",
        "args": { "text": "\u0001:screen\r" },
        "when": "terminalFocus"
    },

    // Window picker within session (Ctrl+Shift+W)
    {
        "key": "ctrl+shift+w",
        "command": "workbench.action.terminal.sendSequence",
        "args": { "text": "\u0001w" },
        "when": "terminalFocus"
    },

    // Navigate windows within session
    {
        "key": "ctrl+shift+right",
        "command": "workbench.action.terminal.sendSequence",
        "args": { "text": "\u0001n" },
        "when": "terminalFocus"
    },
    {
        "key": "ctrl+shift+left",
        "command": "workbench.action.terminal.sendSequence",
        "args": { "text": "\u0001p" },
        "when": "terminalFocus"
    },

    // Rename window (Ctrl+Shift+R)
    {
        "key": "ctrl+shift+r",
        "command": "workbench.action.terminal.sendSequence",
        "args": { "text": "\u0001A" },
        "when": "terminalFocus"
    }
]
KEYBINDINGS
            keybindings_content=$(cat "$keybindings_tmp")
            rm -f "$keybindings_tmp"

            if [[ -f "$keybindings_file" ]]; then
                backup_file "$keybindings_file"
                # Try to merge with existing keybindings
                if command -v jq &> /dev/null; then
                    local existing_content new_keybindings merged
                    existing_content=$(cat "$keybindings_file")
                    new_keybindings=$(echo "$keybindings_content" | jq '.')
                    # Simple merge: append new keybindings
                    merged=$(echo "$existing_content" | jq --argjson new "$new_keybindings" '. + $new | unique_by(.key)')
                    echo "$merged" > "$keybindings_file"
                    print_success "Merged keybindings into keybindings.json"
                else
                    print_warning "jq not found - please merge keybindings manually"
                fi
            else
                echo "$keybindings_content" > "$keybindings_file"
                print_success "Created keybindings.json"
            fi
        fi

        # ─────────────────────────────────────────────────────────────────
        # Install VS Code Extension
        # ─────────────────────────────────────────────────────────────────
        if command -v code &> /dev/null; then
            if code --list-extensions 2>/dev/null | grep -q "EthanSK.restore-terminals"; then
                print_success "Restore Terminals extension already installed"
            else
                print_info "Installing Restore Terminals extension..."
                if code --install-extension EthanSK.restore-terminals 2>/dev/null; then
                    print_success "Installed Restore Terminals extension"
                    INSTALLED_EXTENSION=true
                else
                    print_warning "Could not install extension automatically"
                    print_info "Install manually: Cmd+Shift+P → 'Extensions: Install Extension'"
                    print_info "Search: EthanSK.restore-terminals"
                fi
            fi
        else
            print_warning "VS Code CLI 'code' not found"
            print_info "Install extension manually: Cmd+Shift+P → 'Extensions: Install Extension'"
            print_info "Search: EthanSK.restore-terminals"
        fi

        INSTALLED_VSCODE=true
    elif [[ "$USER_CHOICE" == "skip" ]]; then
        print_warning "Skipped VS Code configuration"
    else
        print_error "Configuration cancelled"
        exit 1
    fi
}

install_zshrc() {
    print_step "6" "7" "Configure Zsh (Optional)"
    echo ""
    print_info "Optional: Add helper functions to ~/.zshrc"
    print_detail "• sname <name> - Set screen window title"
    print_detail "• Useful when inside a screen session"
    echo ""

    if grep -q "SCREEN_WINDOW_NAME" ~/.zshrc 2>/dev/null || grep -q "# Screen Window Title Helper" ~/.zshrc 2>/dev/null; then
        print_success "Screen helpers already in ~/.zshrc"
        INSTALLED_ZSHRC=true
        return 0
    fi

    print_action "Will append to: ${WHITE}~/.zshrc${RESET}"

    ask_continue
    if [[ "$USER_CHOICE" == "yes" ]]; then
        backup_file ~/.zshrc

        cat >> ~/.zshrc << 'ZSHRC'

# ─────────────────────────────────────────────────────────────────────────────
# ImmorTerm - Screen Window Title Helper
# ─────────────────────────────────────────────────────────────────────────────
if [[ -n "$STY" ]]; then
    sname() {
        screen -X title "$1"
        echo "Window renamed to: $1"
    }
fi
ZSHRC

        print_success "Added screen helpers to ~/.zshrc"
        INSTALLED_ZSHRC=true
    elif [[ "$USER_CHOICE" == "skip" ]]; then
        print_warning "Skipped zshrc configuration"
    else
        print_error "Configuration cancelled"
        exit 1
    fi
}

install_name_sync_extension() {
    print_step "7" "7" "Install Terminal Name Sync Extension"
    echo ""
    print_info "This VS Code extension syncs terminal tab names to restore-terminals.json"
    print_detail "• Syncs names when switching terminal tabs"
    print_detail "• Syncs names when opening/closing terminals"
    print_detail "• Periodic backup sync every 10 minutes"
    print_detail "• Manual sync command available in Command Palette"
    echo ""

    local ext_dir="$PROJECT_DIR/.vscode/extensions/terminal-name-sync"
    local vscode_ext_dir="$HOME/.vscode/extensions/terminal-name-sync"

    # Check if already installed and linked
    if [[ -d "$ext_dir/out" ]] && [[ -L "$vscode_ext_dir" ]]; then
        print_success "Terminal Name Sync extension already installed"
        INSTALLED_NAME_SYNC=true
        return 0
    fi

    print_action "Will install: ${WHITE}Terminal Name Sync extension${RESET}"

    ask_continue
    if [[ "$USER_CHOICE" == "yes" ]]; then
        mkdir -p "$ext_dir/src"

        # Copy extension files from ImmorTerm
        cp "$EXTENSION_DIR/package.json" "$ext_dir/"
        cp "$EXTENSION_DIR/tsconfig.json" "$ext_dir/"
        cp "$EXTENSION_DIR/src/extension.ts" "$ext_dir/src/"

        print_success "Created extension files"

        # ─────────────────────────────────────────────────────────────────
        # Install dependencies and compile
        # ─────────────────────────────────────────────────────────────────
        print_info "Installing dependencies and compiling..."

        (
            cd "$ext_dir"
            if command -v npm &> /dev/null; then
                npm install --silent 2>/dev/null
                npm run compile --silent 2>/dev/null
            elif command -v bun &> /dev/null; then
                bun install --silent 2>/dev/null
                bun run compile --silent 2>/dev/null
            else
                print_warning "Neither npm nor bun found - please compile manually"
                exit 1
            fi
        )

        if [[ -f "$ext_dir/out/extension.js" ]]; then
            print_success "Extension compiled successfully"
        else
            print_error "Failed to compile extension"
            print_info "Try manually: cd $ext_dir && npm install && npm run compile"
            return 1
        fi

        # ─────────────────────────────────────────────────────────────────
        # Create symlink to VS Code extensions
        # ─────────────────────────────────────────────────────────────────
        mkdir -p "$HOME/.vscode/extensions"
        if [[ -L "$vscode_ext_dir" ]]; then
            rm "$vscode_ext_dir"
        elif [[ -d "$vscode_ext_dir" ]]; then
            rm -rf "$vscode_ext_dir"
        fi

        ln -s "$ext_dir" "$vscode_ext_dir"
        print_success "Linked extension to VS Code extensions folder"

        INSTALLED_NAME_SYNC=true
        print_info "Restart VS Code to activate the extension"
    elif [[ "$USER_CHOICE" == "skip" ]]; then
        print_warning "Skipped Terminal Name Sync extension"
    else
        print_error "Installation cancelled"
        exit 1
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Verification
# ─────────────────────────────────────────────────────────────────────────────

run_verification() {
    echo ""
    echo -e "${CYAN}${BOLD}  ┌────────────────────────────────────────────────────────────────┐${RESET}"
    echo -e "${CYAN}${BOLD}  │  ${WHITE}Verifying Installation${RESET}                                        ${CYAN}│${RESET}"
    echo -e "${CYAN}${BOLD}  └────────────────────────────────────────────────────────────────┘${RESET}"
    echo ""

    local issues=0

    # Check screen
    if command -v screen &> /dev/null; then
        print_success "GNU Screen is installed"
    else
        print_error "GNU Screen is NOT installed"
        ((issues++))
    fi

    # Check project scripts
    if [[ -x "$PROJECT_DIR/.vscode/terminals/screen-auto" ]]; then
        print_success ".vscode/terminals/screen-auto exists and is executable"
    else
        print_warning ".vscode/terminals/screen-auto not found"
        ((issues++))
    fi

    # Check restore-terminals.json
    if [[ -f "$PROJECT_DIR/.vscode/restore-terminals.json" ]]; then
        print_success "restore-terminals.json exists"
    else
        print_warning "restore-terminals.json not found"
        ((issues++))
    fi

    # Check jq (needed for reconcile script)
    if command -v jq &> /dev/null; then
        print_success "jq is installed (needed for reconcile script)"
    else
        print_warning "jq is NOT installed - run: brew install jq"
        ((issues++))
    fi

    # Check VS Code extension
    if command -v code &> /dev/null; then
        if code --list-extensions 2>/dev/null | grep -q "EthanSK.restore-terminals"; then
            print_success "Restore Terminals extension is installed"
        else
            print_warning "Restore Terminals extension not found"
            ((issues++))
        fi
    fi

    # Check Terminal Name Sync extension
    local ext_dir="$PROJECT_DIR/.vscode/extensions/terminal-name-sync"
    local vscode_ext_dir="$HOME/.vscode/extensions/terminal-name-sync"
    if [[ -f "$ext_dir/out/extension.js" ]] && [[ -L "$vscode_ext_dir" ]]; then
        print_success "Terminal Name Sync extension is installed"
    else
        print_warning "Terminal Name Sync extension not installed"
        ((issues++))
    fi

    echo ""
    if [[ $issues -eq 0 ]]; then
        echo -e "     ${GREEN}${BOLD}All checks passed!${RESET}"
    else
        echo -e "     ${YELLOW}${BOLD}$issues issue(s) found - see warnings above${RESET}"
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}"
    echo "  ╔════════════════════════════════════════════════════════════════╗"
    echo "  ║                                                                ║"
    echo -e "  ║   ${WHITE}${ICON_STAR}  Installation Complete!  ${ICON_STAR}${GREEN}                                ║"
    echo "  ║                                                                ║"
    echo "  ╚════════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"

    echo -e "${CYAN}${BOLD}  Next Steps:${RESET}"
    echo ""
    echo -e "     ${WHITE}1.${RESET} Restart VS Code"
    echo ""
    echo -e "     ${WHITE}2.${RESET} Open a new terminal - it will use screen!"
    echo ""

    # Quick Reference
    echo -e "${CYAN}${BOLD}  ┌────────────────────────────────────────────────────────────────┐${RESET}"
    echo -e "${CYAN}${BOLD}  │${RESET}              ${WHITE}${BOLD}⚡ QUICK REFERENCE${RESET}                              ${CYAN}│${RESET}"
    echo -e "${CYAN}${BOLD}  ├────────────────────────────────────────────────────────────────┤${RESET}"
    echo -e "${CYAN}  │${RESET}                                                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${YELLOW}${BOLD}KEYBOARD SHORTCUTS${RESET}                                           ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}Shift+Up/Down${RESET}      Navigate between terminal tabs            ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}Ctrl+Shift+Q Q${RESET}     Close terminal properly (quit screen)     ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}Ctrl+Shift+Q A${RESET}     Close ALL terminals (reset)               ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}Ctrl+Shift+D${RESET}       Detach (session keeps running)            ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}                                                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${YELLOW}${BOLD}VS CODE TASKS${RESET}  ${DIM}(Cmd+Shift+P → 'Tasks: Run Task')${RESET}           ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}screen-forget${RESET}      Remove current terminal                  ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}screen-forget-all${RESET}  Reset all project terminals              ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}screen-cleanup${RESET}     Remove stale entries                     ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}                                                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${YELLOW}${BOLD}HOW IT WORKS${RESET}                                                 ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  • Each VS Code terminal = one screen session                  ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  • Sessions persist through VS Code restarts                   ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  • Terminals auto-restore on VS Code open                      ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  • Scroll history saved to .vscode/terminals/logs/             ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}                                                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${YELLOW}${BOLD}TERMINAL CLOSE BEHAVIOR${RESET}                                      ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}Ctrl+Shift+Q Q${RESET}     Cleanup immediately                      ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}Click X button${RESET}     Cleanup after 60s (safe for quit)        ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}Close VS Code${RESET}      Terminals preserved (auto-restore)       ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${GREEN}VS Code crash${RESET}      Terminals preserved (auto-restore)       ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}                                                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${DIM}INSIDE SCREEN (rarely needed)${RESET}                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}  ${DIM}Ctrl-a c = new window | Ctrl-a d = detach | Ctrl-a k = kill${RESET}  ${CYAN}│${RESET}"
    echo -e "${CYAN}  │${RESET}                                                                ${CYAN}│${RESET}"
    echo -e "${CYAN}  └────────────────────────────────────────────────────────────────┘${RESET}"
    echo ""

    echo -e "${DIM}  Project: $PROJECT_DIR${RESET}"
    echo -e "${DIM}  Documentation: https://github.com/lonormaly/ImmorTerm${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Uninstall
# ─────────────────────────────────────────────────────────────────────────────

uninstall_project() {
    echo ""
    echo -e "${RED}${BOLD}"
    echo "  ╔════════════════════════════════════════════════════════════════╗"
    echo "  ║                                                                ║"
    echo -e "  ║   ${WHITE}🗑️  ImmorTerm Uninstaller  🗑️${RED}                               ║"
    echo "  ║                                                                ║"
    echo "  ╚════════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"

    # Set project directory
    if [[ -z "$PROJECT_DIR" ]]; then
        PROJECT_DIR="$(pwd)"
    fi

    # Resolve to absolute path
    PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd)" || {
        echo -e "${RED}Error: Directory not found: $PROJECT_DIR${RESET}"
        exit 1
    }

    PROJECT_NAME="$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]')"

    echo -e "  ${WHITE}Project:${RESET} $PROJECT_DIR"
    echo ""

    # Check if ImmorTerm is installed
    if [[ ! -d "$PROJECT_DIR/.vscode/terminals" ]]; then
        echo -e "${YELLOW}  ImmorTerm is not installed in this project.${RESET}"
        echo ""
        exit 0
    fi

    echo -e "${WHITE}  This will:${RESET}"
    echo -e "     ${RED}•${RESET} Kill all screen sessions for this project"
    echo -e "     ${RED}•${RESET} Remove .vscode/terminals/ directory"
    echo -e "     ${RED}•${RESET} Remove restore-terminals.json"
    echo ""
    echo -e "${YELLOW}  Note: VS Code settings, keybindings, and tasks will remain.${RESET}"
    echo -e "${DIM}  (These are shared and may be used by other projects)${RESET}"
    echo ""

    echo -e -n "${YELLOW}  Are you sure you want to uninstall? [y/N] ${RESET}"
    read -r confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${DIM}  Uninstall cancelled.${RESET}"
        exit 0
    fi

    echo ""

    # Step 1: Kill screen sessions for this project
    echo -e "  ${CYAN}[1/3]${RESET} Killing screen sessions..."
    local sessions
    sessions=$(screen -ls 2>/dev/null | grep -oE "[0-9]+\.${PROJECT_NAME}-[0-9]+-[A-Za-z0-9]+" || true)
    if [[ -n "$sessions" ]]; then
        local count=0
        while IFS= read -r session; do
            screen -S "$session" -X quit 2>/dev/null && ((count++)) || true
        done <<< "$sessions"
        echo -e "        ${GREEN}✓${RESET} Killed $count screen session(s)"
    else
        echo -e "        ${DIM}No active sessions found${RESET}"
    fi

    # Step 2: Remove .vscode/terminals/
    echo -e "  ${CYAN}[2/3]${RESET} Removing .vscode/terminals/..."
    if [[ -d "$PROJECT_DIR/.vscode/terminals" ]]; then
        rm -rf "$PROJECT_DIR/.vscode/terminals"
        echo -e "        ${GREEN}✓${RESET} Removed .vscode/terminals/"
    fi

    # Step 3: Remove restore-terminals.json
    echo -e "  ${CYAN}[3/3]${RESET} Removing restore-terminals.json..."
    if [[ -f "$PROJECT_DIR/.vscode/restore-terminals.json" ]]; then
        rm -f "$PROJECT_DIR/.vscode/restore-terminals.json"
        echo -e "        ${GREEN}✓${RESET} Removed restore-terminals.json"
    fi

    echo ""
    echo -e "${GREEN}${BOLD}  ✓ ImmorTerm uninstalled from this project${RESET}"
    echo ""
    echo -e "${DIM}  To reinstall: immorterm $PROJECT_DIR${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

print_os_info() {
    local os_name=""
    local os_icon=""
    case "$DETECTED_OS" in
        macos)  os_name="macOS"; os_icon="🍎" ;;
        linux)  os_name="Linux"; os_icon="🐧" ;;
        windows) os_name="Windows"; os_icon="🪟" ;;
        *)      os_name="Unknown"; os_icon="❓" ;;
    esac
    echo -e "     ${DIM}${os_icon} Detected: ${os_name} (${PACKAGE_MANAGER})${RESET}"
}

run_installation() {
    select_project_directory
    install_screen
    install_global_screenrc
    install_project_scripts
    install_vscode_tasks
    install_vscode_settings
    install_zshrc
    install_name_sync_extension
    run_verification
    print_summary
}

show_version() {
    echo "ImmorTerm v${VERSION}"
    echo "Terminals that survive VS Code crashes"
    echo ""
    echo "https://github.com/lonormaly/ImmorTerm"
}

show_help() {
    echo "ImmorTerm v${VERSION} - Persistent terminal sessions for VS Code"
    echo ""
    echo "USAGE:"
    echo "    immorterm [OPTIONS] [PROJECT_DIR]"
    echo ""
    echo "ARGUMENTS:"
    echo "    PROJECT_DIR    Target project directory (default: current directory)"
    echo ""
    echo "OPTIONS:"
    echo "    -h, --help       Show this help message"
    echo "    -v, --version    Show version information"
    echo "    --uninstall      Remove ImmorTerm from a project"
    echo ""
    echo "EXAMPLES:"
    echo "    immorterm                      # Install in current directory"
    echo "    immorterm ~/my-project         # Install in specific project"
    echo "    immorterm --uninstall          # Uninstall from current directory"
    echo "    immorterm --uninstall ~/proj   # Uninstall from specific project"
    echo ""
    echo "WHAT IT DOES:"
    echo "    1. Installs GNU Screen (if needed)"
    echo "    2. Configures persistent terminal sessions"
    echo "    3. Sets up VS Code integration"
    echo "    4. Installs terminal name sync extension"
    echo ""
    echo "After installation, your terminals will survive VS Code crashes!"
    echo ""
    echo "For more info: https://github.com/lonormaly/ImmorTerm"
}

main() {
    # Part 1: Header and The Problem
    clear
    print_header
    print_os_info
    print_pain_points
    press_enter

    # Part 2: The Solution
    clear
    print_header
    print_os_info
    print_feature_box
    press_enter

    # Part 3: Start Installation
    clear
    print_header
    print_os_info
    echo ""
    echo -e "${WHITE}  ╭────────────────────────────────────────────────────────────────╮${RESET}"
    echo -e "${WHITE}  │  ${CYAN}🚀 Ready to Install${WHITE}                                           │${RESET}"
    echo -e "${WHITE}  ├────────────────────────────────────────────────────────────────┤${RESET}"
    echo -e "${WHITE}  │                                                                │${RESET}"
    echo -e "${WHITE}  │  This installer will set up multi-terminal persistent          │${RESET}"
    echo -e "${WHITE}  │  sessions for your project:                                    │${RESET}"
    echo -e "${WHITE}  │                                                                │${RESET}"
    echo -e "${WHITE}  │  ${GREEN}1.${WHITE} Install GNU Screen (if needed)                            │${RESET}"
    echo -e "${WHITE}  │  ${GREEN}2.${WHITE} Configure global screenrc                                 │${RESET}"
    echo -e "${WHITE}  │  ${GREEN}3.${WHITE} Create project scripts in .vscode/terminals/              │${RESET}"
    echo -e "${WHITE}  │  ${GREEN}4.${WHITE} Configure VS Code tasks                                   │${RESET}"
    echo -e "${WHITE}  │  ${GREEN}5.${WHITE} Configure VS Code settings, keybindings & extension       │${RESET}"
    echo -e "${WHITE}  │  ${GREEN}6.${WHITE} Configure Zsh helpers (optional)                          │${RESET}"
    echo -e "${WHITE}  │  ${GREEN}7.${WHITE} Install Terminal Name Sync extension                      │${RESET}"
    echo -e "${WHITE}  │                                                                │${RESET}"
    echo -e "${WHITE}  ╰────────────────────────────────────────────────────────────────╯${RESET}"
    echo ""
    echo -e "${DIM}  Press Enter to start installation or Ctrl+C to exit...${RESET}"
    read -r

    run_installation
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -v|--version)
                show_version
                exit 0
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            --uninstall)
                UNINSTALL_MODE=true
                ;;
            -*)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
            *)
                # Positional argument = project directory
                if [[ -z "$PROJECT_DIR" ]]; then
                    PROJECT_DIR="$1"
                else
                    echo "Error: Multiple project directories specified"
                    exit 1
                fi
                ;;
        esac
        shift
    done
}

# Entry point
parse_args "$@"

if [[ "$UNINSTALL_MODE" == true ]]; then
    uninstall_project
else
    main
fi
