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
 * Update the theme in restore-terminals.json for a given window ID
 * @param windowId The window ID to update
 * @param theme The theme name, or undefined to clear the per-terminal theme
 */
export function updateJsonTheme(windowId: string, theme: string | undefined) {
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
                    if (theme) {
                        if (split.theme !== theme) {
                            logFn(`JSON theme update for ${windowId}: "${split.theme || 'none'}" → "${theme}"`);
                            split.theme = theme;
                            modified = true;
                        }
                    } else {
                        // Clear the theme
                        if (split.theme) {
                            logFn(`JSON theme cleared for ${windowId}`);
                            delete split.theme;
                            modified = true;
                        }
                    }
                }
            }
        }

        if (modified) {
            fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
            logFn('Updated restore-terminals.json (theme)');
        }
    } catch (error) {
        logFn(`Error updating JSON theme: ${error}`);
    }
}

/**
 * Update both name and command in restore-terminals.json for a given window ID
 * The command is updated to include the display name so screen-auto uses it for the tab title
 */
export function updateJsonNameAndCommand(windowId: string, newName: string) {
    logFn(`updateJsonNameAndCommand called: windowId=${windowId}, newName=${newName}`);

    if (!jsonPath) {
        logFn('ERROR: jsonPath not initialized - call initJsonUtils first');
        return;
    }

    if (!fs.existsSync(jsonPath)) {
        logFn(`restore-terminals.json not found at: ${jsonPath}`);
        return;
    }

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let modified = false;
        const foundIds: string[] = [];

        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                const id = split.windowId || extractWindowIdFromCommands(split.commands);
                if (id) foundIds.push(id);
                if (id === windowId) {
                    if (split.name !== newName) {
                        logFn(`JSON update name "${split.name}" → "${newName}"`);
                        split.name = newName;
                        modified = true;
                    }

                    const newCommand = `exec .vscode/terminals/screen-auto ${windowId} "${newName}"`;
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
        } else {
            logFn(`No match found for windowId=${windowId}. Found IDs in JSON: [${foundIds.join(', ')}]`);
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

/**
 * Add a new terminal entry to restore-terminals.json
 * Creates the file if it doesn't exist
 */
export function addTerminalToJson(windowId: string, displayName: string): boolean {
    try {
        // Default config structure
        let config = {
            artificialDelayMilliseconds: 800,
            terminals: [] as Array<{ splitTerminals: Array<{ windowId: string; name: string; commands: string[] }> }>
        };

        // Load existing config if file exists
        if (fs.existsSync(jsonPath)) {
            config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (!config.terminals) {
                config.terminals = [];
            }
        }

        // Check if terminal already exists
        for (const tab of config.terminals) {
            for (const split of tab.splitTerminals || []) {
                if (split.windowId === windowId) {
                    logFn(`Terminal ${windowId} already exists in JSON, skipping add`);
                    return false; // Already exists
                }
            }
        }

        // Create the command that screen-auto uses
        const command = `exec .vscode/terminals/screen-auto ${windowId} "${displayName}"`;

        // Add new terminal entry
        config.terminals.push({
            splitTerminals: [
                {
                    windowId,
                    name: displayName,
                    commands: [command]
                }
            ]
        });

        // Write to file
        fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
        logFn(`Added terminal ${windowId} ("${displayName}") to restore-terminals.json`);
        return true;
    } catch (error) {
        logFn(`Error adding terminal to JSON: ${error}`);
        return false;
    }
}

/**
 * Remove a specific terminal entry from restore-terminals.json
 * @param windowId The window ID to remove
 * @returns true if terminal was found and removed, false otherwise
 */
export function removeTerminalFromJson(windowId: string): boolean {
    if (!fs.existsSync(jsonPath)) return false;

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let modified = false;

        // Filter out the terminal with the given windowId
        config.terminals = (config.terminals || []).filter((tab: { splitTerminals?: Array<{ windowId?: string }> }) => {
            if (!tab.splitTerminals) return true;

            const originalLength = tab.splitTerminals.length;
            tab.splitTerminals = tab.splitTerminals.filter(split => split.windowId !== windowId);

            if (tab.splitTerminals.length !== originalLength) {
                modified = true;
            }

            // Keep the tab only if it still has terminals
            return tab.splitTerminals.length > 0;
        });

        if (modified) {
            fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
            logFn(`Removed terminal ${windowId} from restore-terminals.json`);
        }

        return modified;
    } catch (error) {
        logFn(`Error removing terminal from JSON: ${error}`);
        return false;
    }
}

/**
 * Get all terminals from restore-terminals.json
 * Returns array of {windowId, name, claudeSessionId} for restoration
 */
export function getAllTerminalsFromJson(): Array<{ windowId: string; name: string; claudeSessionId?: string; theme?: string }> {
    if (!fs.existsSync(jsonPath)) return [];

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const terminals: Array<{ windowId: string; name: string; claudeSessionId?: string; theme?: string }> = [];

        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                const windowId = split.windowId || extractWindowIdFromCommands(split.commands);
                if (windowId && split.name) {
                    terminals.push({
                        windowId,
                        name: split.name,
                        claudeSessionId: split.claudeSessionId,
                        theme: split.theme
                    });
                }
            }
        }

        return terminals;
    } catch (error) {
        logFn(`Error reading terminals from JSON: ${error}`);
        return [];
    }
}

/**
 * Clear all terminal entries from restore-terminals.json
 * Resets the file to an empty terminals array
 */
export function clearAllTerminalsFromJson(): boolean {
    try {
        // Create empty config structure
        const config = {
            artificialDelayMilliseconds: 800,
            terminals: [] as Array<{ splitTerminals: Array<{ windowId: string; name: string; commands: string[] }> }>
        };

        // Write empty config to file
        fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
        logFn('Cleared all terminals from restore-terminals.json');
        return true;
    } catch (error) {
        logFn(`Error clearing terminals from JSON: ${error}`);
        return false;
    }
}
