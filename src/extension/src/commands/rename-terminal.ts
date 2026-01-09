/**
 * Rename Terminal Command
 *
 * Renames the current terminal via VS Code input box.
 * Updates: screen title, VS Code tab, storage, and JSON.
 *
 * Keybinding: Ctrl+Shift+R (when terminal focused)
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { WorkspaceStorage } from '../storage/workspace-state';
import { updateJsonNameAndCommand } from '../json-utils';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface RenameTerminalResult {
  success: boolean;
  windowId?: string;
  oldName?: string;
  newName?: string;
  error?: string;
}

/**
 * Rename terminal via VS Code input box
 *
 * @param terminal The VS Code terminal to rename
 * @param windowId The terminal's window ID
 * @param storage The workspace storage instance
 * @param projectName The project name prefix for screen sessions
 * @returns Result of the rename operation
 */
export async function renameTerminal(
  terminal: vscode.Terminal,
  windowId: string,
  storage: WorkspaceStorage,
  projectName: string
): Promise<RenameTerminalResult> {
  const sessionName = `${projectName}-${windowId}`;
  const oldName = terminal.name;

  // Show input box with current name
  const newName = await vscode.window.showInputBox({
    prompt: 'Enter new terminal name',
    value: oldName,
    placeHolder: 'Terminal name',
    validateInput: (value) => {
      if (!value || value.trim() === '') {
        return 'Name cannot be empty';
      }
      return null;
    },
  });

  // User cancelled
  if (newName === undefined) {
    return {
      success: false,
      windowId,
      error: 'Cancelled',
    };
  }

  const trimmedName = newName.trim();

  // No change
  if (trimmedName === oldName) {
    return {
      success: true,
      windowId,
      oldName,
      newName: trimmedName,
    };
  }

  try {
    // 1. Update screen title with timestamp
    const timestamp = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).replace(',', '-').replace(' ', '');
    const fullTitle = `${timestamp} ${trimmedName}`;
    await execAsync(`screen -S "${sessionName}" -X title "${fullTitle}"`);
    logger.debug(`Set screen title to "${fullTitle}"`);

    // 2. Write pending rename file for the shell to pick up
    // Use session name as filename - shell can derive this from $STY
    // The shell's precmd hook will read this and update SCREEN_WINDOW_NAME
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceFolder) {
      const pendingDir = `${workspaceFolder}/.vscode/terminals/pending-renames`;
      await execAsync(`mkdir -p "${pendingDir}"`);
      const pendingFile = `${pendingDir}/${sessionName}`;
      await execAsync(`echo "${trimmedName}" > "${pendingFile}"`);
      logger.debug(`Wrote pending rename file: ${pendingFile}`);
    }

    // NOTE: We don't use "screen -X stuff" for OSC sequences - that injects into INPUT, not output
    // The shell's precmd hook will pick up the pending file and update the title

    // 3. Update storage
    await storage.updateTerminal(windowId, { name: trimmedName });

    // 4. Update JSON
    updateJsonNameAndCommand(windowId, trimmedName);

    logger.info(`Renamed terminal: "${oldName}" -> "${trimmedName}"`);

    return {
      success: true,
      windowId,
      oldName,
      newName: trimmedName,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to rename terminal ${windowId}:`, error);
    return {
      success: false,
      windowId,
      oldName,
      error: errorMessage,
    };
  }
}

export default renameTerminal;
