#!/usr/bin/env node
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

import which from 'which'

// find npm being shadowed by this process
const npms = await which('npm', {
  all: true
})
const npmpath = npms.find(npmPath => npmPath !== fileURLToPath(import.meta.url))
if (!npmpath) {
  process.exit(127)
}

process.exitCode = 1
const injectionpath = fileURLToPath(new URL('../utils/npm-injection.cjs', import.meta.url))
spawn(process.execPath, ['--require', injectionpath, npmpath, ...process.argv.slice(2)], {
  stdio: 'inherit'
}).on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
  } else if (code !== null) {
    process.exit(code)
  }
})
