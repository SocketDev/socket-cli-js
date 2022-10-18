#!/usr/bin/env node
/* eslint-disable no-console */

import chalk from 'chalk'
import { messageWithCauses, stackWithCauses } from 'pony-cause'

import * as cliCommands from './lib/commands/index.js'
import { meowWithSubcommands } from './lib/utils/meow-with-subcommands.js'

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
    chalk.bgRed('Unexpected error:') +
    (err instanceof Error ? ' ' + messageWithCauses(err) + '\n\n' + stackWithCauses(err) : '') +
    '\n'
  )
  process.exit(1)
}
