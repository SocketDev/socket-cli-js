/**
 * @template T
 * @param {T} obj
 * @param {string|undefined} key
 * @returns {(keyof T) | undefined}
 */
export function ensureIsKeyOf (obj, key) {
  return /** @type {keyof T} */ (key && Object.prototype.hasOwnProperty.call(obj, key) ? key : undefined)
}
