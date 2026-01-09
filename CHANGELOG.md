# Changelog

All notable changes to ImmorTerm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-07

### Added
- **Immortal Terminals**: Terminals persist through VS Code crashes, restarts, and updates using GNU Screen
- **Auto-Restore**: Terminals automatically reopen on VS Code startup with full scrollback history
- **VS Code Settings UI**: All 13 configuration options accessible via Settings > Extensions > ImmorTerm
- **8 Commands**: forgetTerminal, forgetAllTerminals, cleanupStale, killAllScreens, showStatus, syncNow, enableForProject, disableForProject
- **2 Keyboard Shortcuts**: `Ctrl+Shift+Q Q` (forget current), `Ctrl+Shift+Q A` (forget all)
- **Status Bar Integration**: Terminal count and Screen availability status at a glance
- **Per-Project Control**: Enable/disable ImmorTerm per project via commands or settings
- **Graceful Degradation**: Extension works without Screen installed (no persistence, but no errors)
- **Log Management**: Automatic log rotation with configurable size limits
- **Debug Logging**: Optional verbose logging via `immorterm.enableDebugLog` setting
- **Claude Code Integration**: Terminal sessions automatically link to Claude Code conversations
- **Configurable Naming**: Terminal naming pattern via `immorterm.namingPattern` setting

### Technical
- **TypeScript Architecture**: ScreenManager, TerminalRegistry, LogManager, SessionNamer, ConfigManager, StatusBarManager
- **Bundled Scripts**: screen-auto and screen-mem bundled in extension resources
- **VS Code API Integration**: Full use of Terminal, FileSystemWatcher, and workspaceState APIs
- **Event-Driven Architecture**: Terminal lifecycle managed via onDidOpenTerminal/onDidCloseTerminal
- **Cross-Platform**: Full support for macOS, Linux, and WSL2
