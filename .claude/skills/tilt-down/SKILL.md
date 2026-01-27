---
name: tilt-down
description: Stop Pexit development environment with Tilt. Use this skill to gracefully stop services and clean up resources. ALWAYS use this instead of running `tilt down` directly.
allowed-tools: Bash, Read
---

# Tilt Down - Stop Development Environment

**CRITICAL**: NEVER run `tilt down` directly! Always use the shutdown script.

## Usage

```bash
./scripts/tilt_down.sh [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--local` | Target local k3d cluster |
| `--force` | Force stop without confirmation |
| `--clean` | Also clean up orphaned resources |

## Examples

```bash
# Stop remote development (default)
./scripts/tilt_down.sh

# Stop local k3d development
./scripts/tilt_down.sh --local

# Force stop with cleanup
./scripts/tilt_down.sh --force --clean
```

## What the Script Does

1. Gracefully stops Tilt processes
2. Cleans up port forwards
3. Removes orphaned k8s resources
4. Handles both local and remote contexts

## Troubleshooting

**Tilt not stopping**
```bash
./scripts/tilt_down.sh --force
```

**Orphaned resources**
```bash
./scripts/tilt_down.sh --clean
```

**Manual cleanup if needed**
```bash
pkill -f "tilt"
kubectl delete pods -l app.kubernetes.io/name=pexit -n pexit-dev-shai
```
