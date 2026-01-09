import * as vscode from 'vscode';
import { WorkspaceStorage } from '../storage/workspace-state';
import { screenCommands } from '../utils/screen-commands';
import { logger } from '../utils/logger';
import { isStatusBarEnabled } from '../utils/settings';

/**
 * Status bar item for ImmorTerm
 * Shows terminal count and Screen availability status
 */
export class StatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private storage: WorkspaceStorage | null = null;
  private screenAvailable: boolean = false;
  private disposed: boolean = false;

  constructor() {
    // Create status bar item aligned left with priority 100
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    // Set command to show status when clicked
    this.statusBarItem.command = 'immorterm.showStatus';

    // Set initial tooltip
    this.statusBarItem.tooltip = 'ImmorTerm: Click for status';

    logger.debug('StatusBar created');
  }

  /**
   * Initializes the status bar with storage and Screen availability
   * @param storage The workspace storage instance
   * @param screenAvailable Whether GNU Screen is available
   */
  async initialize(storage: WorkspaceStorage, screenAvailable: boolean): Promise<void> {
    this.storage = storage;
    this.screenAvailable = screenAvailable;

    await this.update();
    this.show();

    logger.debug('StatusBar initialized, Screen available:', screenAvailable);
  }

  /**
   * Updates the status bar text and icon
   */
  async update(): Promise<void> {
    if (this.disposed) {
      return;
    }

    // Check if status bar is enabled via settings utility
    if (!isStatusBarEnabled()) {
      this.hide();
      return;
    }

    // Build status text
    let icon: string;
    let text: string;
    let tooltip: string;

    if (!this.screenAvailable) {
      // Screen is missing - show warning
      icon = '$(warning)';
      text = 'ImmorTerm: Screen missing';
      tooltip = 'GNU Screen is not installed. Terminals will not persist.\nClick for more information.';
    } else if (this.storage) {
      // Screen available - show terminal count
      const terminalCount = this.storage.getTerminalCount();
      const projectName = this.storage.getProjectName();

      icon = '$(terminal)';
      text = `ImmorTerm: ${terminalCount}`;
      tooltip = `ImmorTerm - ${projectName}\n${terminalCount} terminal${terminalCount !== 1 ? 's' : ''} registered\nClick to show status`;

      // Get active Screen session count for tooltip
      try {
        const sessions = await screenCommands.listProjectSessions(projectName);
        tooltip += `\n${sessions.length} Screen session${sessions.length !== 1 ? 's' : ''} active`;
      } catch {
        // Ignore errors in tooltip generation
      }
    } else {
      // Not initialized yet
      icon = '$(terminal)';
      text = 'ImmorTerm';
      tooltip = 'ImmorTerm: Initializing...';
    }

    this.statusBarItem.text = `${icon} ${text}`;
    this.statusBarItem.tooltip = tooltip;

    // Set color based on status
    if (!this.screenAvailable) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }

    logger.debug('StatusBar updated:', text);
  }

  /**
   * Shows the status bar item
   */
  show(): void {
    if (this.disposed) {
      return;
    }

    // Only show if enabled via settings utility
    if (isStatusBarEnabled()) {
      this.statusBarItem.show();
    }
  }

  /**
   * Hides the status bar item
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Sets the Screen availability status
   * @param available Whether Screen is available
   */
  async setScreenAvailable(available: boolean): Promise<void> {
    this.screenAvailable = available;
    await this.update();
  }

  /**
   * Sets the storage instance
   * @param storage The workspace storage
   */
  setStorage(storage: WorkspaceStorage): void {
    this.storage = storage;
  }

  /**
   * Gets whether Screen is available
   */
  isScreenAvailable(): boolean {
    return this.screenAvailable;
  }

  /**
   * Gets the status bar item (for testing)
   */
  getStatusBarItem(): vscode.StatusBarItem {
    return this.statusBarItem;
  }

  /**
   * Disposes of the status bar item
   */
  dispose(): void {
    this.disposed = true;
    this.statusBarItem.dispose();
    logger.debug('StatusBar disposed');
  }
}

export default StatusBar;
