// THIS MUST BE CJS TO WORK WITH --require
/* eslint-disable no-console */
'use strict'

const fs = require('fs')
const path = require('path')

const npmEntrypoint = fs.realpathSync(`${process.argv[1]}`)
/**
 * @param {string} filepath
 * @returns {string}
 */
function findRoot (filepath) {
  if (path.basename(filepath) === 'npm') {
    return filepath
  }
  const parent = path.dirname(filepath)
  if (parent === filepath) {
    process.exit(127)
  }
  return findRoot(parent)
}
const npmDir = findRoot(path.dirname(npmEntrypoint))
/**
 * @type {typeof import('@npmcli/arborist')}
 */
const Arborist = require(path.join(npmDir, 'node_modules', '@npmcli', 'arborist'))
const $Arborist_prototype_reify = Arborist.prototype.reify
/**
 * @typedef { Parameters<typeof $Arborist_prototype_reify> } ReifyParams
 */
/**
 * @this {InstanceType<typeof Arborist>}
 * @param {ReifyParams} args
 */
async function reify (...args) {
  // TODO: make this deal w/ any refactor to private fields by punching the class itself
  const dryRun = Object.getOwnPropertySymbols(this).filter(s => s.description === 'dryRun')[0]
  if (!dryRun) {
    throw new Error('socket npm: unsupported underlying npm version')
  }
  // @ts-ignore
  const oldDryRun = this[dryRun]
  // already doing dry run, no need to do anything
  if (oldDryRun) {
    return Reflect.apply($Arborist_prototype_reify, this, args)
  }
  // @ts-ignore
  this[dryRun] = true
  /**
   * @type {ReifyParams[0]}
   */
  const mutedArguments = {
    ...(args[0] ?? {}),
    // @ts-expect-error the types are wrong
    ignoreScripts: true,
    audit: false,
    fund: false
  }
  const result = await Reflect.apply($Arborist_prototype_reify, this, [mutedArguments, ...args.slice(1)])
  // @ts-ignore
  this[dryRun] = oldDryRun
  const diff = gatherDiff(this)
  // nothing to check, mmm already installed?
  if (diff.check.length === 0 && diff.unknowns.length === 0) {
    return result
  }
  const sdk = await import('./sdk.js')
  const client = await sdk.setupSdk('sktsec_t_--RAN5U4ivauy4w37-6aoKyYPDt5ZbaT5JBVMqiwKo_api')
  const isInteractive = (await import('is-interactive')).default()
  if (isInteractive) {
    const ora = (await import('ora')).default
    const risky = await packagesHaveRiskyIssues(diff.check.map(c => c.pkgid), client, ora)
    if (risky) {
      const rl = require('readline')
      const rli = rl.createInterface(process.stdin, process.stderr)
      while (true) {
        /**
         * @type {string}
         */
        const answer = await new Promise((resolve) => {
          rli.question('Accept Risks (y/N)?', (str) => resolve(str))
        })
        if (/^\s*y(es)?\s*$/i.test(answer)) {
          return Reflect.apply($Arborist_prototype_reify, this, args)
        } else if (/^\s*no?\s*$/i.test(answer)) {
          throw new Error('Socket npm exiting due to risks')
        }
      }
    }
  } else {
    throw new Error('Socket npm Unable to prompt to accept risk, need TTY to do so')
  }
}
// @ts-expect-error TS is confused
Arborist.prototype.reify = reify

/**
 * @param {InstanceType<typeof Arborist>} arb
 * @returns {{
 *   check: InstallEffect[],
 *   unknowns: InstallEffect[]
 * }}
 */
function gatherDiff (arb) {
  // TODO: make this support private registry complexities
  const registry = arb.registry
  /**
   * @type {InstallEffect[]}
   */
  const unknowns = []
  /**
   * @type {InstallEffect[]}
   */
  const check = []
  for (const node of walk(arb.diff)) {
    if (node.resolved?.startsWith(registry)) {
      check.push(node)
    } else {
      unknowns.push(node)
    }
  }
  return {
    check,
    unknowns
  }
}
/**
 * @typedef InstallEffect
 * @property {import('@npmcli/arborist').Diff['action']} action
 * @property {import('@npmcli/arborist').Node['pkgid']} pkgid
 * @property {import('@npmcli/arborist').Node['resolved']} resolved
 */
/**
 * @param {import('@npmcli/arborist').Diff | null} diff
 * @param {InstallEffect[]} needInfoOn
 * @returns {InstallEffect[]}
 */
function walk (diff, needInfoOn = []) {
  if (!diff) {
    return needInfoOn
  }

  if (diff.action) {
    const metaChange = diff.actual?.package.version === diff.ideal?.package.version
    let keep = false
    if (diff.action === 'CHANGE') {
      if (!metaChange) {
        keep = true
      } else {
        // console.log('SKIPPING META CHANGE ON', diff)
      }
    } else {
      keep = diff.action !== 'REMOVE'
    }
    if (keep) {
      if (diff.ideal?.pkgid) {
        needInfoOn.push({
          pkgid: diff.ideal.pkgid,
          action: diff.action,
          resolved: diff.ideal.resolved
        })
      }
    }
  }
  if (diff.children) {
    for (const child of diff.children) {
      walk(child, needInfoOn)
    }
  }
  return needInfoOn
}

/**
 * @param {string[]} pkgs
 * @param {import('@socketsecurity/sdk').SocketSdk} socketSdk
 * @param {import('ora')['default']} ora
 * @returns {Promise<boolean>}
 */
async function packagesHaveRiskyIssues (pkgs, socketSdk, ora) {
  let failed = false
  if (pkgs.length) {
    let remaining = pkgs.length
    /**
     *
     * @returns {string}
     */
    function getText () {
      return `Looking up data for ${remaining} packages`
    }
    const spinner = ora(getText()).start()
    const pkgDatas = []
    try {
      for (const pkg of pkgs) {
        const delimiter = pkg.lastIndexOf('@')
        const name = pkg.slice(0, delimiter)
        const version = pkg.slice(delimiter + 1)
        // console.error('FETCHING', name, version)
        const pkgData = await socketSdk.getIssuesByNPMPackage(name, version)
        if (!pkgData.success) {
          throw new Error('unable to obtain data from Socket API: ' + pkgData.error.message)
        }
        const failures = []
        for (const issue of pkgData.data) {
          if (issue.type) {
            /**
             * @type {string}
             */
            const type = issue.type
            if ([
              'shellScriptOverride',
              'gitDependency',
              'httpDependency',
              'installScripts',
              'malware',
              'didYouMean',
              'hasNativeCode',
              'troll',
              'telemetry',
              'invalidPackageJSON',
              'unresolvedRequire',
            ].includes(type)) {
              failed = true
              failures.push(issue)
            }
          }
        }
        if (failures.length) {
          spinner.stop()
          console.error(pkg, 'contains issues: ', failures.map(f => f.type).filter(Boolean))
          spinner.start()
        }
        // console.error('FETCHED', name, version)
        remaining--
        if (remaining !== 0) {
          spinner.text = getText()
        } else {
          spinner.stop()
        }
        pkgDatas.push(pkgData)
      }
      return failed
    } finally {
      if (spinner.isSpinning) {
        console.error('STOPPING')
        spinner.stop()
      }
    }
  } else {
    ora('').succeed('No changes detected')
    return false
  }
}
