import { FormData } from 'formdata-node'
import { fileFromPath } from 'formdata-node/file-from-path'
import got, { HTTPError } from 'got'
import { ErrorWithCause } from 'pony-cause'

import { ensureObject } from './type-helpers.js'

/**
 * @typedef SocketSdkOptions
 * @property {import('got').Agents} [agent]
 * @property {string} [baseUrl]
 */

/**
 * @template {keyof import('../types/api').operations} T
 * @typedef {import('../types/api-helpers').OpReturnType<import('../types/api').operations[T]>} SocketSdkReturnType
 */

/**
 * @template {keyof import('../types/api').operations} T
 * @typedef {import('../types/api-helpers').OpErrorType<import('../types/api').operations[T]>} SocketSdkErrorType
 */

/**
 * @template {keyof import('../types/api').operations} T
 * @typedef {SocketSdkReturnType<T> | SocketSdkErrorType<T>} SocketSdkResultType
 */

/** @type {SocketSdkResultType<'createReport'>} */
const foo = {
  success: false,
  status: 400,
  error: { message: 'Foobar' }
}

/** @type {SocketSdkResultType<'createReport'>} */
const bar = {
  success: true,
  status: 200,
  data: {
    id: '123',
    url: 'url'
  }
}

console.log(foo, bar)

export class SocketSdk {
   /** @type {import('got').Got} */
  #client

  /**
   * @param {string} apiKey
   * @param {SocketSdkOptions} options
   */
  constructor (apiKey, options = {}) {
    const {
      agent,
      baseUrl = 'https://api.socket.dev/v0/',
    } = options

    console.log('baseUrl', baseUrl)
    // FIXME: Handle rate limit! Seems like got is handling that now?
    // TODO: Add timeout
    // TODO: Add debug()

    this.#client = got.extend({
      prefixUrl: baseUrl,
      username: apiKey,
      ...(agent ? { agent } : {}),
    })
  }

  /**
   * @param {string[]} filePaths
   * @returns {Promise<SocketSdkResultType<'createReport'>>}
   */
   async createReportFromFilePaths (filePaths) {
    const body = new FormData()

    const files = await Promise.all(filePaths.map(filePath => fileFromPath(filePath)))

    for (let i = 0, length = files.length; i < length; i++) {
      const filePath = filePaths[i]
      if (filePath) {
        body.set(filePath, files[i])
      }
    }

    try {
      const data = await this.#client.put('report/upload', { body }).json()

      return {
        success: true,
        // TODO: It may not always be 200
        status: 200,
        data,
      }
    } catch (err) {
      if (err instanceof HTTPError) {
        return {
          success: false,
          status: /** @type {SocketSdkErrorType<'createReport'>["status"]} */ (parseInt(err.code)),
          error: /** @type {SocketSdkErrorType<'createReport'>["error"]} */ (getApiErrorDescription(err))
        }
      }

      throw new ErrorWithCause('Unexpected error when uploading report', { cause: err })
    }
  }
}

/**
 * @param {HTTPError} err
 * @returns {import('type-fest').JsonObject}
 */
function getApiErrorDescription (err) {
  /** @type {import('type-fest').JsonValue} */
  let rawBody

  try {
    rawBody = JSON.parse(/** @type {string} */ (err.response.body))
  } catch (cause) {
    throw new ErrorWithCause('Could not parse API error response', { cause })
  }

  const errorDescription = ensureObject(rawBody) ? rawBody['error'] : undefined

  if (!ensureObject(errorDescription)) {
    throw new Error('Invalid body on API error response')
  }

  return errorDescription
}
