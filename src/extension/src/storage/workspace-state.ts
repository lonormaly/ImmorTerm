import * as vscode from 'vscode';
import { logger } from '../utils/logger';

/**
 * Terminal state for a single terminal instance
 * Stored in VS Code workspaceState for persistence across sessions
 */
export interface TerminalState {
  /** Unique ID: "${pid}-${random8}" */
  windowId: string;
  /** Display name shown in terminal tab */
  name: string;
  /** Screen session name: "${project}-${windowId}" */
  screenSession: string;
  /** Unix timestamp when terminal was created */
  createdAt: number;
  /** Unix timestamp when terminal was last attached */
  lastAttached: number;
  /** Claude session ID if this terminal is running Claude Code */
  claudeSessionId?: string;
  /** Terminal position in the tab bar */
  position?: {
    tabIndex: number;
    splitDirection?: 'horizontal' | 'vertical';
    splitIndex?: number;
  };
  /** Per-terminal theme override (falls back to project default if not set) */
  theme?: string;
}

/**
 * Complete workspace terminal state
 * Stored as a single JSON object in VS Code workspaceState
 */
export interface WorkspaceTerminalState {
  /** Schema version for migration compatibility */
  version: 3;
  /** Lowercase project name for Screen session prefixes */
  projectName: string;
  /** All registered terminals */
  terminals: TerminalState[];
  /** Unix timestamp of last cleanup run */
  lastCleanup: number;
}

/** Storage key for workspace state */
const STORAGE_KEY = 'immorterm.terminalState';

/** Debounce delay in milliseconds for rapid state changes */
const DEBOUNCE_DELAY = 50;

/**
 * WorkspaceStorage class for terminal state persistence
 * Uses VS Code workspaceState API with debouncing for performance
 */
export class WorkspaceStorage {
  private context: vscode.ExtensionContext;
  private projectName: string;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingState: WorkspaceTerminalState | null = null;

  constructor(context: vscode.ExtensionContext, projectName: string) {
    this.context = context;
    this.projectName = projectName;
  }

  /**
   * Gets the current terminal state from workspace storage
   * Creates a default state if none exists
   */
  getState(): WorkspaceTerminalState {
    const stored = this.context.workspaceState.get<WorkspaceTerminalState>(STORAGE_KEY);

    if (stored && stored.version === 3) {
      return stored;
    }

    // Create default state if none exists or version mismatch
    const defaultState: WorkspaceTerminalState = {
      version: 3,
      projectName: this.projectName,
      terminals: [],
      lastCleanup: Date.now(),
    };

    logger.debug('Creating default workspace state:', defaultState);
    return defaultState;
  }

  /**
   * Sets the terminal state with debouncing
   * Rapid updates are coalesced to prevent excessive storage writes
   */
  async setState(state: WorkspaceTerminalState): Promise<void> {
    this.pendingState = state;

    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set up new debounce timer
    return new Promise((resolve, reject) => {
      this.debounceTimer = setTimeout(async () => {
        try {
          if (this.pendingState) {
            await this.context.workspaceState.update(STORAGE_KEY, this.pendingState);
            logger.debug('Workspace state saved:', this.pendingState.terminals.length, 'terminals');
            this.pendingState = null;
          }
          resolve();
        } catch (error) {
          logger.error('Failed to save workspace state:', error);
          reject(error);
        }
      }, DEBOUNCE_DELAY);
    });
  }

  /**
   * Adds a new terminal to the storage
   * @param terminal The terminal state to add
   */
  async addTerminal(terminal: TerminalState): Promise<void> {
    const state = this.getState();

    // Check for duplicate windowId
    const existingIndex = state.terminals.findIndex(t => t.windowId === terminal.windowId);
    if (existingIndex !== -1) {
      logger.warn('Terminal with windowId already exists, updating:', terminal.windowId);
      state.terminals[existingIndex] = terminal;
    } else {
      state.terminals.push(terminal);
      logger.info('Added terminal to storage:', terminal.windowId, terminal.name);
    }

    await this.setState(state);
  }

  /**
   * Removes a terminal from storage by windowId
   * @param windowId The unique window identifier
   * @returns true if terminal was found and removed
   */
  async removeTerminal(windowId: string): Promise<boolean> {
    const state = this.getState();
    const initialLength = state.terminals.length;

    state.terminals = state.terminals.filter(t => t.windowId !== windowId);

    if (state.terminals.length < initialLength) {
      logger.info('Removed terminal from storage:', windowId);
      await this.setState(state);
      return true;
    }

    logger.debug('Terminal not found for removal:', windowId);
    return false;
  }

  /**
   * Updates an existing terminal in storage
   * @param windowId The unique window identifier
   * @param updates Partial terminal state to merge
   * @returns true if terminal was found and updated
   */
  async updateTerminal(windowId: string, updates: Partial<TerminalState>): Promise<boolean> {
    const state = this.getState();
    const terminal = state.terminals.find(t => t.windowId === windowId);

    if (!terminal) {
      logger.debug('Terminal not found for update:', windowId);
      return false;
    }

    // Merge updates into existing terminal
    Object.assign(terminal, updates);
    terminal.lastAttached = Date.now();

    logger.debug('Updated terminal in storage:', windowId, updates);
    await this.setState(state);
    return true;
  }

  /**
   * Gets all registered terminals
   */
  getAllTerminals(): TerminalState[] {
    return this.getState().terminals;
  }

  /**
   * Gets a terminal by windowId
   * @param windowId The unique window identifier
   * @returns The terminal state or undefined if not found
   */
  getTerminal(windowId: string): TerminalState | undefined {
    return this.getState().terminals.find(t => t.windowId === windowId);
  }

  /**
   * Gets a terminal by screen session name
   * @param screenSession The screen session name
   * @returns The terminal state or undefined if not found
   */
  getTerminalBySession(screenSession: string): TerminalState | undefined {
    return this.getState().terminals.find(t => t.screenSession === screenSession);
  }

  /**
   * Gets a terminal by display name
   * @param name The display name
   * @returns The terminal state or undefined if not found
   */
  getTerminalByName(name: string): TerminalState | undefined {
    return this.getState().terminals.find(t => t.name === name);
  }

  /**
   * Updates the last cleanup timestamp
   */
  async updateLastCleanup(): Promise<void> {
    const state = this.getState();
    state.lastCleanup = Date.now();
    await this.setState(state);
  }

  /**
   * Clears all terminals from storage
   * Used for forget-all and reset operations
   */
  async clearAllTerminals(): Promise<void> {
    const state = this.getState();
    const count = state.terminals.length;
    state.terminals = [];
    await this.setState(state);
    logger.info('Cleared all terminals from storage:', count);
  }

  /**
   * Gets the count of registered terminals
   */
  getTerminalCount(): number {
    return this.getState().terminals.length;
  }

  /**
   * Gets the project name for this workspace
   */
  getProjectName(): string {
    return this.projectName;
  }

  /**
   * Flushes any pending state immediately (bypasses debounce)
   * Call this before extension deactivation
   */
  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.pendingState) {
      await this.context.workspaceState.update(STORAGE_KEY, this.pendingState);
      logger.debug('Flushed pending workspace state');
      this.pendingState = null;
    }
  }

  /**
   * Disposes of the storage, flushing any pending changes
   */
  async dispose(): Promise<void> {
    await this.flush();
  }
}

export default WorkspaceStorage;
