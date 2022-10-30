/**
 * @template T
 * @param {T} obj
 * @param {string|undefined} key
 * @returns {(keyof T) | undefined}
 */
export function ensureIsKeyOf (obj, key) {
  return /** @type {keyof T} */ (key && Object.prototype.hasOwnProperty.call(obj, key) ? key : undefined)
}

/**
 * @param {unknown} value
 * @returns {value is { [key: string]: unknown }}
 */
export function ensureObject (value) {
  return !!(value && typeof value === 'object' && !Array.isArray(value))
}
