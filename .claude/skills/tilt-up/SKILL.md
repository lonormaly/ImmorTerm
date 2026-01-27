---
name: tilt-up
description: Start Pexit development environment with Tilt. Use this skill to deploy services to local k3d or remote Hetzner cluster. ALWAYS use this instead of running `tilt up` directly.
allowed-tools: Bash, Read
---

# Tilt Up - Start Development Environment

**CRITICAL**: NEVER run `tilt up` directly! Always use the startup script.

## Usage

```bash
./scripts/tilt_up.sh [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--local` | Use local k3d cluster (port 10360) |
| `--port PORT` | Override default port |
| `--services api,web,...` | Only start specific services |

## Modes

| Mode | Command | Cluster | Port | Use Case |
|------|---------|---------|------|----------|
| Remote (default) | `./scripts/tilt_up.sh` | pexit-hetzner | 10361 | Deploy to dev-shai VPS |
| Local | `./scripts/tilt_up.sh --local` | k3d-pexit | 10360 | Local k3d development |

## Examples

```bash
# Remote development (default) - deploys to Hetzner dev-shai
./scripts/tilt_up.sh

# Local development with k3d
./scripts/tilt_up.sh --local

# Only start API and Web services
./scripts/tilt_up.sh --services api,web

# Custom port
./scripts/tilt_up.sh --port 10365
```

## What the Script Does

1. Checks for existing Tilt processes and handles conflicts
2. Sets correct kubernetes context (k3d-pexit or pexit-hetzner)
3. Selects appropriate Tiltfile (local or remote)
4. Manages port forwarding
5. Handles graceful cleanup on exit

## Services Available

| Service | Port | Description |
|---------|------|-------------|
| api | 3001 | Hono API server |
| worker | 3002 | BullMQ job processor |
| web | 3010 | Next.js frontend |
| storybook | 6006 | UI component library |
| redis | 6379 | Queue backend |

## Checking Status

After starting, check resource status:
```bash
tilt --port 10361 get uiresources  # Remote
tilt --port 10360 get uiresources  # Local
```

## Troubleshooting

**Port already in use**
- The script handles this automatically
- Or manually: `./scripts/tilt_down.sh` first

**Context not found**
- Remote: Ensure `~/.kube/config` has pexit-hetzner context
- Local: Run `k3d cluster create pexit` first
