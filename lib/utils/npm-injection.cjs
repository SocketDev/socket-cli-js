// THIS MUST BE CJS TO WORK WITH --require
// uses fd=3
'use strict'
const fs = require('fs')
const path = require('path')

/**
 * @typedef {import('@npmcli/arborist').Diff} Diff
 */
/**
 * @typedef {import('@npmcli/arborist').Node} ArboristNode
 */
/**
 * @typedef {(typeof import('@npmcli/arborist'))['Arborist']} Arborist
 */

process.env['DEBUG'] = ''
const npmEntrypoint = fs.realpathSync(`${process.argv[1]}`)
const reifyPath = path.join(npmEntrypoint, '..', '..', 'lib', 'utils', 'reify-finish.js')
// load module to patch
require(reifyPath)

/**
 * @typedef {{
 *  pkgid: ArboristNode['pkgid'],
 *  action: Diff['action'],
 *  resolved: ArboristNode['resolved']
 * }} InstallEffect
 */

/**
 * @type {InstallEffect[]}
 */
const needInfoOn = []
/**
 *
 * @param {import('npm')} npm
 * @param {Arborist} arb
 */
function reifyFinish (npm, arb) {
  walk(arb.diff)
  // TODO: make this support private registry complexities
  const registry = `${npm.config.get('registry')}`
  /**
   * @type {(typeof needInfoOn)[number][]}
   */
  const unknowns = []
  /**
   * @type {(typeof needInfoOn)[number][]}
   */
  const check = []
  for (const node of needInfoOn) {
    if (node.resolved?.startsWith(registry)) {
      check.push(node)
    } else {
      unknowns.push(node)
    }
  }
  try {
    fs.writeFileSync(3, JSON.stringify({
      unknowns,
      check
    }))
  } catch {
    // parent closed before us
  }
}
// @ts-expect-error
require.cache[reifyPath].exports = reifyFinish
/**
 *
 * @param {Diff | null} diff
 */
function walk (diff) {
  if (!diff) {
    return
  }

  if (diff.action) {
    const metaChange = diff.actual?.package.version === diff.ideal?.package.version
    let keep = false
    if (diff.action === 'CHANGE') {
      if (!metaChange) {
        keep = true
      } else {
        console.log('SKIPPING META CHANGE ON', diff)
      }
    } else {
      keep = true
    }
    if (keep) {
      needInfoOn.push({
        pkgid: diff.ideal.pkgid,
        action: diff.action,
        resolved: diff.ideal.resolved
      })
    }
  }
  if (diff.children) {
    for (const child of diff.children) {
      walk(child)
    }
  }
}
