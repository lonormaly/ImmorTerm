import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * ImmorTerm Name Sync Extension
 *
 * Architecture: VS Code terminal tab name is the SINGLE SOURCE OF TRUTH
 *
 * Flow:
 * 1. User renames terminal tab in VS Code (right-click → Rename)
 * 2. Extension detects name change when switching terminals
 * 3. Extension syncs to BOTH:
 *    - restore-terminals.json (for persistence across restarts)
 *    - screen title (for display in screen sessions)
 *
 * Screen renames (sname, Ctrl+A A) are IGNORED - VS Code name is authoritative.
 */

// Maps to track terminal state
const terminalWindowIds = new Map<vscode.Terminal, string>();
const terminalLastNames = new Map<vscode.Terminal, string>();

let projectName: string;
let jsonPath: string;
let pollInterval: NodeJS.Timeout | undefined;
let outputChannel: vscode.OutputChannel;

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes - fallback only

function log(message: string) {
    const timestamp = new Date().toISOString().slice(11, 19);
    outputChannel.appendLine(`[${timestamp}] ${message}`);
}

/**
 * Check if terminal name changed and sync if needed
 */
function checkTerminalNameChange(terminal: vscode.Terminal): boolean {
    const lastName = terminalLastNames.get(terminal);
    if (lastName !== undefined && lastName !== terminal.name) {
        log(`Name changed "${lastName}" → "${terminal.name}"`);
        terminalLastNames.set(terminal, terminal.name);
        syncTerminalToScreenAndJson(terminal);
        return true;
    }
    return false;
}

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('ImmorTerm Name Sync');
    context.subscriptions.push(outputChannel);

    log('Extension activated');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        log('No workspace folder found');
        return;
    }

    projectName = path.basename(workspaceFolder).toLowerCase();
    jsonPath = path.join(workspaceFolder, '.vscode', 'restore-terminals.json');

    // Watch for shell execution to capture window IDs when screen-auto runs
    context.subscriptions.push(
        vscode.window.onDidStartTerminalShellExecution((event) => {
            const cmdLine = event.execution.commandLine.value;
            const match = cmdLine.match(/screen-auto\s+(\d+-\w+)/);
            if (match) {
                const windowId = match[1];
                terminalWindowIds.set(event.terminal, windowId);
                terminalLastNames.set(event.terminal, event.terminal.name);
                log(`Captured window ID ${windowId} for "${event.terminal.name}"`);

                // Sync current name to screen title (sets DD/MM-HH:MM prefix)
                syncTerminalToScreenAndJson(event.terminal);
            }
        })
    );

    // Watch for new terminals opening
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal((terminal) => {
            terminalLastNames.set(terminal, terminal.name);
            // Try to match to a window ID from JSON (for already-restored terminals)
            tryMatchTerminalToWindowId(terminal);
        })
    );

    // Watch for terminal state changes (may include name changes)
    context.subscriptions.push(
        vscode.window.onDidChangeTerminalState((terminal) => {
            checkTerminalNameChange(terminal);
        })
    );

    // Watch for active terminal changes - check names when switching terminals
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTerminal((terminal) => {
            if (terminal) {
                checkTerminalNameChange(terminal);
            }
            // Also check all terminals since rename might have happened on inactive one
            for (const t of vscode.window.terminals) {
                checkTerminalNameChange(t);
            }
        })
    );

    // Clean up when terminal closes (X button or programmatic close)
    // 60-second delay ensures we don't cleanup during VS Code quit/crash:
    // - If VS Code quits: timer never executes (process dies)
    // - If user clicks X: timer executes after delay (VS Code still running)
    const CLEANUP_DELAY_MS = 60 * 1000; // 1 minute

    context.subscriptions.push(
        vscode.window.onDidCloseTerminal((terminal) => {
            const windowId = terminalWindowIds.get(terminal);
            const terminalName = terminal.name;

            // Clean up maps immediately
            terminalWindowIds.delete(terminal);
            terminalLastNames.delete(terminal);

            if (windowId) {
                log(`Terminal closed: "${terminalName}" (window ${windowId}) - cleanup in 60s`);

                // Delay cleanup to distinguish single terminal close from VS Code quit
                setTimeout(() => {
                    log(`Executing delayed cleanup for window ${windowId}`);

                    // Kill the screen session
                    const sessionName = `${projectName}-${windowId}`;
                    try {
                        execSync(`screen -S "${sessionName}" -X quit`, {
                            timeout: 5000,
                            stdio: 'pipe'
                        });
                        log(`Killed screen session ${sessionName}`);
                    } catch (error) {
                        // Session might already be dead
                        log(`Could not kill screen session ${sessionName}`);
                    }

                    // Remove from JSON
                    removeFromJson(windowId);
                }, CLEANUP_DELAY_MS);
            }
        })
    );

    // Register manual sync command
    context.subscriptions.push(
        vscode.commands.registerCommand('immorterm.syncNow', () => {
            let synced = 0;
            for (const terminal of vscode.window.terminals) {
                if (syncTerminalToScreenAndJson(terminal)) {
                    synced++;
                }
            }
            vscode.window.showInformationMessage(`ImmorTerm: Synced ${synced} terminal names`);
        })
    );

    // Fallback: poll every 10 minutes to catch any missed name changes
    pollInterval = setInterval(() => {
        for (const terminal of vscode.window.terminals) {
            if (checkTerminalNameChange(terminal)) {
                log('[poll] Detected name change');
            }
        }
    }, POLL_INTERVAL_MS);

    context.subscriptions.push({
        dispose: () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        }
    });

    // Initialize existing terminals
    for (const terminal of vscode.window.terminals) {
        terminalLastNames.set(terminal, terminal.name);
        tryMatchTerminalToWindowId(terminal);
    }

    log(`Initialized with ${vscode.window.terminals.length} terminals`);
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
 * Sync terminal name to both JSON and screen title
 * Returns true if sync was performed
 */
function syncTerminalToScreenAndJson(terminal: vscode.Terminal): boolean {
    const windowId = terminalWindowIds.get(terminal);
    if (!windowId) {
        log(`No window ID for "${terminal.name}" - skipping`);
        return false;
    }

    const name = terminal.name;
    log(`Syncing "${name}" (window ${windowId})`);

    // 1. Update restore-terminals.json
    updateJsonName(windowId, name);

    // 2. Update screen title with date prefix
    const sessionName = `${projectName}-${windowId}`;
    const title = `${getDatePrefix()} ${name}`;
    try {
        execSync(`screen -S "${sessionName}" -X title "${title}"`, {
            timeout: 5000,
            stdio: 'pipe'
        });
        log(`Set screen title to "${title}"`);
    } catch (error) {
        // Session might not exist yet or screen not running
        log(`Could not set screen title for ${sessionName}`);
    }

    return true;
}

/**
 * Update the name in restore-terminals.json for a given window ID
 */
function updateJsonName(windowId: string, newName: string) {
    if (!fs.existsSync(jsonPath)) {
        log('restore-terminals.json not found');
        return;
    }

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let modified = false;

        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                const id = extractWindowIdFromCommands(split.commands);
                if (id === windowId && split.name !== newName) {
                    log(`JSON update "${split.name}" → "${newName}"`);
                    split.name = newName;
                    modified = true;
                }
            }
        }

        if (modified) {
            fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
            log('Updated restore-terminals.json');
        }
    } catch (error) {
        log(`Error updating JSON: ${error}`);
    }
}

/**
 * Remove entry from restore-terminals.json for a given window ID
 */
function removeFromJson(windowId: string) {
    if (!fs.existsSync(jsonPath)) {
        return;
    }

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const originalCount = config.terminals?.length || 0;

        config.terminals = (config.terminals || []).filter((tab: any) => {
            const id = extractWindowIdFromCommands(tab.splitTerminals?.[0]?.commands);
            return id !== windowId;
        });

        if (config.terminals.length < originalCount) {
            fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
            log(`Removed window ${windowId} from restore-terminals.json`);
        }
    } catch (error) {
        log(`Error removing from JSON: ${error}`);
    }
}

/**
 * Extract window ID from command array
 * Commands look like: "exec .vscode/terminals/screen-auto 12345-abcdef12"
 */
function extractWindowIdFromCommands(commands: string[] | undefined): string | null {
    if (!commands) return null;
    for (const cmd of commands) {
        const match = cmd.match(/screen-auto\s+(\d+-\w+)/);
        if (match) return match[1];
    }
    return null;
}

/**
 * Try to match an existing terminal to a window ID from JSON
 * Used for terminals that were already open when extension activated
 * Only matches if there's exactly one terminal with that name (unambiguous)
 */
function tryMatchTerminalToWindowId(terminal: vscode.Terminal) {
    if (terminalWindowIds.has(terminal)) return;
    if (!fs.existsSync(jsonPath)) return;

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const matches: string[] = [];

        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                if (split.name === terminal.name) {
                    const windowId = extractWindowIdFromCommands(split.commands);
                    if (windowId) matches.push(windowId);
                }
            }
        }

        // Only use if exactly one match (unambiguous)
        if (matches.length === 1) {
            terminalWindowIds.set(terminal, matches[0]);
            log(`Matched "${terminal.name}" → window ID ${matches[0]}`);
        } else if (matches.length > 1) {
            log(`Multiple matches for "${terminal.name}" - waiting for shell execution`);
        }
    } catch (error) {
        log(`Error matching terminal: ${error}`);
    }
}

export function deactivate() {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
}
