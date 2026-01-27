---
description: Convert existing tasks into actionable, dependency-ordered GitHub issues for the feature based on available design artifacts.
tools: ['github/github-mcp-server/issue_write']
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

**IMPORTANT**: Look for `FEATURE_DIR:` in the input above. If provided, use it directly instead of running the shell script.

## Outline

1. **Resolve feature context** (CRITICAL for subagent continuity):

   **Option A - FEATURE_DIR provided in input above**:
   - If you see `FEATURE_DIR: /path/to/specs/NNN-feature-name` in the User Input section, use it directly
   - Set `TASKS` = `{FEATURE_DIR}/tasks.md`
   - Skip the shell script entirely

   **Option B - No FEATURE_DIR provided (fallback)**:
   - Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root
   - Parse FEATURE_DIR and AVAILABLE_DOCS list
   - All paths must be absolute
   - For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot")

2. From the resolved FEATURE_DIR, extract the path to **tasks** (`TASKS`).
1. Get the Git remote by running:

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> ONLY PROCEED TO NEXT STEPS IF THE REMOTE IS A GITHUB URL

1. For each task in the list, use the GitHub MCP server to create a new issue in the repository that is representative of the Git remote.

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL
