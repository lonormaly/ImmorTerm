import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let syncInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('ImmorTerm Name Sync: Activated');

    // Sync when switching terminal tabs
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTerminal(() => {
            syncTerminalNames();
        })
    );

    // Sync when a terminal is opened (new terminal gets its session ID)
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal(() => {
            // Delay slightly to let the terminal initialize and get its name
            setTimeout(syncTerminalNames, 1000);
        })
    );

    // Sync when a terminal is closed (cleanup)
    context.subscriptions.push(
        vscode.window.onDidCloseTerminal(() => {
            syncTerminalNames();
        })
    );

    // Register manual sync command
    context.subscriptions.push(
        vscode.commands.registerCommand('immorterm.syncNow', () => {
            syncTerminalNames();
            vscode.window.showInformationMessage('ImmorTerm: Terminal names synced');
        })
    );

    // Periodic sync every 10 minutes as backup
    syncInterval = setInterval(syncTerminalNames, SYNC_INTERVAL_MS);
    context.subscriptions.push({
        dispose: () => {
            if (syncInterval) {
                clearInterval(syncInterval);
            }
        }
    });

    // Initial sync on activation
    setTimeout(syncTerminalNames, 2000);
}

function syncTerminalNames() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        return;
    }

    const jsonPath = path.join(workspaceFolder, '.vscode', 'restore-terminals.json');
    if (!fs.existsSync(jsonPath)) {
        return;
    }

    try {
        const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const terminals = vscode.window.terminals;
        let modified = false;

        // Build a map of current terminal names
        const terminalMap = new Map<string, string>();
        for (const terminal of terminals) {
            terminalMap.set(terminal.name, terminal.name);
        }

        // Update names in restore-terminals.json
        for (const tab of config.terminals || []) {
            for (const split of tab.splitTerminals || []) {
                // The commands array contains "exec .vscode/terminals/screen-auto <window-id>"
                // Extract the window ID from the command
                const windowId = extractWindowId(split.commands);
                if (!windowId) continue;

                // Find matching terminal by checking if any terminal's original session
                // matches this window ID
                for (const terminal of terminals) {
                    const currentName = terminal.name;

                    // If the current name in JSON matches a terminal that now has a different name
                    if (split.name === windowId && currentName !== windowId) {
                        // User renamed this terminal - update the JSON
                        split.name = currentName;
                        modified = true;
                    } else if (currentName === windowId || terminalMatchesWindowId(terminal, windowId)) {
                        // Terminal still has its original name or matches by other means
                        if (split.name !== currentName) {
                            split.name = currentName;
                            modified = true;
                        }
                    }
                }
            }
        }

        if (modified) {
            fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2) + '\n');
            console.log('ImmorTerm Name Sync: Updated restore-terminals.json');
        }
    } catch (error) {
        console.error('ImmorTerm Name Sync: Error syncing names:', error);
    }
}

function extractWindowId(commands: string[] | undefined): string | null {
    if (!commands || commands.length === 0) return null;

    // Commands look like: "exec .vscode/terminals/screen-auto 12345-abcdef12"
    for (const cmd of commands) {
        const match = cmd.match(/screen-auto\s+(\d+-\w+)/);
        if (match) {
            return match[1];
        }
    }
    return null;
}

function terminalMatchesWindowId(terminal: vscode.Terminal, windowId: string): boolean {
    // Check if the terminal's creation options contains the window ID
    const creationOptions = terminal.creationOptions as vscode.TerminalOptions;
    if (creationOptions?.name === windowId) {
        return true;
    }
    return false;
}

export function deactivate() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
}
