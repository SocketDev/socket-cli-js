import meow from 'meow'

import { printFlagList, printHelpList } from './formatting'
import { toSortedObject } from '@socketsecurity/registry/lib/objects'
import { commonFlags } from '../flags'

import type { Options } from 'meow'

interface CliAlias {
  description: string
  argv: readonly string[]
}

type CliAliases = Record<string, CliAlias>

type CliSubcommandRun = (
  argv: readonly string[],
  importMeta: ImportMeta,
  context: { parentName: string }
) => Promise<void> | void

export interface CliSubcommand {
  description: string
  run: CliSubcommandRun
}

interface MeowOptions extends Options<any> {
  aliases?: CliAliases
  argv: readonly string[]
  name: string
}

export async function meowWithSubcommands(
  subcommands: Record<string, CliSubcommand>,
  options: MeowOptions
): Promise<void> {
  const {
    aliases = {},
    argv,
    importMeta,
    name,
    ...additionalOptions
  } = { __proto__: null, ...options }
  const [commandOrAliasName, ...rawCommandArgv] = argv
  // If we got at least some args, then lets find out if we can find a command
  if (commandOrAliasName) {
    const alias = aliases[commandOrAliasName]
    // First: Resolve argv data from alias if its an alias that's been given
    const [commandName, ...commandArgv] = alias
      ? [...alias.argv, ...rawCommandArgv]
      : [commandOrAliasName, ...rawCommandArgv]
    // Second: Find a command definition using that data
    const commandDefinition = commandName ? subcommands[commandName] : undefined
    // Third: If a valid command has been found, then we run it...
    if (commandDefinition) {
      return await commandDefinition.run(commandArgv, importMeta, {
        parentName: name
      })
    }
  }
  const flags = {
    ...commonFlags,
    ...additionalOptions.flags
  }
  // ...else we provide basic instructions and help
  const cli = meow(
    `
    Usage
      $ ${name} <command>

    Commands
      ${printHelpList(
        {
          ...toSortedObject(subcommands),
          ...toSortedObject(aliases)
        },
        6
      )}

    Options
      ${printFlagList(flags, 6)}

    Examples
      $ ${name} --help
  `,
    {
      argv,
      importMeta,
      ...additionalOptions,
      flags
    }
  )
  cli.showHelp()
}
