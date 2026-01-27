# Pexit - AI Creator Platform

## CRITICAL RULES - READ FIRST

### Process Management - NEVER DO THIS
```bash
# FORBIDDEN - These kill processes across ALL projects!
pkill -f "tilt"           # Kills Tilt in OTHER projects too!
pkill -f "tilt up"        # Same problem
pkill -f "bun"            # Kills bun processes everywhere
kill $(pgrep -f "...")    # Same issue with broad patterns
```

### Safe Alternatives
```bash
# Use project scripts ONLY
./scripts/tilt_down.sh    # Stops THIS project's Tilt safely

# If you must kill a process, use the specific PID
cat .tilt-pid && kill $(cat .tilt-pid)  # If PID file exists

# Or use port-specific targeting
lsof -ti :10361 | xargs kill  # Kill process on specific port
```

### Why This Matters
The developer runs multiple projects with Tilt simultaneously. Using `pkill -f "tilt"` destroys work in OTHER projects, causing data loss and frustration.

---

## Quick Start for New Sessions

**Read `PROJECT_INDEX.md` first** - comprehensive codebase index (~3K tokens vs ~58K full scan).

The index auto-refreshes in background on `git push`, `git pull`, and `git checkout` (local optimization, non-blocking).
Manual refresh: `/sc:index-repo`

---

## Project Overview

**Pexit** is a platform that lets AI creators build and sell interactive AI "packs" — personalized mini-apps that turn a user's selfies into directed, customizable photoshoots.

Think Shopify for AI creators + Astria's personalization + interactive generation tools:
- Creators get storefronts, monetization, and an easy pack-builder
- Users get a magical flow where they upload photos, train a Flux LoRA, and generate scenes they can tweak

**ICP**: AI directors, visual creators, and influencers who want to monetize their styles, and everyday users who want premium, personalized visuals without technical complexity.

---

## Tech Stack (Bleeding Edge)

| Category | Choice |
|----------|--------|
| Runtime | Bun 1.3+ |
| Monorepo | Moon (Rust-based) |
| Frontend | Next.js 15 (App Router) |
| Backend | Hono on Bun |
| Database | Neon (Postgres) + Drizzle ORM |
| Queue | BullMQ + Upstash Redis |
| Auth | Better Auth |
| AI/GPU | Modal + Replicate |
| Storage | Cloudflare R2 |
| Design | Figma MCP + shadcn/ui + Storybook |

---

## Monorepo Structure

```
/pexit
├── apps/
│   └── web/                 # Next.js marketplace + dashboard
├── services/
│   ├── api/                 # Hono API (Bun runtime)
│   └── worker/           # BullMQ job processor
├── libs/
│   ├── config/              # Zod env validation (@pexit/config)
│   ├── types/               # Shared types + Zod schemas (@pexit/types)
│   ├── ai-sdk/              # Modal/Replicate SDK (@pexit/ai-sdk)
│   ├── database/            # Drizzle + Neon (@pexit/database)
│   └── ui/                  # shadcn/ui components (@pexit/ui)
├── migrations/              # Drizzle SQL migrations
├── api-collections/         # Bruno API collections
├── .moon/                   # Moon workspace config
└── .devops/                 # Tilt, Docker, k8s
```

---

## Key Commands

```bash
# Development
bun install                    # Install dependencies
./scripts/tilt_up.sh           # Start dev environment (use /tilt-up skill)
./scripts/tilt_down.sh         # Stop dev environment (use /tilt-down skill)
moon run api:dev               # Run API in watch mode

# Quality
bun run lint                   # Lint with Biome
bun run lint:fix               # Fix lint issues
moon run :typecheck            # Type check all packages

# Database (Phase 2)
moon run database:generate     # Generate Drizzle migrations
moon run database:migrate      # Apply migrations
moon run database:studio       # Open Drizzle Studio

# Build
moon run :build                # Build all packages
moon clean                     # Clean build artifacts
```

---

## Coding Conventions

### Imports
- Use workspace aliases: `@pexit/config`, `@pexit/types`, `@pexit/ai-sdk`
- Prefer named exports over default exports
- Use `import type` for type-only imports

### TypeScript
- Strict mode enabled
- Use Zod for runtime validation
- Define schemas in `@pexit/types` for shared types

### API Patterns
- All endpoints return `{ success: boolean, data?: T, error?: Error }`
- Use `@hono/zod-validator` for request validation
- HTTP status codes: 200 (success), 400 (validation), 404 (not found), 500 (error)

### File Organization
- Collocate tests with source files (`*.test.ts`)
- One component/function per file when possible
- Index files only for re-exports

### TypeScript Monorepo Setup (Source-Based / Option B)

**Architecture Decision**: This project uses **source-based path aliases** (Option B) instead of TypeScript project references (Option A).

**How it works**:
1. `tsconfig.base.json` defines path aliases pointing to source: `"@pexit/ui": ["./libs/ui/src"]`
2. Libs export from `./src/*` in package.json (not `./dist/*`)
3. No `composite: true` or `references` arrays needed
4. TypeScript resolves imports directly to source `.ts` files

**Why Option B**:
- All libs are internal (not published to npm)
- Simpler DX - no build step needed for libs
- Faster feedback - typecheck runs on source directly
- Bun workspaces handle runtime resolution via `workspace:*`

**CRITICAL - When adding new libs**:
```yaml
# tsconfig.base.json - add path alias
"paths": {
  "@pexit/new-lib": ["./libs/new-lib/src"]
}

# libs/new-lib/package.json - export from source
"exports": {
  ".": "./src/index.ts",
  "./*": "./src/*.ts"
}

# libs/new-lib/tsconfig.json - minimal config
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src" },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**DO NOT**:
- Add `composite: true` to lib tsconfigs
- Add `references` arrays to consumer tsconfigs
- Add `rootDir` to services with `noEmit: true` (conflicts with path aliases)
- Enable `syncProjectReferences` in `.moon/toolchain.yml`

---

## Current Phase: LoRA POC

### API Endpoints

```
POST /api/lora/train         # Start LoRA training
GET  /api/lora/:id           # Get training status
GET  /api/lora               # List all training jobs

POST /api/lora/generate      # Start image generation (async)
GET  /api/lora/generate/:id  # Get generation status
POST /api/lora/generate/sync # Synchronous generation
```

### libs/ai-sdk Usage

```typescript
import { startLoraTraining, generateImages, waitForGeneration } from '@pexit/ai-sdk';

// Train a LoRA model
const training = await startLoraTraining({
  userId: 'user_123',
  images: ['https://...', 'https://...'],
  config: { triggerWord: 'TOK', steps: 1000 }
});

// Generate with trained LoRA
const generation = await generateImages({
  prompt: 'TOK as a superhero',
  loraUrl: 'https://model-url...',
  width: 1024,
  height: 1024
});

// Wait for completion
const result = await waitForGeneration(generation.predictionId);
console.log(result.imageUrls);
```

---

## Environment Variables

Required for development:
- `DATABASE_URL` - Neon connection string
- `FAL_KEY` - fal.ai API key (primary AI provider)
- `REPLICATE_API_TOKEN` - Replicate API token (backup provider)
- `R2_*` - Cloudflare R2 credentials for storage

See `.env.example` for full list.

### Secrets Management

**IMPORTANT**: All secrets are managed through **Infisical** - never hardcode secrets in code, k8s manifests, or kubectl commands.

```
Infisical Project: pexit
Environment: dev / staging / prod
K8s Secret: pexit-secrets (synced by Infisical Operator)
```

**To add/update a secret**:
1. Add to Infisical dashboard (pexit project, appropriate environment)
2. The Infisical Operator auto-syncs to `pexit-secrets` in k8s
3. Restart pods to pick up changes: `kubectl rollout restart deployment/api -n pexit`

**Local development without k8s**: Use `.env.local` files (git-ignored)

---

## Design System

Components are in `libs/ui` using shadcn/ui as base.

When creating UI:
1. Check if component exists in `@pexit/ui`
2. Use Tailwind CSS for styling
3. Follow WCAG 2.1 AA accessibility standards
4. Document in Storybook

### Frontend Aesthetics

Avoid generic "AI slop" designs (Inter font, purple gradients, cookie-cutter layouts).

- **Main conversation:** The `frontend-design` plugin auto-activates for distinctive UI
- **Subagents:** Follow `AESTHETICS.md` for typography, color, motion, and background guidance

---

## Development Workflow

### Constitution
Read the project constitution for immutable rules:
- **Location**: `.specify/memory/constitution.md`
- Defines: Bun-native patterns, workspace imports, Zod validation, API response format
- Updates: Require team approval and documentation

## Orchestrated Workflow

**Core principle**: Main agent orchestrates, never implements. Every phase spawns subagents.

### Feature Flow
/speckit.specify "feature"  → subagent → spec.md
/speckit.plan               → subagent → plan.md
/speckit.tasks              → subagent → tasks.md (with [P] markers)
/speckit.run                → parallel subagents → implementation
/sc:test                    → subagent → validation

### Parallel Execution Rules
- `[P]` marker = task can run in parallel (different files)
- No `[P]` = sequential execution
- `/speckit.run` spawns ALL `[P]` tasks in a phase simultaneously

### Auto-Activation
SuperClaude auto-selects personas from task content. No manual assignment needed.

**When to use specs**:
- New features spanning multiple files
- Database schema changes
- API endpoint additions
- Authentication/authorization changes
- Breaking changes to existing APIs

### Quick Tasks (Non-Spec)
For single-file changes or investigations:
- Use `/sc:implement` directly for small changes
- Use `/sc:analyze` for investigation
- Use `/sc:troubleshoot` for debugging

### Session Persistence
Knowledge persists across Claude Code sessions:
- **Specs**: `specs/` (git-tracked)
- **Constitution**: `.specify/memory/constitution.md`
- **Lessons Learned**: `.specify/memory/lessons-learned.md`
- **Custom Commands**: `.claude/commands/`

---

## Parallel Development with Worktrees

For working on multiple features simultaneously, use git worktrees instead of branch switching.

### Why Worktrees?

- **True parallel development** - Multiple Claude Code sessions, each in their own worktree
- **No stashing/switching** - Main repo stays on `main` branch
- **Shared Tilt** - Claim system coordinates Tilt access between agents
- **Clean merges** - Standard git workflow for merging back

### Quick Start

```bash
# Create worktree for new feature (via /speckit.specify)
/speckit.specify "my feature"
# → Choose Option A (worktree) when prompted

# Or manually:
git branch feature/015-my-feature
git worktree add ../Pexit-015-my-feature feature/015-my-feature

# Work in worktree
cd ../Pexit-015-my-feature
claude  # Start new Claude Code session

# After merge, cleanup
./scripts/worktree/worktree-cleanup.sh ../Pexit-015-my-feature
```

### Tilt Coordination

When multiple agents need Tilt:

```bash
# Check status
./scripts/worktree/tilt-status.sh

# Claim for testing (automatic during /speckit.run)
source scripts/worktree/tilt-claim.sh claim

# Release when done
source scripts/worktree/tilt-claim.sh release
```

See [scripts/worktree/README.md](scripts/worktree/README.md) for full documentation.

---

## SuperClaude Integration

### Personas to Use
- `--persona-backend` for API development
- `--persona-frontend` for UI components
- `--persona-architect` for system design
- `--persona-analyzer` for debugging
- `--persona-security` for auth and security reviews
- `--persona-qa` for testing strategy

### MCP Servers (All Installed)

| Server | Purpose | Use When |
|--------|---------|----------|
| **context7** | Library documentation & code examples | Looking up Hono, Drizzle, Bun APIs |
| **sequential-thinking** | Multi-step problem solving | Complex debugging, architecture decisions |
| **magic** | UI component generation | Creating React/shadcn components |
| **playwright** | E2E testing & browser automation | Testing user flows, screenshots |
| **serena** | Semantic code analysis | Refactoring, understanding codebase |
| **tavily** | Web search & research | Finding solutions, checking docs |
| **chrome-devtools** | Chrome debugging & performance | Performance profiling, debugging |
| **morphllm-fast-apply** | Fast code modifications | Quick inline edits |

### Custom Commands
- `/feature-start` - Begin spec-driven feature workflow
- `/implement-task` - Execute a single task from current spec
- `/review-spec` - Check spec/code alignment

---

## Multi-Environment Deployment

Pexit uses a multi-environment deployment infrastructure on a single Hetzner VPS with k3s.

### Environments

| Environment | API URL | Frontend URL | Database Branch |
|-------------|---------|--------------|-----------------|
| Production | api.pexitai.com | pexitai.com | main |
| Development | api.dev.pexitai.com | dev.pexitai.com | dev |
| Dev-Shai | api.dev-shai.pexitai.com | dev-shai.pexitai.com | dev-shai |

### Quick Commands

```bash
# Deploy to dev (automatic on push to main)
git push origin main

# Start personal dev environment (NEVER use tilt up directly!)
./scripts/tilt_up.sh              # Remote dev-shai (default)
./scripts/tilt_up.sh --local      # Local k3d

# Stop dev environment
./scripts/tilt_down.sh

# Promote to production (requires approval)
gh workflow run 03-promote-prod.yml --field image_tag=sha-xxx --field confirm_promotion=PROMOTE

# Emergency rollback
kubectl rollout undo deployment/api -n pexit-prod
```

### CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `01-build.yml` | Push to main | Build Docker image, push to GHCR |
| `02-deploy-dev.yml` | After build | Deploy to dev environment |
| `03-promote-prod.yml` | Manual | Promote image to production |
| `99-rollback.yml` | Manual | Emergency rollback |

### Documentation

- [Multi-Environment Guide](.devops/docs/multi-environment-guide.md) - Complete architecture overview
- [Runbooks Index](.devops/runbooks/README.md) - Operational procedures
- [Scripts Documentation](.devops/scripts/README.md) - Automation scripts

---

## Links

- [Moon Documentation](https://moonrepo.dev/docs)
- [Hono Documentation](https://hono.dev)
- [Bun Documentation](https://bun.sh/docs)
- [Modal Documentation](https://modal.com/docs)
- [Replicate Documentation](https://replicate.com/docs)
