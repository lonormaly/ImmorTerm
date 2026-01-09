# ImmorTerm Shell Initialization
# This file is sourced automatically for each ImmorTerm screen session
# Provides dynamic window title with "last activity" timestamp

# Only run inside screen sessions
[[ -z "$STY" ]] && return

# Initialize SCREEN_WINDOW_NAME if not already set by screen-auto
if [[ -z "${SCREEN_WINDOW_NAME:-}" ]]; then
    export SCREEN_WINDOW_NAME="zsh"
fi

# WORKING VERSION - no flicker
# Updates on every command, no screen -Q queries, no OSC sequences
_immorterm_title_update() {
    # Check for pending rename from VS Code (Ctrl-Shift-R)
    # Extract session name from $STY (format: "pid.sessionname")
    local session_name="${STY#*.}"
    local pending_file="${SCREEN_PROJECT_DIR}/.vscode/terminals/pending-renames/${session_name}"
    if [[ -f "$pending_file" ]]; then
        local new_name
        new_name=$(<"$pending_file")
        if [[ -n "$new_name" ]]; then
            export SCREEN_WINDOW_NAME="$new_name"
        fi
        rm -f "$pending_file"
    fi

    screen -X title "$(date '+%d/%m-%H:%M') ${SCREEN_WINDOW_NAME}" 2>/dev/null
}

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
        screen -X title "${name#!}" 2>/dev/null
    else
        # Normal mode
        export SCREEN_WINDOW_NAME="$name"
        # Re-add hook if removed
        if [[ ! " ${precmd_functions[*]} " =~ " _immorterm_title_update " ]]; then
            precmd_functions+=(_immorterm_title_update)
        fi
        _immorterm_title_update
    fi
}
