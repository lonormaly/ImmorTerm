# ImmorTerm Shell Initialization
# This file is sourced automatically for each ImmorTerm screen session
# Provides dynamic window title with "last activity" timestamp

# Only run inside screen sessions
[[ -z "$STY" ]] && return

# Use the same screen binary that created this session (screen vs immorterm use different sockets)
SCREEN_CMD="${IMMORTERM_SCREEN_BINARY:-immorterm}"

# Initialize base name (separate from display name to prevent timestamp pollution)
# IMMORTERM_BASE_NAME stores ONLY the base name, never timestamps
if [[ -z "${IMMORTERM_BASE_NAME:-}" ]]; then
    export IMMORTERM_BASE_NAME="${SCREEN_WINDOW_NAME:-zsh}"
fi

# Track last update time for debouncing (prevents rapid-fire updates during Claude sessions)
_IMMORTERM_LAST_UPDATE=0

# WORKING VERSION - with debouncing and screen setenv for renames
_immorterm_title_update() {
    # Debounce: skip if updated within last 2 seconds
    # This prevents visual artifacts during rapid terminal output (e.g., Claude interactive)
    local now=$(date +%s)
    if (( now - _IMMORTERM_LAST_UPDATE < 2 )); then
        return
    fi
    _IMMORTERM_LAST_UPDATE=$now

    # Check for pending rename via screen environment (set by VS Code rename command)
    # This replaces the file-based IPC approach for cleaner communication
    local pending_name
    pending_name=$("$SCREEN_CMD" -Q echo '$IMMORTERM_PENDING_RENAME' 2>/dev/null)
    # screen -Q returns the literal string if not set, so check for both empty and unexpanded
    if [[ -n "$pending_name" && "$pending_name" != '$IMMORTERM_PENDING_RENAME' ]]; then
        export IMMORTERM_BASE_NAME="$pending_name"
        # Clear the pending rename so it's not picked up again
        "$SCREEN_CMD" -X setenv IMMORTERM_PENDING_RENAME "" 2>/dev/null
    fi

    # Screen title is just the base name (timestamp shown separately on right side of status bar)
    # Note: Last activity time is tracked via log file mtime, not shell hooks
    "$SCREEN_CMD" -X title "$IMMORTERM_BASE_NAME" 2>/dev/null

    # VS Code tab gets clean name without timestamp
    # OSC 0 sequence goes directly to VS Code's PTY, bypassing screen
    printf '\033]0;%s\007' "$IMMORTERM_BASE_NAME" > /dev/tty
}

# Remove any conflicting screen title hooks from user's .zshrc
# (These might have been registered before shell-init.zsh and would override our clean titles)
precmd_functions=(${precmd_functions:#_screen_title_update})
preexec_functions=(${preexec_functions:#_screen_title_update})

# Register precmd hook
if [[ ! " ${precmd_functions[*]} " =~ " _immorterm_title_update " ]]; then
    precmd_functions+=(_immorterm_title_update)
fi

# Set initial title
_immorterm_title_update

# Helper function to rename window manually
sname() {
    if [[ -z "$1" ]]; then
        echo "Usage: sname <name> or sname !<name> (pinned, no timestamp)"
        return 1
    fi

    local name="$1"

    if [[ "$name" == \!* ]]; then
        # Pinned mode - remove hook and set title without date
        precmd_functions=(${precmd_functions:#_immorterm_title_update})
        local pinned_title="${name#!}"
        "$SCREEN_CMD" -X title "$pinned_title" 2>/dev/null
        printf '\033]0;%s\007' "$pinned_title" > /dev/tty
    else
        # Normal mode - update the base name
        export IMMORTERM_BASE_NAME="$name"
        # Re-add hook if removed
        if [[ ! " ${precmd_functions[*]} " =~ " _immorterm_title_update " ]]; then
            precmd_functions+=(_immorterm_title_update)
        fi
        _immorterm_title_update
    fi
}
