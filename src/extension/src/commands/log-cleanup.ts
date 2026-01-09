import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

/**
 * Information about a log file
 */
interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  mtime: Date;
}

/**
 * Result of a log cleanup operation
 */
export interface LogCleanupResult {
  /** Total bytes freed by cleanup */
  bytesFreed: number;
  /** Number of files removed */
  filesRemoved: number;
  /** Current size of logs directory after cleanup (bytes) */
  currentSize: number;
  /** Maximum allowed size (bytes) */
  maxSize: number;
  /** Names of files that were removed */
  removedFiles: string[];
}

/**
 * Gets information about all log files in a directory
 *
 * @param logsDir Path to the logs directory
 * @returns Array of log file info sorted by modification time (oldest first)
 */
async function getLogFiles(logsDir: string): Promise<LogFileInfo[]> {
  const files: LogFileInfo[] = [];

  try {
    const entries = await fs.readdir(logsDir);

    for (const entry of entries) {
      if (!entry.endsWith('.log')) {
        continue;
      }

      const filePath = path.join(logsDir, entry);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          files.push({
            name: entry,
            path: filePath,
            size: stat.size,
            mtime: stat.mtime,
          });
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Directory doesn't exist or isn't readable
    return [];
  }

  // Sort by modification time (oldest first for FIFO removal)
  files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

  return files;
}

/**
 * Calculates total size of log files
 *
 * @param files Array of log file info
 * @returns Total size in bytes
 */
function getTotalSize(files: LogFileInfo[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

/**
 * Manages log file sizes by removing oldest logs when limit is exceeded
 *
 * This is the TypeScript equivalent of the bash log-cleanup script.
 * Uses FIFO (first-in, first-out) removal strategy.
 *
 * Key differences from bash version:
 * - Uses fs/promises for async file operations
 * - Respects immorterm.maxLogSizeMb setting
 * - Returns detailed cleanup summary
 *
 * @param logsDir Path to the logs directory
 * @param options Cleanup configuration
 * @returns LogCleanupResult with cleanup statistics
 */
export async function cleanupLogs(
  logsDir: string,
  options: {
    /** Maximum size in MB (overrides setting) */
    maxSizeMb?: number;
    /** Number of lines to retain when truncating (future use) */
    retainLines?: number;
  } = {}
): Promise<LogCleanupResult> {
  // Get settings with defaults
  const config = vscode.workspace.getConfiguration('immorterm');
  const maxSizeMb = options.maxSizeMb ?? config.get<number>('maxLogSizeMb', 300);
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  const result: LogCleanupResult = {
    bytesFreed: 0,
    filesRemoved: 0,
    currentSize: 0,
    maxSize: maxSizeBytes,
    removedFiles: [],
  };

  logger.debug(`Log cleanup: max size ${maxSizeMb}MB (${maxSizeBytes} bytes)`);

  // Get all log files
  let files = await getLogFiles(logsDir);
  if (files.length === 0) {
    logger.debug('No log files found');
    return result;
  }

  result.currentSize = getTotalSize(files);
  logger.debug(`Current log size: ${result.currentSize} bytes`);

  // Remove oldest files until under limit
  while (result.currentSize > maxSizeBytes && files.length > 0) {
    const oldest = files[0];

    try {
      await fs.unlink(oldest.path);
      result.bytesFreed += oldest.size;
      result.filesRemoved++;
      result.removedFiles.push(oldest.name);

      logger.info(`Removed old log: ${oldest.name} (${oldest.size} bytes)`);

      // Remove from our tracking array
      files = files.slice(1);
      result.currentSize = getTotalSize(files);
    } catch (err) {
      logger.warn(`Failed to remove log file ${oldest.name}:`, err);
      // Skip this file and continue
      files = files.slice(1);
    }
  }

  logger.info(
    `Log cleanup complete: ${result.filesRemoved} files removed, ${result.bytesFreed} bytes freed. ` +
      `Current size: ${Math.round(result.currentSize / 1024 / 1024)}MB / ${maxSizeMb}MB`
  );

  return result;
}

export default cleanupLogs;
