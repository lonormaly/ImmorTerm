/**
 * Claude Session Sync
 * Detects Claude processes in screen sessions and manages claudeSessionId in JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import {
    getTerminalNameFromJson,
    getAllWindowIds,
    getCurrentClaudeSessionId,
    updateClaudeSessionId,
    removeClaudeSessionId
} from './json-utils';

let projectName: string;
let workspacePath: string;
let screenBinary: string = 'immorterm';
let logFn: (message: string) => void = console.log;

export function initClaudeSync(project: string, workspace: string, logger: (message: string) => void, screen: string = 'immorterm') {
    projectName = project;
    workspacePath = workspace;
    logFn = logger;
    screenBinary = screen;
}

export interface ScreenSession {
    windowId: string;
    screenPid: string;
    hasClaudeProcess: boolean;
    name?: string;
}

/**
 * Get all screen sessions for this project and detect Claude processes
 */
export function getScreenSessionsWithClaudeStatus(): ScreenSession[] {
    const sessions: ScreenSession[] = [];

    try {
        logFn(`[claude-sync] Using screen binary: ${screenBinary}, project: ${projectName}`);
        const screenList = execSync(`${screenBinary} -ls 2>/dev/null || true`, {
            encoding: 'utf8',
            timeout: 5000
        });

        // Parse ImmorTerm sessions - check both Attached and Detached
        const sessionRegex = new RegExp(`(\\d+)\\.${projectName}-(\\S+)\\s+\\((Attached|Detached)\\)`, 'g');
        logFn(`[claude-sync] Regex pattern: ${sessionRegex.source}`);
        let match;

        const seenWindowIds = new Set<string>();
        let debugOnce = true;

        while ((match = sessionRegex.exec(screenList)) !== null) {
            const screenPid = match[1];
            const windowId = match[2];
            const status = match[3];

            if (seenWindowIds.has(windowId)) continue;
            seenWindowIds.add(windowId);

            // Check ALL sessions for Claude processes, not just Attached ones
            // Claude can be running in a Detached session (e.g., after laptop restart)
            const hasClaudeProcess = checkForClaudeProcess(screenPid, debugOnce);
            if (debugOnce) {
                logFn(`[claude-sync] Session ${windowId} (${status}): claude=${hasClaudeProcess}`);
            }
            debugOnce = false;
            const name = getTerminalNameFromJson(windowId);

            sessions.push({ windowId, screenPid, hasClaudeProcess, name: name || undefined });
        }
    } catch (error) {
        logFn(`Error getting screen sessions: ${error}`);
    }

    return sessions;
}

/**
 * Check if a screen session has a Claude process running
 * Process tree: screen → zsh/bash → claude
 */
function checkForClaudeProcess(screenPid: string, debug: boolean = false): boolean {
    try {
        const psOutput = execSync('ps -eo pid,ppid,comm', {
            encoding: 'utf8',
            timeout: 5000
        });

        const lines = psOutput.trim().split('\n').slice(1);
        const processes: { pid: string; ppid: string; comm: string }[] = [];

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
                processes.push({
                    pid: parts[0],
                    ppid: parts[1],
                    comm: parts.slice(2).join(' ')  // Handle comm with spaces
                });
            }
        }

        const screenChildren = processes.filter(p => p.ppid === screenPid);
        // Always log for debugging
        logFn(`[debug] Screen ${screenPid} children: ${screenChildren.length > 0 ? screenChildren.map(c => `${c.comm}(${c.pid})`).join(', ') : 'NONE'}`);

        // Find ALL shell processes under screen (not just the first one)
        const shellProcesses = processes.filter(p =>
            p.ppid === screenPid &&
            (p.comm.includes('zsh') || p.comm.includes('bash'))
        );

        if (shellProcesses.length === 0) {
            logFn(`[debug] No shell found for screen ${screenPid}`);
            return false;
        }

        // Check each shell for Claude process
        for (const shellProcess of shellProcesses) {
            const claudeProcess = processes.find(p =>
                p.ppid === shellProcess.pid &&
                p.comm === 'claude'
            );

            if (claudeProcess) {
                logFn(`[debug] Found Claude (${claudeProcess.pid}) under shell ${shellProcess.comm}(${shellProcess.pid})`);
                return true;
            }
        }

        logFn(`[debug] Claude process found: NO (checked ${shellProcesses.length} shells)`);
        return false;
    } catch (error) {
        logFn(`[debug] Error in checkForClaudeProcess: ${error}`);
        return false;
    }
}

/**
 * Find Claude session ID using CONTENT-BASED matching
 * Searches log file content for user messages from history.jsonl
 */
export function findClaudeSessionIdForWindow(windowId: string): string | null {
    const logsDir = path.join(workspacePath, '.vscode', 'terminals', 'logs');
    const logFile = path.join(logsDir, `${projectName}-${windowId}.log`);
    const historyPath = path.join(os.homedir(), '.claude', 'history.jsonl');

    if (!fs.existsSync(logFile) || !fs.existsSync(historyPath)) {
        logFn(`[claude-sync] Log or history not found for ${windowId}`);
        return null;
    }

    try {
        // Read log and strip ANSI escape codes for accurate matching
        const rawLogContent = fs.readFileSync(logFile, 'utf8');
        // eslint-disable-next-line no-control-regex
        const logContent = rawLogContent.replace(/\x1b\[[0-9;]*m/g, '');

        const historyContent = execSync(`grep "${workspacePath}" "${historyPath}" | tail -1000`, {
            encoding: 'utf8',
            timeout: 10000
        });

        // Parse history entries: sessionId -> list of display messages
        const sessionMessages = new Map<string, string[]>();

        for (const line of historyContent.split('\n')) {
            if (!line.trim()) continue;
            try {
                const entry = JSON.parse(line);
                if (entry.sessionId && entry.display &&
                    entry.display.length > 15 &&
                    !entry.display.includes('/resume') &&
                    !entry.display.includes('/status') &&
                    entry.display !== 'go on') {

                    if (!sessionMessages.has(entry.sessionId)) {
                        sessionMessages.set(entry.sessionId, []);
                    }
                    sessionMessages.get(entry.sessionId)!.push(entry.display);
                }
            } catch {
                // Skip invalid JSON
            }
        }

        if (sessionMessages.size === 0) {
            logFn(`[claude-sync] No session messages found in history`);
            return null;
        }

        // Score matches for each session using word-level matching
        let bestSession = '';
        let bestScore = 0;
        let bestMatchInfo = '';

        for (const [sessionId, messages] of sessionMessages) {
            let wordMatchCount = 0;
            let messageMatchCount = 0;
            const totalMessages = messages.length;

            // Extract unique multi-word phrases (3+ words) from RECENT messages
            // Use slice(-N) to get most recent messages (history is chronological)
            const searchTerms = messages
                .slice(-20) // Use last 20 messages (most recent)
                .filter(m => m.length > 15)
                .flatMap(m => {
                    // Extract 3-5 word phrases for more unique matching
                    const words = m.split(/\s+/).filter(w => w.length > 3);
                    const phrases: string[] = [];
                    for (let i = 0; i < words.length - 2; i++) {
                        phrases.push(words.slice(i, i + 3).join(' '));
                    }
                    return phrases.slice(0, 5); // Max 5 phrases per message
                })
                .slice(0, 20); // Max 20 search terms total

            for (const term of searchTerms) {
                if (logContent.includes(term)) {
                    wordMatchCount++;
                }
            }

            // Also check full message matches (first 60 chars) from RECENT messages
            for (const msg of messages.filter(m => m.length > 20).slice(-10)) {
                if (logContent.includes(msg.substring(0, 60))) {
                    messageMatchCount++;
                }
            }

            // Calculate confidence score:
            // - Sessions with few messages: word matches are more important
            // - Sessions with many messages: need higher match ratio
            const matchRatio = totalMessages > 0 ? messageMatchCount / Math.min(totalMessages, 10) : 0;
            const wordScore = Math.min(wordMatchCount / 5, 1); // Cap at 5 word matches = 1.0

            // Final score: weighted combination
            const score = (matchRatio * 0.6) + (wordScore * 0.4);

            if (score > bestScore || (score === bestScore && wordMatchCount > 0)) {
                bestScore = score;
                bestSession = sessionId;
                bestMatchInfo = `msgs=${messageMatchCount}/${totalMessages}, words=${wordMatchCount}, ratio=${matchRatio.toFixed(2)}`;
            }
        }

        // Accept if:
        // - Score >= 0.1 (at least some matches)
        // - OR if there's only 1 session with any matches at all
        const hasConfidentMatch = bestScore >= 0.1 && bestSession;

        if (hasConfidentMatch) {
            logFn(`[claude-sync] Content match: ${windowId} → ${bestSession.slice(0, 8)}... (${bestMatchInfo}, score=${bestScore.toFixed(2)})`);
            return bestSession;
        }

        logFn(`[claude-sync] No confident match for ${windowId} (best score: ${bestScore.toFixed(2)})`);
        return findSessionByTimestamp(windowId);
    } catch (error) {
        logFn(`[claude-sync] Error in content matching: ${error}`);
        return null;
    }
}

/**
 * Fallback: Find session by timestamp correlation
 */
function findSessionByTimestamp(windowId: string): string | null {
    const logsDir = path.join(workspacePath, '.vscode', 'terminals', 'logs');
    const logFile = path.join(logsDir, `${projectName}-${windowId}.log`);
    const historyPath = path.join(os.homedir(), '.claude', 'history.jsonl');
    const claudeProjectDir = path.join(os.homedir(), '.claude', 'projects', workspacePath.replace(/\//g, '-'));

    if (!fs.existsSync(logFile) || !fs.existsSync(historyPath)) return null;

    try {
        const historyContent = execSync(`tail -100 "${historyPath}"`, {
            encoding: 'utf8',
            timeout: 5000
        });

        const sessionIds = new Set<string>();
        for (const line of historyContent.split('\n')) {
            if (!line.trim()) continue;
            try {
                const entry = JSON.parse(line);
                if (entry.project === workspacePath && entry.sessionId) {
                    sessionIds.add(entry.sessionId);
                }
            } catch {
                // Skip
            }
        }

        if (sessionIds.size === 1) {
            const sessionId = [...sessionIds][0];
            logFn(`[claude-sync] Single session fallback: ${windowId} → ${sessionId.slice(0, 8)}...`);
            return sessionId;
        }

        if (fs.existsSync(claudeProjectDir)) {
            const logStat = fs.statSync(logFile);
            const logMtime = logStat.mtimeMs;

            let bestSession = '';
            let bestDiff = Infinity;

            for (const sessionId of sessionIds) {
                const sessionFile = path.join(claudeProjectDir, `${sessionId}.jsonl`);
                if (!fs.existsSync(sessionFile)) continue;

                const sessionStat = fs.statSync(sessionFile);
                const diff = Math.abs(logMtime - sessionStat.mtimeMs);

                if (diff < bestDiff && diff < 120000) {
                    bestDiff = diff;
                    bestSession = sessionId;
                }
            }

            if (bestSession) {
                logFn(`[claude-sync] Timestamp fallback: ${windowId} → ${bestSession.slice(0, 8)}...`);
                return bestSession;
            }
        }
    } catch (error) {
        logFn(`[claude-sync] Timestamp fallback error: ${error}`);
    }

    return null;
}

/**
 * Clean up orphaned screen sessions and log files
 */
export function cleanupOrphanedLogs() {
    const logsDir = path.join(workspacePath, '.vscode', 'terminals', 'logs');
    if (!fs.existsSync(logsDir)) return;

    try {
        const validWindowIds = getAllWindowIds();
        const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
        const logPattern = new RegExp(`^${projectName}-(.+)\\.log$`);

        for (const logFile of logFiles) {
            const match = logFile.match(logPattern);
            if (match) {
                const windowId = match[1];
                if (!validWindowIds.has(windowId)) {
                    // Kill the orphaned screen session first
                    const sessionName = `${projectName}-${windowId}`;
                    try {
                        execSync(`${screenBinary} -S "${sessionName}" -X quit 2>/dev/null || true`, {
                            timeout: 5000,
                            stdio: 'pipe'
                        });
                        logFn(`[cleanup] Killed orphaned screen: ${sessionName}`);
                    } catch {
                        // Ignore
                    }

                    // Remove the log file
                    const logPath = path.join(logsDir, logFile);
                    fs.unlinkSync(logPath);
                    logFn(`[cleanup] Removed orphaned log: ${logFile}`);
                }
            }
        }
    } catch (error) {
        logFn(`[cleanup] Error cleaning logs: ${error}`);
    }
}

/**
 * Main sync function: detect Claude processes and update JSON
 */
export function syncClaudeSessions() {
    logFn(`[claude-sync] Scanning for Claude sessions...`);

    cleanupOrphanedLogs();

    const sessions = getScreenSessionsWithClaudeStatus();
    logFn(`[claude-sync] Found ${sessions.length} ImmorTerm sessions`);

    for (const session of sessions) {
        const currentSessionId = getCurrentClaudeSessionId(session.windowId);
        const displayName = session.name || session.windowId;
        logFn(`[claude-sync] "${displayName}": claude=${session.hasClaudeProcess}, currentId=${currentSessionId ? currentSessionId.slice(0, 8) + '...' : 'none'}`);

        if (session.hasClaudeProcess) {
            if (!currentSessionId) {
                const sessionId = findClaudeSessionIdForWindow(session.windowId);
                if (sessionId) {
                    updateClaudeSessionId(session.windowId, sessionId);
                } else {
                    logFn(`[claude-sync] No session ID found in history for ${displayName}`);
                }
            }
        } else {
            if (currentSessionId) {
                removeClaudeSessionId(session.windowId);
            }
        }
    }
}
