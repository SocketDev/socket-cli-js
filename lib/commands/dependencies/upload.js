/* eslint-disable no-console */

import meow from 'meow'
import ora from 'ora'

import { outputFlags } from '../../flags/index.js'
import { handleApiCall, handleUnsuccessfulApiResponse } from '../../utils/api-helpers.js'
import { prepareFlags } from '../../utils/flags.js'
import { printFlagList } from '../../utils/formatting.js'
import { getDefaultKey, setupSdk } from '../../utils/sdk.js'

/** @type {import('../../utils/meow-with-subcommands.js').CliSubcommand} */
export const upload = {
  description: 'Upload dependency that is being used in your organization',
  async run (argv, importMeta, { parentName }) {
    const name = parentName + ' upload'

    const input = setupCommand(name, upload.description, argv, importMeta)
    if (input) {
      const spinnerText = 'Uploading dependencies...'
      const spinner = ora(spinnerText).start()
      await uploadDeps(input, spinner)
    }
  }
}

const dependenciesFlags = prepareFlags({
    repository: {
      type: 'string',
      shortFlag: 'r',
      default: '',
      description: 'Repository name',
    },
    branch: {
      type: 'string',
      shortFlag: 'b',
      default: '',
      description: 'Branch name',
    }
  })

// Internal functions

/**
 * @typedef Command
 * @property {boolean} outputJson
 * @property {boolean} outputMarkdown
 * @property {string} repository
 * @property {string} branch
 */

/**
 * @param {string} name
 * @param {string} description
 * @param {readonly string[]} argv
 * @param {ImportMeta} importMeta
 * @returns {void|Command}
 */
function setupCommand (name, description, argv, importMeta) {
  const flags = {
    ...outputFlags,
    ...dependenciesFlags
  }

  const cli = meow(`
    Usage
      $ ${name}

    Options
      ${printFlagList(flags, 6)}

    Examples
      $ ${name}
  `, {
    argv,
    description,
    importMeta,
    flags
  })

  const {
    json: outputJson,
    markdown: outputMarkdown,
    repository,
    branch
  } = cli.flags

  return {
    outputJson,
    outputMarkdown,
    repository,
    branch
  }
}

/**
 * @typedef DependenciesData
 * @property {import('@socketsecurity/sdk').SocketSdkReturnType<'createDependenciesSnapshot'>["data"]} data
 */

/**
 * @param {Command} input
 * @param {import('ora').Ora} spinner
 * @returns {Promise<void|DependenciesData>}
 */
//@ts-ignore
async function uploadDeps ({ repository, branch, outputJson }, spinner) {
  const socketSdk = await setupSdk(getDefaultKey())
  //@ts-ignore
  const result = await handleApiCall(socketSdk.createDependenciesSnapshot({}), 'Uploading dependencies')

  if (!result.success) {
    return handleUnsuccessfulApiResponse('createDependenciesSnapshot', result, spinner)
  }

  spinner.stop()

  if (outputJson) {
    return console.log(result.data)
  }

  return {
    data: result.data
  }
}
