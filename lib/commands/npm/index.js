import { install } from './install.js'
import { meowWithSubcommands } from '../../utils/meow-with-subcommands.js'

const description = 'npm related commands'

/** @type {import('../../utils/meow-with-subcommands').CliSubcommand} */
export const npm = {
  description,
  run: async (argv, importMeta, { parentName }) => {
    await meowWithSubcommands(
      {
        install,
      },
      {
        argv,
        description,
        importMeta,
        name: parentName + ' report',
      }
    )
  }
}
