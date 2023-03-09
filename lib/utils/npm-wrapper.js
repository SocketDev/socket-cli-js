import { spawn } from 'child_process'
import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

import which from 'which'

/**
 *
 * @param {string} cmd
 * @returns {string}
 */
export function deref (cmd) {
  const npmEntrypoint = fs.realpathSync(`${which.sync('npm')}`)
  let list
  const require = createRequire(import.meta.url)
  try {
    list = require(
      path.join(npmEntrypoint, '..', '..', 'lib', 'utils', 'cmd-list.js')
    )
  } catch {
    // older npm
    list = require(
      path.join(npmEntrypoint, '..', '..', 'lib', 'config', 'cmd-list.js')
    )
  }
  let value = list.abbrevs[cmd] ?? cmd
  while (list.aliases[value]) {
    value = list.aliases[value]
  }
  return value
}

/**
 * @param {string} cmd
 * @param {string[]} argv
 * @returns {Promise<string[]>}
 */
export function dryRun (cmd, argv) {
  const positionalIndex = argv.indexOf('--')
  // append to end if no positional delimiter
  // else make these last for priority
  let spliceIndex = argv.length
  if (positionalIndex > spliceIndex) {
    spliceIndex = positionalIndex
  }
  const clean = [...argv]
  clean.splice(spliceIndex, 0,
    '--dry-run',
    '--progress=false',
    '--silent',
    '--ignore-scripts=true',
    '--fund=false',
    '--audit=false'
  )
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--require',
      fileURLToPath(new URL('./npm-injection.cjs', import.meta.url)),
      which.sync('npm'),
      cmd,
      ...clean
    ], {
      stdio: [
        'inherit',
        'inherit',
        'inherit',
        'pipe'
      ],
      env: {
        ...process.env,
        DEBUG: ''
      }
    })
    const out = child.stdio[3]
    if (!out) {
      throw new Error('unable to spawn npm properly')
    }
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code !== 0) {
        reject(new Error('npm process exited with ' + (
          signal
            ? `signal ${signal}`
            : `code ${code}`
        )))
      }
    })
    /**
     * @type {Buffer[]}
     */
    const chunks = []
    out.on('error', reject)
    out.on('data', d => {
      chunks.push(d)
    })
    out.on('close', () => {
      try {
        /**
         * @typedef { import('./npm-injection.cjs').InstallEffect } InstallEffect
         */
        const src = Buffer.concat(chunks).toString('utf-8')
        if (src === '') {
          return
        }
        /**
         * @type {{
         *   check: InstallEffect[],
         *   unknowns: InstallEffect[]
         * }}
         */
        const results = JSON.parse(src)
        if (results.unknowns.length) {
          reject(new Error(`non-registry sourced packages are not supported, found: ${
            results.unknowns.map(
              un => `${un.pkgid} ( ${un.resolved} )`
            ).join(', ')
          }`))
        } else {
          resolve(
            results.check.map(c => c.pkgid)
          )
        }
      } catch (e) {
        reject(e)
      }
    })
  })
}
