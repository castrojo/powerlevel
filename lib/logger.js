/**
 * Structured logging helper for Powerlevel plugin.
 * Wraps the OpenCode client.app.log() call with null-safety and a consistent shape.
 */

export function log(client, level, message) {
  if (!client?.app?.log) return;
  client.app.log({ body: { service: 'powerlevel', level, message } });
}

export function logInfo(client, message) { log(client, 'info', message); }
export function logWarn(client, message) { log(client, 'warn', message); }
export function logError(client, message) { log(client, 'error', message); }
export function logDebug(client, message) { log(client, 'debug', message); }
