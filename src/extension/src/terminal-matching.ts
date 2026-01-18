/**
 * Terminal Matching
 * Matches VS Code terminals to window IDs from restore-terminals.json
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { execSync } from 'child_process';
import {
    getJsonPath,
    extractWindowIdFromCommands,
    updateJsonNameAndCommand
} from './json-utils';

let projectName: string;
let logFn: (message: string) => void = console.log;

/**
 * Gets the configured screen binary path from settings
 */
function getScreenBinary(): string {
    const config = vscode.workspace.getConfiguration('immorterm');
    return config.get<string>('screenBinary', 'screen-immorterm');
}

// Maps to track terminal state
export const terminalWindowIds = new Map<vscode.Terminal, string>();
export const terminalLastNames = new Map<vscode.Terminal, string>();

export function initTerminalMatching(project: string, logger: (message: string) => void) {
    projectName = project;
    logFn = logger;
}

/**
 * Generate date prefix for screen title: DD/MM-HH:MM
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
 * Check if a name is a raw windowId format (e.g., "12345-abcdef12")
 */
function isRawWindowIdFormat(name: string): boolean {
    return /^\d+-\w+$/.test(name);
}

/**
 * Get the next available friendly name (e.g., "pax-1", "pax-2")
 */
function getNextFriendlyName(): string {
    let maxN = 0;
    const jsonPath = getJsonPath();

    if (fs.existsSync(jsonPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const pattern = new RegExp(`^${projectName}-(\\d+)$`, 'i');

            for (const tab of config.terminals || []) {
                for (const split of tab.splitTerminals || []) {
                    const match = split.name?.match(pattern);
                    if (match) {
                        maxN = Math.max(maxN, parseInt(match[1], 10));
                    }
                }
            }
        } catch (error) {
            logFn(`Error reading JSON for friendly name: ${error}`);
        }
    }

    return `${projectName}-${maxN + 1}`;
}

/**
 * Auto-rename a terminal from raw windowId format to friendly name
 */
function autoRenameTerminal(terminal: vscode.Terminal, windowId: string) {
    if (!isRawWindowIdFormat(terminal.name)) {
        logFn(`Keeping user name "${terminal.name}" (not raw windowId format)`);
        return;
    }

    const newName = getNextFriendlyName();
    logFn(`Auto-rename: "${terminal.name}" → "${newName}" (effective on restart)`);

    updateJsonNameAndCommand(windowId, newName);

    const sessionName = `${projectName}-${windowId}`;
    const title = `${getDatePrefix()} ${newName}`;
    try {
        execSync(`${getScreenBinary()} -S "${sessionName}" -X title "${title}"`, {
            timeout: 5000,
            stdio: 'pipe'
        });
    } catch {
        // Session might not exist yet
    }

    terminalLastNames.set(terminal, terminal.name);
}

/**
 * Try to match a terminal to a window ID from JSON
 */
export function tryMatchTerminalToWindowId(terminal: vscode.Terminal) {
    if (terminalWindowIds.has(terminal)) return;

    const jsonPath = getJsonPath();
    if (!fs.existsSync(jsonPath)) return;

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const matches: string[] = [];

        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                const windowId = split.windowId || extractWindowIdFromCommands(split.commands);
                if (!windowId) continue;

                // Strategy 1: Match by JSON name
                if (split.name === terminal.name) {
                    matches.push(windowId);
                    continue;
                }

                // Strategy 2: Terminal name IS the windowId
                if (terminal.name === windowId) {
                    matches.push(windowId);
                    continue;
                }

                // Strategy 3: Terminal name matches windowId pattern from JSON
                if (isRawWindowIdFormat(terminal.name) && terminal.name === split.windowId) {
                    matches.push(windowId);
                }
            }
        }

        const uniqueMatches = [...new Set(matches)];

        if (uniqueMatches.length === 1) {
            const windowId = uniqueMatches[0];
            terminalWindowIds.set(terminal, windowId);
            logFn(`Matched "${terminal.name}" → window ID ${windowId}`);
            autoRenameTerminal(terminal, windowId);
        } else if (uniqueMatches.length > 1) {
            logFn(`Multiple matches for "${terminal.name}" - cannot determine which window`);
        } else {
            logFn(`No match found for "${terminal.name}" in JSON`);
        }
    } catch (error) {
        logFn(`Error matching terminal: ${error}`);
    }
}

/**
 * Sync terminal name to both JSON and screen title
 */
export function syncTerminalToScreenAndJson(terminal: vscode.Terminal): boolean {
    const windowId = terminalWindowIds.get(terminal);
    if (!windowId) {
        logFn(`No window ID for "${terminal.name}" - skipping`);
        return false;
    }

    const name = terminal.name;
    logFn(`Syncing "${name}" (window ${windowId})`);

    updateJsonNameAndCommand(windowId, name);

    const sessionName = `${projectName}-${windowId}`;
    const title = `${getDatePrefix()} ${name}`;
    try {
        execSync(`${getScreenBinary()} -S "${sessionName}" -X title "${title}"`, {
            timeout: 5000,
            stdio: 'pipe'
        });
        logFn(`Set screen title to "${title}"`);
    } catch {
        logFn(`Could not set screen title for ${sessionName}`);
    }

    return true;
}

/**
 * Check if terminal name changed and sync if needed
 */
export function checkTerminalNameChange(terminal: vscode.Terminal): boolean {
    const lastName = terminalLastNames.get(terminal);
    if (lastName !== undefined && lastName !== terminal.name) {
        logFn(`Name changed "${lastName}" → "${terminal.name}"`);
        terminalLastNames.set(terminal, terminal.name);
        syncTerminalToScreenAndJson(terminal);
        return true;
    }
    return false;
}
