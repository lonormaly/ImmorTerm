import * as vscode from 'vscode';
import { logger } from '../utils/logger';

/**
 * Notifications utility for ImmorTerm user feedback
 * Provides consistent notification patterns across the extension
 */
export const notifications = {
  /**
   * Shows a warning when screen-immorterm is not installed
   * Includes instructions for installation via Homebrew
   */
  async showScreenMissing(): Promise<void> {
    const config = vscode.workspace.getConfiguration('immorterm');
    const screenBinary = config.get<string>('screenBinary', 'screen-immorterm');
    const isMac = process.platform === 'darwin';

    // Determine if using default (screen-immorterm) or fallback (screen)
    const isUsingDefault = screenBinary === 'screen-immorterm';

    if (isUsingDefault && isMac) {
      // Prompt to install screen-immorterm via Homebrew
      const action = await vscode.window.showWarningMessage(
        'ImmorTerm: screen-immorterm is not installed. This patched version of GNU Screen is required for full functionality.',
        'Install via Homebrew',
        'Use Standard Screen',
        'Dismiss'
      );

      if (action === 'Install via Homebrew') {
        const installCmd = 'brew install lonormaly/tap/screen-immorterm';

        // Copy to clipboard and show terminal
        await vscode.env.clipboard.writeText(installCmd);
        vscode.window.showInformationMessage(
          `Installation command copied to clipboard:\n\n${installCmd}\n\nPaste in a terminal to install, then reload VS Code.`,
          'Open Terminal'
        ).then(result => {
          if (result === 'Open Terminal') {
            vscode.commands.executeCommand('workbench.action.terminal.new');
          }
        });
      } else if (action === 'Use Standard Screen') {
        // Update settings to use standard screen
        await config.update('screenBinary', 'screen', vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
          'ImmorTerm: Switched to standard GNU Screen. Some features (like UTF-8 titles) may not work correctly. Reload VS Code to apply.',
          'Reload'
        ).then(result => {
          if (result === 'Reload') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });
      }
    } else {
      // Standard screen not found - show generic install message
      const action = await vscode.window.showWarningMessage(
        `ImmorTerm: ${screenBinary} is not installed. Terminal persistence is disabled.`,
        'Install Instructions',
        'Dismiss'
      );

      if (action === 'Install Instructions') {
        let installCmd: string;
        if (isMac) {
          installCmd = 'brew install lonormaly/tap/screen-immorterm';
        } else if (process.platform === 'linux') {
          installCmd = 'sudo apt-get install screen  # or: sudo yum install screen';
        } else {
          installCmd = 'Please install GNU Screen for your platform';
        }

        const message = `Install GNU Screen:\n\n${installCmd}\n\nAfter installation, reload VS Code.`;

        vscode.window.showInformationMessage(message, 'Copy Command').then(result => {
          if (result === 'Copy Command') {
            vscode.env.clipboard.writeText(installCmd);
          }
        });
      }
    }

    logger.info('Showed Screen missing notification for:', screenBinary);
  },

  /**
   * Shows notification when a terminal is forgotten
   * @param name The terminal name that was forgotten
   */
  showTerminalForget(name: string): void {
    vscode.window.showInformationMessage(
      `ImmorTerm: Forgot terminal "${name}". Session terminated.`
    );
    logger.info('Showed terminal forget notification:', name);
  },

  /**
   * Shows notification when all terminals are forgotten
   * @param count The number of terminals forgotten
   */
  showAllTerminalsForgotten(count: number): void {
    vscode.window.showInformationMessage(
      `ImmorTerm: Forgot ${count} terminal${count !== 1 ? 's' : ''}. All sessions terminated.`
    );
    logger.info('Showed all terminals forgotten notification:', count);
  },

  /**
   * Shows notification when cleanup completes
   * @param count The number of stale sessions cleaned up
   */
  showCleanupComplete(count: number): void {
    if (count === 0) {
      vscode.window.showInformationMessage(
        'ImmorTerm: No stale sessions found. Everything is clean!'
      );
    } else {
      vscode.window.showInformationMessage(
        `ImmorTerm: Cleaned up ${count} stale session${count !== 1 ? 's' : ''}.`
      );
    }
    logger.info('Showed cleanup complete notification:', count);
  },

  /**
   * Shows notification when Screen sessions are killed
   * @param count The number of sessions killed
   */
  showSessionsKilled(count: number): void {
    vscode.window.showInformationMessage(
      `ImmorTerm: Killed ${count} session${count !== 1 ? 's' : ''}.`
    );
    logger.info('Showed sessions killed notification:', count);
  },

  /**
   * Shows notification when terminals are restored
   * @param count The number of terminals restored
   */
  showTerminalsRestored(count: number): void {
    if (count > 0) {
      vscode.window.showInformationMessage(
        `ImmorTerm: Restored ${count} terminal${count !== 1 ? 's' : ''}.`
      );
      logger.info('Showed terminals restored notification:', count);
    }
  },

  /**
   * Shows notification when sync completes
   */
  showSyncComplete(): void {
    vscode.window.showInformationMessage('ImmorTerm: Terminal names synced.');
    logger.info('Showed sync complete notification');
  },

  /**
   * Shows an error message with optional View Logs action
   * @param message The error message to display
   * @param showLogs Whether to show the View Logs action (default: true)
   */
  async showError(message: string, showLogs: boolean = true): Promise<void> {
    const actions = showLogs ? ['View Logs', 'Dismiss'] : ['Dismiss'];

    const result = await vscode.window.showErrorMessage(
      `ImmorTerm: ${message}`,
      ...actions
    );

    if (result === 'View Logs') {
      logger.show();
    }

    logger.error('Showed error notification:', message);
  },

  /**
   * Shows a confirmation prompt
   * @param message The confirmation message
   * @param confirmText The confirm button text (default: "Yes")
   * @returns true if user confirmed
   */
  async showConfirmation(message: string, confirmText: string = 'Yes'): Promise<boolean> {
    const result = await vscode.window.showWarningMessage(
      `ImmorTerm: ${message}`,
      { modal: true },
      confirmText,
      'Cancel'
    );

    return result === confirmText;
  },

  /**
   * Shows a progress notification for long-running operations
   * @param title The progress title
   * @param task The async task to run
   * @returns The result of the task
   */
  async withProgress<T>(
    title: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken
    ) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `ImmorTerm: ${title}`,
        cancellable: false,
      },
      task
    );
  },
};

export default notifications;
