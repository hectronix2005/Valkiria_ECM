/**
 * Dev-only logger utility.
 * In production builds, all log calls are silenced to avoid leaking
 * internal details to the browser console.
 */
const isDev = import.meta.env.DEV

const noop = () => {}

export const logger = {
  error: isDev ? console.error.bind(console) : noop,
  warn: isDev ? console.warn.bind(console) : noop,
  log: isDev ? console.log.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  debug: isDev ? console.debug.bind(console) : noop,
}

export default logger
