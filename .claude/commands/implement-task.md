---
description: Execute a single task from the current feature spec
---

# Implement Task

Execute a single task from the current feature spec.

## Instructions

1. **Load Context**
   - Read the current spec at `specs/[current]/spec.md`
   - Read the plan at `specs/[current]/plan.md`
   - Read the tasks at `specs/[current]/tasks.md`

2. **Find Next Task**
   - Locate the next uncompleted task (not marked with [x])
   - Verify any dependencies are completed first

3. **Execute Implementation**
   - Use `/sc:implement --safe-mode` for the task
   - Follow the constitution's patterns (Bun-native, Zod validation, etc.)
   - Create/modify only the files specified in the task

4. **Run Tests**
   - Execute `/sc:test` after completion
   - Ensure existing tests still pass
   - Add new tests for new functionality

5. **Mark Complete**
   - Update the task with [x] to mark it complete
   - Add any notes about implementation decisions

## Safety Guidelines

- Use `--safe-mode` to preview changes before applying
- Run `bun run lint` after each task
- Commit after each completed task for easy rollback

## Global SuperClaude Commands

**IMPORTANT**: The `/sc:*` commands referenced above are **GLOBAL SuperClaude commands** located at `~/.claude/commands/sc/`:

- `/sc:implement` - Implementation command with safe-mode support
- `/sc:test` - Testing command for running test suites
- `/sc:spawn` - Task orchestration for complex multi-domain operations

These commands are part of the SuperClaude framework and are NOT project-local. They work across all projects.

## What This Command Does

This command provides systematic task execution within a spec-driven feature. It ensures:
- Context is loaded before implementation
- Constitution patterns are followed
- Tests are run after each task
- Progress is tracked in the tasks file
