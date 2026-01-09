#!/usr/bin/env zsh
# ImmorTerm Shell Wrapper
# This script is used as screen's shell to inject shell-init.zsh into the shell startup.
# It uses ZDOTDIR to point to a custom .zshrc that sources our init before the user's .zshrc.

# Set ZDOTDIR to use our custom .zshrc (which sources shell-init.zsh then chains to ~/.zshrc)
export ZDOTDIR="${SCREEN_PROJECT_DIR}/.vscode/terminals"

# Execute the real shell (login shell) - it will load $ZDOTDIR/.zshrc
exec zsh -l
