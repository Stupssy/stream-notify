// In-memory log buffer for real-time console streaming
interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "command" | "event";
  message: string;
}

const logBuffer: LogEntry[] = [];
const MAX_LOGS = 500; // Keep last 500 entries
let logIdCounter = 0;

// SSE clients - store callbacks instead of writers
interface SSEClient {
  id: number;
  send: (data: string) => void;
  onClose: () => void;
}

const sseClients = new Map<number, SSEClient>();
let clientIdCounter = 0;

export function addLog(level: LogEntry["level"], message: string): void {
  const entry: LogEntry = {
    id: ++logIdCounter,
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }

  // Broadcast to SSE clients
  broadcastLog(entry);
}

function broadcastLog(entry: LogEntry): void {
  const data = `data: ${JSON.stringify(entry)}\n\n`;

  for (const [, client] of sseClients) {
    try {
      client.send(data);
    } catch {
      client.onClose();
    }
  }
}

export function getRecentLogs(count: number = 100): LogEntry[] {
  return logBuffer.slice(-count);
}

export function registerSSEClient(send: (data: string) => void, onClose: () => void): number {
  const id = ++clientIdCounter;
  sseClients.set(id, { id, send, onClose });

  // Send recent history
  const recent = getRecentLogs(50);
  let history = "";
  for (const entry of recent) {
    history += `data: ${JSON.stringify(entry)}\n\n`;
  }
  
  // Send history in one go
  if (history) {
    send(history);
  }

  return id;
}

export function unregisterSSEClient(id: number): void {
  sseClients.delete(id);
}

// Wrap console methods to capture all output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = function(...args: any[]) {
  originalConsoleLog.apply(console, args);
  const message = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
  addLog("info", message);
};

console.warn = function(...args: any[]) {
  originalConsoleWarn.apply(console, args);
  const message = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
  addLog("warn", message);
};

console.error = function(...args: any[]) {
  originalConsoleError.apply(console, args);
  const message = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
  addLog("error", message);
};

// Helper for special event types
export function logCommand(command: string, user: string, details?: string): void {
  const message = details
    ? `/${command} by ${user}: ${details}`
    : `/${command} by ${user}`;
  addLog("command", message);
}

export function logEvent(event: string, details: string): void {
  addLog("event", `${event}: ${details}`);
}
