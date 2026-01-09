import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkspaceStorage } from '../storage/workspace-state';
import { screenCommands } from '../utils/screen-commands';
import { logger } from '../utils/logger';
import { getAllTerminalsFromJson } from '../json-utils';

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Number of stale terminal entries removed from storage */
  entriesRemoved: number;
  /** Number of orphaned log files deleted */
  logsDeleted: number;
  /** Window IDs of terminals that were cleaned up */
  cleanedWindowIds: string[];
}

/**
 * Removes stale terminal entries from workspace storage
 *
 * This is the TypeScript equivalent of the bash screen-cleanup script.
 * Compares storage entries against active Screen sessions and removes
 * entries that no longer have a corresponding session.
 *
 * Key differences from bash version:
 * - No jq usage - native JSON via WorkspaceStorage
 * - Uses screenCommands utility for session listing
 * - Respects immorterm.autoCleanupStale setting
 *
 * @param storage WorkspaceStorage instance
 * @param logsDir Path to the logs directory
 * @returns CleanupResult with counts and cleaned window IDs
 */
export async function cleanupStaleTerminals(
  storage: WorkspaceStorage,
  logsDir: string
): Promise<CleanupResult> {
  const result: CleanupResult = {
    entriesRemoved: 0,
    logsDeleted: 0,
    cleanedWindowIds: [],
  };

  // Check if auto-cleanup is enabled
  const config = vscode.workspace.getConfiguration('immorterm');
  const autoCleanup = config.get<boolean>('autoCleanupStale', true);

  if (!autoCleanup) {
    logger.debug('Auto cleanup is disabled, skipping');
    return result;
  }

  logger.debug('Starting stale terminal cleanup');

  // Get active screen sessions for this project
  const projectName = storage.getProjectName();
  const activeSessions = await screenCommands.listProjectSessions(projectName);
  const activeSessionNames = new Set(activeSessions.map(s => s.name));

  logger.debug(`Found ${activeSessions.length} active sessions for project: ${projectName}`);

  // Get all terminals from storage
  const terminals = storage.getAllTerminals();
  const terminalsToRemove: string[] = [];

  // Find terminals with no matching screen session
  for (const terminal of terminals) {
    if (!activeSessionNames.has(terminal.screenSession)) {
      logger.info(`Stale terminal found: ${terminal.windowId} (session: ${terminal.screenSession})`);
      terminalsToRemove.push(terminal.windowId);
      result.cleanedWindowIds.push(terminal.windowId);
    }
  }

  // Remove stale terminals from storage
  for (const windowId of terminalsToRemove) {
    const removed = await storage.removeTerminal(windowId);
    if (removed) {
      result.entriesRemoved++;
    }
  }

  // Delete orphaned log files
  // IMPORTANT: Only delete logs that have NO JSON entry AND NO active screen session
  // JSON is the source of truth - if an entry exists in JSON, preserve its logs for restoration
  try {
    const logFiles = await fs.readdir(logsDir).catch(() => []);

    // Get all windowIds from JSON (source of truth for restoration)
    const jsonTerminals = getAllTerminalsFromJson();
    const jsonWindowIds = new Set(jsonTerminals.map(t => t.windowId));

    for (const logFile of logFiles) {
      if (!logFile.endsWith('.log')) {
        continue;
      }

      // Extract session name from log file (format: project-windowId.log)
      const sessionName = logFile.replace('.log', '');

      // Extract windowId from session name (format: project-windowId)
      const windowId = sessionName.replace(`${projectName}-`, '');

      // Only delete if:
      // 1. No active screen session AND
      // 2. No JSON entry (not pending restoration)
      const hasActiveSession = activeSessionNames.has(sessionName);
      const hasJsonEntry = jsonWindowIds.has(windowId);

      if (!hasActiveSession && !hasJsonEntry) {
        const logPath = path.join(logsDir, logFile);
        try {
          await fs.unlink(logPath);
          logger.debug(`Deleted orphaned log: ${logFile} (no session, no JSON entry)`);
          result.logsDeleted++;
        } catch (err) {
          logger.warn(`Failed to delete log file ${logFile}:`, err);
        }
      } else if (!hasActiveSession && hasJsonEntry) {
        logger.debug(`Preserving log for restoration: ${logFile} (JSON entry exists)`);
      }
    }
  } catch (err) {
    logger.debug('Logs directory not accessible:', err);
  }

  // Update last cleanup timestamp
  await storage.updateLastCleanup();

  logger.info(
    `Cleanup complete: ${result.entriesRemoved} entries removed, ${result.logsDeleted} logs deleted`
  );

  return result;
}

export default cleanupStaleTerminals;
