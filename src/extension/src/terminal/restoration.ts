import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TerminalManager } from './manager';
import { TerminalState } from '../storage/workspace-state';
import { createTerminalWithScreen, isScreenAvailable } from './screen-integration';
import { screenCommands } from '../utils/screen-commands';
import { logger } from '../utils/logger';
import { shouldCloseExistingOnRestore } from '../utils/settings';
import { getAllTerminalsFromJson } from '../json-utils';
import { getTheme, generateHardstatus } from '../themes';

const execAsync = promisify(exec);

/**
 * Configuration options for terminal restoration
 */
interface RestorationOptions {
  /** Path to the .vscode/terminals directory containing scripts */
  scriptsPath: string;
  /** Delay in milliseconds between terminal restorations (default from settings) */
  restoreDelay?: number;
}

/**
 * Result of terminal restoration operation
 */
export interface RestorationResult {
  /** Number of terminals successfully restored */
  restored: number;
  /** Number of terminals that failed to restore */
  failed: number;
  /** Number of terminals skipped (e.g., session already attached) */
  skipped: number;
  /** Details for each terminal restoration attempt */
  details: RestorationDetail[];
}

/**
 * Detail for a single terminal restoration attempt
 */
interface RestorationDetail {
  windowId: string;
  name: string;
  status: 'restored' | 'failed' | 'skipped';
  reason?: string;
}

/**
 * Gets the terminal restore delay from settings
 * @returns Delay in milliseconds
 */
function getRestoreDelay(): number {
  const config = vscode.workspace.getConfiguration('immorterm');
  return config.get<number>('terminalRestoreDelay', 800);
}

/**
 * Checks if restore on startup is enabled
 * @returns true if terminals should restore on startup
 */
export function isRestoreOnStartupEnabled(): boolean {
  const config = vscode.workspace.getConfiguration('immorterm');
  return config.get<boolean>('restoreOnStartup', true);
}

/**
 * Delays execution for a specified time
 * @param ms Milliseconds to wait
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Restores all terminals from WorkspaceStorage on startup
 *
 * For each terminal in storage:
 * 1. Checks if the Screen session still exists
 * 2. If exists: attaches to it with the stored name
 * 3. If not exists: creates a new Screen session
 * 4. Tracks the terminal in TerminalManager
 *
 * @param manager The TerminalManager instance
 * @param options Restoration options including scriptsPath
 * @returns RestorationResult with counts and details
 */
export async function restoreTerminals(
  manager: TerminalManager,
  options: RestorationOptions
): Promise<RestorationResult> {
  const result: RestorationResult = {
    restored: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  // Check if restoration is enabled
  if (!isRestoreOnStartupEnabled()) {
    logger.info('Terminal restoration disabled by settings');
    return result;
  }

  // Close existing terminals if setting is enabled
  if (shouldCloseExistingOnRestore()) {
    const existingTerminals = vscode.window.terminals;
    if (existingTerminals.length > 0) {
      logger.info(`Closing ${existingTerminals.length} existing terminals before restoration`);
      for (const terminal of existingTerminals) {
        terminal.dispose();
      }
      // Brief delay to allow terminals to close
      await delay(100);
    }
  }

  // Check if Screen is available (graceful degradation)
  if (!isScreenAvailable()) {
    logger.warn('Screen not available - terminal restoration skipped (no persistence)');
    return result;
  }

  const projectName = manager.getProjectName();

  // JSON is the source of truth for terminal restoration
  // WorkspaceStorage is just a runtime cache that can be cleared by VS Code
  const jsonTerminals = getAllTerminalsFromJson();

  if (jsonTerminals.length === 0) {
    logger.debug('No terminals in JSON to restore');
    return result;
  }

  // Convert JSON entries to TerminalState format
  const terminals: TerminalState[] = jsonTerminals.map((t) => ({
    windowId: t.windowId,
    name: t.name,
    screenSession: `${projectName}-${t.windowId}`,
    createdAt: Date.now(),
    lastAttached: Date.now(),
    claudeSessionId: t.claudeSessionId,
  }));

  logger.info(`Found ${terminals.length} terminals in JSON to restore`);

  logger.info(`Restoring ${terminals.length} terminals...`);

  const restoreDelay = options.restoreDelay ?? getRestoreDelay();

  for (let i = 0; i < terminals.length; i++) {
    const terminalState = terminals[i];

    try {
      const detail = await restoreSingleTerminal(
        manager,
        terminalState,
        options.scriptsPath,
        projectName
      );

      result.details.push(detail);

      switch (detail.status) {
        case 'restored':
          result.restored++;
          break;
        case 'failed':
          result.failed++;
          break;
        case 'skipped':
          result.skipped++;
          break;
      }

      // Add delay between terminal creations (except for the last one)
      if (i < terminals.length - 1 && restoreDelay > 0) {
        await delay(restoreDelay);
      }
    } catch (error) {
      logger.error(`Failed to restore terminal ${terminalState.windowId}:`, error);
      result.details.push({
        windowId: terminalState.windowId,
        name: terminalState.name,
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error),
      });
      result.failed++;
    }
  }

  logger.info(
    `Terminal restoration complete: ${result.restored} restored, ` +
    `${result.failed} failed, ${result.skipped} skipped`
  );

  // Show the terminal panel if any terminals were restored
  if (result.restored > 0) {
    const terminals = vscode.window.terminals;
    if (terminals.length > 0) {
      terminals[0].show();
      logger.info('Revealed terminal panel after restoration');
    }
  }

  return result;
}

/**
 * Restores a single terminal
 *
 * @param manager The TerminalManager instance
 * @param terminalState The stored terminal state
 * @param scriptsPath Path to the scripts directory
 * @param projectName The project name for session naming
 * @returns RestorationDetail for this terminal
 */
async function restoreSingleTerminal(
  manager: TerminalManager,
  terminalState: TerminalState,
  scriptsPath: string,
  projectName: string
): Promise<RestorationDetail> {
  const { windowId, name, screenSession } = terminalState;

  logger.debug(`Restoring terminal: ${windowId} "${name}"`);

  // Check if Screen session exists
  const sessionExists = await screenCommands.sessionExists(screenSession);

  if (sessionExists) {
    // Check if session is already attached (by another window)
    const sessions = await screenCommands.listSessions();
    const session = sessions.get(screenSession);

    if (session?.attached) {
      logger.debug(`Session ${screenSession} is attached elsewhere, detaching first`);
      await screenCommands.detachSession(screenSession);
    }
  }

  // Create VS Code terminal that connects to the Screen session
  // The screen-auto script handles both creating new sessions and attaching to existing ones
  const terminal = createTerminalWithScreen({
    name,
    windowId,
    scriptsPath,
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    isRestoration: true,
  });

  // Cancel any pending cleanup (in case terminal is being restored during grace period)
  if (manager.cancelCleanup(windowId)) {
    logger.debug('Cancelled pending cleanup during restoration:', windowId);
  }

  // Track the terminal in the manager
  manager.trackTerminal(terminal, windowId);

  // Update lastAttached timestamp
  await manager.getStorage().updateTerminal(windowId, {
    lastAttached: Date.now(),
  });

  const status = sessionExists ? 'restored' : 'restored';
  const reason = sessionExists
    ? 'Reattached to existing Screen session'
    : 'Created new Screen session (previous session was lost)';

  logger.info(`Restored terminal: ${windowId} "${name}" - ${reason}`);

  // Apply per-terminal theme if set (with a small delay to ensure screen is ready)
  if (terminalState.theme) {
    setTimeout(async () => {
      try {
        await applyPerTerminalTheme(terminalState.theme!, screenSession);
        logger.debug(`Applied per-terminal theme "${terminalState.theme}" to ${screenSession}`);
      } catch (err) {
        logger.warn(`Failed to apply per-terminal theme to ${screenSession}:`, err);
      }
    }, 500); // Small delay to ensure screen session is ready
  }

  return {
    windowId,
    name,
    status,
    reason,
  };
}

/**
 * Applies a per-terminal theme to a running screen session
 *
 * @param themeName The theme name to apply
 * @param screenSession The screen session name
 */
async function applyPerTerminalTheme(themeName: string, screenSession: string): Promise<void> {
  const theme = getTheme(themeName);
  const hardstatusLine = generateHardstatus(theme);

  const config = vscode.workspace.getConfiguration('immorterm');
  const screenBinary = config.get<string>('screenBinary', 'immorterm');

  const command = `${screenBinary} -S "${screenSession}" -X hardstatus alwayslastline ${hardstatusLine}`;
  await execAsync(command);
}

/**
 * Restores terminals after a brief startup delay
 * This allows VS Code to fully initialize before creating terminals
 *
 * @param manager The TerminalManager instance
 * @param options Restoration options
 * @param startupDelay Delay before starting restoration (default: 500ms)
 * @returns Promise that resolves to RestorationResult
 */
export async function restoreTerminalsWithDelay(
  manager: TerminalManager,
  options: RestorationOptions,
  startupDelay: number = 500
): Promise<RestorationResult> {
  await delay(startupDelay);
  return restoreTerminals(manager, options);
}

export default {
  restoreTerminals,
  restoreTerminalsWithDelay,
  isRestoreOnStartupEnabled,
};
