import path from 'node:path'

import { FormData } from 'formdata-node'
import { fileFromPath } from 'formdata-node/file-from-path'
import got, { HTTPError } from 'got'
import { ErrorWithCause } from 'pony-cause'

import { ensureObject } from './type-helpers.js'

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

/**
 * @typedef SocketSdkOptions
 * @property {import('got').Agents} [agent]
 * @property {string} [baseUrl]
 */

export class SocketSdk {
   /** @type {import('got').Got} */
  #client

  /**
   * @param {string} apiKey
   * @param {SocketSdkOptions} options
   * @throws {SocketSdkAuthError}
   */
  constructor (apiKey, options = {}) {
    const {
      agent,
      baseUrl = 'https://api.socket.dev/v0/',
    } = options

    // FIXME: Handle rate limit! Seems like got is handling that now?
    // TODO: Add timeout
    // TODO: Add debug() and/or take a logging function

    this.#client = got.extend({
      prefixUrl: baseUrl,
      username: apiKey,
      ...(agent ? { agent } : {}),
    })
  }

  /**
   * @param {string[]} filePaths
   * @param {string} pathsRelativeTo
   * @returns {Promise<SocketSdkResultType<'createReport'>>}
   */
   async createReportFromFilePaths (filePaths, pathsRelativeTo = '.') {
    const basePath = path.resolve(process.cwd(), pathsRelativeTo)
    const absoluteFilePaths = filePaths.map(filePath => path.resolve(basePath, filePath))

    const body = new FormData()

    const files = await Promise.all(absoluteFilePaths.map(absoluteFilePath => fileFromPath(absoluteFilePath)))

    for (let i = 0, length = files.length; i < length; i++) {
      const absoluteFilePath = absoluteFilePaths[i]
      if (absoluteFilePath) {
        const relativeFilePath = path.relative(basePath, absoluteFilePath)
        body.set(relativeFilePath, files[i])
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
          status: /** @type {SocketSdkErrorType<'createReport'>["status"]} */ (err.response.statusCode),
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
