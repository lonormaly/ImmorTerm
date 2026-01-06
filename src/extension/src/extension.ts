/**
 * Terminal Name Sync Extension
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
 * Claude Session Sync:
 * - Polls every 30 seconds to detect Claude processes in screen sessions
 * - Matches Claude sessions to terminals via content-based log matching
 * - Updates claudeSessionId in JSON for auto-resume after restart
 * - Removes claudeSessionId when user exits Claude (prevents unwanted auto-resume)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { execSync } from 'child_process';
import { initJsonUtils } from './json-utils';
import { initClaudeSync, syncClaudeSessions } from './claude-sync';
import {
    initTerminalMatching,
    terminalWindowIds,
    terminalLastNames,
    tryMatchTerminalToWindowId,
    checkTerminalNameChange,
    syncTerminalToScreenAndJson
} from './terminal-matching';

let pollInterval: NodeJS.Timeout | undefined;
let claudeSyncInterval: NodeJS.Timeout | undefined;
let outputChannel: vscode.OutputChannel;

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes - fallback only
const CLAUDE_SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds for Claude session detection

function log(message: string) {
    const timestamp = new Date().toISOString().slice(11, 19);
    outputChannel.appendLine(`[${timestamp}] ${message}`);
}

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Terminal Name Sync');
    context.subscriptions.push(outputChannel);

    log('Extension activated');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        log('No workspace folder found');
        return;
    }

    const projectName = path.basename(workspaceFolder).toLowerCase();
    const jsonPath = path.join(workspaceFolder, '.vscode', 'restore-terminals.json');

    // Initialize modules
    initJsonUtils(jsonPath, log);
    initClaudeSync(projectName, workspaceFolder, log);
    initTerminalMatching(projectName, log);

    // Watch for new terminals opening
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal((terminal) => {
            log(`Terminal opened: "${terminal.name}"`);
            terminalLastNames.set(terminal, terminal.name);

            // Delay to allow screen-reconcile to write JSON
            setTimeout(() => {
                log(`Attempting match for "${terminal.name}"...`);
                tryMatchTerminalToWindowId(terminal);
            }, 2000);
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
            for (const t of vscode.window.terminals) {
                checkTerminalNameChange(t);
            }
        })
    );

    // Clean up when terminal closes
    const CLEANUP_DELAY_MS = 60 * 1000;

    context.subscriptions.push(
        vscode.window.onDidCloseTerminal((terminal) => {
            const windowId = terminalWindowIds.get(terminal);
            const terminalName = terminal.name;

            terminalWindowIds.delete(terminal);
            terminalLastNames.delete(terminal);

            if (windowId) {
                log(`Terminal closed: "${terminalName}" (window ${windowId}) - cleanup in 60s`);

                setTimeout(() => {
                    log(`Executing delayed cleanup for window ${windowId}`);

                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (workspaceFolder) {
                        const forgetScript = path.join(workspaceFolder, '.vscode', 'terminals', 'screen-forget');
                        try {
                            execSync(`"${forgetScript}" "${windowId}"`, {
                                timeout: 10000,
                                stdio: 'pipe',
                                cwd: workspaceFolder
                            });
                            log(`Cleaned up window ${windowId} via screen-forget`);
                        } catch (error) {
                            log(`screen-forget failed: ${error}`);
                        }
                    }
                }, CLEANUP_DELAY_MS);
            }
        })
    );

    // Register manual sync command
    context.subscriptions.push(
        vscode.commands.registerCommand('terminalNameSync.syncNow', () => {
            let synced = 0;
            for (const terminal of vscode.window.terminals) {
                if (syncTerminalToScreenAndJson(terminal)) {
                    synced++;
                }
            }
            vscode.window.showInformationMessage(`Synced ${synced} terminal names`);
        })
    );

    // Fallback: poll every 10 minutes
    pollInterval = setInterval(() => {
        for (const terminal of vscode.window.terminals) {
            if (checkTerminalNameChange(terminal)) {
                log('[poll] Detected name change');
            }
            if (!terminalWindowIds.has(terminal)) {
                tryMatchTerminalToWindowId(terminal);
            }
        }
    }, POLL_INTERVAL_MS);

    context.subscriptions.push({
        dispose: () => {
            if (pollInterval) clearInterval(pollInterval);
            if (claudeSyncInterval) clearInterval(claudeSyncInterval);
        }
    });

    // Claude session sync
    claudeSyncInterval = setInterval(() => {
        syncClaudeSessions();
    }, CLAUDE_SYNC_INTERVAL_MS);

    // Run initial Claude sync after a short delay
    setTimeout(() => {
        syncClaudeSessions();
    }, 5000);

    // Initialize existing terminals
    for (const terminal of vscode.window.terminals) {
        terminalLastNames.set(terminal, terminal.name);
        tryMatchTerminalToWindowId(terminal);
    }

    log(`Initialized with ${vscode.window.terminals.length} terminals`);
}

export function deactivate() {
    if (pollInterval) clearInterval(pollInterval);
    if (claudeSyncInterval) clearInterval(claudeSyncInterval);
}
