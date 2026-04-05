/**
 * Structured JSON logger for API routes.
 *
 * Outputs JSON lines to stdout (CloudWatch Logs Insights compatible).
 * Each log includes timestamp, level, route, and message.
 *
 * Usage:
 *   import { logger } from "@/app/lib/logger";
 *   const log = logger("api/chat/conversation");
 *   log.info("Processing request", { turnNumber: 3 });
 *   log.error("Bedrock failed", { error: err });
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  route: string;
  message: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logger(route: string) {
  return {
    info(message: string, data?: Record<string, unknown>) {
      emit({ timestamp: new Date().toISOString(), level: "info", route, message, ...data });
    },
    warn(message: string, data?: Record<string, unknown>) {
      emit({ timestamp: new Date().toISOString(), level: "warn", route, message, ...data });
    },
    error(message: string, data?: Record<string, unknown>) {
      // Extract error message safely (don't log full stack to CloudWatch)
      const cleaned = data ? { ...data } : {};
      if (cleaned.error instanceof Error) {
        cleaned.error = { name: cleaned.error.name, message: cleaned.error.message };
      }
      emit({ timestamp: new Date().toISOString(), level: "error", route, message, ...cleaned });
    },
  };
}
