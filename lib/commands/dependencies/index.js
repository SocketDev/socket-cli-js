import { search } from './search.js'
import { upload } from './upload.js'
import { meowWithSubcommands } from '../../utils/meow-with-subcommands.js'

const description = 'Dependencies related commands'

/** @type {import('../../utils/meow-with-subcommands.js').CliSubcommand} */
export const dependencies = {
  description,
  run: async (argv, importMeta, { parentName }) => {
    await meowWithSubcommands(
      {
        search,
        upload
      },
      {
        argv,
        description,
        importMeta,
        name: parentName + ' dependencies',
      }
    )
  }
}
