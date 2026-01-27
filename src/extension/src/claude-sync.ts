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

        // Helper to get Claude's responses from session file
        const getClaudeResponses = (sessionId: string, projectPath: string): string[] => {
            const responses: string[] = [];
            try {
                // Convert project path to folder name: /Users/foo → -Users-foo
                const projectFolder = projectPath.replace(/\//g, '-');
                const sessionFile = path.join(os.homedir(), '.claude', 'projects', projectFolder, `${sessionId}.jsonl`);

                if (!fs.existsSync(sessionFile)) return responses;

                // Read first 50 lines to get early responses (most distinctive)
                const content = execSync(`head -50 "${sessionFile}"`, { encoding: 'utf8', timeout: 5000 });

                for (const line of content.split('\n')) {
                    if (!line.trim()) continue;
                    try {
                        const entry = JSON.parse(line);
                        // Session files have: entry.message.content[] array with {type, text}
                        if (entry.type === 'assistant' && entry.message?.content) {
                            for (const block of entry.message.content) {
                                if (block.type === 'text' && block.text && block.text.length > 5) {
                                    responses.push(block.text.substring(0, 200));
                                    if (responses.length >= 5) return responses;
                                }
                            }
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            } catch {
                // Session file not found or error reading
            }
            return responses;
        };

        // Helper to parse history content into session messages map
        // Also tracks project path for each session to lookup Claude responses
        const sessionProjects = new Map<string, string>(); // sessionId → project path

        const parseHistory = (content: string): Map<string, string[]> => {
            const sessions = new Map<string, string[]>();
            for (const line of content.split('\n')) {
                if (!line.trim()) continue;
                try {
                    const entry = JSON.parse(line);
                    if (entry.sessionId && entry.display &&
                        entry.display.length > 10 &&
                        !entry.display.includes('/resume') &&
                        !entry.display.includes('/status') &&
                        entry.display !== 'go on') {

                        if (!sessions.has(entry.sessionId)) {
                            sessions.set(entry.sessionId, []);
                        }
                        sessions.get(entry.sessionId)!.push(entry.display);

                        // Track project path for this session
                        if (entry.project && !sessionProjects.has(entry.sessionId)) {
                            sessionProjects.set(entry.sessionId, entry.project);
                        }
                    }
                } catch {
                    // Skip invalid JSON
                }
            }
            return sessions;
        };

        // Helper to score sessions against log content
        // Additive scoring: exact matches + phrase matches, no cap
        const scoreSession = (messages: string[]): { score: number; info: string } => {
            let exactMatches = 0;
            let phraseMatches = 0;

            // Check exact matches - full message found in log (lowered threshold to 5 chars)
            for (const msg of messages.slice(-20)) {
                if (msg.length >= 5 && logContent.includes(msg)) {
                    exactMatches++;
                }
            }

            // Check phrase matches - 3-word phrases (lowered threshold to 10 chars)
            const searchTerms = messages
                .slice(-20)
                .filter(m => m.length >= 10)
                .flatMap(m => {
                    const words = m.split(/\s+/).filter(w => w.length > 2);
                    const phrases: string[] = [];
                    for (let i = 0; i < words.length - 2; i++) {
                        phrases.push(words.slice(i, i + 3).join(' '));
                    }
                    return phrases.slice(0, 5);
                })
                .slice(0, 30);

            for (const term of searchTerms) {
                if (logContent.includes(term)) {
                    phraseMatches++;
                }
            }

            // Additive scoring - no cap, higher = better match
            const score = (exactMatches * 0.15) + (phraseMatches * 0.03);

            return {
                score,
                info: `exact=${exactMatches}, phrases=${phraseMatches}`
            };
        };

        // Try workspace-filtered search first
        let historyContent = '';
        try {
            historyContent = execSync(`grep "${workspacePath}" "${historyPath}" | tail -1000`, {
                encoding: 'utf8',
                timeout: 10000
            });
        } catch {
            // grep returns error if no matches
        }

        let sessionMessages = parseHistory(historyContent);
        let bestSession = '';
        let bestScore = 0;
        let bestMatchInfo = '';

        // Score workspace-filtered sessions (user messages + Claude responses)
        for (const [sessionId, userMessages] of sessionMessages) {
            const projectPath = sessionProjects.get(sessionId);
            const claudeResponses = projectPath ? getClaudeResponses(sessionId, projectPath) : [];
            const allMessages = [...userMessages, ...claudeResponses];
            const { score, info } = scoreSession(allMessages);
            if (score > bestScore) {
                bestScore = score;
                bestSession = sessionId;
                bestMatchInfo = info;
            }
        }

        // If no confident match from workspace filter, also try recent history
        // Claude may record a different project path if started from different cwd
        if (bestScore < 0.1) {
            logFn(`[claude-sync] Workspace filter score too low (${bestScore.toFixed(2)}), trying recent history`);
            try {
                const recentHistory = execSync(`tail -500 "${historyPath}"`, {
                    encoding: 'utf8',
                    timeout: 10000
                });
                const recentSessions = parseHistory(recentHistory);

                for (const [sessionId, userMessages] of recentSessions) {
                    const projectPath = sessionProjects.get(sessionId);
                    const claudeResponses = projectPath ? getClaudeResponses(sessionId, projectPath) : [];
                    const allMessages = [...userMessages, ...claudeResponses];
                    const { score, info } = scoreSession(allMessages);
                    if (score > bestScore) {
                        bestScore = score;
                        bestSession = sessionId;
                        bestMatchInfo = info;
                        logFn(`[claude-sync] Found better match in recent history: ${sessionId.slice(0, 8)}... (score=${score.toFixed(2)})`);
                    }
                }
            } catch {
                // Ignore
            }
        }

        if (sessionMessages.size === 0 && bestScore === 0) {
            logFn(`[claude-sync] No session messages found in history`);
            return null;
        }

        // Accept if score >= 0.1 (at least 1 exact match or 4+ phrase matches)
        // With additive scoring: exact=0.15, phrase=0.03
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
