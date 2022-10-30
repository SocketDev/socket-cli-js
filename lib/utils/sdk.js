import isInteractive from 'is-interactive'
import prompts from 'prompts'

export async function getAuthedSdk () {
  let apiKey = process.env['SOCKET_SECURITY_API_KEY']

  if (!apiKey && isInteractive()) {
    const input = await prompts({
      type: 'password',
      name: 'apiKey',
      message: `Enter your Socket.dev API key`,
    })

    apiKey = input.apiKey
  }

  if (!apiKey) {
    // FIXME: Throw a detailed error that is properly shown
    throw new Error('Missing API-key')
  }

  return {
    createReport: async () => {}
  }
}
