/**
 * ImmorTerm Extension Entry Point
 *
 * Architecture: VS Code extension that provides immortal terminals using GNU Screen.
 *
 * Flow:
 * 1. Extension activates on VS Code startup (onStartupFinished)
 * 2. Detects Screen availability and extracts resources
 * 3. Initializes WorkspaceStorage, TerminalManager, and StatusBar
 * 4. Registers all commands and terminal event handlers
 * 5. Restores terminals from previous session (if enabled)
 *
 * Commands:
 * - immorterm.forgetTerminal: Forget current terminal (Ctrl+Shift+Q Q)
 * - immorterm.forgetAllTerminals: Forget all terminals (Ctrl+Shift+Q A)
 * - immorterm.renameTerminal: Rename terminal (Ctrl+Shift+R)
 * - immorterm.cleanupStale: Cleanup stale Screen sessions
 * - immorterm.killAllScreens: Kill all Screen sessions for project
 * - immorterm.showStatus: Show terminal status
 * - immorterm.syncNow: Sync terminal names now
 * - immorterm.enableForProject: Enable ImmorTerm for this project
 * - immorterm.disableForProject: Disable ImmorTerm for this project
 */

import * as vscode from 'vscode';
import { logger } from './utils/logger';
import { activate as activateWorkspace, InitializationResult } from './activation';
import { StatusBar } from './ui/status-bar';
import { TerminalManager } from './terminal/manager';
import { notifications } from './ui/notifications';
import {
  restoreTerminalsWithDelay,
  isRestoreOnStartupEnabled,
  trackTerminalName,
  checkAndSyncNameChange,
  generateNextName,
} from './terminal';
import { WorkspaceStorage } from './storage/workspace-state';
import {
  forgetTerminal,
  forgetAllTerminals,
  cleanupStaleTerminals,
  killAllScreenSessions,
  cleanupLogs,
  reconcileTerminal,
  renameTerminal,
} from './commands';
import { shouldAutoCleanupStale, getClaudeSyncInterval, shouldClaudeAutoResume } from './utils/settings';
import { screenCommands } from './utils/screen-commands';
import { initJsonUtils, updateJsonNameAndCommand, getAllTerminalsFromJson } from './json-utils';
import { initClaudeSync, syncClaudeSessions } from './claude-sync';
import * as fs from 'fs/promises';
import * as path from 'path';

// Track command-initiated renames to prevent onDidChangeTerminalState from reverting
// Maps windowId -> {newName, oldVsCodeName} - we skip sync if VS Code still has oldVsCodeName
const commandRenames = new Map<string, { newName: string; oldVsCodeName: string }>();

/**
 * Mark a terminal as renamed via command (called from rename command)
 * Stores both the new name we set and the VS Code name at rename time
 * Entry persists until VS Code tab updates or user manually renames
 */
export function markCommandRenamed(windowId: string, newName: string, oldVsCodeName: string): void {
  commandRenames.set(windowId, { newName, oldVsCodeName });
  // No timeout - entry cleared when VS Code tab updates or user renames differently
}

/**
 * Check if we should skip syncing VS Code's name to storage
 * Returns true if: we recently renamed via command AND VS Code still shows old name
 * Returns false if: VS Code name actually changed (user manual rename) - we should sync
 */
function shouldSkipVsCodeSync(windowId: string, vsCodeName: string, storedName: string): boolean {
  const pending = commandRenames.get(windowId);
  if (!pending) return false;

  // Case 1: VS Code finally updated to our new name - clear tracking, no sync needed
  if (vsCodeName === pending.newName) {
    logger.debug(`VS Code tab updated to command name "${pending.newName}" - clearing tracking`);
    commandRenames.delete(windowId);
    return true; // Skip sync - names already match
  }

  // Case 2: VS Code still has old name, storage has our new name - skip the revert
  if (vsCodeName === pending.oldVsCodeName && storedName === pending.newName) {
    logger.debug(`Skipping sync - command renamed to "${pending.newName}", VS Code still shows "${vsCodeName}"`);
    return true;
  }

  // Case 3: VS Code has a completely different name - user manually renamed
  // Clear tracking and let it sync
  logger.debug(`User renamed to "${vsCodeName}" - clearing tracking, allowing sync`);
  commandRenames.delete(windowId);
  return false;
}

/**
 * Sync a user-initiated terminal name change to storage, JSON, screen, and shell.
 * Called when VS Code terminal name changes (via UI rename).
 */
async function syncUserRename(
  windowId: string,
  newName: string,
  terminalManager: TerminalManager
): Promise<void> {
  await terminalManager.updateTerminalName(windowId, newName);
  updateJsonNameAndCommand(windowId, newName);

  // Update screen title
  const projectName = terminalManager.getProjectName();
  const sessionName = `${projectName}-${windowId}`;
  const timestamp = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(',', '-').replace(' ', '');
  await screenCommands.setWindowTitle(sessionName, `${timestamp} ${newName}`);

  // Write pending-renames file so shell's precmd hook updates SCREEN_WINDOW_NAME
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceFolder) {
    const pendingDir = path.join(workspaceFolder, '.vscode', 'terminals', 'pending-renames');
    try {
      await fs.mkdir(pendingDir, { recursive: true });
      await fs.writeFile(path.join(pendingDir, sessionName), newName, 'utf-8');
      logger.debug('Wrote pending rename file for shell:', sessionName);
    } catch (err) {
      logger.warn('Failed to write pending rename file:', err);
    }
  }

  logger.info('Synced user rename to storage, JSON, screen, and shell:', windowId, '->', newName);
}

/**
 * Generates a unique window ID in the same format as screen-auto
 * Format: {pid}-{8-char-random}
 */
function generateWindowId(): string {
  const pid = process.pid;
  const randomChars = Array.from({ length: 8 }, () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }).join('');
  return `${pid}-${randomChars}`;
}

/**
 * Terminal Profile Provider for ImmorTerm
 *
 * Implements vscode.TerminalProfileProvider to create ImmorTerm terminals
 * that wrap in GNU Screen sessions for persistence.
 */
class ImmorTermProfileProvider implements vscode.TerminalProfileProvider {
  constructor(
    private readonly terminalsDir: string,
    private readonly storage: WorkspaceStorage,
    private readonly projectName: string,
    private readonly pendingDir: string
  ) {}

  provideTerminalProfile(
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.TerminalProfile> {
    logger.info('ImmorTermProfileProvider.provideTerminalProfile() called');
    const screenAutoPath = `${this.terminalsDir}/screen-auto`;

    // Generate unique window ID and display name BEFORE terminal creation
    const windowId = generateWindowId();
    const displayName = generateNextName(this.projectName, this.storage);
    logger.info('Creating new ImmorTerm terminal:', { windowId, displayName, screenAutoPath });

    logger.debug('Pre-generating terminal identity:', { windowId, displayName });

    // Write pending file so reconciliation picks it up
    // (screen-auto will skip its own pending file creation when env vars are set)
    const pendingFile = path.join(this.pendingDir, windowId);
    const fsSync = require('fs');
    try {
      fsSync.mkdirSync(this.pendingDir, { recursive: true });
      fsSync.writeFileSync(pendingFile, `${windowId} ${displayName}`);
    } catch (err) {
      logger.warn('Failed to write pending file:', err);
    }

    // NOTE: Do NOT set 'name' property here!
    // When 'name' is set via TerminalProfileProvider, VS Code ignores OSC title sequences.
    // By omitting 'name', VS Code respects the 'terminal.integrated.tabs.title: ${sequence}'
    // setting, allowing dynamic title changes (e.g., when Claude Code renames terminals).
    // The screen-auto script sends an OSC sequence immediately at startup to set the initial title.

    // Get configured screen binary
    const screenBinary = vscode.workspace.getConfiguration('immorterm').get<string>('screenBinary', 'screen-immorterm');

    return new vscode.TerminalProfile({
      shellPath: '/bin/bash',
      shellArgs: ['-l', '-c', screenAutoPath],
      env: {
        IMMORTERM_EXTENSION: '1',
        IMMORTERM_WINDOW_ID: windowId,
        IMMORTERM_DISPLAY_NAME: displayName,
        IMMORTERM_SCREEN_BINARY: screenBinary,
      },
    });
  }
}

/**
 * Migrates default terminal profile settings from legacy "screen" to "immorterm.screen"
 * This handles cases where users or v2 installer set the default profile to "screen"
 */
async function migrateDefaultProfileSettings(): Promise<void> {
  const config = vscode.workspace.getConfiguration('terminal.integrated');
  const platforms = ['osx', 'linux', 'windows'] as const;

  for (const platform of platforms) {
    const settingKey = `defaultProfile.${platform}`;
    const currentValue = config.get<string>(settingKey);

    if (currentValue === 'screen') {
      try {
        // Update to the new profile ID
        await config.update(settingKey, 'immorterm.screen', vscode.ConfigurationTarget.Global);
        logger.info(`Migrated default profile setting for ${platform}: screen → immorterm.screen`);
      } catch (err) {
        logger.warn(`Failed to migrate default profile for ${platform}:`, err);
      }
    }
  }
}

// Module-level state
let initResult: InitializationResult | null = null;
let disposables: vscode.Disposable[] = [];

// Scheduled cleanup timers
let staleCleanupTimer: NodeJS.Timeout | null = null;
let logCleanupTimer: NodeJS.Timeout | null = null;
let claudeSyncTimer: NodeJS.Timeout | null = null;
let titleSyncTimer: NodeJS.Timeout | null = null;

// Cleanup intervals (in milliseconds)
const STALE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const LOG_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const TITLE_SYNC_INTERVAL = 2000; // 2 seconds - fast for responsive title sync

/**
 * Schedules periodic cleanup tasks
 * - Stale terminal cleanup (hourly, if autoCleanupStale is enabled)
 * - Log file cleanup (hourly)
 */
function schedulePeriodicCleanup(
  storage: import('./storage/workspace-state').WorkspaceStorage,
  logsDir: string
): void {
  // Schedule stale terminal cleanup (if enabled)
  if (shouldAutoCleanupStale()) {
    // Run once immediately on activation
    cleanupStaleTerminals(storage, logsDir)
      .then((result) => {
        if (result.entriesRemoved > 0) {
          logger.info(`Initial stale cleanup: removed ${result.entriesRemoved} entries`);
        }
      })
      .catch((err) => {
        logger.error('Initial stale cleanup failed:', err);
      });

    // Schedule periodic cleanup
    staleCleanupTimer = setInterval(async () => {
      try {
        const result = await cleanupStaleTerminals(storage, logsDir);
        if (result.entriesRemoved > 0) {
          logger.info(`Scheduled stale cleanup: removed ${result.entriesRemoved} entries`);
        }
      } catch (err) {
        logger.error('Scheduled stale cleanup failed:', err);
      }
    }, STALE_CLEANUP_INTERVAL);

    logger.debug('Scheduled stale cleanup every', STALE_CLEANUP_INTERVAL / 1000 / 60, 'minutes');
  }

  // Schedule log cleanup (always enabled)
  logCleanupTimer = setInterval(async () => {
    try {
      const result = await cleanupLogs(logsDir);
      if (result.filesRemoved > 0) {
        logger.info(`Scheduled log cleanup: removed ${result.filesRemoved} files, freed ${Math.round(result.bytesFreed / 1024)}KB`);
      }
    } catch (err) {
      logger.error('Scheduled log cleanup failed:', err);
    }
  }, LOG_CLEANUP_INTERVAL);

  logger.debug('Scheduled log cleanup every', LOG_CLEANUP_INTERVAL / 1000 / 60, 'minutes');
}

/**
 * Cancels all scheduled cleanup timers
 */
function cancelScheduledCleanup(): void {
  if (staleCleanupTimer) {
    clearInterval(staleCleanupTimer);
    staleCleanupTimer = null;
    logger.debug('Cancelled stale cleanup timer');
  }

  if (logCleanupTimer) {
    clearInterval(logCleanupTimer);
    logCleanupTimer = null;
    logger.debug('Cancelled log cleanup timer');
  }

  if (claudeSyncTimer) {
    clearInterval(claudeSyncTimer);
    claudeSyncTimer = null;
    logger.debug('Cancelled Claude sync timer');
  }

  if (titleSyncTimer) {
    clearInterval(titleSyncTimer);
    titleSyncTimer = null;
    logger.debug('Cancelled title sync timer');
  }
}

/**
 * Registers all ImmorTerm commands
 */
function registerCommands(
  context: vscode.ExtensionContext,
  terminalManager: TerminalManager,
  statusBar: StatusBar,
  logsDir: string
): void {
  // Command: Forget Current Terminal (Ctrl+Shift+Q Q)
  // T030: Gets active terminal, extracts windowId, calls forgetTerminal()
  const forgetTerminalCmd = vscode.commands.registerCommand(
    'immorterm.forgetTerminal',
    async () => {
      const activeTerminal = vscode.window.activeTerminal;
      if (!activeTerminal) {
        vscode.window.showWarningMessage('ImmorTerm: No active terminal');
        return;
      }

      const windowId = terminalManager.getWindowIdForTerminal(activeTerminal);
      if (!windowId) {
        vscode.window.showWarningMessage(
          'ImmorTerm: Current terminal is not tracked'
        );
        return;
      }

      // Use the forgetTerminal command function from commands module
      const storage = terminalManager.getStorage();
      const result = await forgetTerminal(windowId, storage, logsDir, {
        showNotification: true,
        closeTerminalTab: true,
      });

      await statusBar.update();

      logger.info('Forgot terminal:', windowId, result);
    }
  );
  context.subscriptions.push(forgetTerminalCmd);

  // Command: Forget All Terminals (Ctrl+Shift+Q A)
  // T031: Calls forgetAllTerminals() with confirmation prompt
  const forgetAllTerminalsCmd = vscode.commands.registerCommand(
    'immorterm.forgetAllTerminals',
    async () => {
      const terminals = terminalManager.getAllTerminals();
      if (terminals.length === 0) {
        vscode.window.showInformationMessage('ImmorTerm: No terminals to forget');
        return;
      }

      // Use the forgetAllTerminals command function from commands module
      // It handles confirmation internally
      const storage = terminalManager.getStorage();
      const result = await forgetAllTerminals(storage, logsDir, {
        skipConfirmation: false,
        showNotification: true,
      });

      if (result.confirmed) {
        // Close VS Code terminal tabs (command function handles Screen sessions and storage)
        for (const terminal of vscode.window.terminals) {
          terminal.dispose();
        }

        await statusBar.update();
        logger.info('Forgot all terminals:', result);
      }
    }
  );
  context.subscriptions.push(forgetAllTerminalsCmd);

  // Command: Cleanup Stale Sessions
  // T032: Calls cleanupStaleTerminals() and shows notification with cleanup count
  const cleanupStaleCmd = vscode.commands.registerCommand(
    'immorterm.cleanupStale',
    async () => {
      const storage = terminalManager.getStorage();
      const result = await cleanupStaleTerminals(storage, logsDir);

      // Show notification with cleanup count
      notifications.showCleanupComplete(result.entriesRemoved);
      await statusBar.update();

      logger.info('Cleanup stale sessions complete:', result);
    }
  );
  context.subscriptions.push(cleanupStaleCmd);

  // Command: Kill All Screen Sessions
  // T033: Calls killAllScreenSessions() with confirmation and shows notification with count
  const killAllScreensCmd = vscode.commands.registerCommand(
    'immorterm.killAllScreens',
    async () => {
      const storage = terminalManager.getStorage();
      const result = await killAllScreenSessions(storage, logsDir, {
        skipConfirmation: false,
        showNotification: true,
      });

      if (result.confirmed) {
        // Close VS Code terminal tabs
        for (const terminal of vscode.window.terminals) {
          terminal.dispose();
        }

        await statusBar.update();
        logger.info('Kill all screens complete:', result);
      }
    }
  );
  context.subscriptions.push(killAllScreensCmd);

  // Command: Show Status
  // T034: Shows QuickPick with terminal list and status
  // Includes Screen session count, total log size, storage version
  const showStatusCmd = vscode.commands.registerCommand(
    'immorterm.showStatus',
    async () => {
      const terminals = terminalManager.getAllTerminals();
      const projectName = terminalManager.getProjectName();
      const screenAvailable = statusBar.isScreenAvailable();
      const storage = terminalManager.getStorage();

      // Get Screen session count
      let screenSessionCount = 0;
      try {
        const { screenCommands } = await import('./utils/screen-commands');
        const sessions = await screenCommands.listProjectSessions(projectName);
        screenSessionCount = sessions.length;
      } catch {
        // Ignore errors in session count
      }

      // Get total log size
      let totalLogSizeMb = 0;
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const logFiles = await fs.readdir(logsDir).catch(() => []);
        for (const logFile of logFiles) {
          if (logFile.endsWith('.log') && logFile.startsWith(`${projectName}-`)) {
            const logPath = path.join(logsDir, logFile);
            const stats = await fs.stat(logPath).catch(() => null);
            if (stats) {
              totalLogSizeMb += stats.size / (1024 * 1024);
            }
          }
        }
      } catch {
        // Ignore errors in log size calculation
      }

      // Get storage version
      const storageState = storage.getState();
      const storageVersion = storageState.version;

      // Build status items for QuickPick
      const items: vscode.QuickPickItem[] = [
        {
          label: '$(info) Status',
          description: screenAvailable ? 'Screen Available' : 'Screen Missing',
          detail: `Project: ${projectName} | Storage Version: ${storageVersion}`,
        },
        {
          label: '$(list-unordered) Terminals',
          description: `${terminals.length} registered`,
          detail: `ImmorTerm Sessions: ${screenSessionCount} | Log Size: ${totalLogSizeMb.toFixed(2)} MB`,
        },
        { kind: vscode.QuickPickItemKind.Separator, label: '' },
      ];

      // Add terminal entries
      for (const terminal of terminals) {
        items.push({
          label: `$(terminal) ${terminal.name}`,
          description: terminal.screenSession,
          detail: `Created: ${new Date(terminal.createdAt).toLocaleString()}`,
        });
      }

      // Add actions
      items.push(
        { kind: vscode.QuickPickItemKind.Separator, label: '' },
        { label: '$(refresh) Sync Now', description: 'Sync terminal names' },
        { label: '$(trash) Cleanup Stale', description: 'Remove orphaned sessions' },
        { label: '$(output) View Logs', description: 'Open ImmorTerm output' }
      );

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'ImmorTerm Status',
        title: 'ImmorTerm',
      });

      if (selected?.label === '$(refresh) Sync Now') {
        vscode.commands.executeCommand('immorterm.syncNow');
      } else if (selected?.label === '$(trash) Cleanup Stale') {
        vscode.commands.executeCommand('immorterm.cleanupStale');
      } else if (selected?.label === '$(output) View Logs') {
        logger.show();
      }
    }
  );
  context.subscriptions.push(showStatusCmd);

  // Command: Sync Now
  // T035: Triggers manual sync of terminal names to storage
  const syncNowCmd = vscode.commands.registerCommand(
    'immorterm.syncNow',
    async () => {
      // Sync terminal names from VS Code to storage
      let synced = 0;
      for (const terminal of vscode.window.terminals) {
        const windowId = terminalManager.getWindowIdForTerminal(terminal);
        if (windowId) {
          const updated = await terminalManager.updateTerminalName(
            windowId,
            terminal.name
          );
          if (updated) {
            synced++;
          }
        }
      }

      // Show notification on completion
      notifications.showSyncComplete();
      await statusBar.update();

      logger.info('Synced terminal names:', synced);
    }
  );
  context.subscriptions.push(syncNowCmd);

  // Command: Rename Terminal
  // T036: Rename terminal via VS Code input box (Ctrl+Shift+R)
  const renameTerminalCmd = vscode.commands.registerCommand(
    'immorterm.renameTerminal',
    async () => {
      const terminal = vscode.window.activeTerminal;
      if (!terminal) {
        vscode.window.showWarningMessage('ImmorTerm: No active terminal');
        return;
      }

      const windowId = terminalManager.getWindowIdForTerminal(terminal);
      if (!windowId) {
        vscode.window.showWarningMessage('ImmorTerm: Terminal not tracked by ImmorTerm');
        return;
      }

      const storage = terminalManager.getStorage();
      const projectName = terminalManager.getProjectName();
      const oldVsCodeName = terminal.name; // Capture VS Code tab name before rename
      const result = await renameTerminal(terminal, windowId, storage, projectName);

      if (result.success && result.oldName !== result.newName) {
        // Mark this rename so onDidChangeTerminalState won't revert it
        // VS Code tab name stays as oldVsCodeName (can't update via OSC through screen)
        // Storage/JSON have newName - we don't want handler to "sync" old name back
        markCommandRenamed(windowId, result.newName!, oldVsCodeName);
        vscode.window.showInformationMessage(
          `ImmorTerm: Renamed "${result.oldName}" → "${result.newName}"`
        );
        await statusBar.update();
      } else if (!result.success && result.error !== 'Cancelled') {
        vscode.window.showErrorMessage(`ImmorTerm: ${result.error}`);
      }
    }
  );
  context.subscriptions.push(renameTerminalCmd);

  // Command: Enable for This Project
  // Creates .vscode/settings.json with ImmorTerm as default terminal profile
  const enableForProjectCmd = vscode.commands.registerCommand(
    'immorterm.enableForProject',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('ImmorTerm: No workspace folder open');
        return;
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
      const settingsPath = path.join(vscodeDir, 'settings.json');

      try {
        // Ensure .vscode directory exists
        await fs.mkdir(vscodeDir, { recursive: true });

        // Read existing settings or start fresh
        let settings: Record<string, unknown> = {};
        try {
          const content = await fs.readFile(settingsPath, 'utf-8');
          settings = JSON.parse(content);
        } catch {
          // File doesn't exist or is invalid, start fresh
        }

        // Check if already enabled
        const osxProfile = settings['terminal.integrated.defaultProfile.osx'];
        const linuxProfile = settings['terminal.integrated.defaultProfile.linux'];

        if (osxProfile === 'ImmorTerm' || linuxProfile === 'ImmorTerm') {
          vscode.window.showInformationMessage('ImmorTerm: Already enabled for this project');
          return;
        }

        // Add ImmorTerm as default terminal profile (use profile title, not ID)
        settings['terminal.integrated.defaultProfile.osx'] = 'ImmorTerm';
        settings['terminal.integrated.defaultProfile.linux'] = 'ImmorTerm';

        // Write updated settings
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');

        vscode.window.showInformationMessage(
          'ImmorTerm: Enabled for this project! New terminals will be immortal.',
          'Reload Window'
        ).then((selection) => {
          if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });

        logger.info('Enabled ImmorTerm for project:', workspaceFolder.name);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`ImmorTerm: Failed to enable - ${message}`);
        logger.error('Failed to enable for project:', err);
      }
    }
  );
  context.subscriptions.push(enableForProjectCmd);

  // Command: Disable for This Project
  // Removes ImmorTerm settings from .vscode/settings.json
  const disableForProjectCmd = vscode.commands.registerCommand(
    'immorterm.disableForProject',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('ImmorTerm: No workspace folder open');
        return;
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      const settingsPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json');

      try {
        // Read existing settings
        const content = await fs.readFile(settingsPath, 'utf-8');
        const settings: Record<string, unknown> = JSON.parse(content);

        // Remove ImmorTerm profile settings (check by title, not ID)
        let removed = false;
        if (settings['terminal.integrated.defaultProfile.osx'] === 'ImmorTerm') {
          delete settings['terminal.integrated.defaultProfile.osx'];
          removed = true;
        }
        if (settings['terminal.integrated.defaultProfile.linux'] === 'ImmorTerm') {
          delete settings['terminal.integrated.defaultProfile.linux'];
          removed = true;
        }

        if (!removed) {
          vscode.window.showInformationMessage('ImmorTerm: Not enabled for this project');
          return;
        }

        // Write updated settings (or delete if empty)
        if (Object.keys(settings).length === 0) {
          await fs.unlink(settingsPath);
        } else {
          await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
        }

        vscode.window.showInformationMessage(
          'ImmorTerm: Disabled for this project. New terminals will be regular.',
          'Reload Window'
        ).then((selection) => {
          if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });

        logger.info('Disabled ImmorTerm for project:', workspaceFolder.name);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          vscode.window.showInformationMessage('ImmorTerm: Not enabled for this project');
        } else {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`ImmorTerm: Failed to disable - ${message}`);
          logger.error('Failed to disable for project:', err);
        }
      }
    }
  );
  context.subscriptions.push(disableForProjectCmd);

  // TEST Command: Try to set terminal title via sendText with OSC
  const testTitleCmd = vscode.commands.registerCommand(
    'immorterm.testTitle',
    async () => {
      const terminal = vscode.window.activeTerminal;
      if (!terminal) {
        vscode.window.showErrorMessage('No active terminal');
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: 'Enter test title',
        value: 'TestTitle',
      });

      if (!newName) return;

      // Try sending OSC sequence via sendText
      // This sends to terminal INPUT - let's see what happens
      terminal.sendText(`printf '\\033]0;${newName}\\007'`, true);

      vscode.window.showInformationMessage(`Sent OSC for: ${newName}`);
      logger.info(`TEST: Sent OSC via sendText for: ${newName}`);
    }
  );
  context.subscriptions.push(testTitleCmd);

  logger.info('Registered 9 commands');
}

/**
 * Subscribes to terminal events for tracking and lifecycle management
 */
function subscribeToTerminalEvents(
  context: vscode.ExtensionContext,
  terminalManager: TerminalManager,
  statusBar: StatusBar
): void {
  // Track when terminals are opened
  const onDidOpenTerminal = vscode.window.onDidOpenTerminal((terminal) => {
    logger.info('Terminal opened:', terminal.name);

    // Check if this terminal is already tracked (restored terminal)
    if (terminalManager.getWindowIdForTerminal(terminal)) {
      logger.debug('Terminal already tracked:', terminal.name);
      return;
    }

    // Check for ImmorTerm env var - most reliable method
    // The profile provider sets IMMORTERM_WINDOW_ID in the terminal's env
    const opts = terminal.creationOptions as vscode.TerminalOptions | undefined;
    const envWindowId = opts?.env?.IMMORTERM_WINDOW_ID;
    if (envWindowId) {
      terminalManager.trackTerminal(terminal, envWindowId);
      logger.info('Tracked terminal by env var:', envWindowId);
      return;
    }

    // Fallback: Try to match this terminal to a registered entry by name
    // This handles restored terminals that don't have the env var
    const storage = terminalManager.getStorage();
    const terminalState = storage.getTerminalByName(terminal.name);
    logger.debug('Looking for terminal by name:', terminal.name, '-> found:', !!terminalState);

    if (terminalState) {
      // Found matching terminal in storage - track it!
      terminalManager.trackTerminal(terminal, terminalState.windowId);
      logger.info('Tracked new terminal by name:', terminal.name, '->', terminalState.windowId);
    } else {
      // Terminal not in storage yet - might be reconciled later via pending file
      // Use a small delay to check again after pending file is processed
      setTimeout(() => {
        if (!terminalManager.getWindowIdForTerminal(terminal)) {
          const retryState = storage.getTerminalByName(terminal.name);
          if (retryState) {
            terminalManager.trackTerminal(terminal, retryState.windowId);
            logger.info('Tracked terminal after delay:', terminal.name, '->', retryState.windowId);
          }
        }
      }, 500);
    }
  });
  context.subscriptions.push(onDidOpenTerminal);
  disposables.push(onDidOpenTerminal);

  // Track when terminals are closed
  const onDidCloseTerminal = vscode.window.onDidCloseTerminal((terminal) => {
    logger.debug('Terminal closed:', terminal.name);

    const windowId = terminalManager.getWindowIdForTerminal(terminal);
    if (windowId) {
      // Untrack from memory
      terminalManager.untrackTerminal(terminal);

      // Schedule cleanup with grace period (prevents accidental cleanup during VS Code reload)
      // The logsDir is captured from the outer scope (initResult)
      if (initResult?.logsDir) {
        const scheduled = terminalManager.scheduleCleanup(windowId, initResult.logsDir);
        logger.info(`Terminal closed: ${windowId} - cleanup ${scheduled ? 'scheduled' : 'already pending'}`);
      } else {
        logger.warn(`Terminal closed: ${windowId} - cleanup NOT scheduled (logsDir missing)`);
      }

      // Update status bar
      statusBar.update().catch((err) => {
        logger.error('Failed to update status bar:', err);
      });
    }
  });
  context.subscriptions.push(onDidCloseTerminal);
  disposables.push(onDidCloseTerminal);

  // Track terminal state changes (may include name changes)
  const onDidChangeTerminalState = vscode.window.onDidChangeTerminalState(
    async (terminal) => {
      logger.debug('Terminal state changed:', terminal.name);

      const windowId = terminalManager.getWindowIdForTerminal(terminal);
      logger.debug('onDidChangeTerminalState - windowId lookup:', windowId || 'NOT FOUND');

      if (windowId) {
        // Check if name changed and update storage
        const storedTerminal = terminalManager.getTerminalByWindowId(windowId);
        logger.debug('onDidChangeTerminalState - stored name:', storedTerminal?.name || 'NOT FOUND', '| terminal name:', terminal.name);

        if (storedTerminal && storedTerminal.name !== terminal.name) {
          // Check if we should skip this sync (command-initiated rename where VS Code hasn't updated)
          if (shouldSkipVsCodeSync(windowId, terminal.name, storedTerminal.name)) {
            return;
          }
          // VS Code name actually changed (user manual rename) - sync all
          await syncUserRename(windowId, terminal.name, terminalManager);
        } else {
          logger.debug('onDidChangeTerminalState - name unchanged or terminal not in storage');
        }
      } else {
        logger.debug('onDidChangeTerminalState - terminal not tracked by ImmorTerm');
      }
    }
  );
  context.subscriptions.push(onDidChangeTerminalState);
  disposables.push(onDidChangeTerminalState);

  // Track active terminal changes - also sync names here since onDidChangeTerminalState
  // may not fire reliably for name changes
  const onDidChangeActiveTerminal = vscode.window.onDidChangeActiveTerminal(
    async (terminal) => {
      if (terminal) {
        logger.debug('Active terminal changed:', terminal.name);

        // Check if this terminal's name changed (user manual rename via VS Code UI)
        const windowId = terminalManager.getWindowIdForTerminal(terminal);
        if (windowId) {
          const storedTerminal = terminalManager.getTerminalByWindowId(windowId);
          if (storedTerminal && storedTerminal.name !== terminal.name) {
            // Check if we should skip this sync (command-initiated rename)
            if (shouldSkipVsCodeSync(windowId, terminal.name, storedTerminal.name)) {
              return;
            }
            // VS Code name actually changed (user manual rename) - sync all
            await syncUserRename(windowId, terminal.name, terminalManager);
          }
        }
      }
    }
  );
  context.subscriptions.push(onDidChangeActiveTerminal);
  disposables.push(onDidChangeActiveTerminal);

  logger.info('Subscribed to terminal events');
}

/**
 * Sets up a file watcher for the pending directory
 *
 * When screen-auto creates a new terminal, it writes a pending file with:
 *   {windowId} {displayName}
 *
 * This watcher:
 * 1. Watches .vscode/terminals/pending/ for new files
 * 2. Reads the file content to get windowId and displayName
 * 3. Calls reconcileTerminal() to register the terminal
 * 4. Deletes the pending file after successful processing
 */
function setupPendingFileWatcher(
  context: vscode.ExtensionContext,
  terminalManager: TerminalManager,
  statusBar: StatusBar
): vscode.FileSystemWatcher | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    logger.warn('No workspace folder, skipping pending file watcher');
    return undefined;
  }

  const pendingDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'terminals', 'pending');
  const pendingPattern = new vscode.RelativePattern(pendingDir, '*');

  // Ensure pending directory exists
  fs.mkdir(pendingDir, { recursive: true }).catch((err) => {
    logger.debug('Could not create pending directory:', err);
  });

  const watcher = vscode.workspace.createFileSystemWatcher(pendingPattern);

  // Process a pending file
  const processPendingFile = async (uri: vscode.Uri): Promise<void> => {
    const filePath = uri.fsPath;
    const fileName = path.basename(filePath);

    try {
      // Read the pending file content
      const content = await fs.readFile(filePath, 'utf-8');
      const trimmed = content.trim();

      if (!trimmed) {
        logger.debug(`Empty pending file, deleting: ${fileName}`);
        await fs.unlink(filePath).catch(() => {});
        return;
      }

      // Parse format: "{windowId} {displayName}"
      const spaceIndex = trimmed.indexOf(' ');
      if (spaceIndex === -1) {
        logger.warn(`Invalid pending file format (no space): ${fileName}`);
        await fs.unlink(filePath).catch(() => {});
        return;
      }

      const windowId = trimmed.substring(0, spaceIndex);
      const displayName = trimmed.substring(spaceIndex + 1);

      logger.info(`Processing pending terminal: ${windowId} -> ${displayName}`);

      // Reconcile the terminal (register in storage)
      const storage = terminalManager.getStorage();
      const result = await reconcileTerminal(windowId, displayName, storage);

      if (result.added) {
        logger.info(`Registered new terminal: ${windowId} (${displayName})`);
        // Note: Terminal tracking now happens in onDidOpenTerminal via env var check
        // This ensures deterministic matching instead of racy "first untracked" scanning

        // Update status bar to reflect new terminal count
        await statusBar.update();
      } else {
        logger.debug(`Terminal already registered: ${windowId}`);
      }

      // Delete the pending file after successful processing
      await fs.unlink(filePath).catch((err) => {
        logger.warn(`Failed to delete pending file ${fileName}:`, err);
      });

    } catch (err) {
      logger.error(`Failed to process pending file ${fileName}:`, err);
      // Still try to delete the file to avoid infinite retries
      await fs.unlink(filePath).catch(() => {});
    }
  };

  // Watch for new files
  watcher.onDidCreate(async (uri) => {
    logger.debug('Pending file created:', uri.fsPath);
    // Small delay to ensure file is fully written
    await new Promise((resolve) => setTimeout(resolve, 100));
    await processPendingFile(uri);
  });

  // Also process any existing pending files on startup
  (async () => {
    try {
      const files = await fs.readdir(pendingDir);
      for (const file of files) {
        const filePath = path.join(pendingDir, file);
        const uri = vscode.Uri.file(filePath);
        await processPendingFile(uri);
      }
      if (files.length > 0) {
        logger.info(`Processed ${files.length} pending file(s) on startup`);
      }
    } catch (err) {
      // Directory may not exist yet, that's fine
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.debug('Could not read pending directory:', err);
      }
    }
  })();

  context.subscriptions.push(watcher);
  disposables.push(watcher);

  logger.info('Pending file watcher initialized');
  return watcher;
}

/**
 * Extension activation entry point
 * Called when VS Code starts up (onStartupFinished)
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  logger.info('ImmorTerm extension activating...');

  // Initialize workspace (Screen detection, resource extraction, storage, etc.)
  initResult = await activateWorkspace(context);

  if (!initResult) {
    logger.warn('ImmorTerm initialization failed or no workspace');
    return;
  }

  const { terminalManager, statusBar, screenAvailable, terminalsDir, logsDir } = initResult;

  // Initialize JSON utilities with the path to restore-terminals.json
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    const jsonPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'restore-terminals.json');
    initJsonUtils(jsonPath, (msg) => logger.info(msg));
    logger.debug('Initialized JSON utilities with path:', jsonPath);

    // Initialize Claude sync if enabled
    if (shouldClaudeAutoResume()) {
      const projectName = workspaceFolder.name;
      const screenBinary = vscode.workspace.getConfiguration('immorterm').get<string>('screenBinary', 'screen-immorterm');
      initClaudeSync(projectName, workspaceFolder.uri.fsPath, (msg) => logger.info(msg), screenBinary);
      logger.info('Claude sync initialized for project:', projectName);

      // Run initial sync
      syncClaudeSessions();

      // Schedule periodic Claude sync
      const syncInterval = getClaudeSyncInterval();
      claudeSyncTimer = setInterval(() => {
        syncClaudeSessions();
      }, syncInterval);
      logger.info('Claude sync scheduled every', syncInterval / 1000, 'seconds');
    } else {
      logger.info('Claude auto-resume disabled by settings');
    }
  }

  // Register terminal profile provider for ImmorTerm terminals
  const storage = terminalManager.getStorage();
  const projectName = terminalManager.getProjectName();
  const pendingDir = workspaceFolder
    ? path.join(workspaceFolder.uri.fsPath, '.vscode', 'terminals', 'pending')
    : '';
  const terminalProfileProvider = new ImmorTermProfileProvider(
    terminalsDir,
    storage,
    projectName,
    pendingDir
  );
  context.subscriptions.push(
    vscode.window.registerTerminalProfileProvider('immorterm.screen', terminalProfileProvider)
  );

  // Migrate default profile settings from legacy "screen" to "immorterm.screen"
  await migrateDefaultProfileSettings();

  // Register all commands
  registerCommands(context, terminalManager, statusBar, logsDir);

  // Subscribe to terminal events
  subscribeToTerminalEvents(context, terminalManager, statusBar);

  // Set up pending file watcher for new terminal registration
  setupPendingFileWatcher(context, terminalManager, statusBar);

  // Schedule periodic cleanup tasks
  schedulePeriodicCleanup(terminalManager.getStorage(), logsDir);

  // Start title sync polling - checks for name changes from OSC sequences (e.g., Claude)
  // This is needed because onDidChangeTerminalState doesn't fire for OSC title changes
  titleSyncTimer = setInterval(async () => {
    const storage = terminalManager.getStorage();

    for (const terminal of vscode.window.terminals) {
      const windowId = terminalManager.getWindowIdForTerminal(terminal);
      if (windowId) {
        const storedTerminal = storage.getTerminal(windowId);
        if (storedTerminal && storedTerminal.name !== terminal.name) {
          // Skip if this was a command-initiated rename
          if (shouldSkipVsCodeSync(windowId, terminal.name, storedTerminal.name)) {
            continue;
          }
          logger.debug(`Title sync detected name change: "${storedTerminal.name}" -> "${terminal.name}"`);
          await syncUserRename(windowId, terminal.name, terminalManager);
        }
      }
    }
  }, TITLE_SYNC_INTERVAL);
  logger.debug('Started title sync polling every', TITLE_SYNC_INTERVAL / 1000, 'seconds');

  // Log activation summary
  logger.info('ImmorTerm activated', {
    screenAvailable,
    terminalsDir,
    terminalCount: terminalManager.getTerminalCount(),
    workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.name,
  });

  // Check for conflicting "Restore Terminals" extension
  // This extension reads restore-terminals.json and creates duplicate terminals
  const restoreTerminalsExt = vscode.extensions.getExtension('ethanjreesor.restore-terminals');
  if (restoreTerminalsExt) {
    logger.warn('Conflicting extension detected: "Restore Terminals" (ethanjreesor.restore-terminals)');
    logger.warn('This will cause duplicate terminals. Please disable "Restore Terminals" extension.');

    vscode.window.showWarningMessage(
      'ImmorTerm: The "Restore Terminals" extension is installed. This causes duplicate terminals on reload. Please disable "Restore Terminals" - ImmorTerm handles terminal persistence natively.',
      'Open Extensions',
      'Dismiss'
    ).then((choice) => {
      if (choice === 'Open Extensions') {
        vscode.commands.executeCommand('workbench.extensions.action.showInstalledExtensions');
      }
    });
  }

  // Sync terminal names from restore-terminals.json to WorkspaceStorage
  // This ensures names edited in JSON or from external sources are respected
  const jsonTerminals = getAllTerminalsFromJson();
  for (const jsonTerm of jsonTerminals) {
    const storedTerm = terminalManager.getStorage().getTerminal(jsonTerm.windowId);
    if (storedTerm && storedTerm.name !== jsonTerm.name) {
      logger.info(`Syncing name from JSON: "${storedTerm.name}" -> "${jsonTerm.name}" for ${jsonTerm.windowId}`);
      await terminalManager.getStorage().updateTerminal(jsonTerm.windowId, { name: jsonTerm.name });
    }
  }

  // Restore terminals on startup (if enabled and Screen is available)
  if (screenAvailable && isRestoreOnStartupEnabled()) {
    // Use delay to let VS Code fully initialize before creating terminals
    restoreTerminalsWithDelay(
      terminalManager,
      { scriptsPath: terminalsDir },
      500 // Brief startup delay
    )
      .then((result) => {
        if (result.restored > 0) {
          logger.info(`Restored ${result.restored} terminal(s) on startup`);
        }
        if (result.failed > 0) {
          logger.warn(`Failed to restore ${result.failed} terminal(s)`);
        }

        // Track restored terminals for name sync
        for (const terminal of vscode.window.terminals) {
          trackTerminalName(terminal);
        }

        // Update status bar after restoration
        statusBar.update();
      })
      .catch((err) => {
        logger.error('Terminal restoration failed:', err);
      });
  } else if (!screenAvailable) {
    logger.info('Skipping terminal restoration - Screen not available');
  } else {
    logger.info('Terminal restoration disabled by settings');
  }
}

/**
 * Extension deactivation entry point
 * Called when VS Code shuts down or extension is disabled
 */
export async function deactivate(): Promise<void> {
  logger.info('ImmorTerm extension deactivating...');

  // Cancel scheduled cleanup timers
  cancelScheduledCleanup();

  // Dispose terminal event subscriptions
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables = [];

  // Cleanup components
  if (initResult) {
    // Flush storage to ensure all state is saved
    await initResult.storage.flush();

    // Dispose status bar
    initResult.statusBar.dispose();

    // Dispose terminal manager
    await initResult.terminalManager.dispose();

    logger.info('ImmorTerm cleanup complete');
  }

  // Dispose logger last
  logger.dispose();
}
