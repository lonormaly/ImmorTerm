# ImmorTerm Shell Initialization
# This file is sourced automatically for each ImmorTerm screen session
# Provides dynamic window title with "last activity" timestamp

# Only run inside screen sessions
[[ -z "$STY" ]] && return

# Initialize SCREEN_WINDOW_NAME if not already set by screen-auto
if [[ -z "${SCREEN_WINDOW_NAME:-}" ]]; then
    export SCREEN_WINDOW_NAME="zsh"
fi

# Track state
typeset -g _IMMORTERM_LAST_MINUTE=""
typeset -g _IMMORTERM_PINNED=false

# Update title with "last activity" timestamp on each command
_immorterm_title_update() {
    # If pinned, do nothing
    [[ "$_IMMORTERM_PINNED" == true ]] && return

    # Get current minute (optimization: skip if same minute, display wouldn't change)
    local current_minute="$(date '+%d/%m-%H:%M')"
    [[ "$current_minute" == "$_IMMORTERM_LAST_MINUTE" ]] && return

    _IMMORTERM_LAST_MINUTE="$current_minute"
    screen -X title "${current_minute} ${SCREEN_WINDOW_NAME}" 2>/dev/null
}

# Register precmd hook (runs after each command)
if [[ ! " ${precmd_functions[*]} " =~ " _immorterm_title_update " ]]; then
    precmd_functions+=(_immorterm_title_update)
fi

# Set initial title
_immorterm_title_update

# Helper function to rename window manually
# Usage: sname <name>     - Set name with auto-updating activity timestamp
#        sname !<name>    - Pin name (no timestamp, no auto-updates)
sname() {
    if [[ -z "$1" ]]; then
        echo "Usage: sname <name> or sname !<name> (pinned, no timestamp)"
        return 1
    fi

    local name="$1"

    if [[ "$name" == \!* ]]; then
        # Pinned mode - disable auto-updates, set title without timestamp
        _IMMORTERM_PINNED=true
        precmd_functions=(${precmd_functions:#_immorterm_title_update})
        screen -X title "${name#!}" 2>/dev/null
    else
        # Normal mode - update name and refresh timestamp
        _IMMORTERM_PINNED=false
        export SCREEN_WINDOW_NAME="$name"
        _IMMORTERM_LAST_MINUTE=""  # Force immediate update
        # Re-add hook if it was removed
        if [[ ! " ${precmd_functions[*]} " =~ " _immorterm_title_update " ]]; then
            precmd_functions+=(_immorterm_title_update)
        fi
        _immorterm_title_update
    fi
}
