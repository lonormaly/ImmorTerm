#!/bin/bash
# Extracts dev ports from package.json files
# Agents should run this before E2E/Playwright tests to get current ports
#
# Usage: .claude/scripts/get-dev-ports.sh [--json]
#
# Output (default):
#   web=3010
#   api=3001
#
# Output (--json):
#   {"web":{"port":3010,"url":"http://localhost:3010"},"api":{"port":3001,"url":"http://localhost:3001"}}

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Extract port from package.json dev script (looks for --port XXXX or -p XXXX)
extract_port() {
  local pkg_json="$1"
  local default_port="$2"

  if [[ -f "$pkg_json" ]]; then
    # Try to extract --port or -p followed by a number
    local port=$(grep -o '"dev":[^}]*' "$pkg_json" | grep -oE '(-p|--port)\s*[0-9]+' | grep -oE '[0-9]+' | head -1)
    if [[ -n "$port" ]]; then
      echo "$port"
      return
    fi
  fi
  echo "$default_port"
}

# Get ports from package.json files
WEB_PORT=$(extract_port "$PROJECT_ROOT/apps/web/package.json" "3000")
API_PORT=$(extract_port "$PROJECT_ROOT/services/api/package.json" "3001")

# Fallback: check for PORT in .env files or use defaults
if [[ "$API_PORT" == "3001" ]] && [[ -f "$PROJECT_ROOT/services/api/.env" ]]; then
  env_port=$(grep -E '^PORT=' "$PROJECT_ROOT/services/api/.env" | cut -d= -f2 | tr -d ' "'"'" | head -1)
  [[ -n "$env_port" ]] && API_PORT="$env_port"
fi

# Output format
if [[ "$1" == "--json" ]]; then
  cat <<EOF
{"web":{"port":$WEB_PORT,"url":"http://localhost:$WEB_PORT"},"api":{"port":$API_PORT,"url":"http://localhost:$API_PORT"}}
EOF
else
  echo "web=$WEB_PORT"
  echo "api=$API_PORT"
  echo ""
  echo "# URLs for Playwright/E2E:"
  echo "# Web App: http://localhost:$WEB_PORT"
  echo "# API:     http://localhost:$API_PORT"
fi
