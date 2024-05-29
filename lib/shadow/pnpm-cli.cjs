#!/usr/bin/env node
// THIS FILE USES .cjs to get around the extension-free entrypoint problem with ESM
'use strict'
const { spawn } = require('child_process')
const { realpathSync } = require('fs')
const fs = require('fs')
const path = require('path')

const realFilename = realpathSync(__filename)
const realDirname = path.dirname(realFilename)

/**
 */
async function main () {
    const pnpmpath = await require('./link.cjs')(path.join(realDirname, 'bin'), 'pnpm')
    process.exitCode = 1
    const injectionpath = path.join(realDirname, 'pnpm-injection.cjs')    
    const pnpmModulePath = `${process.env.PNPM_HOME}/global/5/.pnpm/pnpm@9.1.0/node_modules/pnpm/dist/pnpm.cjs`
  
    // require.cache[process.argv[1]] = { exports: {} } 
    // require.cache[pnpmModulePath] = { get exports() {console.log(123)} } 
    // require('module').Module.runMain = () => {}

    // Read module file
    // await fs.readFile(pnpmModulePath, 'utf-8' , (err, data) => {
    //   if (err) throw err;
    //   console.log(data);
    // });

    // Require the installed pnpm module
    require(pnpmModulePath)

    // spawn(process.execPath, ['--require', injectionpath, pnpmpath, ...process.argv.slice(2)], {
    // spawn(process.execPath, ['--require', injectionpath, pnpmModulePath, ...process.argv.slice(2)], {
    // spawn(process.execPath, ['--require', pnpmModulePath, ...process.argv.slice(2)], {
    //   stdio: 'inherit'
    // }).on('exit', (code, signal) => {
    //   if (signal) {
    //     process.kill(process.pid, signal)
    //   } else if (code !== null) {
    //     process.exit(code)
    //   }
    // })
  }
  main()