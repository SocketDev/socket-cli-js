/* eslint-disable no-console */

import chalk from 'chalk'
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
    },
  })

// Internal functions

/**
 * @typedef Command
 * @property {boolean} outputMarkdown
 * @property {string} repository
 * @property {string} branch
 * @property {string[]} filePaths
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
    markdown: outputMarkdown,
    repository,
    branch
  } = cli.flags

  if (!repository || !branch) {
    console.error(`${chalk.white.bgRed('Input error')}: Please provide a repository name and branch name.`)
    cli.showHelp()
    return
  }

  const filePaths = cli.input

  if (!filePaths.length) {
    console.error(`${chalk.white.bgRed('Input error')}: Please provide file paths.`)
    cli.showHelp()
    return
  }

  return {
    outputMarkdown,
    repository,
    branch,
    filePaths
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
async function uploadDeps ({ repository, branch, filePaths }, spinner) {
  const socketSdk = await setupSdk(getDefaultKey())

  const result = await handleApiCall(socketSdk.createDependenciesSnapshot({ repository, branch }, filePaths), 'Uploading dependencies')

  if (!result.success) {
    return handleUnsuccessfulApiResponse('createDependenciesSnapshot', result, spinner)
  }

  spinner.stop()

  console.log('\n✅ Dependencies snapshot uploaded successfully \n')

  return {
    data: result.data
  }
}
