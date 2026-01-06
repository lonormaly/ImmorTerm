/**
 * JSON Utilities for restore-terminals.json operations
 */

import * as fs from 'fs';

let jsonPath: string;
let logFn: (message: string) => void = console.log;

export function initJsonUtils(path: string, logger: (message: string) => void) {
    jsonPath = path;
    logFn = logger;
}

export function getJsonPath(): string {
    return jsonPath;
}

/**
 * Extract window ID from command array (fallback for old entries without windowId field)
 * Commands look like: "exec .vscode/terminals/screen-auto 12345-abcdef12"
 */
export function extractWindowIdFromCommands(commands: string[] | undefined): string | null {
    if (!commands) return null;
    for (const cmd of commands) {
        const match = cmd.match(/screen-auto\s+(\d+-\w+)/);
        if (match) return match[1];
    }
    return null;
}

/**
 * Get terminal name from JSON for a windowId
 */
export function getTerminalNameFromJson(windowId: string): string | null {
    if (!fs.existsSync(jsonPath)) return null;

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                if (split.windowId === windowId) {
                    return split.name || null;
                }
            }
        }
    } catch {
        // Ignore
    }
    return null;
}

/**
 * Update the name in restore-terminals.json for a given window ID
 */
export function updateJsonName(windowId: string, newName: string) {
    if (!fs.existsSync(jsonPath)) {
        logFn('restore-terminals.json not found');
        return;
    }

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let modified = false;

        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                const id = split.windowId || extractWindowIdFromCommands(split.commands);
                if (id === windowId && split.name !== newName) {
                    logFn(`JSON update "${split.name}" → "${newName}"`);
                    split.name = newName;
                    modified = true;
                }
            }
        }

        if (modified) {
            fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
            logFn('Updated restore-terminals.json');
        }
    } catch (error) {
        logFn(`Error updating JSON: ${error}`);
    }
}

/**
 * Update both name and command in restore-terminals.json for a given window ID
 * The command is updated to include the display name so screen-auto uses it for the tab title
 */
export function updateJsonNameAndCommand(windowId: string, newName: string) {
    if (!fs.existsSync(jsonPath)) {
        logFn('restore-terminals.json not found');
        return;
    }

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let modified = false;

        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                const id = split.windowId || extractWindowIdFromCommands(split.commands);
                if (id === windowId) {
                    if (split.name !== newName) {
                        logFn(`JSON update name "${split.name}" → "${newName}"`);
                        split.name = newName;
                        modified = true;
                    }

                    const newCommand = `exec .vscode/terminals/screen-auto ${windowId} ${newName}`;
                    if (split.commands && split.commands.length > 0) {
                        if (split.commands[0] !== newCommand) {
                            logFn(`JSON update command → "${newCommand}"`);
                            split.commands[0] = newCommand;
                            modified = true;
                        }
                    }
                }
            }
        }

        if (modified) {
            fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
            logFn('Updated restore-terminals.json (name + command)');
        }
    } catch (error) {
        logFn(`Error updating JSON: ${error}`);
    }
}

/**
 * Get all window IDs from JSON
 */
export function getAllWindowIds(): Set<string> {
    const windowIds = new Set<string>();
    if (!fs.existsSync(jsonPath)) return windowIds;

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                if (split.windowId) {
                    windowIds.add(split.windowId);
                }
            }
        }
    } catch {
        // Ignore
    }
    return windowIds;
}

/**
 * Get current claudeSessionId from JSON for a window
 */
export function getCurrentClaudeSessionId(windowId: string): string | null {
    if (!fs.existsSync(jsonPath)) return null;

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                if (split.windowId === windowId) {
                    return split.claudeSessionId || null;
                }
            }
        }
    } catch {
        // Ignore
    }
    return null;
}

/**
 * Update claudeSessionId in JSON for a window
 */
export function updateClaudeSessionId(windowId: string, sessionId: string): boolean {
    if (!fs.existsSync(jsonPath)) return false;

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let modified = false;

        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                if (split.windowId === windowId) {
                    if (split.claudeSessionId !== sessionId) {
                        split.claudeSessionId = sessionId;
                        modified = true;
                        logFn(`[claude-sync] Set claudeSessionId for ${windowId}: ${sessionId.slice(0, 8)}...`);
                    }
                }
            }
        }

        if (modified) {
            fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
        }

        return modified;
    } catch (error) {
        logFn(`Error updating claudeSessionId: ${error}`);
        return false;
    }
}

/**
 * Remove claudeSessionId from JSON for a window (Claude exited)
 */
export function removeClaudeSessionId(windowId: string): boolean {
    if (!fs.existsSync(jsonPath)) return false;

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let modified = false;

        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                if (split.windowId === windowId && split.claudeSessionId) {
                    delete split.claudeSessionId;
                    modified = true;
                    logFn(`[claude-sync] Removed claudeSessionId for ${windowId} (Claude exited)`);
                }
            }
        }

        if (modified) {
            fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
        }

        return modified;
    } catch (error) {
        logFn(`Error removing claudeSessionId: ${error}`);
        return false;
    }
}
