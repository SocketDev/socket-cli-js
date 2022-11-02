import isInteractive from 'is-interactive'
import prompts from 'prompts'

import { AuthError } from './errors.js'
import { SocketSdk } from './socket-sdk.js'

/**
 * @returns {Promise<import('./socket-sdk').SocketSdk>}
 */
export async function setupSdk () {
  let apiKey = process.env['SOCKET_SECURITY_API_KEY']

  if (!apiKey && isInteractive()) {
    const input = await prompts({
      type: 'password',
      name: 'apiKey',
      message: 'Enter your Socket.dev API key',
    })

    apiKey = input.apiKey
  }

  if (!apiKey) {
    throw new AuthError('You need to provide an API key')
  }

  /** @type {import('./socket-sdk').SocketSdkOptions["agent"]} */
  let agent

  if (process.env['SOCKET_SECURITY_API_PROXY']) {
    const { HttpProxyAgent, HttpsProxyAgent } = await import('hpagent')
    agent = {
      http: new HttpProxyAgent({ proxy: process.env['SOCKET_SECURITY_API_PROXY'] }),
      https: new HttpsProxyAgent({ proxy: process.env['SOCKET_SECURITY_API_PROXY'] }),
    }
  }

  /** @type {import('./socket-sdk.js').SocketSdkOptions} */
  const sdkOptions = {
    agent,
    baseUrl: process.env['SOCKET_SECURITY_API_BASE_URL'],
  }

  return new SocketSdk(apiKey || '', sdkOptions)
}
