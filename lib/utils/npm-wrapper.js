import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { isatty } from 'tty'

import which from 'which'

/**
 * @param {string[]} pkgSpecifiers
 * @returns {Promise<string[]>}
 */
export function dryRun (pkgSpecifiers) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--require',
      fileURLToPath(new URL('./npm-injection.cjs', import.meta.url)),
      which.sync('npm'),
      '--dry-run',
      '--progress=false',
      '--silent',
      // '--json',
      // '--loglevel=silly',
      '--ignore-scripts=true',
      '--fund=false',
      '--audit=false',
      'install',
      ...pkgSpecifiers
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
