import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from './logger';

/**
 * Resource names that should be extracted from the extension bundle
 */
const BUNDLED_SCRIPTS = ['screen-auto', 'screen-mem'] as const;
const BUNDLED_TEMPLATES = ['screenrc.template'] as const;

/**
 * Result of resource extraction
 */
export interface ExtractionResult {
  /** Path to the .vscode/terminals directory */
  terminalsDir: string;
  /** Path to the logs directory */
  logsDir: string;
  /** Path to the pending directory */
  pendingDir: string;
  /** Files that were extracted (not skipped) */
  extracted: string[];
  /** Files that were skipped (already existed) */
  skipped: string[];
}

/**
 * Extracts bundled resources from the extension to the workspace
 *
 * Creates the following structure:
 * .vscode/terminals/
 * ├── screen-auto        (executable)
 * ├── screen-mem         (executable)
 * ├── screenrc           (config)
 * ├── logs/              (directory for log files)
 * └── pending/           (directory for pending terminal registrations)
 *
 * @param context The extension context (provides path to bundled resources)
 * @param workspaceFolder The workspace folder to extract resources to
 * @returns ExtractionResult with paths and extraction status
 */
export async function extractResources(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder
): Promise<ExtractionResult> {
  const workspacePath = workspaceFolder.uri.fsPath;

  // Define target directories
  const terminalsDir = path.join(workspacePath, '.vscode', 'terminals');
  const logsDir = path.join(terminalsDir, 'logs');
  const pendingDir = path.join(terminalsDir, 'pending');

  // Create directories
  await fs.mkdir(terminalsDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await fs.mkdir(pendingDir, { recursive: true });

  logger.debug('Created directories:', terminalsDir, logsDir, pendingDir);

  const extracted: string[] = [];
  const skipped: string[] = [];

  // Get path to bundled resources
  const resourcesPath = path.join(context.extensionPath, 'resources');

  // Extract scripts
  for (const scriptName of BUNDLED_SCRIPTS) {
    const sourcePath = path.join(resourcesPath, scriptName);
    const targetPath = path.join(terminalsDir, scriptName);

    const result = await extractFile(sourcePath, targetPath, true);
    if (result === 'extracted') {
      extracted.push(scriptName);
    } else {
      skipped.push(scriptName);
    }
  }

  // Extract templates (screenrc.template -> screenrc)
  for (const templateName of BUNDLED_TEMPLATES) {
    const sourcePath = path.join(resourcesPath, templateName);
    // Remove .template suffix for target
    const targetName = templateName.replace('.template', '');
    const targetPath = path.join(terminalsDir, targetName);

    const result = await extractFile(sourcePath, targetPath, false);
    if (result === 'extracted') {
      extracted.push(targetName);
    } else {
      skipped.push(targetName);
    }
  }

  logger.info('Resource extraction complete:', {
    extracted: extracted.length,
    skipped: skipped.length,
  });

  return {
    terminalsDir,
    logsDir,
    pendingDir,
    extracted,
    skipped,
  };
}

/**
 * Extracts a single file from bundle to target location
 *
 * @param sourcePath Path to the bundled file
 * @param targetPath Path to extract to
 * @param makeExecutable Whether to make the file executable (chmod 755)
 * @returns 'extracted' if file was copied, 'skipped' if already exists
 */
async function extractFile(
  sourcePath: string,
  targetPath: string,
  makeExecutable: boolean
): Promise<'extracted' | 'skipped'> {
  // Check if target already exists (preserve user modifications)
  try {
    await fs.access(targetPath);
    logger.debug('Skipping existing file:', targetPath);
    return 'skipped';
  } catch {
    // File doesn't exist, proceed with extraction
  }

  // Check if source exists
  try {
    await fs.access(sourcePath);
  } catch {
    logger.warn('Bundled resource not found:', sourcePath);
    return 'skipped';
  }

  // Copy file
  try {
    await fs.copyFile(sourcePath, targetPath);

    // Make executable if requested (Unix-like systems only)
    if (makeExecutable && process.platform !== 'win32') {
      await fs.chmod(targetPath, 0o755);
    }

    logger.debug('Extracted file:', targetPath, makeExecutable ? '(executable)' : '');
    return 'extracted';
  } catch (error) {
    logger.error('Failed to extract file:', sourcePath, '->', targetPath, error);
    return 'skipped';
  }
}

/**
 * Gets the path to the terminals directory for a workspace
 *
 * @param workspaceFolder The workspace folder
 * @returns Path to .vscode/terminals/
 */
export function getTerminalsDir(workspaceFolder: vscode.WorkspaceFolder): string {
  return path.join(workspaceFolder.uri.fsPath, '.vscode', 'terminals');
}

/**
 * Gets the path to the logs directory for a workspace
 *
 * @param workspaceFolder The workspace folder
 * @returns Path to .vscode/terminals/logs/
 */
export function getLogsDir(workspaceFolder: vscode.WorkspaceFolder): string {
  return path.join(workspaceFolder.uri.fsPath, '.vscode', 'terminals', 'logs');
}

/**
 * Gets the path to the pending directory for a workspace
 *
 * @param workspaceFolder The workspace folder
 * @returns Path to .vscode/terminals/pending/
 */
export function getPendingDir(workspaceFolder: vscode.WorkspaceFolder): string {
  return path.join(workspaceFolder.uri.fsPath, '.vscode', 'terminals', 'pending');
}

/**
 * Gets the path to a specific script
 *
 * @param workspaceFolder The workspace folder
 * @param scriptName The script name (e.g., 'screen-auto')
 * @returns Full path to the script
 */
export function getScriptPath(
  workspaceFolder: vscode.WorkspaceFolder,
  scriptName: string
): string {
  return path.join(getTerminalsDir(workspaceFolder), scriptName);
}

/**
 * Checks if resources have been extracted to a workspace
 *
 * @param workspaceFolder The workspace folder to check
 * @returns true if screen-auto exists (indicates extraction was done)
 */
export async function areResourcesExtracted(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<boolean> {
  const screenAutoPath = getScriptPath(workspaceFolder, 'screen-auto');
  try {
    await fs.access(screenAutoPath);
    return true;
  } catch {
    return false;
  }
}

export default {
  extractResources,
  getTerminalsDir,
  getLogsDir,
  getPendingDir,
  getScriptPath,
  areResourcesExtracted,
};
