#!/usr/bin/env node
/* eslint-disable no-console */

import chalk from 'chalk'
import logSymbols from 'log-symbols'
import { messageWithCauses, stackWithCauses } from 'pony-cause'

import * as cliCommands from './lib/commands/index.js'
import { meowWithSubcommands } from './lib/utils/meow-with-subcommands.js'

// TODO: Add autocompletion using https://www.npmjs.com/package/omelette

try {
  await meowWithSubcommands(
    cliCommands,
    {
      argv: process.argv.slice(2),
      name: 'socket',
      importMeta: import.meta
    }
  )
} catch (err) {
  console.error(
    logSymbols.error + ' ' +
    chalk.white.bgRed('Unexpected error:') +
    (err instanceof Error ? ' ' + messageWithCauses(err) + '\n\n' + stackWithCauses(err) : ` ${logSymbols.warning} Unknown error`) +
    '\n'
  )
  process.exit(1)
}
