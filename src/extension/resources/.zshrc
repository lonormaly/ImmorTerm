# ImmorTerm Custom .zshrc
# This file is used via ZDOTDIR to inject shell-init.zsh into the shell startup
# It sources the user's .zshrc first, then ImmorTerm init to ensure our hooks have precedence

# Reset ZDOTDIR and source the user's real .zshrc FIRST
# (Any screen title hooks they have will be registered here)
export ZDOTDIR="$HOME"
if [[ -f "$HOME/.zshrc" ]]; then
    source "$HOME/.zshrc"
fi

# Source ImmorTerm shell initialization AFTER user's .zshrc
# This ensures we can remove conflicting hooks and have the final say on titles
if [[ -n "$SCREEN_PROJECT_DIR" && -f "$SCREEN_PROJECT_DIR/.vscode/terminals/shell-init.zsh" ]]; then
    source "$SCREEN_PROJECT_DIR/.vscode/terminals/shell-init.zsh"
fi
