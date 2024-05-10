import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const description = 'pnpm wrapper functionality'

/** @type {import('../../utils/meow-with-subcommands').CliSubcommand} */
export const pnpm = {
  description,
  run: async (argv, _importMeta, _ctx) => {
    const wrapperPath = fileURLToPath(new URL('../../shadow/pnpm-cli.cjs', import.meta.url))
    process.exitCode = 1
    spawn(process.execPath, [wrapperPath, ...argv], {
      stdio: 'inherit'
    }).on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
      } else if (code !== null) {
        process.exit(code)
      }
    })
  }
}
