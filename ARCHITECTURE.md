# ImmorTerm Architecture & Freemium Implementation

> **Purpose**: Technical blueprint for implementing freemium model in ImmorTerm.
> **Status**: Planning - Ready for implementation
> **Last Updated**: January 2025

---

## Table of Contents

1. [Freemium Model Overview](#freemium-model-overview)
2. [Feature Matrix](#feature-matrix)
3. [Technical Changes Required](#technical-changes-required)
4. [Cloud Architecture](#cloud-architecture)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Extension Changes](#extension-changes)
8. [Terminal/Script Changes](#terminalscript-changes)
9. [Payment Integration](#payment-integration)
10. [Migration Path](#migration-path)
11. [Implementation Phases](#implementation-phases)

---

## Freemium Model Overview

### Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRIAL (7 days)                           │
│  • All Pro features unlocked                                    │
│  • Banner: "Trial: X days remaining"                            │
│  • After expiry → automatically becomes Free tier               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                          FREE TIER                              │
│  • 3 persisted terminals max                                    │
│  • 2 projects max                                               │
│  • 1 basic theme (default dark)                                 │
│  • Manual Claude resume (copy UUID yourself)                    │
│  • 500 lines log history on restore                             │
│  • No cross-machine sync                                        │
│  • "Upgrade to Pro" prompts                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      PRO TIER ($8/month)                        │
│  • Unlimited terminals                                          │
│  • Unlimited projects                                           │
│  • 15+ premium themes                                           │
│  • Auto Claude resume (killer feature)                          │
│  • Full log history (configurable)                              │
│  • Cross-machine session sync (Phase 2)                         │
│  • Priority support                                             │
│  • Web dashboard access (Phase 2)                               │
└─────────────────────────────────────────────────────────────────┘
```

### Pricing

| Tier | Price | Billing |
|------|-------|---------|
| Trial | Free | 7 days |
| Free | $0 | Forever |
| Pro Monthly | $8/mo | Recurring |
| Pro Annual | $72/yr | Recurring (25% off) |

---

## Feature Matrix

### What's Free vs Pro

| Feature | Free | Pro | Server-Gated? |
|---------|------|-----|---------------|
| Persisted terminals | 3 max | Unlimited | ✅ Yes |
| Projects | 2 max | Unlimited | ✅ Yes |
| Themes | 1 (default) | 15+ | ✅ Yes |
| Claude auto-resume | ❌ Manual UUID copy | ✅ Automatic | ✅ Yes |
| Log lines on restore | 500 | Configurable | ✅ Yes |
| Terminal crash recovery | ✅ Yes | ✅ Yes | ❌ Local |
| Screen session persistence | ✅ Yes | ✅ Yes | ❌ Local |
| Cross-machine sync | ❌ No | ✅ Yes (Phase 2) | ✅ Yes |
| Web dashboard | ❌ No | ✅ Yes (Phase 2) | ✅ Yes |
| Session analytics | ❌ No | ✅ Yes | ✅ Yes |
| Export session logs | ❌ No | ✅ Yes | ✅ Yes |
| Priority support | ❌ No | ✅ Yes | ✅ Yes |

### Server-Gated Features (Cannot Be Pirated)

These features ONLY work with server connection:

1. **Themes** - Theme configs stored on server, fetched on demand
2. **Terminal/Project limits** - Server validates counts
3. **Claude session correlation** - UUID mappings stored server-side
4. **Log history settings** - Server stores user preferences
5. **Cross-machine sync** - Requires cloud storage
6. **Analytics** - Tracked server-side
7. **License validation** - Server checks subscription status

### Local-Only Features (Work Offline)

These work without server (core value, keeps users happy on free tier):

1. **Terminal persistence** - GNU Screen wrapper
2. **Crash recovery** - restore-terminals.json (local backup)
3. **Basic session management** - screen-auto, screen-forget
4. **VS Code integration** - Terminal panel, commands

---

## Technical Changes Required

### Overview of Changes

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│  VS Code Extension                                              │
│       ↓                                                         │
│  Shell Scripts (screen-auto, screen-forget, etc.)               │
│       ↓                                                         │
│  restore-terminals.json (LOCAL)                                 │
│       ↓                                                         │
│  GNU Screen sessions                                            │
└─────────────────────────────────────────────────────────────────┘

                              ↓ MIGRATE TO ↓

┌─────────────────────────────────────────────────────────────────┐
│                     NEW ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────┤
│  VS Code Extension                                              │
│       ↓                                                         │
│  immorterm binary (C/Rust - contains all scripts)               │
│       ↓                    ↓                                    │
│  LOCAL backup          CLOUD sync                               │
│  (offline mode)        (api.immorterm.com)                      │
│       ↓                    ↓                                    │
│  restore-terminals.json   Cloud DB                              │
│  (fallback)               (primary for Pro)                     │
│       ↓                                                         │
│  GNU Screen sessions                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cloud Architecture

### Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                    api.immorterm.com                            │
│                    (k3d cluster)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │   Hono API      │  │   PostgreSQL    │                      │
│  │   (Bun runtime) │  │   (Neon)        │                      │
│  └────────┬────────┘  └────────┬────────┘                      │
│           │                    │                                │
│           └────────┬───────────┘                                │
│                    │                                            │
│  ┌─────────────────┴─────────────────┐                         │
│  │         Better Auth               │                         │
│  │  (GitHub OAuth, session mgmt)     │                         │
│  └───────────────────────────────────┘                         │
│                    │                                            │
│  ┌─────────────────┴─────────────────┐                         │
│  │       Lemon Squeezy               │                         │
│  │  (Payments, subscriptions)        │                         │
│  └───────────────────────────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack (Reuse from Pax)

| Layer | Technology | Notes |
|-------|------------|-------|
| Monorepo | Moon + Bun | Copy Pax structure |
| API | Hono | Lightweight, fast |
| Database | Drizzle + Neon | Serverless Postgres |
| Auth | Better Auth | GitHub OAuth |
| Payments | Lemon Squeezy | Israel supported, MoR |
| Email | Resend | Transactional emails |

---

## Database Schema

### Tables

```sql
-- Users (managed by Better Auth)
-- Better Auth creates: user, session, account tables

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user(id),

  -- Lemon Squeezy data
  ls_customer_id VARCHAR(255),
  ls_subscription_id VARCHAR(255),
  ls_variant_id VARCHAR(255),

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'trialing',
  -- trialing, active, past_due, canceled, expired

  -- Dates
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User settings (Pro features config)
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user(id) UNIQUE,

  -- Limits (null = unlimited for Pro)
  max_terminals INTEGER DEFAULT 3,
  max_projects INTEGER DEFAULT 2,
  log_lines_on_restore INTEGER DEFAULT 500,

  -- Preferences
  theme_id VARCHAR(50) DEFAULT 'default',
  auto_claude_resume BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Themes (Pro only)
CREATE TABLE themes (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  config JSONB NOT NULL, -- Terminal colors, styles
  is_premium BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User projects (for limit tracking)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user(id),

  path_hash VARCHAR(64) NOT NULL, -- SHA256 of project path
  name VARCHAR(255) NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, path_hash)
);

-- Terminal sessions (for limit tracking + cloud sync)
CREATE TABLE terminal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user(id),
  project_id UUID REFERENCES projects(id),

  -- Screen session data
  screen_name VARCHAR(255) NOT NULL,
  socket_path TEXT,
  cwd TEXT,
  shell VARCHAR(100),

  -- Claude integration
  claude_session_uuid VARCHAR(255),
  claude_session_matched_at TIMESTAMPTZ,

  -- State
  is_active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Claude session mappings (Pro feature)
CREATE TABLE claude_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user(id),
  terminal_session_id UUID REFERENCES terminal_sessions(id),

  -- Claude data
  session_uuid VARCHAR(255) NOT NULL,
  session_file_path TEXT, -- Local path on user's machine
  last_message_preview TEXT,

  -- Matching data
  content_hash VARCHAR(64), -- For content-based matching
  matched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, session_uuid)
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_terminal_sessions_user_id ON terminal_sessions(user_id);
CREATE INDEX idx_terminal_sessions_project_id ON terminal_sessions(project_id);
CREATE INDEX idx_claude_sessions_user_id ON claude_sessions(user_id);
```

---

## API Endpoints

### Auth (Better Auth handles these)

```
POST /api/auth/sign-in/github     # GitHub OAuth
POST /api/auth/sign-out           # Sign out
GET  /api/auth/session            # Get current session
```

### License & Subscription

```
GET  /api/license/status
Response:
{
  "tier": "pro" | "free" | "trial",
  "trialDaysRemaining": 5,        // if trial
  "limits": {
    "terminals": null,            // null = unlimited
    "projects": null,
    "logLines": 10000
  },
  "features": {
    "autoClaudeResume": true,
    "crossMachineSync": true,
    "themes": true
  }
}

POST /api/license/activate        # Activate license (from LS webhook)
POST /api/license/deactivate      # Cancel subscription
```

### Themes (Pro Only)

```
GET  /api/themes
Response (Pro):
{
  "themes": [
    { "id": "dracula", "name": "Dracula Pro", "config": {...} },
    { "id": "tokyo-night", "name": "Tokyo Night", "config": {...} },
    ...
  ]
}

Response (Free):
{
  "themes": [
    { "id": "default", "name": "Default Dark", "config": {...} }
  ]
}

GET  /api/themes/:id              # Get specific theme config
```

### Projects & Terminals (Limit Enforcement)

```
POST /api/projects
Request: { "pathHash": "sha256...", "name": "my-project" }
Response (success): { "id": "uuid", "allowed": true }
Response (limit): { "allowed": false, "limit": 2, "current": 2 }

GET  /api/projects                # List user's projects
DELETE /api/projects/:id          # Remove project

POST /api/terminals
Request: { "projectId": "uuid", "screenName": "term-1", ... }
Response (success): { "id": "uuid", "allowed": true }
Response (limit): { "allowed": false, "limit": 3, "current": 3 }

GET  /api/terminals               # List active terminals
DELETE /api/terminals/:id         # Remove terminal
PATCH /api/terminals/:id          # Update terminal state
```

### Claude Sessions (Pro Only)

```
POST /api/claude/sessions
Request: {
  "terminalSessionId": "uuid",
  "sessionUuid": "claude-session-uuid",
  "contentHash": "sha256...",
  "lastMessagePreview": "Let me help you with..."
}

GET  /api/claude/sessions/:terminalId
Response: {
  "sessionUuid": "claude-session-uuid",
  "matchedAt": "2025-01-24T...",
  "resumeCommand": "claude --resume uuid"
}

POST /api/claude/correlate        # Trigger correlation for terminal
```

### Webhooks (Lemon Squeezy)

```
POST /api/webhooks/lemonsqueezy
Events:
- subscription_created
- subscription_updated
- subscription_cancelled
- subscription_payment_success
- subscription_payment_failed
```

---

## Extension Changes

### New Dependencies

```json
{
  "dependencies": {
    // Existing...

    // New for cloud integration
    "axios": "^1.6.0",           // Or use fetch
    "keytar": "^7.9.0"           // Secure credential storage
  }
}
```

### New Files

```
src/extension/src/
├── api/
│   ├── client.ts              # API client for api.immorterm.com
│   ├── auth.ts                # OAuth flow, token management
│   └── sync.ts                # Cloud sync logic
├── services/
│   ├── license.ts             # License checking, feature gates
│   ├── limits.ts              # Terminal/project limit enforcement
│   └── themes.ts              # Theme fetching and applying
├── ui/
│   ├── auth-webview.ts        # OAuth webview
│   ├── upgrade-prompt.ts      # "Upgrade to Pro" prompts
│   └── trial-banner.ts        # Trial countdown banner
└── utils/
    └── feature-flags.ts       # Feature availability checks
```

### Key Changes

#### 1. Startup Flow

```typescript
// extension.ts - activate()

async function activate(context: ExtensionContext) {
  // 1. Check if user is authenticated
  const authState = await AuthService.getState();

  if (!authState.isAuthenticated) {
    // Show "Sign in to sync" prompt (non-blocking)
    showSignInPrompt();
  }

  // 2. Check license status (cached, refresh in background)
  const license = await LicenseService.getStatus();

  // 3. Apply limits based on license
  LimitsService.init(license.limits);

  // 4. Load theme (from cache or fetch)
  await ThemeService.apply(license.tier);

  // 5. Continue with normal activation...
  // (existing code)

  // 6. If trial, show banner
  if (license.tier === 'trial') {
    showTrialBanner(license.trialDaysRemaining);
  }
}
```

#### 2. Terminal Creation (Limit Check)

```typescript
// terminal-manager.ts

async function createTerminal(options: TerminalOptions): Promise<Terminal | null> {
  const limits = await LimitsService.getLimits();
  const currentCount = getActiveTerminalCount();

  if (limits.terminals !== null && currentCount >= limits.terminals) {
    // Show upgrade prompt
    const result = await vscode.window.showWarningMessage(
      `You've reached the ${limits.terminals} terminal limit on the free tier.`,
      'Upgrade to Pro',
      'Dismiss'
    );

    if (result === 'Upgrade to Pro') {
      openUpgradeUrl();
    }
    return null;
  }

  // Create terminal...
  const terminal = await createScreenTerminal(options);

  // Sync to cloud (if authenticated)
  if (AuthService.isAuthenticated()) {
    await ApiClient.post('/api/terminals', {
      projectId: getCurrentProjectId(),
      screenName: terminal.screenName,
      cwd: options.cwd
    });
  }

  return terminal;
}
```

#### 3. Claude Auto-Resume (Pro Only)

```typescript
// claude-sync.ts

async function getClaudeResumeCommand(terminalId: string): Promise<string | null> {
  const license = await LicenseService.getStatus();

  if (!license.features.autoClaudeResume) {
    // Free tier: show manual instructions
    showManualResumeInstructions();
    return null;
  }

  // Pro tier: fetch from server
  const session = await ApiClient.get(`/api/claude/sessions/${terminalId}`);

  if (session.sessionUuid) {
    return `claude --resume ${session.sessionUuid}`;
  }

  return null;
}
```

#### 4. Theme Application

```typescript
// themes.ts

async function applyTheme(): Promise<void> {
  const license = await LicenseService.getStatus();
  const settings = await SettingsService.get();

  let themeConfig: ThemeConfig;

  if (license.tier === 'free') {
    // Always use default theme
    themeConfig = DEFAULT_THEME;
  } else {
    // Fetch selected theme from server
    const themes = await ApiClient.get('/api/themes');
    themeConfig = themes.find(t => t.id === settings.themeId) || DEFAULT_THEME;
  }

  // Apply to terminals
  applyThemeToTerminals(themeConfig);
}
```

---

## Terminal/Script Changes

### Binary Consolidation

Consolidate all shell scripts into a single binary:

```
CURRENT:
├── screen-auto
├── screen-forget
├── screen-reconcile
├── screen-adopt
├── install.sh
└── uninstall.sh

NEW:
└── immorterm (single binary)
    └── Commands:
        immorterm start <name>      # screen-auto
        immorterm forget <name>     # screen-forget
        immorterm reconcile         # screen-reconcile
        immorterm adopt <socket>    # screen-adopt
        immorterm status            # show all sessions
        immorterm sync              # sync to cloud
        immorterm auth login        # authenticate
        immorterm auth logout       # logout
        immorterm auth status       # show auth status
```

### Binary Implementation (C or Rust)

```c
// immorterm.c - Main entry point

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Embedded license key check
static const char* API_URL = "https://api.immorterm.com";

int main(int argc, char* argv[]) {
    if (argc < 2) {
        print_usage();
        return 1;
    }

    const char* cmd = argv[1];

    if (strcmp(cmd, "start") == 0) {
        return cmd_start(argc - 2, argv + 2);
    } else if (strcmp(cmd, "forget") == 0) {
        return cmd_forget(argc - 2, argv + 2);
    } else if (strcmp(cmd, "reconcile") == 0) {
        return cmd_reconcile();
    } else if (strcmp(cmd, "sync") == 0) {
        return cmd_sync();  // Requires auth
    } else if (strcmp(cmd, "auth") == 0) {
        return cmd_auth(argc - 2, argv + 2);
    }
    // ...

    return 0;
}

// License check embedded in binary
int check_license() {
    // Read cached license from ~/.immorterm/license.json
    // If expired or missing, call API
    // Return tier: 0=free, 1=trial, 2=pro
}
```

### restore-terminals.json Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                  HYBRID SYNC STRATEGY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOCAL (always works, offline-first):                          │
│  ~/.immorterm/restore-terminals.json                           │
│  - Written on every terminal change                            │
│  - Used as primary source for restore                          │
│  - Fallback if cloud unavailable                               │
│                                                                 │
│  CLOUD (Pro feature, requires auth):                           │
│  api.immorterm.com/api/terminals                               │
│  - Synced in background                                        │
│  - Enables cross-machine continuity                            │
│  - Stores Claude session correlations                          │
│                                                                 │
│  SYNC FLOW:                                                     │
│  1. Terminal created → write local → sync to cloud (async)     │
│  2. Terminal closed → write local → sync to cloud (async)      │
│  3. VS Code starts → read local → fetch cloud (if newer)       │
│  4. Conflict → local wins, cloud is backup                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Payment Integration

### Lemon Squeezy Setup

1. **Create Product in LS Dashboard**
   - Product: "ImmorTerm Pro"
   - Variant 1: Monthly ($8/mo)
   - Variant 2: Annual ($72/yr)

2. **Webhook Configuration**
   - URL: `https://api.immorterm.com/api/webhooks/lemonsqueezy`
   - Events: All subscription events

3. **Checkout Flow**

```typescript
// In extension
function openUpgradeUrl() {
  const userId = AuthService.getUserId();
  const checkoutUrl = `https://immorterm.lemonsqueezy.com/checkout/buy/xxx?checkout[custom][user_id]=${userId}`;
  vscode.env.openExternal(vscode.Uri.parse(checkoutUrl));
}
```

4. **Webhook Handler**

```typescript
// api/routes/webhooks.ts

app.post('/api/webhooks/lemonsqueezy', async (c) => {
  const signature = c.req.header('X-Signature');
  const body = await c.req.text();

  // Verify signature
  if (!verifyLemonSqueezySignature(body, signature)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const event = JSON.parse(body);
  const userId = event.meta.custom_data.user_id;

  switch (event.meta.event_name) {
    case 'subscription_created':
      await activateSubscription(userId, event.data);
      break;
    case 'subscription_cancelled':
      await cancelSubscription(userId, event.data);
      break;
    // ...
  }

  return c.json({ received: true });
});
```

---

## Migration Path

### For Existing Users

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGRATION STRATEGY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Day 0: Release v2.0 with freemium                             │
│  - Existing users get 30-day "loyalty trial" (not 7 days)      │
│  - All features work as before during trial                    │
│  - Prompt to create account (optional but recommended)         │
│                                                                 │
│  Day 1-30: Trial period                                        │
│  - Daily reminder of days remaining                            │
│  - One-click upgrade to Pro                                    │
│  - Export data option (if they don't want to continue)         │
│                                                                 │
│  Day 31+: Post-trial                                           │
│  - If upgraded → Pro features continue                         │
│  - If not → gracefully degrade to Free tier                    │
│    - Keep 3 most recent terminals                              │
│    - Keep 2 most recent projects                               │
│    - Disable auto Claude resume                                │
│    - Switch to default theme                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Freemium (MVP) - 2 weeks

```
Week 1:
├── [ ] Set up api.immorterm.com (Hono + Bun on k3d)
├── [ ] Database schema (Drizzle + Neon)
├── [ ] Better Auth integration (GitHub OAuth)
├── [ ] Basic license endpoint (/api/license/status)
└── [ ] Extension: Auth flow (sign in via GitHub)

Week 2:
├── [ ] Lemon Squeezy integration
├── [ ] Webhook handlers
├── [ ] Extension: License checking
├── [ ] Extension: Limit enforcement (terminals, projects)
├── [ ] Extension: Upgrade prompts
└── [ ] Trial banner and countdown
```

### Phase 2: Premium Features - 2 weeks

```
Week 3:
├── [ ] Themes API (/api/themes)
├── [ ] Theme management in extension
├── [ ] Claude session correlation API
├── [ ] Extension: Auto Claude resume
└── [ ] Log history settings

Week 4:
├── [ ] Cloud sync for restore-terminals.json
├── [ ] Offline fallback handling
├── [ ] Binary consolidation (immorterm command)
└── [ ] Testing and polish
```

### Phase 3: Cross-Machine (Future)

```
├── [ ] Multi-machine session sync
├── [ ] Web dashboard
├── [ ] Mobile web app
└── [ ] Team features
```

---

## Quick Reference

### Environment Variables

```bash
# API Server
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
LEMON_SQUEEZY_API_KEY=...
LEMON_SQUEEZY_WEBHOOK_SECRET=...
RESEND_API_KEY=...

# Extension
IMMORTERM_API_URL=https://api.immorterm.com
```

### Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Payment processor | Lemon Squeezy | Israel support, MoR, Stripe-backed |
| Auth provider | Better Auth | Self-hosted, GitHub OAuth, passkeys |
| Database | Neon Postgres | Serverless, Drizzle ORM, Pax compatible |
| API framework | Hono | Fast, Bun-native, TypeScript |
| Binary language | C or Rust | Small, fast, harder to reverse-engineer |
| Sync strategy | Local-first | Offline works, cloud enhances |

---

## Files to Create

### API Service

```
services/api/
├── package.json
├── moon.yml
├── tsconfig.json
└── src/
    ├── index.ts
    ├── routes/
    │   ├── auth.ts
    │   ├── license.ts
    │   ├── themes.ts
    │   ├── projects.ts
    │   ├── terminals.ts
    │   ├── claude.ts
    │   └── webhooks.ts
    └── lib/
        ├── db.ts
        └── lemon-squeezy.ts
```

### Shared Libraries

```
libs/
├── database/
│   ├── package.json
│   └── src/
│       ├── index.ts
│       └── schema/
│           ├── subscriptions.ts
│           ├── user-settings.ts
│           ├── themes.ts
│           ├── projects.ts
│           ├── terminals.ts
│           └── claude-sessions.ts
├── auth/
│   ├── package.json
│   └── src/
│       └── index.ts
└── types/
    ├── package.json
    └── src/
        └── index.ts
```

---

*This document serves as the complete blueprint for implementing ImmorTerm's freemium model. The next agent should start with Phase 1, Week 1 tasks.*
