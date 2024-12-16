import path from 'node:path'

import spawn from '@npmcli/promise-spawn'

import constants from '../constants'

import type { CliSubcommand } from '../utils/meow-with-subcommands'

const { abortSignal, execPath, rootBinPath } = constants

const description = 'npm wrapper functionality'

export const npm: CliSubcommand = {
  description,
  async run(argv, _importMeta, _ctx) {
    const wrapperPath = path.join(rootBinPath, 'npm-cli.js')
    process.exitCode = 1
    const spawnPromise = spawn(
      execPath,
      [
        // Lazily access constants.nodeNoWarningsFlags.
        ...constants.nodeNoWarningsFlags,
        wrapperPath,
        ...argv
      ],
      {
        signal: abortSignal,
        stdio: 'inherit'
      }
    )
    spawnPromise.process.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
      } else if (code !== null) {
        process.exit(code)
      }
    })
    await spawnPromise
  }
}
