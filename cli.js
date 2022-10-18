#!/usr/bin/env node
/* eslint-disable no-console */

import chalk from 'chalk'
import meow from 'meow'
import { messageWithCauses, stackWithCauses } from 'pony-cause'

const CLI_NAME = 'socket'

const CLI_COMMANDS = /** @type {const} */ {
  package: 'foo',
  project: 'bar',
}

/**
 * @param {Record<string,string>} list
 * @returns {string}
 */
const printHelpList = (list, indent = 4, padName = 18) => {
  const names = Object.keys(list).sort()

  let result = ''

  for (const name of names) {
    result += ''.padEnd(indent) + name.padEnd(padName) + list[name] + '\n'
  }

  return result.trim()
}

const cli = meow(`
  Usage
    $ ${CLI_NAME} <command>

  Runs one of the socket commands.

  Commands
    ${printHelpList(CLI_COMMANDS)}

  Options
    ${printHelpList({
      '--help': 'Print this help and exits.',
      '--version': 'Prints current version and exits.',
    })}

  Examples
    $ ${CLI_NAME} --help
`, {
  importMeta: import.meta
})

const [command, ...input] = cli.input

if (!command || !Object.prototype.hasOwnProperty.call(CLI_COMMANDS, command)) {
  cli.showHelp()
}
console.log('command!!', command)

try {
  // TODO: Use
} catch (err) {
  console.error(
    chalk.bgRed('Unexpected error:') +
    (err instanceof Error ? ' ' + messageWithCauses(err) + '\n\n' + stackWithCauses(err) : '') +
    '\n'
  )
  process.exit(1)
}
