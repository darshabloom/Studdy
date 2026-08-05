export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

/**
 * Structured console logger. The observability provider is deliberately
 * unselected (Technical Architecture §25) — this interface is the stable
 * contract; the implementation is swappable without touching call sites.
 */
export function createLogger(bindings: Record<string, unknown> = {}): Logger {
  const emit = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...bindings,
      ...context,
    };
    console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
  };
  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
    child: (childBindings) => createLogger({ ...bindings, ...childBindings }),
  };
}
