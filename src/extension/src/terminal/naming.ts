import * as vscode from 'vscode';
import { WorkspaceStorage } from '../storage/workspace-state';
import { screenCommands } from '../utils/screen-commands';
import { buildSessionName } from '../utils/process';
import { logger } from '../utils/logger';

/**
 * Gets the configured screen binary path from settings
 */
function getScreenBinary(): string {
  const config = vscode.workspace.getConfiguration('immorterm');
  return config.get<string>('screenBinary', 'screen-immorterm');
}

/**
 * Terminal Naming Module
 *
 * Handles terminal name generation, synchronization, and management.
 * VS Code terminal tab name is the SINGLE SOURCE OF TRUTH.
 *
 * Flow:
 * 1. User renames terminal tab in VS Code (right-click -> Rename)
 * 2. Extension detects name change via onDidChangeActiveTerminal or polling
 * 3. Extension syncs to both:
 *    - WorkspaceStorage (for persistence across restarts)
 *    - Screen title (for display in screen sessions)
 */

/**
 * Maps to track terminal names (for change detection)
 * Weak reference to avoid memory leaks when terminals are closed
 */
const terminalLastNames = new WeakMap<vscode.Terminal, string>();

/**
 * Generates a date prefix for screen titles
 * Format: DD/MM-HH:MM
 *
 * @returns Formatted date string
 */
function getDatePrefix(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}-${hh}:${min}`;
}

/**
 * Checks if a name appears to be a raw windowId format
 * Raw format: "12345-abcdef12" (PID-randomhex)
 *
 * @param name The name to check
 * @returns true if name matches windowId pattern
 */
export function isRawWindowIdFormat(name: string): boolean {
  return /^\d+-[a-f0-9]{8}$/.test(name);
}

/**
 * Gets the naming pattern from settings
 * Default: "${project}-${n}"
 *
 * @returns The naming pattern string
 */
function getNamingPattern(): string {
  const config = vscode.workspace.getConfiguration('immorterm');
  return config.get<string>('namingPattern', '${project}-${n}');
}

/**
 * Generates the next sequential terminal name for a project
 *
 * Scans existing terminal names to find the highest number,
 * then returns project-N+1
 *
 * @param projectName The project name (lowercase)
 * @param storage The workspace storage to check existing names
 * @returns Next available name (e.g., "myproject-3")
 */
export function generateNextName(
  projectName: string,
  storage: WorkspaceStorage
): string {
  const terminals = storage.getAllTerminals();
  let maxN = 0;

  // Pattern matches "projectname-N" format
  const pattern = new RegExp(`^${projectName}-(\\d+)$`, 'i');

  for (const terminal of terminals) {
    const match = terminal.name.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxN) {
        maxN = n;
      }
    }
  }

  // Also check currently open terminals (they might not be in storage yet)
  for (const terminal of vscode.window.terminals) {
    const match = terminal.name.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxN) {
        maxN = n;
      }
    }
  }

  const nextN = maxN + 1;

  // Apply naming pattern
  const namingPattern = getNamingPattern();
  return namingPattern
    .replace('${project}', projectName)
    .replace('${n}', String(nextN));
}

/**
 * Syncs a terminal's name to both storage and Screen title
 *
 * @param terminal The VS Code Terminal instance
 * @param windowId The terminal's window ID
 * @param storage The workspace storage
 * @param projectName The project name
 * @returns true if sync was successful
 */
export async function syncTerminalName(
  terminal: vscode.Terminal,
  windowId: string,
  storage: WorkspaceStorage,
  projectName: string
): Promise<boolean> {
  const name = terminal.name;

  logger.debug(`Syncing terminal name: "${name}" (window ${windowId})`);

  // Update storage
  const updated = await storage.updateTerminal(windowId, { name });

  if (!updated) {
    logger.debug(`Terminal not found in storage: ${windowId}`);
    return false;
  }

  // Update Screen title (with date prefix)
  const sessionName = buildSessionName(projectName, windowId);
  const screenTitle = `${getDatePrefix()} ${name}`;

  try {
    await screenCommands.sendCommand(sessionName, '');
    // Use screen -X title to set the window title
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const screenBinary = getScreenBinary();

    await execAsync(`${screenBinary} -S "${sessionName}" -X title "${screenTitle}"`);
    logger.debug(`Set screen title to "${screenTitle}"`);
  } catch (error) {
    logger.debug(`Could not set screen title for ${sessionName}:`, error);
    // Not a critical error - terminal still works without screen title
  }

  // Update last known name
  terminalLastNames.set(terminal, name);

  return true;
}

/**
 * Checks if a terminal's name has changed and syncs if needed
 *
 * @param terminal The VS Code Terminal to check
 * @param windowId The terminal's window ID
 * @param storage The workspace storage
 * @param projectName The project name
 * @returns true if name changed and was synced
 */
export async function checkAndSyncNameChange(
  terminal: vscode.Terminal,
  windowId: string,
  storage: WorkspaceStorage,
  projectName: string
): Promise<boolean> {
  const lastName = terminalLastNames.get(terminal);

  // If we haven't tracked this terminal yet, start tracking
  if (lastName === undefined) {
    terminalLastNames.set(terminal, terminal.name);
    return false;
  }

  // Check if name changed
  if (lastName !== terminal.name) {
    logger.info(`Terminal name changed: "${lastName}" -> "${terminal.name}"`);
    terminalLastNames.set(terminal, terminal.name);
    await syncTerminalName(terminal, windowId, storage, projectName);
    return true;
  }

  return false;
}

/**
 * Initializes name tracking for a terminal
 *
 * @param terminal The VS Code Terminal
 */
export function trackTerminalName(terminal: vscode.Terminal): void {
  terminalLastNames.set(terminal, terminal.name);
}

/**
 * Gets the last known name for a terminal
 *
 * @param terminal The VS Code Terminal
 * @returns The last known name, or undefined if not tracked
 */
export function getLastKnownName(terminal: vscode.Terminal): string | undefined {
  return terminalLastNames.get(terminal);
}

/**
 * Auto-renames a terminal from raw windowId format to a friendly name
 * Only renames if the current name looks like a raw windowId
 *
 * @param terminal The VS Code Terminal
 * @param windowId The terminal's window ID
 * @param storage The workspace storage
 * @param projectName The project name
 * @returns The new name if renamed, or null if not renamed
 */
export async function autoRenameIfNeeded(
  terminal: vscode.Terminal,
  windowId: string,
  storage: WorkspaceStorage,
  projectName: string
): Promise<string | null> {
  // Only auto-rename if the name is in raw windowId format
  if (!isRawWindowIdFormat(terminal.name)) {
    logger.debug(`Keeping user name "${terminal.name}" (not raw windowId format)`);
    return null;
  }

  const newName = generateNextName(projectName, storage);
  logger.info(`Auto-rename: "${terminal.name}" -> "${newName}"`);

  // Update storage with new name
  await storage.updateTerminal(windowId, { name: newName });

  // Update Screen title
  const sessionName = buildSessionName(projectName, windowId);
  const screenTitle = `${getDatePrefix()} ${newName}`;

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const screenBinary = getScreenBinary();

    await execAsync(`${screenBinary} -S "${sessionName}" -X title "${screenTitle}"`);
  } catch {
    // Session might not exist yet
  }

  // Update tracking
  terminalLastNames.set(terminal, terminal.name);

  return newName;
}

export default {
  generateNextName,
  syncTerminalName,
  checkAndSyncNameChange,
  trackTerminalName,
  getLastKnownName,
  autoRenameIfNeeded,
  isRawWindowIdFormat,
};
