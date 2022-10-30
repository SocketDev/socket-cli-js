import meow from 'meow'

import { printFlagList } from '../../utils/formatting.js'
import { getAuthedSdk } from '../../utils/sdk.js'

const description = 'Create a project report'

/** @type {import('../../utils/meow-with-subcommands').CliSubcommandRun} */
const run = async (argv, importMeta, { parentName }) => {
  const name = parentName + ' create'

  // ...else provide basic instructions and help
  const cli = meow(`
    Usage
      $ ${name} <path-to-lock-file>

    Options
      ${printFlagList({
        // FIXME: Remove rainbow
        '--rainbow': 'Foobar'
      }, 6)}

    Examples
      $ ${name} --help
  `, {
    argv,
    description,
    importMeta,
    flags: {
      // FIXME: Remove rainbow
      rainbow: {
        type: 'boolean',
        alias: 'r'
      }
    }
  })

  // TODO: Remove
  console.log('LETS CREATE!', cli.flags, cli.input)

  const socketSdk = await getAuthedSdk()

  try {
    const result = await socketSdk.createReport()
    // TODO: Remove
    console.log('RESULT!', result)
  } catch (err) {
    // TODO: Remove
    console.log('err!', err)
  }
}

/** @type {import('../../utils/meow-with-subcommands').CliSubcommand} */
export const create = { description, run }
