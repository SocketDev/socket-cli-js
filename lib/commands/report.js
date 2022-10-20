import { meowWithSubcommands } from '../utils/meow-with-subcommands.js'

const description = 'Create a project report'

/** @type {import('../utils/meow-with-subcommands').CliSubcommand} */
export const report = {
  description,
  run: async (argv, importMeta, { parentName }) => {
    await meowWithSubcommands(
      {
        create: { description: '', run: (argv) => {
          console.log('HI!', argv)
        } },
        view: { description: '', run: () => {} },
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
