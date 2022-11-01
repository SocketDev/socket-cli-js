/* eslint-disable no-console */
import chalk from 'chalk'
import meow from 'meow'
import ora from 'ora'
import { ErrorWithCause } from 'pony-cause'

import { ChalkOrMarkdown } from '../../utils/chalk-markdown.js'
import { AuthError } from '../../utils/errors.js'
import { printFlagList } from '../../utils/formatting.js'
import { setupSdk } from '../../utils/sdk.js'

const description = 'Create a project report'

/** @type {import('../../utils/meow-with-subcommands').CliSubcommandRun} */
const run = async (argv, importMeta, { parentName }) => {
  const name = parentName + ' create'

  const cli = meow(`
    Usage
      $ ${name} <path-to-package-json>

    Options
      ${printFlagList({
        '--json': 'Output result as json',
        '--markdown': 'Output result as markdown',
      }, 6)}

    Examples
      $ ${name} .
  `, {
    argv,
    description,
    importMeta,
    // TODO: Add a --verbose?
    flags: {
      json: {
        type: 'boolean',
        alias: 'j',
      },
      markdown: {
        type: 'boolean',
        alias: 'm',
      },
    }
  })

  const {
    json: outputJson,
    markdown: outputMarkdown,
  } = cli.flags

  const socketSdk = await setupSdk()

  const spinner = ora('Creating report').start()

  /** @type {Awaited<ReturnType<typeof socketSdk.createReportFromFilePaths>>} */
  let result

  try {
    // FIXME: Take files from input?
    result = await socketSdk.createReportFromFilePaths(['package.json'])
  } catch (cause) {
    spinner.fail()
    throw new ErrorWithCause('Failed creating report', { cause })
  }

  if (result.success === false) {
    if (result.status === 401 || result.status === 403) {
      spinner.stop()
      throw new AuthError(result.error.message)
    }
    spinner.fail(chalk.white.bgRed('API returned an error:') + ' ' + result.error.message)
    process.exit(1)
  }

  spinner.stop()

  if (outputJson) {
    console.log(JSON.stringify(result.data, undefined, 2))
    return
  }

  const format = new ChalkOrMarkdown(!!outputMarkdown)

  console.log(format.header(format.logSymbols.success + ' Report created'))
  console.log('New report: ' + format.hyperlink(result.data.id, result.data.url, { fallbackToUrl: true }))
}

/** @type {import('../../utils/meow-with-subcommands').CliSubcommand} */
export const create = { description, run }
