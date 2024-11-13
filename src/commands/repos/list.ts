import chalk from 'chalk'
// @ts-ignore
import chalkTable from 'chalk-table'
import meow from 'meow'
import ora from 'ora'

import { commonFlags, outputFlags } from '../../flags'
import {
  handleApiCall,
  handleUnsuccessfulApiResponse
} from '../../utils/api-helpers'
import { AuthError } from '../../utils/errors'
import { printFlagList } from '../../utils/formatting'
import { getDefaultKey, setupSdk } from '../../utils/sdk'

import type { CliSubcommand } from '../../utils/meow-with-subcommands'
import type { Ora } from 'ora'

export const list: CliSubcommand = {
  description: 'List repositories in an organization',
  async run(argv, importMeta, { parentName }) {
    const name = `${parentName} list`
    const input = setupCommand(name, list.description, argv, importMeta)
    if (input) {
      const apiKey = getDefaultKey()
      if (!apiKey) {
        throw new AuthError(
          'User must be authenticated to run this command. To log in, run the command `socket login` and enter your API key.'
        )
      }
      const spinnerText = 'Listing repositories... \n'
      const spinner = ora(spinnerText).start()
      await listOrgRepos(input.orgSlug, input, spinner, apiKey)
    }
  }
}

const listRepoFlags: { [key: string]: any } = {
  sort: {
    type: 'string',
    shortFlag: 's',
    default: 'created_at',
    description: 'Sorting option'
  },
  direction: {
    type: 'string',
    default: 'desc',
    description: 'Direction option'
  },
  perPage: {
    type: 'number',
    shortFlag: 'pp',
    default: 30,
    description: 'Number of results per page'
  },
  page: {
    type: 'number',
    shortFlag: 'p',
    default: 1,
    description: 'Page number'
  }
}

// Internal functions

type CommandContext = {
  outputJson: boolean
  outputMarkdown: boolean
  orgSlug: string
  sort: string
  direction: string
  per_page: number
  page: number
}

function setupCommand(
  name: string,
  description: string,
  argv: readonly string[],
  importMeta: ImportMeta
): CommandContext | undefined {
  const flags: { [key: string]: any } = {
    ...commonFlags,
    ...listRepoFlags,
    ...outputFlags
  }
  const cli = meow(
    `
    Usage
      $ ${name} <org slug>

    Options
      ${printFlagList(flags, 6)}

    Examples
      $ ${name} FakeOrg
  `,
    {
      argv,
      description,
      importMeta,
      flags
    }
  )
  let showHelp = cli.flags['help']
  if (!cli.input[0]) {
    showHelp = true
    console.error(
      `${chalk.white.bgRed('Input error')}: Please provide an organization slug.`
    )
  }
  if (showHelp) {
    cli.showHelp()
    return
  }
  const { 0: orgSlug = '' } = cli.input
  return <CommandContext>{
    outputJson: cli.flags['json'],
    outputMarkdown: cli.flags['markdown'],
    orgSlug,
    sort: cli.flags['sort'],
    direction: cli.flags['direction'],
    page: cli.flags['page'],
    per_page: cli.flags['perPage']
  }
}

async function listOrgRepos(
  orgSlug: string,
  input: CommandContext,
  spinner: Ora,
  apiKey: string
): Promise<void> {
  const socketSdk = await setupSdk(apiKey)
  const result = await handleApiCall(
    socketSdk.getOrgRepoList(orgSlug, input),
    'listing repositories'
  )

  if (!result.success) {
    handleUnsuccessfulApiResponse('getOrgRepoList', result, spinner)
    return
  }

  spinner.stop()

  const options = {
    columns: [
      { field: 'id', name: chalk.magenta('ID') },
      { field: 'name', name: chalk.magenta('Name') },
      { field: 'visibility', name: chalk.magenta('Visibility') },
      { field: 'default_branch', name: chalk.magenta('Default branch') },
      { field: 'archived', name: chalk.magenta('Archived') }
    ]
  }

  console.log(chalkTable(options, result.data.results))
}
