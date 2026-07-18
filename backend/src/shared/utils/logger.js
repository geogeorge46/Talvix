export const logger = Object.freeze({
  info: (message) => console.info(message),
  warn: (message) => console.warn(message),
  error: (message, error) => console.error(message, error ?? ''),
});
