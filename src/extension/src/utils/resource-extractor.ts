import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from './logger';
import { getTheme, generateHardstatus } from '../themes';

/**
 * Version file name - stores the extension version that last extracted resources
 * This enables force-updating resources when the extension updates
 */
const VERSION_FILE = '.immorterm-version';

/**
 * Resource names that should be extracted from the extension bundle
 */
const BUNDLED_SCRIPTS = [
  // Core screen management
  'screen-auto',
  'screen-mem',
  'screen-time',
  'screen-cleanup',
  'screen-forget',
  'screen-forget-all',
  'screen-reconcile',
  'kill-screens',
  'log-cleanup',
  // Claude session tracking (for resume after restart)
  'claude-session-capture',
  'claude-session-map',
  'claude-session-sync',
  'claude-session-tracker',
] as const;
const BUNDLED_TEMPLATES = ['screenrc.template'] as const;
const BUNDLED_SHELL_CONFIG = ['.zshrc', 'shell-init.zsh'] as const;

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
 * ├── screen-auto              (executable - main entry point)
 * ├── screen-mem               (executable - memory helper for status bar)
 * ├── screen-cleanup           (executable - removes stale entries)
 * ├── screen-forget            (executable - remove single session)
 * ├── screen-forget-all        (executable - kill all sessions)
 * ├── screen-reconcile         (executable - reconcile pending terminals)
 * ├── kill-screens             (executable - kill all project screens)
 * ├── claude-session-capture   (executable - capture Claude session IDs)
 * ├── claude-session-map       (executable - interactive session mapper)
 * ├── claude-session-sync      (executable - background session scanner)
 * ├── claude-session-tracker   (executable - real-time session tracking)
 * ├── screenrc                 (screen configuration)
 * ├── .zshrc                   (custom zshrc via ZDOTDIR, sources shell-init.zsh)
 * ├── shell-init.zsh           (shell initialization with title updates)
 * ├── logs/                    (directory for log files)
 * └── pending/                 (directory for pending terminal registrations)
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

  // Check if we need to force update (extension version changed)
  const currentVersion = context.extension.packageJSON.version as string;
  const versionFilePath = path.join(terminalsDir, VERSION_FILE);
  let forceUpdate = false;

  try {
    const storedVersion = await fs.readFile(versionFilePath, 'utf-8');
    if (storedVersion.trim() !== currentVersion) {
      logger.info(`Extension updated from ${storedVersion.trim()} to ${currentVersion}, forcing resource update`);
      forceUpdate = true;
    }
  } catch {
    // Version file doesn't exist - first install or old installation
    forceUpdate = true;
  }

  const extracted: string[] = [];
  const skipped: string[] = [];

  // Get path to bundled resources
  const resourcesPath = path.join(context.extensionPath, 'resources');

  // Extract scripts
  for (const scriptName of BUNDLED_SCRIPTS) {
    const sourcePath = path.join(resourcesPath, scriptName);
    const targetPath = path.join(terminalsDir, scriptName);

    const result = await extractFile(sourcePath, targetPath, true, forceUpdate);
    if (result === 'extracted') {
      extracted.push(scriptName);
    } else {
      skipped.push(scriptName);
    }
  }

  // Extract templates (screenrc.template -> screenrc) with theme applied
  for (const templateName of BUNDLED_TEMPLATES) {
    const sourcePath = path.join(resourcesPath, templateName);
    // Remove .template suffix for target
    const targetName = templateName.replace('.template', '');
    const targetPath = path.join(terminalsDir, targetName);

    // For screenrc, apply the selected theme
    if (templateName === 'screenrc.template') {
      const result = await extractScreenrcWithTheme(sourcePath, targetPath, forceUpdate);
      if (result === 'extracted') {
        extracted.push(targetName);
      } else {
        skipped.push(targetName);
      }
    } else {
      const result = await extractFile(sourcePath, targetPath, false, forceUpdate);
      if (result === 'extracted') {
        extracted.push(targetName);
      } else {
        skipped.push(targetName);
      }
    }
  }

  // Extract shell config files (.zshrc, shell-init.zsh)
  for (const configName of BUNDLED_SHELL_CONFIG) {
    const sourcePath = path.join(resourcesPath, configName);
    const targetPath = path.join(terminalsDir, configName);

    const result = await extractFile(sourcePath, targetPath, false, forceUpdate);
    if (result === 'extracted') {
      extracted.push(configName);
    } else {
      skipped.push(configName);
    }
  }

  // Write current version to version file
  await fs.writeFile(versionFilePath, currentVersion, 'utf-8');

  logger.info('Resource extraction complete:', {
    extracted: extracted.length,
    skipped: skipped.length,
    forceUpdate,
    version: currentVersion,
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
 * @param forceOverwrite If true, overwrite existing files (for extension updates)
 * @returns 'extracted' if file was copied, 'skipped' if already exists and not forcing
 */
async function extractFile(
  sourcePath: string,
  targetPath: string,
  makeExecutable: boolean,
  forceOverwrite: boolean = false
): Promise<'extracted' | 'skipped'> {
  // Check if target already exists (preserve user modifications unless forcing)
  if (!forceOverwrite) {
    try {
      await fs.access(targetPath);
      logger.debug('Skipping existing file:', targetPath);
      return 'skipped';
    } catch {
      // File doesn't exist, proceed with extraction
    }
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

    logger.debug('Extracted file:', targetPath, makeExecutable ? '(executable)' : '', forceOverwrite ? '(force updated)' : '');
    return 'extracted';
  } catch (error) {
    logger.error('Failed to extract file:', sourcePath, '->', targetPath, error);
    return 'skipped';
  }
}

/**
 * Extracts screenrc template with the selected theme applied
 *
 * @param sourcePath Path to the screenrc.template file
 * @param targetPath Path to write the themed screenrc
 * @param forceOverwrite If true, overwrite existing files (for extension updates)
 * @returns 'extracted' if file was written, 'skipped' if already exists and not forcing
 */
async function extractScreenrcWithTheme(
  sourcePath: string,
  targetPath: string,
  forceOverwrite: boolean = false
): Promise<'extracted' | 'skipped'> {
  // Check if target already exists
  let existingContent: string | null = null;
  try {
    existingContent = await fs.readFile(targetPath, 'utf-8');
    if (!forceOverwrite) {
      // File exists and we're not forcing - skip entirely
      logger.debug('Skipping existing screenrc:', targetPath);
      return 'skipped';
    }
    // File exists and forceOverwrite=true - we'll update just the hardstatus line
    logger.debug('Updating existing screenrc (preserving customizations):', targetPath);
  } catch {
    // File doesn't exist, proceed with extraction from template
  }

  // Check if source exists (needed when creating new screenrc)
  try {
    await fs.access(sourcePath);
  } catch {
    logger.warn('Bundled screenrc template not found:', sourcePath);
    return 'skipped';
  }

  try {
    // Use existing content if available, otherwise read template
    let baseContent: string;
    if (existingContent) {
      baseContent = existingContent;
    } else {
      baseContent = await fs.readFile(sourcePath, 'utf-8');
    }

    // Get the selected theme from VS Code configuration
    const config = vscode.workspace.getConfiguration('immorterm');
    const themeName = config.get<string>('statusBarTheme', 'Purple Haze');
    const theme = getTheme(themeName);

    logger.debug('Applying theme to screenrc:', themeName);

    // Generate the themed hardstatus line
    const themedHardstatus = `hardstatus alwayslastline ${generateHardstatus(theme)}`;

    // Replace ONLY the hardstatus line, preserving everything else
    const themedContent = baseContent.replace(
      /^hardstatus alwayslastline .+$/m,
      themedHardstatus
    );

    // Write the themed screenrc
    await fs.writeFile(targetPath, themedContent, 'utf-8');

    logger.debug('Extracted themed screenrc:', targetPath, 'with theme:', themeName);
    return 'extracted';
  } catch (error) {
    logger.error('Failed to extract themed screenrc:', sourcePath, '->', targetPath, error);
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
