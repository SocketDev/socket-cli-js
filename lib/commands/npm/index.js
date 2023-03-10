import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const description = 'npm wrapper functionality'

/** @type {import('../../utils/meow-with-subcommands').CliSubcommand} */
export const npm = {
  description,
  run: async (argv, _importMeta, _ctx) => {
    const wrapperPath = fileURLToPath(new URL('../../shadow/npm-cli.js', import.meta.url))
    process.exitCode = 1
    const exit = spawnSync(process.execPath, [wrapperPath, ...argv], {
      stdio: 'inherit'
    })
    if (exit) {
      if (exit.signal) {
        process.kill(process.pid, exit.signal)
      } else if (exit.status !== null) {
        process.exit(exit.status)
      }
    }
  }
}
