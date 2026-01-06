# Changelog

All notable changes to ImmorTerm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-06

### Added
- **Claude Code Integration**: Terminal sessions now automatically link to your Claude Code conversations
  - When you work in Claude Code, ImmorTerm tracks which terminal belongs to which conversation
  - Reopening a Claude session reconnects you to the exact terminal state you left
- **Background Session Sync**: New `claude-session-sync` service keeps terminal-to-Claude associations current
- **Expanded History Buffer**: Terminal sessions now preserve 1000 lines of scrollback (up from 500)

### Changed
- Improved session matching accuracy using conversation content analysis
- Session associations now clear automatically when Claude Code exits, preventing outdated connections

### Technical
- New modules: `claude-sync.ts`, `json-utils.ts`, `terminal-matching.ts`
- Integration with `~/.claude/history.jsonl` for session correlation

## [1.0.0] - 2024-12-15

### Added
- Initial release
- **Crash Survival**: Terminals persist through VS Code crashes, restarts, and updates
- **Auto-Restore**: Terminals automatically reopen on VS Code startup via Restore Terminals extension
- **Scroll History**: Full scroll history saved to log files in `.vscode/terminals/logs/`
- **Multi-Terminal**: Each VS Code terminal gets its own isolated screen session
- **Name Sync**: Terminal tab names sync to restore configuration via custom VS Code extension
- **Zero Config**: Works immediately after installation with sensible defaults
- **Keyboard Shortcuts**: `Ctrl+Shift+Q Q` for instant close, `Ctrl+Shift+D` to detach
- **60-Second Safety**: X button closes have delayed cleanup to protect against accidental loss
- **Cross-Platform**: Full support for macOS, Linux, and WSL2
- **Homebrew Distribution**: Easy installation via `brew tap lonormaly/tap && brew install immorterm`
