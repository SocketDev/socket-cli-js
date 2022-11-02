/**
 * @param {boolean|undefined} printDebugLogs
 * @returns {typeof console.error}
 */
export function createDebugLogger (printDebugLogs) {
  if (printDebugLogs) {
    // eslint-disable-next-line no-console
    return console.error.bind(console)
  }
  return () => {}
}
