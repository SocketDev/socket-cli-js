#!/usr/bin/env node
// THIS FILE USES .cjs to get around the extension-free entrypoint problem with ESM
'use strict'
const { spawn } = require('child_process')
const { realpathSync } = require('fs')
const path = require('path')

const realFilename = realpathSync(__filename)
const realDirname = path.dirname(realFilename)

/**
 */
async function main () {
  const npmpath = await require('./link.cjs')(realDirname, 'npm')
  process.exitCode = 1
  const injectionpath = path.join(realDirname, 'npm-injection.cjs')
  // console.error(injectionpath)
  // process.exit(12)
  // console.log(process.execPath, '--require', injectionpath, npmpath, ...process.argv.slice(2))
  spawn(process.execPath, ['--require', injectionpath, npmpath, ...process.argv.slice(2)], {
    stdio: 'inherit'
  }).on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
    } else if (code !== null) {
      process.exit(code)
    }
  })
}
main()
