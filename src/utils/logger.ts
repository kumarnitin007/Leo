/**
 * Logger Utility
 * 
 * Centralized logging with environment-aware output.
 * - Development: Full logging with colors and context
 * - Production: Errors only, no sensitive data
 * 
 * CR-008: Create Logger Utility
 * SEC-003: Remove Debug Logging in Production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  prefix?: string;
  enabled?: boolean;
}

const isDev = import.meta.env.DEV;
const isTest = import.meta.env.MODE === 'test';

// Log level colors for dev console
const COLORS = {
  debug: '#6b7280', // gray
  info: '#3b82f6',  // blue
  warn: '#f59e0b',  // amber
  error: '#ef4444', // red
};

// Emojis for visual scanning
const ICONS = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

class Logger {
  private prefix: string;
  private enabled: boolean;

  constructor(config: LoggerConfig = {}) {
    this.prefix = config.prefix || '';
    this.enabled = config.enabled ?? true;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    if (isTest) return false;
    
    // In production, only log errors
    if (!isDev && level !== 'error') return false;
    
    return true;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const prefix = this.prefix ? `[${this.prefix}]` : '';
    return `${ICONS[level]} ${prefix} ${message}`;
  }

  /**
   * Debug level - only in development
   * Use for detailed debugging info, state changes, etc.
   */
  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('debug')) return;
    console.debug(
      `%c${this.formatMessage('debug', message)}`,
      `color: ${COLORS.debug}`,
      ...args
    );
  }

  /**
   * Info level - only in development
   * Use for general information, flow tracking
   */
  info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('info')) return;
    console.info(
      `%c${this.formatMessage('info', message)}`,
      `color: ${COLORS.info}`,
      ...args
    );
  }

  /**
   * Warn level - only in development
   * Use for potential issues, deprecations
   */
  warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('warn', message), ...args);
  }

  /**
   * Error level - always logged
   * Use for actual errors that need attention
   */
  error(message: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    // Errors always logged (even in production)
    console.error(this.formatMessage('error', message), ...args);
  }

  /**
   * Group logs together (dev only)
   */
  group(label: string): void {
    if (!isDev) return;
    console.group(this.prefix ? `[${this.prefix}] ${label}` : label);
  }

  /**
   * End log group (dev only)
   */
  groupEnd(): void {
    if (!isDev) return;
    console.groupEnd();
  }

  /**
   * Log with timing (dev only)
   */
  time(label: string): void {
    if (!isDev) return;
    console.time(this.prefix ? `[${this.prefix}] ${label}` : label);
  }

  /**
   * End timing (dev only)
   */
  timeEnd(label: string): void {
    if (!isDev) return;
    console.timeEnd(this.prefix ? `[${this.prefix}] ${label}` : label);
  }

  /**
   * Create a child logger with a sub-prefix
   */
  child(subPrefix: string): Logger {
    const newPrefix = this.prefix ? `${this.prefix}:${subPrefix}` : subPrefix;
    return new Logger({ prefix: newPrefix, enabled: this.enabled });
  }
}

// Pre-configured loggers for different modules
export const logger = new Logger();

// Create module-specific loggers
export const createLogger = (prefix: string): Logger => new Logger({ prefix });

// Convenience exports for common modules
export const storageLogger = createLogger('Storage');
export const authLogger = createLogger('Auth');
export const safeLogger = createLogger('Safe');
export const encryptionLogger = createLogger('Encryption');
export const sharingLogger = createLogger('Sharing');
export const voiceLogger = createLogger('Voice');
export const apiLogger = createLogger('API');

export default logger;
