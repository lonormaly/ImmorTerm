#!/bin/bash
# ImmorTerm One-Liner Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/lonormaly/ImmorTerm/main/install.sh | bash

set -e

REPO_URL="https://github.com/lonormaly/ImmorTerm.git"
TEMP_DIR=$(mktemp -d)

cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo ""
echo "  ╔════════════════════════════════════════════════════════════════╗"
echo "  ║                                                                ║"
echo "  ║        ImmorTerm - Terminals that survive VS Code crashes      ║"
echo "  ║                                                                ║"
echo "  ╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check for git
if ! command -v git &> /dev/null; then
    echo "Error: git is required but not installed."
    echo "Please install git and try again."
    exit 1
fi

echo "Downloading ImmorTerm..."
git clone --depth 1 "$REPO_URL" "$TEMP_DIR/ImmorTerm" 2>/dev/null

echo "Starting installer..."
echo ""

# Run the main installer
bash "$TEMP_DIR/ImmorTerm/src/installer.sh"
