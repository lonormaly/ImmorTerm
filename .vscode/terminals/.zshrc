# ImmorTerm Custom .zshrc
# This file is used via ZDOTDIR to inject shell-init.zsh into the shell startup
# It sources the ImmorTerm init first, then chains to the user's real .zshrc

# Source ImmorTerm shell initialization (title updates, sname function, etc.)
if [[ -n "$SCREEN_PROJECT_DIR" && -f "$SCREEN_PROJECT_DIR/.vscode/terminals/shell-init.zsh" ]]; then
    source "$SCREEN_PROJECT_DIR/.vscode/terminals/shell-init.zsh"
fi

# Reset ZDOTDIR and source the user's real .zshrc
export ZDOTDIR="$HOME"
if [[ -f "$HOME/.zshrc" ]]; then
    source "$HOME/.zshrc"
fi
