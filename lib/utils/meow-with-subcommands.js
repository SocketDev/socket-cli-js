import meow from 'meow'

import { printHelpList } from './formatting.js'
import { ensureIsKeyOf } from './type-helpers.js'

/**
 * @callback CliSubcommandRun
 * @param {readonly string[]} argv
 * @param {ImportMeta} importMeta
 * @param {{ parentName: string }} context
 * @returns {Promise<void>|void}
 */

/**
 * @typedef CliSubcommand
 * @property {string} description
 * @property {CliSubcommandRun} run
 */

/**
 * @template {import('meow').AnyFlags} Flags
 * @param {Record<string, CliSubcommand>} subcommands
 * @param {import('meow').Options<Flags> & { argv: readonly string[], name: string }} options
 */
export async function meowWithSubcommands (subcommands, options) {
  const {
    argv,
    name,
    importMeta,
    ...additionalOptions
  } = options
  const [rawCommandName, ...commandArgv] = argv

  const commandName = ensureIsKeyOf(subcommands, rawCommandName)
  const command = commandName ? subcommands[commandName] : undefined

  // If a valid command has been specified, run it...
  if (command) {
    return await command.run(
      commandArgv,
      importMeta,
      {
        parentName: name
      }
    )
  }

  // ...else provide basic instructions and help
  const cli = meow(`
    Usage
      $ ${name} <command>

    Commands
      ${printHelpList(subcommands, 6)}

    Options
      ${printHelpList({
        '--help': 'Print this help and exits.',
        '--version': 'Prints current version and exits.',
      }, 6)}

    Examples
      $ ${name} --help
  `, {
    argv,
    importMeta,
    ...additionalOptions,
  })

  cli.showHelp()
}
