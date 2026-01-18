import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { logger } from './logger';

const execAsync = promisify(exec);

/**
 * Gets the configured screen binary path from settings
 * @returns The screen binary path (default: 'screen-immorterm')
 */
function getScreenBinary(): string {
  const config = vscode.workspace.getConfiguration('immorterm');
  return config.get<string>('screenBinary', 'screen-immorterm');
}

/**
 * Screen session information parsed from `screen -ls` output
 */
export interface ScreenSession {
  /** Process ID of the screen session */
  pid: number;
  /** Session name (e.g., "project-windowId") */
  name: string;
  /** Whether the session is currently attached */
  attached: boolean;
  /** Full session identifier (pid.name) */
  fullName: string;
}

/**
 * Parses the output of `screen -ls` command
 *
 * Example output:
 * There are screens on:
 *     12345.project-abc123	(Detached)
 *     12346.project-def456	(Attached)
 * 2 Sockets in /var/folders/.../T/.screen.
 */
function parseScreenLsOutput(output: string): Map<string, ScreenSession> {
  const sessions = new Map<string, ScreenSession>();
  const lines = output.split('\n');

  for (const line of lines) {
    // Match lines like: "	12345.session-name	(Detached)" or "(Attached)"
    const match = line.match(/^\s*(\d+)\.([^\s]+)\s+\((Attached|Detached)\)/);
    if (match) {
      const [, pidStr, name, status] = match;
      const pid = parseInt(pidStr, 10);
      const attached = status === 'Attached';
      const fullName = `${pid}.${name}`;

      sessions.set(name, {
        pid,
        name,
        attached,
        fullName,
      });
    }
  }

  return sessions;
}

/**
 * Screen CLI wrapper for ImmorTerm extension
 * Provides methods for interacting with GNU Screen sessions
 */
export const screenCommands = {
  /**
   * Lists all active Screen sessions
   * @returns Map of session name to session info
   */
  async listSessions(): Promise<Map<string, ScreenSession>> {
    try {
      const screen = getScreenBinary();
      const { stdout } = await execAsync(`${screen} -ls`);
      return parseScreenLsOutput(stdout);
    } catch (error: unknown) {
      // screen -ls returns exit code 1 when there are no sessions
      // but still outputs "No Sockets found"
      if (error && typeof error === 'object' && 'stdout' in error) {
        const stdout = (error as { stdout: string }).stdout;
        if (stdout.includes('No Sockets found') || stdout.includes('No screens found')) {
          return new Map();
        }
        // There might be sessions even with error exit code
        return parseScreenLsOutput(stdout);
      }
      logger.warn('Failed to list screen sessions:', error);
      return new Map();
    }
  },

  /**
   * Kills a Screen session by name
   * @param sessionName The name of the session to kill (without pid prefix)
   * @returns true if the session was killed, false otherwise
   */
  async killSession(sessionName: string): Promise<boolean> {
    try {
      const screen = getScreenBinary();
      await execAsync(`${screen} -S "${sessionName}" -X quit`);
      logger.debug(`Killed screen session: ${sessionName}`);
      return true;
    } catch (error) {
      logger.warn(`Failed to kill screen session ${sessionName}:`, error);
      return false;
    }
  },

  /**
   * Checks if a Screen session exists
   * @param sessionName The name of the session to check
   * @returns true if the session exists, false otherwise
   */
  async sessionExists(sessionName: string): Promise<boolean> {
    const sessions = await this.listSessions();
    return sessions.has(sessionName);
  },

  /**
   * Checks if GNU Screen is installed and available
   * @returns true if screen is installed, false otherwise
   */
  async isScreenInstalled(): Promise<boolean> {
    try {
      const screen = getScreenBinary();
      await execAsync(`which ${screen}`);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Gets the full path to the screen executable
   * @returns Path to screen, or null if not found
   */
  async getScreenPath(): Promise<string | null> {
    try {
      const screen = getScreenBinary();
      const { stdout } = await execAsync(`which ${screen}`);
      return stdout.trim();
    } catch {
      return null;
    }
  },

  /**
   * Sends a command to a screen session
   * @param sessionName The session to send the command to
   * @param command The command to send
   */
  async sendCommand(sessionName: string, command: string): Promise<boolean> {
    try {
      const screen = getScreenBinary();
      await execAsync(`${screen} -S "${sessionName}" -X stuff "${command}"`);
      return true;
    } catch (error) {
      logger.warn(`Failed to send command to ${sessionName}:`, error);
      return false;
    }
  },

  /**
   * Detaches from a screen session (if attached elsewhere)
   * @param sessionName The session to detach from
   */
  async detachSession(sessionName: string): Promise<boolean> {
    try {
      const screen = getScreenBinary();
      await execAsync(`${screen} -S "${sessionName}" -d`);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Lists all sessions matching a project pattern
   * @param projectName The project name prefix to match
   * @returns Array of matching session info
   */
  async listProjectSessions(projectName: string): Promise<ScreenSession[]> {
    const sessions = await this.listSessions();
    const matching: ScreenSession[] = [];

    for (const [name, session] of sessions) {
      if (name.startsWith(`${projectName}-`)) {
        matching.push(session);
      }
    }

    return matching;
  },

  /**
   * Kills all sessions matching a project pattern
   * @param projectName The project name prefix to match
   * @returns Number of sessions killed
   */
  async killProjectSessions(projectName: string): Promise<number> {
    const sessions = await this.listProjectSessions(projectName);
    let killed = 0;

    for (const session of sessions) {
      if (await this.killSession(session.name)) {
        killed++;
      }
    }

    logger.info(`Killed ${killed} screen sessions for project: ${projectName}`);
    return killed;
  },

  /**
   * Gets the current window title of a screen session
   * Uses `screen -Q title` to query the title (requires screen 4.1.0+)
   * @param sessionName The session to query
   * @returns The window title, or null if not available
   */
  async getWindowTitle(sessionName: string): Promise<string | null> {
    try {
      const screen = getScreenBinary();
      const { stdout } = await execAsync(`${screen} -S "${sessionName}" -Q title`);
      const title = stdout.trim();
      return title || null;
    } catch {
      // screen -Q may not be available on older versions
      return null;
    }
  },

  /**
   * Sets the window title of a screen session
   * @param sessionName The session to update
   * @param title The new title
   */
  async setWindowTitle(sessionName: string, title: string): Promise<boolean> {
    try {
      const screen = getScreenBinary();
      // Update screen's internal window title
      await execAsync(`${screen} -S "${sessionName}" -X title "${title}"`);

      // NOTE: We don't use "screen -X stuff" for OSC sequences
      // That command injects into terminal INPUT, not output - it would type garbage
      // into whatever program is running (Claude, vim, etc.)

      logger.debug(`Set screen title for ${sessionName}: "${title}"`);
      return true;
    } catch (error) {
      logger.warn(`Failed to set screen title for ${sessionName}:`, error);
      return false;
    }
  },

  /**
   * Gets the configured screen binary name
   * @returns The screen binary path
   */
  getScreenBinary,
};

export default screenCommands;
