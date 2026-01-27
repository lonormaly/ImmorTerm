# ImmorTerm Product Roadmap & Business Plan

> **Vision**: The universal terminal management platform for AI-powered development.
>
> **Mission**: Free developers from the fear of losing their work — across any IDE, any machine, any AI assistant.

---

## The Big Picture

ImmorTerm is evolving from "VS Code extension" to a **unified terminal control plane**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ImmorTerm Platform                                │
│                                                                      │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│   │ VS Code │  │ Terminal│  │JetBrains│  │ Cursor  │              │
│   │Extension│  │   App   │  │ Plugin  │  │ Plugin  │              │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘              │
│        └────────────┼───────────┼────────────┘                     │
│                     │           │                                    │
│                     ▼           ▼                                    │
│        ┌────────────────────────────────────┐                       │
│        │      immorterm daemon (binary)      │                       │
│        │  • Compiled C/Rust (protected)     │                       │
│        │  • License validation embedded     │                       │
│        │  • WebSocket to cloud              │                       │
│        └────────────────────────────────────┘                       │
│                          │                                          │
│                          ▼                                          │
│        ┌────────────────────────────────────┐                       │
│        │         ImmorTerm Cloud             │                       │
│        │  • Terminal sync & persistence     │                       │
│        │  • Claude session correlation      │                       │
│        │  • Cross-machine continuity        │                       │
│        │  • Analytics & insights            │                       │
│        └────────────────────────────────────┘                       │
│                          │                                          │
│                          ▼                                          │
│        ┌────────────────────────────────────┐                       │
│        │        Web Dashboard                │                       │
│        │  • Real-time terminal monitoring   │                       │
│        │  • Multi-machine management        │                       │
│        │  • Team collaboration              │                       │
│        └────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Compiled Binary Architecture

### Why Move from Shell Scripts to Compiled Binary

**Current State (Vulnerable)**:
```
.vscode/terminals/
├── screen-auto        # Shell script - anyone can read
├── screen-reconcile   # Shell script - anyone can copy
├── screen-cleanup     # Shell script - easy to modify
├── screen-forget      # Shell script - remove license checks
└── screen-forget-all  # Shell script - instant copycat
```

**Target State (Protected)**:
```
/usr/local/bin/immorterm    # Single compiled binary
                            # All functionality inside
                            # License validation embedded
                            # Server communication encrypted
                            # Symbols stripped, obfuscated
```

### Binary Command Structure

```bash
# Installation & Auth
immorterm install           # Set up on this machine
immorterm auth login        # Authenticate with server
immorterm auth logout       # Clear credentials
immorterm auth status       # Show license info

# Daemon Management
immorterm daemon start      # Start background process
immorterm daemon stop       # Stop daemon
immorterm daemon status     # Check daemon status

# Terminal Operations (replaces shell scripts)
immorterm terminal new [name]           # Create terminal (was screen-auto)
immorterm terminal list                 # List all terminals
immorterm terminal forget <id>          # Remove terminal (was screen-forget)
immorterm terminal forget-all           # Reset all (was screen-forget-all)
immorterm terminal rename <id> <name>   # Rename terminal
immorterm terminal attach <id>          # Attach to terminal

# Sync Operations (replaces screen-reconcile)
immorterm sync push         # Push local state to server
immorterm sync pull         # Pull state from server
immorterm sync status       # Show sync status

# Claude Operations (Pro)
immorterm claude list       # List Claude sessions
immorterm claude resume <id> # Resume Claude session
immorterm claude forget <id> # Forget Claude mapping

# Project Operations
immorterm project list      # List registered projects
immorterm project add <path> # Register project
immorterm project remove <path> # Unregister project

# Snapshot Operations (Pro)
immorterm snapshot create [name]  # Create snapshot
immorterm snapshot list           # List snapshots
immorterm snapshot restore <id>   # Restore snapshot
```

### Binary Implementation (C/Rust)

```c
// immorterm.c - Core structure

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>
#include <openssl/ssl.h>

// License validation fragments (distributed throughout code)
// Removing one breaks the others - makes patching difficult
#define LICENSE_FRAG_1 0x4A7B2C1D
#define LICENSE_FRAG_2 0x8E3F5A90
#define LICENSE_FRAG_3 0x1C6D9B2E

typedef struct {
    char machine_id[64];
    char user_token[256];
    char server_url[128];
    int license_tier;      // 0=free, 1=pro, 2=team
    int terminal_limit;
    int project_limit;
    int features;          // Bitfield of enabled features
} Config;

typedef struct {
    char id[32];
    char name[64];
    char project_path[256];
    char screen_session[64];
    int source;            // SOURCE_VSCODE, SOURCE_STANDALONE, etc.
    time_t created_at;
    time_t last_active;
    char claude_session_id[64];
} Terminal;

// Feature flags (Pro features check this)
#define FEATURE_CLAUDE_RESUME   (1 << 0)
#define FEATURE_UNLIMITED_TERMS (1 << 1)
#define FEATURE_UNLIMITED_PROJ  (1 << 2)
#define FEATURE_THEMES          (1 << 3)
#define FEATURE_LOG_DUMP        (1 << 4)
#define FEATURE_MULTI_MACHINE   (1 << 5)
#define FEATURE_SNAPSHOTS       (1 << 6)
#define FEATURE_ANALYTICS       (1 << 7)

// License validation woven throughout (not centralized)
static inline int check_license_frag1(Config *cfg) {
    return (cfg->features ^ LICENSE_FRAG_1) != 0;
}

// Server communication with certificate pinning
int server_request(const char *endpoint, const char *method,
                   const char *body, char **response) {
    CURL *curl = curl_easy_init();

    // Certificate pinning - only trust our server
    curl_easy_setopt(curl, CURLOPT_PINNEDPUBLICKEY,
                     "sha256//YhKJG94Opmrv95dbak2efcpZP...");

    // ... request implementation
}

// Main entry point
int main(int argc, char **argv) {
    if (argc < 2) {
        print_usage();
        return 1;
    }

    // Distributed license check (fragment 1)
    if (!check_license_frag1(&global_config)) {
        fprintf(stderr, "License validation failed\n");
        return 1;
    }

    const char *cmd = argv[1];

    if (strcmp(cmd, "daemon") == 0) {
        return cmd_daemon(argc - 1, argv + 1);
    } else if (strcmp(cmd, "terminal") == 0) {
        // Another license fragment check
        return cmd_terminal(argc - 1, argv + 1);
    } else if (strcmp(cmd, "sync") == 0) {
        return cmd_sync(argc - 1, argv + 1);
    } else if (strcmp(cmd, "claude") == 0) {
        // Pro feature check
        if (!(global_config.features & FEATURE_CLAUDE_RESUME)) {
            fprintf(stderr, "Claude resume requires Pro. "
                    "Upgrade at https://immorterm.io/pro\n");
            return 1;
        }
        return cmd_claude(argc - 1, argv + 1);
    }
    // ... more commands

    return 0;
}
```

### Security Measures in Binary

| Technique | Purpose |
|-----------|---------|
| **Symbol stripping** | Remove function names from binary |
| **Code obfuscation** | Make disassembly harder to read |
| **Anti-debugging** | Detect debuggers, exit if found |
| **Certificate pinning** | Only communicate with our servers |
| **Distributed license checks** | Can't patch out a single check |
| **Integrity verification** | Detect if binary was modified |
| **Encrypted config** | License stored encrypted on disk |

### Build Pipeline

```yaml
# .github/workflows/build-binary.yml
name: Build ImmorTerm Binary

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, macos-14]  # Linux, macOS Intel, macOS ARM

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: |
          # Compile with optimizations and stripping
          gcc -O3 -s -fvisibility=hidden \
              -DNDEBUG \
              -o immorterm src/*.c \
              -lcurl -lssl -lcrypto

          # Additional obfuscation (optional)
          strip --strip-all immorterm

      - name: Sign (macOS)
        if: runner.os == 'macOS'
        run: |
          codesign --sign "${{ secrets.APPLE_CERT }}" immorterm

      - name: Upload
        uses: actions/upload-artifact@v4
        with:
          name: immorterm-${{ matrix.os }}
          path: immorterm
```

---

## Web Dashboard

### Dashboard Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Web Dashboard Stack                               │
│                                                                      │
│  Frontend:          Next.js 14 + App Router                         │
│  UI:                Tailwind CSS + shadcn/ui                        │
│  Real-time:         Socket.io or Ably                               │
│  Auth:              Supabase Auth (or Auth0)                        │
│  Hosting:           Vercel                                          │
│                                                                      │
│  Backend:           Next.js API Routes + Supabase                   │
│  Database:          Supabase (PostgreSQL)                           │
│  Storage:           Supabase Storage (snapshots)                    │
│  Payments:          Stripe                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Dashboard Views

#### 1. Home / Overview
```
┌──────────────────────────────────────────────────────────────────────┐
│  ImmorTerm Dashboard                    [Settings] [User ▼]          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Good morning, Shai! 👋                                              │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Machines    │  │ Terminals   │  │ Sessions    │  │ Time Saved  │ │
│  │     2       │  │     7       │  │  3 active   │  │   12.5h     │ │
│  │ 1 online    │  │ 5 running   │  │  2 Claude   │  │  this month │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                                       │
│  Recent Activity                                                      │
│  ├─ 🟢 Terminal "API Server" restored (2 min ago)                    │
│  ├─ 🤖 Claude session detected in "Debug" (15 min ago)               │
│  ├─ 💾 Auto-snapshot created (1 hour ago)                            │
│  └─ 🔴 Machine "Home MacBook" went offline (3 hours ago)             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

#### 2. Machines View
```
┌──────────────────────────────────────────────────────────────────────┐
│  Machines                                          [+ Add Machine]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 💻 MacBook Pro 16" (Work)                         Status: 🟢    │  │
│  │────────────────────────────────────────────────────────────────│  │
│  │ Machine ID: mbp-work-a1b2c3                                    │  │
│  │ OS: macOS 14.2 | ImmorTerm: v2.1.0                            │  │
│  │ Last seen: Just now | IP: 192.168.1.105                       │  │
│  │                                                                │  │
│  │ Projects on this machine:                                      │  │
│  │   📁 ~/Dev/api-service (3 terminals)                          │  │
│  │   📁 ~/Dev/frontend (2 terminals)                             │  │
│  │                                                                │  │
│  │ [View Terminals] [Sync Now] [Settings] [Remove]               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 💻 MacBook Air M2 (Home)                          Status: 🔴    │  │
│  │────────────────────────────────────────────────────────────────│  │
│  │ Last seen: 3 hours ago                                         │  │
│  │ 1 terminal was running when it went offline                   │  │
│  │                                                                │  │
│  │ [View Last State] [Forget Machine]                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

#### 3. Terminals View
```
┌──────────────────────────────────────────────────────────────────────┐
│  Terminals                    Filter: [All ▼] [All Machines ▼]       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────┬──────────────┬─────────────┬────────┬────────┬───────────┐ │
│  │ Sta │ Name         │ Project     │ Source │ Uptime │ Actions   │ │
│  ├─────┼──────────────┼─────────────┼────────┼────────┼───────────┤ │
│  │ 🟢  │ API Server   │ api-service │ VSCode │ 2h 15m │ ⋮         │ │
│  │ 🟢  │ Frontend Dev │ frontend    │ VSCode │ 1h 30m │ ⋮         │ │
│  │ 🟢  │ Database     │ api-service │ Term   │ 45m    │ ⋮         │ │
│  │ 🤖  │ Claude Debug │ api-service │ VSCode │ 30m    │ ⋮         │ │
│  │ 🟡  │ Tests        │ api-service │ VSCode │ Idle   │ ⋮         │ │
│  │ 🔴  │ Old Build    │ frontend    │ VSCode │ Dead   │ ⋮         │ │
│  └─────┴──────────────┴─────────────┴────────┴────────┴───────────┘ │
│                                                                       │
│  Legend: 🟢 Running  🟡 Idle  🔴 Dead  🤖 Claude Active              │
│                                                                       │
│  Click terminal for details, output preview, and actions             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

#### 4. Terminal Detail View
```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to Terminals                                                  │
│                                                                       │
│  Terminal: API Server                                                 │
│  ══════════════════════════════════════════════════════════════════  │
│                                                                       │
│  Status: 🟢 Running                                                   │
│  Project: ~/Dev/api-service                                          │
│  Machine: MacBook Pro (Work)                                         │
│  Source: VS Code                                                     │
│  Screen Session: api-service-12345-abc                               │
│  Created: Jan 15, 2025 at 10:30 AM                                   │
│  Uptime: 2 hours 15 minutes                                          │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Recent Output (last 50 lines)                    [View Full ↗] │  │
│  │────────────────────────────────────────────────────────────────│  │
│  │ > npm run dev                                                  │  │
│  │ > api-service@1.0.0 dev                                        │  │
│  │ > tsx watch src/index.ts                                       │  │
│  │                                                                │  │
│  │ [10:30:15] Server starting...                                  │  │
│  │ [10:30:16] Connected to database                               │  │
│  │ [10:30:16] Listening on http://localhost:3000                  │  │
│  │ [12:45:23] GET /api/users 200 45ms                             │  │
│  │ [12:45:24] GET /api/users/123 200 12ms                         │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Actions:                                                             │
│  [Rename] [Kill] [Snapshot] [View Logs] [Forget]                     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

#### 5. Claude Sessions View (Pro)
```
┌──────────────────────────────────────────────────────────────────────┐
│  Claude Sessions                                         Pro ✨       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Active Sessions                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 🤖 Implementing authentication middleware                      │  │
│  │────────────────────────────────────────────────────────────────│  │
│  │ Session ID: abc-123-def-456                                    │  │
│  │ Project: api-service | Terminal: "Claude Debug"               │  │
│  │ Machine: MacBook Pro (Work)                                   │  │
│  │ Duration: 45 minutes | Messages: 23                           │  │
│  │                                                                │  │
│  │ [View Terminal] [Create Snapshot] [End & Save]                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Recoverable Sessions (machine offline/restarted)                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 🔄 Refactoring component state management                      │  │
│  │────────────────────────────────────────────────────────────────│  │
│  │ Session ID: xyz-789-uvw-012                                    │  │
│  │ Project: frontend | Last active: 2 hours ago                  │  │
│  │ Machine: MacBook Air (offline)                                │  │
│  │                                                                │  │
│  │ Resume on: [MacBook Pro (Work) ▼]  [Resume Session]           │  │
│  │                                                                │  │
│  │ Or: [View Session History] [Discard]                          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Past Sessions (last 30 days)                                        │
│  ├─ Jan 14: "Adding user registration flow" (api-service) - 2h      │
│  ├─ Jan 13: "Fixing pagination bug" (api-service) - 45m             │
│  ├─ Jan 12: "Setting up CI/CD" (frontend) - 1h 30m                  │
│  └─ [View All History]                                               │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

#### 6. Analytics View (Pro)
```
┌──────────────────────────────────────────────────────────────────────┐
│  Analytics                                   [This Month ▼]  Pro ✨   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Your Impact                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │    47        │  │   12.5h      │  │    8         │               │
│  │  Sessions    │  │    Time      │  │   Crashes    │               │
│  │   Saved      │  │   Saved      │  │  Survived    │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                       │
│  Value Delivered                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  💰 Estimated productivity saved: $937.50                      │  │
│  │     (Based on 12.5 hours × $75/hour)                          │  │
│  │                                                                │  │
│  │  📈 You've saved 3x more time than the average user           │  │
│  │  🏆 Top 10% of ImmorTerm users                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Sessions Over Time                                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 15│       ▄▄                                                   │  │
│  │   │      ████                                                  │  │
│  │ 10│  ▄▄  ████  ▄▄                                             │  │
│  │   │ ████ ████ ████      ▄▄                                    │  │
│  │  5│ ████ ████ ████ ▄▄  ████                                   │  │
│  │   │ ████ ████ ████████ ████                                   │  │
│  │  0└─────────────────────────────                               │  │
│  │    W1   W2   W3   W4   W5                                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Most Active Projects                                                 │
│  ├─ api-service: 67% of sessions                                     │
│  ├─ frontend: 23% of sessions                                        │
│  └─ scripts: 10% of sessions                                         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Real-Time WebSocket Events

```typescript
// Dashboard WebSocket connection
const socket = io('wss://api.immorterm.io', {
  auth: { token: userToken }
});

// Events from daemon → server → dashboard
socket.on('machine:online', (data) => {
  // Machine daemon connected
  updateMachineStatus(data.machineId, 'online');
});

socket.on('machine:offline', (data) => {
  // Machine daemon disconnected
  updateMachineStatus(data.machineId, 'offline');
  showNotification(`${data.machineName} went offline`);
});

socket.on('terminal:created', (data) => {
  // New terminal created
  addTerminalToList(data);
});

socket.on('terminal:renamed', (data) => {
  // Terminal renamed
  updateTerminalName(data.terminalId, data.newName);
});

socket.on('terminal:activity', (data) => {
  // Terminal had output (heartbeat)
  updateTerminalActivity(data.terminalId);
});

socket.on('terminal:died', (data) => {
  // Screen session ended
  markTerminalDead(data.terminalId);
});

socket.on('claude:started', (data) => {
  // Claude process detected in terminal
  showClaudeIndicator(data.terminalId);
  addClaudeSession(data);
});

socket.on('claude:ended', (data) => {
  // Claude process exited
  removeClaudeIndicator(data.terminalId);
  archiveClaudeSession(data.sessionId);
});

socket.on('snapshot:created', (data) => {
  // Auto or manual snapshot created
  addSnapshotToList(data);
});
```

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Compiled Binary Architecture](#compiled-binary-architecture)
3. [Web Dashboard](#web-dashboard)
4. [The Pain Point](#the-pain-point)

1. [The Pain Point](#the-pain-point)
2. [Core Value Proposition](#core-value-proposition)
3. [Feature Roadmap](#feature-roadmap)
4. [Server-Side Feature Gating](#server-side-feature-gating)
5. [Technical Implementation](#technical-implementation)
6. [Pricing Strategy](#pricing-strategy)
7. [Revenue Projections](#revenue-projections)
8. [Complementary Products](#complementary-products)
9. [Future Features](#future-features)
10. [Go-To-Market Strategy](#go-to-market-strategy)

---

## The Pain Point

### The Problem (Pre-AI Era)
- VS Code terminals die on crash/restart
- Minor annoyance: restart your dev server, re-run commands
- Impact: 5-15 minutes of lost time

### The Problem (AI Era - NOW)
- Developers spend 60-80% of coding time in terminals with AI assistants
- Claude Code, Cursor, Copilot CLI sessions run for hours
- AI conversations build deep context over time
- A single crash destroys:
  - Hours of accumulated AI context
  - Complex multi-step workflows in progress
  - Debug sessions with rich history
  - Long-running autonomous agent tasks

### The Real Cost

```
Average developer hourly rate:           $75-150/hr
Time to rebuild context after crash:     30-90 minutes
Crashes per month (avg):                 3-5
Monthly productivity loss:               $150-675/developer

For a 10-person team:                    $1,500-6,750/month
Annual loss:                             $18,000-81,000/year
```

### Why Now?

| Trend | Impact |
|-------|--------|
| Claude Code adoption | Millions of developers using CLI AI |
| Agentic workflows | Multi-hour autonomous sessions |
| AI context is expensive | Rebuilding context wastes tokens + time |
| Remote work | Laptop restarts more common (updates, travel) |
| VS Code dominance | 70%+ market share, problem affects everyone |

---

## Core Value Proposition

### Free Tier: "Never Lose a Terminal Again"
- Basic terminal persistence through GNU Screen
- Survives VS Code crashes and restarts
- 3 persistent terminals, 1 project
- Local scroll history

### Pro Tier: "Your AI Workflow, Immortal"
- **Claude session auto-resume** (killer feature)
- Unlimited terminals and projects
- Premium themes and customization
- Log dump on restore
- Multi-machine sync
- Priority support

### Team Tier: "Terminal Persistence for Teams"
- Everything in Pro
- Shared terminal templates
- Team analytics dashboard
- SSO integration
- Admin controls
- SLA support

---

## Feature Roadmap

### Phase 1: Foundation (MVP for Monetization)
**Target: 4-6 weeks**

- [ ] **1.1 Server Infrastructure**
  - [ ] Set up Supabase/Firebase backend
  - [ ] User authentication (email + GitHub OAuth)
  - [ ] License validation endpoint
  - [ ] Stripe integration for payments
  - [ ] Basic admin dashboard

- [ ] **1.2 License Enforcement in Extension**
  - [ ] License check on extension activation
  - [ ] Graceful degradation for free tier
  - [ ] Upgrade prompts (non-intrusive)
  - [ ] Offline grace period (7 days cached license)

- [ ] **1.3 Terminal Limit (Free: 3)**
  - [ ] Track persistent terminal count
  - [ ] Server-side validation of terminal count
  - [ ] 4th+ terminals work but aren't persisted
  - [ ] Clear messaging: "This terminal won't survive restart"

- [ ] **1.4 Project Limit (Free: 1)**
  - [ ] Server tracks registered projects per user
  - [ ] Project registration on first ImmorTerm use
  - [ ] Clear messaging for additional projects
  - [ ] Easy project switching for Pro users

### Phase 2: Killer Features
**Target: 6-8 weeks after Phase 1**

- [ ] **2.1 Claude Session Auto-Resume (Pro)**
  - [ ] Store terminal ↔ Claude UUID mapping on server
  - [ ] Detect Claude process in terminal
  - [ ] Content-based session correlation algorithm
  - [ ] Auto-inject `claude --resume {uuid}` on restore
  - [ ] "Session available" notification for free users

- [ ] **2.2 Premium Themes (Pro)**
  - [ ] Design 10-15 premium themes
  - [ ] Theme API endpoint (serves to Pro users only)
  - [ ] Theme preview in settings
  - [ ] Custom screenrc styling per theme
  - [ ] Status bar color customization

- [ ] **2.3 Log Dump on Restore (Pro)**
  - [ ] Settings: lines to show (10/25/50/100/all)
  - [ ] Settings: always/ask/never
  - [ ] Formatted output with separator
  - [ ] Searchable log viewer panel

### Phase 3: Power Features
**Target: 8-12 weeks after Phase 2**

- [ ] **3.1 Cross-Machine Claude Session Continuity (Pro) ⭐ KILLER FEATURE**
  - [ ] Session transfer preparation workflow
    - [ ] Detect uncommitted git changes
    - [ ] Prompt: "Commit & Push before switching?"
    - [ ] Auto-commit with ImmorTerm checkpoint message
    - [ ] Upload session (.jsonl) to ImmorTerm cloud
  - [ ] Session resume on different machine
    - [ ] Detect available sessions from other machines
    - [ ] Show session details: last message, git state, time ago
    - [ ] Git state comparison (commits behind?)
    - [ ] Guided "Pull & Resume" workflow
    - [ ] Download session, restore, auto-run `claude --resume`
  - [ ] Dashboard management
    - [ ] List of transferable sessions
    - [ ] Sessions with uncommitted changes (warnings)
    - [ ] "Continue on [Machine X]" quick action
    - [ ] Session history across machines
  - [ ] Edge cases
    - [ ] Path differences between machines (project path mapping)
    - [ ] Stash support for uncommitted changes
    - [ ] Conflict detection and resolution
    - [ ] Offline machine handling

- [ ] **3.2 Multi-Machine Terminal Sync (Pro)**
  - [ ] Sync terminal configurations across machines
  - [ ] Conflict resolution for same project on multiple machines
  - [ ] Terminal layout templates per project

- [ ] **3.2 Terminal Templates (Pro)**
  - [ ] Save terminal layout as template
  - [ ] Quick-start templates (Node dev, Python dev, etc.)
  - [ ] Community template marketplace

- [ ] **3.3 Session Snapshots (Pro)**
  - [ ] Manual snapshot: save entire workspace state
  - [ ] Auto-snapshot on VS Code close
  - [ ] Snapshot history (last 10)
  - [ ] Restore from any snapshot

### Phase 4: Team Features
**Target: 12-16 weeks after Phase 3**

- [ ] **4.1 Team Management**
  - [ ] Team creation and member management
  - [ ] Role-based access (admin, member)
  - [ ] Centralized billing

- [ ] **4.2 Shared Terminal Templates**
  - [ ] Team-wide template library
  - [ ] Template versioning
  - [ ] "Official" team templates

- [ ] **4.3 Team Analytics**
  - [ ] Time saved per team member
  - [ ] Sessions recovered from crashes
  - [ ] Usage patterns and insights

- [ ] **4.4 Enterprise Features**
  - [ ] SSO (SAML, OIDC)
  - [ ] Audit logs
  - [ ] Custom data retention policies
  - [ ] On-premise option discussion

---

## Server-Side Feature Gating

### 10 Features That MUST Come From Server (Can't Be Pirated)

#### 1. Premium Themes
```typescript
// Themes don't exist locally - must fetch from server
GET /api/themes
Authorization: Bearer {pro_token}

Response (Pro user):
{
  themes: [
    { id: "dracula-pro", name: "Dracula Pro", config: {...} },
    { id: "tokyo-night", name: "Tokyo Night", config: {...} },
    // ... 13 more themes
  ]
}

Response (Free user):
{
  themes: [] // Empty - no pro themes
}
```

**Why it works**: The theme configurations literally don't exist on the user's machine. No server access = no themes.

---

#### 2. Claude Session Mappings
```typescript
// Session correlations stored server-side
POST /api/claude/sessions
{
  terminalId: "proj-12345-abc",
  claudeSessionId: "uuid-from-correlation",
  projectPath: "/Users/dev/myproject"
}

GET /api/claude/sessions?project=/Users/dev/myproject
Authorization: Bearer {pro_token}

Response (Pro user):
{
  sessions: [
    { terminalId: "proj-12345-abc", claudeSessionId: "abc-123-..." },
    { terminalId: "proj-67890-def", claudeSessionId: "def-456-..." }
  ]
}

Response (Free user):
{
  sessions: [] // Not available
}
```

**Why it works**: The correlation algorithm runs locally, but results are stored on server. Free users can't retrieve the mappings.

---

#### 3. Terminal Templates Library
```typescript
GET /api/templates
Authorization: Bearer {token}

Response (Pro user):
{
  templates: [
    {
      id: "nodejs-fullstack",
      name: "Node.js Full Stack",
      description: "API server + Frontend dev + Test runner",
      terminals: [
        { name: "API", command: "npm run dev:api", cwd: "./backend" },
        { name: "Frontend", command: "npm run dev", cwd: "./frontend" },
        { name: "Tests", command: "npm run test:watch", cwd: "." }
      ]
    },
    // ... more templates
  ],
  community: [...], // Community-submitted templates
  team: [...]       // Team-specific templates (Team tier)
}

Response (Free user):
{
  templates: [
    { id: "basic", name: "Basic", terminals: [{ name: "Terminal 1" }] }
  ],
  community: [],
  team: []
}
```

**Why it works**: Premium and community templates only exist on server.

---

#### 4. Multi-Machine Sync Configuration
```typescript
// Sync terminal configs across machines
POST /api/sync/terminals
{
  machineId: "macbook-home",
  projectPath: "/Users/dev/myproject",
  terminals: [
    { id: "abc", name: "API Server", ... },
    { id: "def", name: "Frontend", ... }
  ]
}

GET /api/sync/terminals?project=/path
Authorization: Bearer {pro_token}

// Returns terminals from OTHER machines
Response: {
  machines: [
    {
      machineId: "macbook-work",
      lastSeen: "2024-01-15T10:30:00Z",
      terminals: [...]
    }
  ]
}
```

**Why it works**: Cross-machine sync inherently requires a server. No bypass possible.

---

#### 5. Session Snapshots (Cloud Storage)
```typescript
POST /api/snapshots
{
  projectPath: "/Users/dev/myproject",
  snapshot: {
    terminals: [...],
    claudeSessions: [...],
    timestamp: "2024-01-15T10:30:00Z",
    metadata: { vscodeVersion: "1.85", os: "darwin" }
  }
}

GET /api/snapshots?project=/path&limit=10
Authorization: Bearer {pro_token}

Response (Pro user):
{
  snapshots: [
    { id: "snap-123", timestamp: "...", terminals: 4 },
    { id: "snap-122", timestamp: "...", terminals: 3 },
    // ... last 10 snapshots
  ]
}
```

**Why it works**: Snapshots stored in cloud. Local-only = no snapshot history.

---

#### 6. Analytics & Insights Dashboard
```typescript
GET /api/analytics/personal
Authorization: Bearer {pro_token}

Response:
{
  timeframe: "last_30_days",
  metrics: {
    sessionsSaved: 47,
    estimatedTimeSaved: "12h 30m",
    crashesRecovered: 8,
    terminalsRestored: 156,
    claudeSessionsResumed: 23
  },
  streaks: {
    currentStreak: 14, // days using ImmorTerm
    longestStreak: 45
  },
  insights: [
    "You've saved approximately $937 in productivity this month",
    "Your most active project: myproject (67% of sessions)"
  ]
}
```

**Why it works**: Analytics computed server-side from usage data. Generates personalized insights and "value proof" for renewal.

---

#### 7. AI-Powered Terminal Naming
```typescript
POST /api/ai/suggest-name
Authorization: Bearer {pro_token}
{
  terminalOutput: "npm run dev\n> myapp@1.0.0 dev\n> vite\n\nVITE v5.0.0 ready in 500ms\n➜ Local: http://localhost:5173/",
  projectPath: "/Users/dev/myproject",
  existingNames: ["API Server", "Tests"]
}

Response:
{
  suggestions: [
    { name: "Frontend Dev", confidence: 0.95 },
    { name: "Vite Server", confidence: 0.82 },
    { name: "Dev Server", confidence: 0.78 }
  ]
}
```

**Why it works**: AI inference runs on server. Can't replicate without the model.

---

#### 8. Terminal Recording & Playback
```typescript
POST /api/recordings/start
{
  terminalId: "proj-123-abc",
  projectPath: "/path"
}

POST /api/recordings/stop
{
  recordingId: "rec-456"
}

GET /api/recordings?project=/path
Authorization: Bearer {pro_token}

Response:
{
  recordings: [
    {
      id: "rec-456",
      name: "Debug session - auth bug",
      duration: "15:32",
      timestamp: "2024-01-15",
      downloadUrl: "https://..." // Time-limited signed URL
    }
  ]
}
```

**Why it works**: Recordings stored in cloud storage. Server controls access and generates signed URLs.

---

#### 9. Custom Keyboard Shortcuts Sync
```typescript
POST /api/settings/keybindings
{
  keybindings: [
    { command: "immorterm.newTerminal", key: "cmd+shift+t" },
    { command: "immorterm.closeTerminal", key: "cmd+shift+w" },
    { command: "immorterm.nextTerminal", key: "cmd+shift+]" }
  ]
}

GET /api/settings/keybindings
Authorization: Bearer {pro_token}

// Syncs keybindings across machines
```

**Why it works**: Custom keybindings sync across machines via server. Free tier = local only.

---

#### 10. Integration Tokens (API Access)
```typescript
POST /api/integrations/tokens
Authorization: Bearer {pro_token}
{
  name: "CI/CD Pipeline",
  scopes: ["read:terminals", "write:snapshots"],
  expiresIn: "90d"
}

Response:
{
  token: "imt_live_abc123...",
  expiresAt: "2024-04-15T00:00:00Z"
}

// Use in CI/CD or scripts:
curl -H "Authorization: Bearer imt_live_abc123" \
  https://api.immorterm.io/v1/snapshots
```

**Why it works**: API access for automation and integrations. Only available to Pro users.

---

### Additional Server-Gated Features (Bonus Ideas)

#### 11. Terminal Health Monitoring
```typescript
// Server monitors terminal session health
// Alerts if session dies unexpectedly
POST /api/health/report
{
  terminalId: "proj-123",
  status: "healthy" | "warning" | "dead",
  metrics: { cpu: 5, memory: 120 }
}

// Push notification when long-running terminal dies
// "Your API server terminal stopped unexpectedly"
```

#### 12. Scheduled Terminal Commands
```typescript
// Run commands on schedule (cron-like)
POST /api/schedules
{
  terminalId: "proj-123",
  schedule: "0 9 * * *", // Every day at 9am
  command: "git pull && npm run build"
}
```

#### 13. Terminal Output Search (Indexed Logs)
```typescript
// Full-text search across all terminal history
GET /api/search?q=error+connection+refused&project=/path
Authorization: Bearer {pro_token}

Response:
{
  results: [
    {
      terminalId: "proj-123",
      timestamp: "2024-01-15T10:30:00Z",
      line: 1547,
      content: "Error: Connection refused at localhost:5432",
      context: ["...", "Error: Connection refused...", "..."]
    }
  ]
}
```

#### 14. Team Activity Feed
```typescript
// See what teammates are working on
GET /api/team/activity
Authorization: Bearer {team_token}

Response:
{
  activity: [
    { user: "alice", event: "started_terminal", project: "api", time: "5m ago" },
    { user: "bob", event: "restored_session", project: "frontend", time: "1h ago" },
    { user: "carol", event: "shared_template", name: "Debug Setup", time: "2h ago" }
  ]
}
```

#### 15. Compliance & Audit Logs (Enterprise)
```typescript
GET /api/enterprise/audit-logs
Authorization: Bearer {enterprise_token}

Response:
{
  logs: [
    { timestamp: "...", user: "alice", action: "terminal_created", details: {...} },
    { timestamp: "...", user: "bob", action: "claude_session_resumed", details: {...} },
    { timestamp: "...", user: "admin", action: "user_added", details: {...} }
  ],
  pagination: { total: 10523, page: 1, perPage: 100 }
}
```

---

## Technical Implementation

### Server Stack (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Dashboard)                      │
│              Next.js + Tailwind + shadcn/ui                 │
│         Hosted on Vercel (free tier to start)               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
│                   Next.js API Routes                         │
│               or Separate Express/Fastify                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Database                              │
│                        Supabase                              │
│  • PostgreSQL (users, licenses, terminals, analytics)       │
│  • Auth (email, GitHub, Google)                             │
│  • Storage (snapshots, recordings)                          │
│  • Realtime (sync, notifications)                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Payment Processing                       │
│                          Stripe                              │
│  • Subscriptions (Pro monthly/yearly, Team)                 │
│  • Customer Portal (manage subscription)                    │
│  • Webhooks (subscription events)                           │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  github_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Licenses
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'team'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  valid_until TIMESTAMPTZ,
  limits JSONB DEFAULT '{"terminals": 3, "projects": 1}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects (for limit enforcement)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  path_hash TEXT NOT NULL, -- SHA256 of project path (privacy)
  display_name TEXT,
  machine_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, path_hash)
);

-- Terminal Sessions
CREATE TABLE terminal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  terminal_id TEXT NOT NULL,
  name TEXT,
  claude_session_id TEXT, -- The killer feature
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Themes
CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier_required TEXT NOT NULL DEFAULT 'pro',
  config JSONB NOT NULL,
  preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id), -- NULL for official templates
  team_id UUID REFERENCES teams(id), -- NULL for personal/official
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL, -- 'session_restored', 'crash_recovered', etc.
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

-- Snapshots
CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  config JSONB NOT NULL,
  storage_path TEXT, -- Path in Supabase Storage
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### VS Code Extension Changes

```typescript
// src/extension/src/license/license-manager.ts

interface License {
  tier: 'free' | 'pro' | 'team';
  validUntil: Date | null;
  limits: {
    terminals: number;      // 3 for free, Infinity for pro
    projects: number;       // 1 for free, Infinity for pro
  };
  features: {
    claudeResume: boolean;  // false for free
    themes: boolean;        // false for free
    logDump: boolean;       // false for free
    multiMachine: boolean;  // false for free
    templates: boolean;     // false for free
    analytics: boolean;     // false for free
  };
}

class LicenseManager {
  private license: License;
  private cachedAt: Date;
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

  async validateLicense(): Promise<License> {
    // Check cache first (offline support)
    const cached = this.getCachedLicense();
    if (cached && !this.isCacheExpired()) {
      return cached;
    }

    try {
      const response = await fetch('https://api.immorterm.io/v1/license', {
        headers: { Authorization: `Bearer ${this.getToken()}` }
      });

      if (!response.ok) {
        return this.getFreeTierLicense();
      }

      const license = await response.json();
      this.cacheicense(license);
      return license;
    } catch (error) {
      // Offline: use cached or free tier
      return cached || this.getFreeTierLicense();
    }
  }

  canCreatePersistentTerminal(): boolean {
    const current = this.getPersistedTerminalCount();
    return current < this.license.limits.terminals;
  }

  canAddProject(projectPath: string): boolean {
    // Check with server
    return this.registeredProjects.length < this.license.limits.projects;
  }

  hasFeature(feature: keyof License['features']): boolean {
    return this.license.features[feature];
  }
}
```

### API Endpoints

```typescript
// /api/v1/license
GET  /license              // Get current license status
POST /license/activate     // Activate license key

// /api/v1/projects
GET  /projects             // List registered projects
POST /projects             // Register new project
DEL  /projects/:id         // Remove project

// /api/v1/terminals
GET  /terminals            // List terminals (for sync)
POST /terminals            // Register terminal
PUT  /terminals/:id        // Update terminal (name, etc.)
DEL  /terminals/:id        // Remove terminal

// /api/v1/claude
GET  /claude/sessions      // Get Claude session mappings
POST /claude/sessions      // Store new mapping
DEL  /claude/sessions/:id  // Remove mapping

// /api/v1/themes
GET  /themes               // List available themes (filtered by tier)
GET  /themes/:id           // Get theme config

// /api/v1/templates
GET  /templates            // List templates
GET  /templates/:id        // Get template
POST /templates            // Create template (Pro)
PUT  /templates/:id        // Update template
DEL  /templates/:id        // Delete template

// /api/v1/snapshots
GET  /snapshots            // List snapshots
GET  /snapshots/:id        // Get snapshot
POST /snapshots            // Create snapshot
DEL  /snapshots/:id        // Delete snapshot

// /api/v1/analytics
GET  /analytics/personal   // Personal stats
GET  /analytics/team       // Team stats (Team tier)

// /api/v1/sync
POST /sync/push            // Push local state to server
GET  /sync/pull            // Pull state from server
```

---

## Pricing Strategy

### Pricing Tiers

| Feature | Free | Pro ($8/mo or $72/yr) | Team ($15/user/mo) |
|---------|------|----------------------|-------------------|
| Persistent terminals | 3 | Unlimited | Unlimited |
| Projects | 1 | Unlimited | Unlimited |
| Claude auto-resume | - | ✓ | ✓ |
| Premium themes | - | 15+ | 15+ + custom |
| Log dump on restore | - | ✓ | ✓ |
| Terminal templates | - | ✓ | ✓ + team library |
| Multi-machine sync | - | ✓ | ✓ |
| Session snapshots | - | 10 history | 50 history |
| Analytics | - | Personal | Team dashboard |
| API access | - | ✓ | ✓ |
| Support | Community | Email (48h) | Priority (24h) |
| SSO | - | - | ✓ |
| Audit logs | - | - | ✓ |

### Why These Prices?

```
$8/month Pro rationale:
- Below "needs manager approval" threshold ($10)
- "Two coffees" mental model
- Comparable: GitHub Copilot ($10), Raycast Pro ($8)
- Annual discount: $72/year = 25% off = strong incentive

$15/user/month Team rationale:
- Standard B2B SaaS pricing
- Below enterprise threshold but sustainable
- Comparable: Linear ($8), Notion ($10), Slack ($15)
```

### Conversion Funnel

```
Free users (100%)
    │
    │ Use for 2+ weeks
    ▼
Active free users (40%)
    │
    │ Hit limits or want premium features
    ▼
Trial Pro (15%)
    │
    │ 14-day trial
    ▼
Convert to Pro (30% of trials = 4.5% of total)
    │
    │ Teams adopt
    ▼
Upgrade to Team (10% of Pro = 0.45% of total)
```

---

## Revenue Projections

### Assumptions

```yaml
Market:
  vs_code_users: 35,000,000
  ai_tool_users: 12,000,000  # Copilot, Claude, Cursor
  heavy_terminal_users: 30%  # 3,600,000
  addressable_market: 3,600,000

Acquisition:
  year_1_reach: 0.5%  # 18,000 users
  year_2_reach: 2%    # 72,000 users
  year_3_reach: 5%    # 180,000 users

Conversion:
  free_to_pro: 5%
  pro_to_team: 10%
  annual_vs_monthly: 40% annual

Pricing:
  pro_monthly: $8
  pro_annual: $72
  team_monthly: $15

Churn:
  monthly: 5%
  annual: 15%
```

### Year 1 Projection (Conservative)

```
Month 1-3: Building & Launch
- Focus: MVP, payment integration, launch
- Users: 500 → 2,000
- Paid: 0 → 50
- MRR: $0 → $400

Month 4-6: Early Traction
- Focus: Content marketing, ProductHunt launch
- Users: 2,000 → 8,000
- Paid: 50 → 300
- MRR: $400 → $2,400

Month 7-9: Growth
- Focus: Feature expansion, partnerships
- Users: 8,000 → 15,000
- Paid: 300 → 600
- MRR: $2,400 → $4,800

Month 10-12: Scale
- Focus: Team tier, enterprise outreach
- Users: 15,000 → 25,000
- Paid: 600 → 1,000
- MRR: $4,800 → $8,500

Year 1 Total:
- Total users: 25,000
- Paid users: 1,000 (4%)
- ARR: ~$100,000
```

### Year 2 Projection (Moderate Growth)

```
Users: 25,000 → 80,000
Paid users: 1,000 → 5,000 (6.25%)
Average revenue per user: $10/month (mix of Pro + Team)
MRR by end of year: $50,000
ARR: $600,000

Key milestones:
- Q1: Team tier launch
- Q2: First enterprise customer
- Q3: Integration partnerships (Cursor, etc.)
- Q4: International expansion
```

### Year 3 Projection (Scale)

```
Users: 80,000 → 200,000
Paid users: 5,000 → 18,000 (9%)
Average revenue per user: $12/month
MRR by end of year: $216,000
ARR: $2,600,000

Key milestones:
- Q1: Series A or profitable
- Q2: Enterprise tier launch
- Q3: 50+ team customers
- Q4: Potential acquisition interest
```

### Revenue Sensitivity Analysis

| Scenario | Y1 ARR | Y2 ARR | Y3 ARR |
|----------|--------|--------|--------|
| Conservative (3% conversion) | $60K | $360K | $1.5M |
| Moderate (5% conversion) | $100K | $600K | $2.6M |
| Optimistic (8% conversion) | $160K | $960K | $4.2M |

### Break-Even Analysis

```
Fixed costs (monthly):
- Infrastructure (Supabase, Vercel): $100-500
- Domain, services: $50
- Your time (opportunity cost): $???

Variable costs:
- Stripe fees: 2.9% + $0.30 per transaction
- Support time: scales with users

Break-even point:
- ~50 paid users at $8/month = $400 MRR
- Covers infrastructure easily
- Profitable from ~100 paid users
```

---

## Complementary Products

### 1. ImmorTerm for JetBrains IDEs
**Estimated effort**: 3-4 months
**Market**: 10M+ JetBrains users

```
Same core value proposition, different platform.
- IntelliJ, WebStorm, PyCharm, etc.
- Plugin for JetBrains marketplace
- Same backend, different frontend

Revenue potential: 30-50% additional market
```

### 2. ImmorTerm CLI (Standalone)
**Estimated effort**: 2-3 months
**Market**: tmux/screen power users who don't use VS Code

```
immorterm init                    # Initialize in project
immorterm new "API Server"        # Create named session
immorterm list                    # List sessions
immorterm attach api-server       # Attach to session
immorterm sync                    # Sync to cloud (Pro)
immorterm restore                 # Restore all sessions

Works outside VS Code for:
- Remote servers
- CI/CD environments
- Users of other editors (Vim, Emacs, Sublime)
```

### 3. ImmorTerm Dashboard (Web App)
**Estimated effort**: 2 months (alongside main development)
**Purpose**: Management, analytics, team admin

```
Features:
- View all machines/projects/terminals
- Analytics and insights
- Team management (Team tier)
- Billing and subscription management
- API key management
- Snapshot browser
- Template marketplace
```

### 4. ImmorTerm Mobile (iOS/Android) ⭐ HUGE OPPORTUNITY
**Estimated effort**: 3-4 weeks (PWA), 2-3 months (Native)
**Purpose**: Continue your development workflow from anywhere

**This is not just monitoring — it's FULL CONTINUATION:**

```
Features:
├── Terminal Viewing
│   ├── Real-time output streaming
│   ├── Last N lines buffer (works even if you just opened)
│   ├── Search within output
│   └── Quick actions (Ctrl+C, restart, clear)
│
├── Terminal Interaction
│   ├── Send commands to any terminal
│   ├── Quick command buttons (customizable)
│   └── Command history
│
├── Claude Conversation (KILLER FEATURE)
│   ├── View full conversation history
│   ├── Continue conversation from mobile
│   ├── Get notified when Claude finishes tasks
│   ├── Review Claude's changes
│   └── Approve/reject suggested changes
│
├── Push Notifications
│   ├── Build completed / failed
│   ├── Tests passed / failed
│   ├── Server crashed
│   ├── Claude needs input
│   ├── Claude finished task
│   └── Custom alerts (regex on output)
│
├── Cross-Machine
│   ├── View all machines
│   ├── Transfer sessions between machines
│   ├── Wake-on-LAN (if supported)
│   └── Remote machine status
│
└── Dashboard
    ├── Overview of all terminals
    ├── Recent activity feed
    ├── Analytics summary
    └── Quick actions

Use Cases:
- Commuting: Check build status, respond to Claude
- In meetings: Get crash alerts, quick restart
- Traveling: Continue Claude conversation from phone
- Weekend: Emergency hotfix without laptop
- Between locations: Start at office, continue on train, finish at home
```

**Technical approach:**
```
PWA (Progressive Web App) - Recommended for MVP
├── Next.js + Tailwind + shadcn/ui
├── Socket.io for real-time streaming
├── Service Worker for push notifications
├── Install to home screen (feels like native)
└── One codebase for iOS + Android

Native (Phase 2 if needed)
├── React Native or Flutter
├── Better offline support
├── Native notifications
└── App Store presence (credibility)
```

### 5. ImmorTerm Enterprise (On-Premise)
**Estimated effort**: 4-6 months
**Market**: Large enterprises with data sovereignty requirements

```
Features:
- Self-hosted server component
- Air-gapped support
- Custom SSO integration
- Compliance certifications (SOC2, GDPR)
- Dedicated support

Pricing: $50-100/user/month or annual enterprise agreements
```

### 6. ImmorTerm API & Webhooks
**Estimated effort**: 1-2 months
**Purpose**: Enable integrations and automation

```
Use cases:
- CI/CD integration (restore terminals in build)
- Monitoring integration (alert on terminal death)
- Custom automation workflows
- Third-party integrations

Pricing: Included in Pro, higher limits for Team/Enterprise
```

### 7. Terminal Analytics Platform
**Estimated effort**: 3-4 months
**Purpose**: Deep insights for teams

```
Features:
- Developer productivity metrics
- Terminal usage patterns
- Crash correlation analysis
- AI session efficiency tracking
- Team benchmarking

Could be separate product or premium Team feature.
```

---

## Future Features

### Quality of Life Improvements

- [ ] **Smart Terminal Naming**: Auto-suggest names based on running process
- [ ] **Terminal Grouping**: Group related terminals visually
- [ ] **Terminal Search**: Search across all terminal output
- [ ] **Quick Commands**: Bookmarkable commands per terminal
- [ ] **Terminal Notes**: Add notes/documentation to terminals
- [ ] **Split Terminal Sync**: Persist split pane layouts
- [ ] **Terminal Pinning**: Pin important terminals to always restore first

### AI-Powered Features

- [ ] **AI Session Context Summary**: Summarize what Claude was working on
- [ ] **Smart Resume**: Suggest which Claude session to resume based on current files
- [ ] **Terminal Error Detection**: Alert when errors appear in output
- [ ] **Automated Debug Sessions**: Start debug terminal when errors detected
- [ ] **Code Context Linking**: Link terminal to specific code files/functions

### Collaboration Features

- [ ] **Terminal Sharing**: Share read-only terminal view with teammate
- [ ] **Collaborative Debugging**: Real-time shared terminal session
- [ ] **Team Templates**: Standardized terminal setups for teams
- [ ] **Onboarding Templates**: "Getting started" terminal layouts for new team members

### Integration Features

- [ ] **Cursor Integration**: Same persistence for Cursor IDE
- [ ] **Zed Integration**: Terminal persistence for Zed
- [ ] **Aider Integration**: Persist Aider sessions like Claude
- [ ] **GitHub Codespaces**: Cloud development environment support
- [ ] **Remote SSH**: Persist terminals for SSH connections
- [ ] **Docker**: Persist terminals inside containers

### Enterprise Features

- [ ] **Compliance Mode**: Extra security, audit logging
- [ ] **Data Retention Policies**: Auto-delete old data
- [ ] **Role-Based Access**: Fine-grained permissions
- [ ] **Cost Center Tracking**: Allocate usage to departments
- [ ] **SLA Monitoring**: Uptime guarantees and reporting

---

## Go-To-Market Strategy

### Phase 1: Launch (Month 1-2)

**Channels**:
1. **ProductHunt Launch**
   - Prepare assets, demo video
   - Coordinate with supporters for upvotes
   - Target: Top 5 of the day

2. **Hacker News**
   - "Show HN: Terminal sessions that survive VS Code crashes"
   - Be authentic, respond to comments
   - Target: Front page

3. **Reddit**
   - r/vscode, r/programming, r/ClaudeAI
   - Not promotional, share genuinely useful tool

4. **Twitter/X**
   - Demo videos showing the problem → solution
   - Tag VS Code, Anthropic accounts
   - Developer influencer outreach

**Messaging**:
- Lead with pain: "Lost your terminal session mid-debug? Never again."
- Show, don't tell: Video demos of crash → restore
- Claude integration angle: "Your AI workflow, immortal"

### Phase 2: Growth (Month 3-6)

**Content Marketing**:
- Blog posts: "Why VS Code terminals lose everything on crash"
- Tutorial: "Setting up the perfect terminal workflow"
- Case study: "How team X saved 10 hours/month with ImmorTerm"

**Partnerships**:
- Anthropic: Get mentioned in Claude Code docs/resources
- VS Code team: Explore official recommendation
- Developer YouTubers: Sponsored reviews

**Community**:
- Discord server for users
- GitHub Discussions for feature requests
- Newsletter with tips and updates

### Phase 3: Scale (Month 6-12)

**Enterprise Sales**:
- Direct outreach to engineering managers
- Case studies from early team adopters
- SOC2 compliance (if pursuing enterprise)

**Expansion**:
- JetBrains plugin development
- International localization
- Enterprise tier features

---

## Success Metrics

### North Star Metric
**"Sessions successfully restored"**
- Directly measures value delivered
- Easy to track server-side
- Grows with both adoption and usage

### Key Performance Indicators

| Metric | Target (Y1) | Target (Y2) |
|--------|-------------|-------------|
| Monthly Active Users | 10,000 | 50,000 |
| Free → Pro Conversion | 5% | 7% |
| Pro Monthly Churn | <5% | <4% |
| Net Promoter Score | 50+ | 60+ |
| Sessions Restored (monthly) | 100K | 1M |
| MRR | $8,000 | $50,000 |

### User Engagement Targets

| Metric | Healthy | At Risk |
|--------|---------|---------|
| Weekly active days | 5+ | <2 |
| Terminals per project | 3+ | 1 |
| Sessions restored/month | 10+ | <3 |
| Feature usage (Pro) | 3+ features | 1 feature |

---

## Risk Analysis

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| VS Code breaks compatibility | Medium | High | Pin to stable API, automated testing |
| Screen/tmux changes | Low | Medium | Abstract multiplexer layer |
| Server outage | Medium | High | Offline grace period, multi-region |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| VS Code adds native persistence | Medium | Critical | Differentiate on AI features |
| Anthropic builds this into Claude | Low | Critical | Partner early, be acquisition target |
| Low conversion rate | Medium | High | A/B test pricing, features, messaging |
| Competition emerges | High | Medium | Move fast, build community moat |

### Mitigation Strategies

1. **Build relationship with Anthropic**: They might acquire or partner
2. **Diversify platforms early**: JetBrains, Cursor reduce VS Code dependency
3. **Community moat**: Open source core, loyal users are defense
4. **Patent/IP**: Consider provisional patent on Claude session correlation

---

## Immediate Next Steps

### This Week
- [ ] Set up Supabase project
- [ ] Create basic auth flow
- [ ] Design license validation endpoint
- [ ] Stripe account setup

### This Month
- [ ] MVP of license enforcement in extension
- [ ] Terminal and project limits working
- [ ] Basic payment flow (Pro tier)
- [ ] Landing page with pricing

### This Quarter
- [ ] Claude session sync (Pro feature)
- [ ] 5 premium themes
- [ ] ProductHunt launch
- [ ] First 100 paid users

---

## Notes & Ideas

### Potential Pivots
- If consumer doesn't work → Focus on Team/Enterprise only
- If VS Code adds persistence → Pivot to AI workflow tools
- If monetization fails → Open source everything, seek acquisition

### Acquisition Targets
- **Anthropic**: Natural fit for Claude Code enhancement
- **Microsoft**: VS Code ecosystem play
- **JetBrains**: IDE tools portfolio
- **GitLab/GitHub**: Developer tools expansion

### Community Ideas
- "ImmorTerm Champions" program for advocates
- Student/OSS discount (50% off Pro)
- Referral program ($2 credit per referral)
- Annual "sessions saved" wrap-up (like Spotify Wrapped)

---

## Current Issues & Challenges Map

### The Problem Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                      LEVEL 1: Terminal Persistence                   │
│                      (Current ImmorTerm Solves This)                 │
│                                                                      │
│  Problem: VS Code terminals die on crash/restart                     │
│  Solution: GNU Screen wrapper + restore extension                    │
│  Status: ✅ SOLVED                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LEVEL 2: Claude Session Persistence             │
│                      (ImmorTerm Pro Solves This)                     │
│                                                                      │
│  Problem: Claude conversation context lost on restart               │
│  Solution: Session correlation + auto-resume                        │
│  Status: 🔄 IN PROGRESS                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LEVEL 3: Cross-Machine Continuity               │
│                      (Partial Solution)                              │
│                                                                      │
│  Problem: Can't continue work on different machine                  │
│  Solution: Session sync + git-assisted transfer                     │
│                                                                      │
│  ⚠️ REMAINING ISSUES:                                               │
│  ├── User still needs the codebase on each machine                 │
│  ├── Git sync adds friction (commit, push, pull)                   │
│  ├── Uncommitted changes block transfer                            │
│  ├── Path differences between machines                             │
│  ├── Environment differences (node version, dependencies)          │
│  └── Large repos = slow clone on new machine                       │
│                                                                      │
│  Status: ⚠️ PARTIALLY SOLVED (friction remains)                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LEVEL 4: Mobile Access                          │
│                      (Partial Solution)                              │
│                                                                      │
│  Problem: Can't continue work from phone                            │
│  Solution: Mobile web app + cloud relay                             │
│                                                                      │
│  ⚠️ REMAINING ISSUES:                                               │
│  ├── Desktop must be online (can't work if laptop is off)         │
│  ├── Latency through relay                                         │
│  ├── Desktop battery drain (must stay awake)                       │
│  ├── Network issues kill connection                                │
│  └── Can't work if traveling without laptop                        │
│                                                                      │
│  Status: ⚠️ PARTIALLY SOLVED (requires desktop online)             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LEVEL 5: True Anywhere Access                   │
│                      (THE ULTIMATE SOLUTION)                         │
│                                                                      │
│  Problem: Development is tied to physical machines                  │
│  Solution: Remote development server (cloud workstation)            │
│                                                                      │
│  ✅ ALL ISSUES SOLVED:                                              │
│  ├── Codebase always available (lives in cloud)                   │
│  ├── No git sync needed (it's the source of truth)                │
│  ├── No path differences (one environment)                        │
│  ├── No environment drift (consistent setup)                      │
│  ├── Works from any device (desktop, laptop, phone, tablet)       │
│  ├── Desktop can be off (server is always on)                     │
│  ├── Low latency (server close to you, or CDN)                    │
│  ├── No battery drain on devices (server does the work)           │
│  ├── Instant "clone" (already there)                              │
│  └── Powerful compute (server can be beefy)                       │
│                                                                      │
│  Status: 🎯 THE GOAL                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Issue-Solution Matrix

| Issue | Local-First Solution | Cloud-First Solution |
|-------|---------------------|---------------------|
| Terminal dies on VS Code crash | Screen wrapper ✅ | Server never crashes |
| Claude session lost | Session correlation ✅ | Session lives on server |
| Different machines, different code | Git sync ⚠️ | One codebase in cloud ✅ |
| Uncommitted changes block transfer | Commit workflow ⚠️ | No transfer needed ✅ |
| Path differences | Path mapping ⚠️ | Same paths always ✅ |
| Environment differences | Docker/devcontainer ⚠️ | One environment ✅ |
| Mobile needs desktop online | Relay through desktop ⚠️ | Server always online ✅ |
| Slow clone on new machine | Git LFS, shallow clone ⚠️ | Already cloned ✅ |
| Laptop battery drain | N/A | No local compute ✅ |
| Weak laptop, slow builds | N/A | Powerful server ✅ |

---

## Remote Development Environment (ImmorTerm Cloud Workstation)

### The Vision: "Mainframe for Modern Developers"

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   "Your development environment in the cloud.                       │
│    Access from anywhere. Resume anytime. Never lose progress."      │
│                                                                      │
│   Like the mainframe days, but with:                                │
│   • Modern UI (VS Code in browser)                                  │
│   • AI assistance (Claude built-in)                                 │
│   • Your tools (any language, any framework)                        │
│   • Your files (persistent storage)                                 │
│   • Any device (laptop, phone, tablet, even TV)                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Devices                                 │
│                                                                      │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐            │
│  │ Desktop │   │ Laptop  │   │ Phone   │   │ Tablet  │            │
│  │ (Work)  │   │ (Home)  │   │ (Train) │   │ (Couch) │            │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘            │
│       │             │             │             │                   │
│       └─────────────┴──────┬──────┴─────────────┘                   │
│                            │                                         │
│                            │ Browser / Mobile App                    │
│                            │ (Thin client - just UI)                │
│                            ▼                                         │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             │ WebSocket / WebRTC
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ImmorTerm Cloud Platform                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Edge / CDN Layer                            │ │
│  │  • Closest server to user                                      │ │
│  │  • Low latency connection                                      │ │
│  │  • WebSocket termination                                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                            │                                         │
│                            ▼                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Control Plane                               │ │
│  │  • User authentication                                         │ │
│  │  • Workstation orchestration                                   │ │
│  │  • Billing & licensing                                         │ │
│  │  • Analytics                                                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                            │                                         │
│                            ▼                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Compute Layer                               │ │
│  │                                                                │ │
│  │   ┌──────────────────────────────────────────────────────┐    │ │
│  │   │           User's Cloud Workstation                    │    │ │
│  │   │                                                       │    │ │
│  │   │   ┌─────────────────────────────────────────────┐    │    │ │
│  │   │   │  Persistent Volume (Your Code & Data)        │    │    │ │
│  │   │   │  ~/projects/                                 │    │    │ │
│  │   │   │  ├── api-service/                           │    │    │ │
│  │   │   │  ├── frontend/                              │    │    │ │
│  │   │   │  └── scripts/                               │    │    │ │
│  │   │   └─────────────────────────────────────────────┘    │    │ │
│  │   │                                                       │    │ │
│  │   │   ┌─────────────────────────────────────────────┐    │    │ │
│  │   │   │  Compute Container (Your Environment)        │    │    │ │
│  │   │   │  • Ubuntu 22.04                              │    │    │ │
│  │   │   │  • Node.js, Python, Go, Rust, etc.          │    │    │ │
│  │   │   │  • Your dotfiles synced                      │    │    │ │
│  │   │   │  • Claude Code pre-installed                 │    │    │ │
│  │   │   └─────────────────────────────────────────────┘    │    │ │
│  │   │                                                       │    │ │
│  │   │   ┌─────────────────────────────────────────────┐    │    │ │
│  │   │   │  ImmorTerm Services                          │    │    │ │
│  │   │   │  • Screen sessions (always running)         │    │    │ │
│  │   │   │  • Terminal multiplexer                     │    │    │ │
│  │   │   │  • Claude session manager                   │    │    │ │
│  │   │   │  • Web IDE server (code-server)             │    │    │ │
│  │   │   └─────────────────────────────────────────────┘    │    │ │
│  │   │                                                       │    │ │
│  │   └──────────────────────────────────────────────────────┘    │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### User Experience

#### From Desktop/Laptop (Full IDE)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ImmorTerm Workstation                    cloud.immorterm.io        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │                    VS Code in Browser                        │   │
│  │                    (code-server)                             │   │
│  │                                                              │   │
│  │  ┌──────────────────────┬───────────────────────────────┐   │   │
│  │  │ EXPLORER             │ auth.ts                       │   │   │
│  │  │ ▼ api-service        │─────────────────────────────────   │   │
│  │  │   ▼ src              │ import jwt from 'jsonwebtoken';│   │   │
│  │  │     ◆ auth.ts        │                                │   │   │
│  │  │     ◆ user.ts        │ export function verifyToken() {│   │   │
│  │  │     ◆ index.ts       │   // ...                       │   │   │
│  │  │   ▶ tests            │ }                              │   │   │
│  │  │   ◆ package.json     │                                │   │   │
│  │  └──────────────────────┴───────────────────────────────┘   │   │
│  │                                                              │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │ TERMINAL                                              │  │   │
│  │  │──────────────────────────────────────────────────────│  │   │
│  │  │ ~/projects/api-service $ npm run dev                  │  │   │
│  │  │ > api@1.0.0 dev                                       │  │   │
│  │  │ > tsx watch src/index.ts                              │  │   │
│  │  │                                                        │  │   │
│  │  │ [10:30:15] Server listening on :3000                  │  │   │
│  │  │ █                                                      │  │   │
│  │  │                                                        │  │   │
│  │  │ [API Server] [Claude 🤖] [Tests] [+]                  │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Status: Connected to us-east-1 | Latency: 23ms | CPU: 12% | RAM: 2.1GB │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### From Phone (Mobile Web)

```
┌─────────────────────────────────────────┐
│ ImmorTerm              9:41 AM     📶   │
├─────────────────────────────────────────┤
│                                         │
│  ☁️ Cloud Workstation                   │
│     Status: Running 🟢                  │
│     Region: us-east-1                   │
│     Uptime: 3 days                      │
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                         │
│  Quick Actions                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ 🖥️      │ │ 📟      │ │ 🤖      │  │
│  │ Open    │ │ Terminal│ │ Claude  │  │
│  │ VS Code │ │ Only    │ │ Chat    │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                         │
│  Active Terminals                       │
│  ├─ 🟢 API Server (running 2h)         │
│  ├─ 🤖 Claude Session (active)         │
│  └─ ✅ Tests (passed)                  │
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                         │
│  Recent Activity                        │
│  • Claude: "I've implemented..."       │
│  • Build passed ✅                      │
│  • 3 files modified                    │
│                                         │
└─────────────────────────────────────────┘
```

### Comparison with Existing Solutions

| Feature | GitHub Codespaces | Gitpod | ImmorTerm Cloud |
|---------|------------------|--------|-----------------|
| **VS Code in browser** | ✅ | ✅ | ✅ |
| **Persistent storage** | ✅ | ✅ | ✅ |
| **Terminal persistence** | ❌ Dies on stop | ❌ Dies on timeout | ✅ Always running |
| **Claude integration** | ❌ DIY | ❌ DIY | ✅ Built-in |
| **Claude session resume** | ❌ | ❌ | ✅ Automatic |
| **Mobile app** | ❌ | ❌ | ✅ First-class |
| **Mobile Claude chat** | ❌ | ❌ | ✅ Native |
| **Offline notification** | ❌ | ❌ | ✅ Push alerts |
| **Terminal from phone** | ❌ | ❌ | ✅ Full access |
| **Always-on option** | ⚠️ Expensive | ⚠️ Limited | ✅ Core feature |
| **Session handoff** | ❌ | ❌ | ✅ Seamless |
| **Focus** | GitHub integration | Ephemeral workspaces | **AI-native dev** |

### The "Tilt Dev" Inspiration

**What Tilt Does:**
- Local development, but with cloud-like features
- Live reload of services
- Dashboard showing all services status
- One command to start everything

**ImmorTerm Cloud = Tilt, but:**
- Runs in cloud (not local)
- Accessible from anywhere
- Terminals persist forever
- Claude sessions managed
- Mobile access included

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ImmorTerm Workstation Dashboard                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Services                                                 [+ Add]   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Service          Status       Port    Logs        Actions      │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ 🟢 api-server    Running      3000    [View]      [Restart]   │ │
│  │ 🟢 frontend      Running      5173    [View]      [Restart]   │ │
│  │ 🟢 postgres      Running      5432    [View]      [Restart]   │ │
│  │ 🟢 redis         Running      6379    [View]      [Restart]   │ │
│  │ 🟡 worker        Building...  -       [View]      [Cancel]    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Terminals                                                [+ New]   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 📟 API Dev       📟 Frontend Dev    🤖 Claude       📟 Shell  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Claude Sessions                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 🤖 "Implementing auth middleware"                              │ │
│  │    Active for 45 minutes | 23 messages                        │ │
│  │    [Continue] [View History] [End]                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Quick Actions                                                       │
│  [🔄 Rebuild All] [📸 Snapshot] [🛑 Stop Workstation] [⚙️ Settings] │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Pricing Model for Cloud Workstation

| Tier | Price | Specs | Best For |
|------|-------|-------|----------|
| **Starter** | $15/mo | 2 vCPU, 4GB RAM, 20GB SSD | Side projects, learning |
| **Pro** | $35/mo | 4 vCPU, 8GB RAM, 50GB SSD | Professional developers |
| **Power** | $75/mo | 8 vCPU, 16GB RAM, 100GB SSD | Heavy workloads, ML |
| **Team** | $50/user/mo | Shared + individual | Teams |
| **Enterprise** | Custom | Dedicated, compliance | Large orgs |

**Comparison:**
- GitHub Codespaces: ~$0.18/hour = $43/mo for 8h/day
- Gitpod: $25-50/mo
- EC2 (DIY): $30-100/mo + setup hassle
- **ImmorTerm Cloud: All-in-one, AI-native, mobile-first**

### Technical Stack for Cloud Workstation

```yaml
Infrastructure:
  orchestration: Kubernetes (EKS/GKE)
  compute: Spot instances for cost + on-demand for reliability
  storage: EBS/Persistent Volumes
  networking: Tailscale/WireGuard for secure access
  regions: us-east-1, eu-west-1, ap-northeast-1 (start)

Workstation Container:
  base: Ubuntu 22.04 LTS
  ide: code-server (VS Code in browser)
  terminal: tmux + ImmorTerm daemon
  tools: nvm, pyenv, rustup, go (user-configurable)
  ai: Claude Code pre-installed, API key managed

Control Plane:
  api: Next.js API routes or Fastify
  auth: Supabase Auth or Auth0
  billing: Stripe
  database: Supabase (PostgreSQL)
  realtime: Socket.io or Ably

Mobile/Web Client:
  framework: Next.js 14 (App Router)
  ui: Tailwind + shadcn/ui
  terminal: xterm.js
  ide-embed: code-server iframe or Monaco
```

---

## Product Evolution Roadmap

### Phase 1: Local-First (Current → 3 months)
```
ImmorTerm v1.x - Terminal Persistence
├── VS Code extension
├── Shell scripts (screen wrapper)
├── Local persistence
└── Basic Claude detection

Revenue: $0 (open source core)
Users: Build community, establish brand
```

### Phase 2: Cloud-Enhanced (3-6 months)
```
ImmorTerm v2.x - Cloud Sync + Mobile
├── Compiled binary (protected)
├── Cloud sync for sessions
├── Claude session correlation
├── Web dashboard
├── Mobile web app
└── Cross-machine continuity

Revenue: $8-15/mo Pro tier
Users: Convert power users to paid
```

### Phase 3: Hybrid Cloud (6-12 months) ⭐ THE BREAKTHROUGH
```
ImmorTerm v3.x - Hybrid Development Environment
├── Local IDE (native VS Code, your setup)
├── Real-time file sync to cloud (<50ms)
├── Cloud terminals (always running)
├── HMR/Hot reload works across the sync
├── Claude edits sync back to local instantly
├── Mobile access to terminals + preview URLs
└── Best of both worlds: local speed + cloud power

Architecture:
┌─────────────────┐      ┌─────────────────┐
│   LOCAL         │      │   CLOUD         │
│                 │      │                 │
│  Native VS Code │◄────►│  Synced Code    │
│  Your setup     │ sync │  Cloud Terminal │
│  Full speed     │<50ms │  Always on      │
│  Works offline  │      │  Claude runs    │
│                 │      │  HMR works      │
└─────────────────┘      └─────────────────┘

Key Innovation:
• You edit locally (instant, native)
• Sync to cloud in <50ms (like HMR)
• Terminals run on cloud (see changes instantly)
• Claude edits sync BACK to your local IDE
• Access terminals from phone
• Preview URLs work from anywhere

Revenue: $25-50/mo (sync + compute)
Users: Developers who want native + cloud power
```

### Phase 3.5: Full Cloud Option (8-14 months)
```
ImmorTerm v3.5 - Full Cloud Workstation (Optional)
├── VS Code in browser (code-server)
├── For users without powerful laptop
├── For tablet/Chromebook users
├── Same backend as hybrid
└── Upgrade path from hybrid

Revenue: $35-75/mo per workstation
Users: Tablet users, Chromebook, traveling light
```

### Phase 4: Platform (12-24 months)
```
ImmorTerm Platform
├── Self-hosted option for enterprise
├── Marketplace (templates, extensions)
├── Team/Org management
├── Compliance (SOC2, HIPAA)
├── Integrations (GitHub, GitLab, Jira)
└── AI agents marketplace

Revenue: Enterprise contracts
Users: Companies, teams
```

---

## Competitive Analysis: Claude Code Web/iOS

### The Question
Does Claude Code's web/iOS app already solve the problem ImmorTerm is solving?

### Short Answer
**No.** They're complementary tools solving different problems.

### What Claude Code Web/iOS CAN Do

| Feature | Description |
|---------|-------------|
| **View sessions in browser/phone** | Sessions run on Anthropic's cloud, viewable anywhere |
| **`/teleport` command** | Pull a web session INTO your local terminal |
| **`&` prefix for background tasks** | Send tasks to run in the cloud (e.g., `& run tests`) |
| **Session persistence** | Web sessions survive laptop sleep/restart |
| **Background execution** | Tasks continue while laptop is closed |

### What Claude Code Web/iOS CANNOT Do

| Gap | Why It Matters |
|-----|----------------|
| **Push terminal → web** | Can't send your LOCAL terminal session to the cloud. It's one-way only! |
| **Non-Claude terminals** | Only manages Claude sessions, not npm/docker/general terminals |
| **Multi-terminal dashboard** | No unified view of ALL your running terminals |
| **Terminal output history** | Limited scroll-back in web UI |
| **VS Code integration** | Web UI is standalone, not in your IDE |
| **Cross-project terminal management** | No organization by project |
| **Themes/customization** | Basic UI only |
| **Crash recovery** | If VS Code crashes, your local session is gone |

### The Critical Insight

```
╔══════════════════════════════════════════════════════════════════╗
║  Claude Code web/iOS: "I want to START work on phone/web"        ║
║  ImmorTerm:           "I want to CONTINUE work that's running"   ║
║                                                                  ║
║  The handoff is ONE-WAY:                                         ║
║    Web → Terminal  ✅ (teleport works)                           ║
║    Terminal → Web  ❌ (this doesn't exist!)                      ║
║                                                                  ║
║  If you're deep in a Claude session on your laptop with          ║
║  5 terminals running npm, docker, and tests... you CAN'T         ║
║  push that to the cloud and continue from your phone.            ║
╚══════════════════════════════════════════════════════════════════╝
```

### ImmorTerm's Unique Value Proposition

1. **Terminal → Cloud push** - The missing direction Claude doesn't offer
2. **All terminals, not just Claude** - npm watch, docker logs, test runners
3. **VS Code native** - In your IDE, not a separate browser tab
4. **Terminal persistence through crashes** - Screen-based resilience
5. **Multi-project organization** - Dashboard across all codebases
6. **Session correlation** - Match terminal logs to Claude UUIDs automatically
7. **Themes and customization** - Power user features developers pay for

### When to Use What

| Scenario | Best Tool |
|----------|-----------|
| Start fresh Claude work from phone | Claude Code iOS |
| Continue existing terminal session from phone | **ImmorTerm** |
| Recover after VS Code crash | **ImmorTerm** |
| Manage multiple terminals across projects | **ImmorTerm** |
| Quick Claude question on the go | Claude Code iOS |
| Resume exact Claude session with full context | **ImmorTerm** (UUID tracking) |
| Run long background task from phone | Claude Code (`&` prefix) |
| Monitor multiple running terminals | **ImmorTerm** |

### Market Positioning

```
                    ┌─────────────────────────────────┐
                    │      Development Experience     │
                    │           Spectrum              │
                    ├─────────────────────────────────┤
                    │                                 │
   Claude Code      │  ●───────────●                  │  ImmorTerm
   Web/iOS          │  │           │                  │
                    │  │           │                  │  ●───────────●
   "Start anywhere" │  │           │                  │  "Never lose
                    │  │           │                  │   your place"
                    │  │           │                  │
                    │  │  OVERLAP: │                  │
                    │  │  Remote   │                  │
                    │  │  Access   │                  │
                    │                                 │
                    └─────────────────────────────────┘
```

### Complementary Future

ImmorTerm could potentially INTEGRATE with Claude Code's APIs:
- Use ImmorTerm to manage local terminals
- When going mobile, push session state to Claude web
- Best of both worlds: local power + cloud continuation

This makes ImmorTerm's approach future-proof: it can become an ENHANCEMENT to Claude's ecosystem rather than a competitor.

---

*Last updated: January 2025*
*Version: 1.0*
