// Commands module exports
// All command handlers for ImmorTerm

// Reconcile - register terminal in workspace storage
export { reconcileTerminal, type ReconcileResult } from './reconcile';

// Cleanup - remove stale terminal entries
export { cleanupStaleTerminals, type CleanupResult } from './cleanup';

// Forget - remove single terminal
export { forgetTerminal, type ForgetResult } from './forget';

// Forget All - remove all terminals for project
export { forgetAllTerminals, type ForgetAllResult } from './forget-all';

// Log Cleanup - manage log file sizes
export { cleanupLogs, type LogCleanupResult } from './log-cleanup';

// Kill All - kill all screen sessions for project
export { killAllScreenSessions, type KillAllResult } from './kill-all';

// Rename Terminal - rename via VS Code input box (Ctrl+Shift+R)
export { renameTerminal, type RenameTerminalResult } from './rename-terminal';
