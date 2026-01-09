import * as vscode from 'vscode';
import { logger } from './utils/logger';
import { screenCommands } from './utils/screen-commands';
import { extractResources, getTerminalsDir, getLogsDir } from './utils/resource-extractor';
import { getProjectName } from './utils/process';
import { WorkspaceStorage } from './storage/workspace-state';
import { TerminalManager } from './terminal/manager';
import { setScreenAvailable } from './terminal/screen-integration';
import { StatusBar } from './ui/status-bar';
import { notifications } from './ui/notifications';

/**
 * Result of workspace initialization
 */
export interface InitializationResult {
  /** Whether Screen is available */
  screenAvailable: boolean;
  /** The terminal manager instance */
  terminalManager: TerminalManager;
  /** The workspace storage instance */
  storage: WorkspaceStorage;
  /** The status bar instance */
  statusBar: StatusBar;
  /** Path to the terminals directory (.vscode/terminals/) */
  terminalsDir: string;
  /** Path to the logs directory (.vscode/terminals/logs/) */
  logsDir: string;
}

/**
 * Detects if GNU Screen is installed and available in PATH
 * @returns true if screen is installed, false otherwise
 */
export async function detectScreen(): Promise<boolean> {
  const isInstalled = await screenCommands.isScreenInstalled();

  if (isInstalled) {
    const screenPath = await screenCommands.getScreenPath();
    logger.info('GNU Screen detected:', screenPath ?? 'unknown path');
  } else {
    logger.warn('GNU Screen not found in PATH');
  }

  return isInstalled;
}

/**
 * Initializes the workspace for ImmorTerm
 * - Extracts bundled resources (scripts, templates)
 * - Creates WorkspaceStorage
 * - Creates TerminalManager
 * - Creates StatusBar
 * - Shows warning if Screen is not installed
 *
 * @param context The extension context
 * @returns InitializationResult with all initialized components
 * @throws Error if no workspace folder is open
 */
export async function initializeWorkspace(
  context: vscode.ExtensionContext
): Promise<InitializationResult> {
  logger.info('Initializing ImmorTerm...');

  // Get workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    logger.warn('No workspace folder found - ImmorTerm requires a workspace');
    throw new Error('ImmorTerm requires a workspace folder to be open');
  }

  // Detect Screen availability
  const screenAvailable = await detectScreen();

  // Set the global Screen availability flag for graceful degradation
  setScreenAvailable(screenAvailable);

  // Show warning if Screen is not available (graceful degradation)
  if (!screenAvailable) {
    await notifications.showScreenMissing();
  }

  // Extract bundled resources to .vscode/terminals/
  const extractionResult = await extractResources(context, workspaceFolder);
  logger.info('Resources extracted:', {
    terminalsDir: extractionResult.terminalsDir,
    extracted: extractionResult.extracted,
    skipped: extractionResult.skipped,
  });

  // Get project name for storage and session naming
  const projectName = getProjectName(workspaceFolder);
  logger.info('Project name:', projectName);

  // Create workspace storage
  const storage = new WorkspaceStorage(context, projectName);
  logger.debug('WorkspaceStorage initialized with', storage.getTerminalCount(), 'terminals');

  // Create terminal manager
  const terminalManager = new TerminalManager(context, storage);

  // Create and initialize status bar
  const statusBar = new StatusBar();
  await statusBar.initialize(storage, screenAvailable);

  logger.info('ImmorTerm initialization complete', {
    screenAvailable,
    projectName,
    terminalCount: storage.getTerminalCount(),
  });

  return {
    screenAvailable,
    terminalManager,
    storage,
    statusBar,
    terminalsDir: extractionResult.terminalsDir,
    logsDir: extractionResult.logsDir,
  };
}

/**
 * Helper function to activate the extension
 * This is called from extension.ts activate()
 *
 * @param context The extension context
 * @returns InitializationResult or null if initialization fails
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<InitializationResult | null> {
  try {
    return await initializeWorkspace(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initialize ImmorTerm:', message);

    // Only show error if it's not the expected "no workspace" case
    if (!message.includes('requires a workspace')) {
      await notifications.showError(`Initialization failed: ${message}`);
    }

    return null;
  }
}

export default {
  detectScreen,
  initializeWorkspace,
  activate,
};
