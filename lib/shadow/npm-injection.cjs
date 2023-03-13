// THIS MUST BE CJS TO WORK WITH --require
/* eslint-disable no-console */
'use strict'

const fs = require('fs')
const path = require('path')

require('./link.cjs')(fs.realpathSync(__dirname), 'npm')

// process.exit(12)

/**
 * @type {import('./translations.json') | null}
 */
let translations = null
/**
 * @type {import('../utils/chalk-markdown.js').ChalkOrMarkdown | null}
 */
let formatter = null

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
const arboristLibClassPath = path.join(npmDir, 'node_modules', '@npmcli', 'arborist', 'lib', 'arborist', 'index.js')
/**
 * @type {typeof import('@npmcli/arborist')}
 */
const Arborist = require(arboristLibClassPath)

const kCtorArgs = Symbol('ctorArgs')
const kRiskyReify = Symbol('riskyReify')
class SafeArborist extends Arborist {
  /**
   * @param {ConstructorParameters<typeof Arborist>} ctorArgs
   */
  constructor (...ctorArgs) {
    if (ctorArgs?.[0]?.dryRun) {
      // @ts-ignore
      return new Arborist(...ctorArgs)
    }
    const mutedArguments = [{
      ...(ctorArgs[0] ?? {}),
      dryRun: true,
      ignoreScripts: true,
      save: false,
      saveBundle: false,
      audit: false,
      // progress: false,
      fund: false
    }, ctorArgs.slice(1)]
    super(...mutedArguments)
    this[kCtorArgs] = ctorArgs
  }

  /**
   * @param {Parameters<InstanceType<typeof Arborist>['reify']>} args
   * @override
   */
  [kRiskyReify] (...args) {
    const arb = new Arborist(...this[kCtorArgs])
    return arb.reify(...args)
  }

  /**
   * @param {Parameters<InstanceType<typeof Arborist>['reify']>} args
   * @override
   */
  async reify (...args) {
    // @ts-expect-error types are wrong
    if (args[0]?.dryRun) {
      return this[kRiskyReify](...args)
    }
    args[0] ??= {}
    const old = { ...args[0] }
    // @ts-expect-error types are wrong
    args[0].dryRun = true
    args[0].save = false
    args[0].saveBundle = false
    // const originalDescriptors = Object.getOwnPropertyDescriptors(this)
    // TODO: make this deal w/ any refactor to private fields by punching the class itself
    await super.reify(...args)
    const diff = gatherDiff(this)
    // @ts-expect-error types are wrong
    args[0].dryRun = old.dryRun
    // @ts-expect-error types are wrong
    args[0].save = old.save
    // @ts-expect-error types are wrong
    args[0].saveBundle = old.saveBundle
    // nothing to check, mmm already installed?
    if (diff.check.length === 0 && diff.unknowns.length === 0) {
      return this[kRiskyReify](...args)
    }
    const sdk = await import('../utils/sdk.js')
    const client = await sdk.setupSdk('sktsec_t_--RAN5U4ivauy4w37-6aoKyYPDt5ZbaT5JBVMqiwKo_api')
    const isInteractive = (await import('is-interactive')).default()
    if (isInteractive) {
      const ora = (await import('ora')).default
      const risky = true || await packagesHaveRiskyIssues(diff.check.map(c => c.pkgid), client, ora)
      if (risky) {
        const rl = require('readline')
        const rli = rl.createInterface(process.stdin, process.stderr)
        while (true) {
          /**
           * @type {string}
           */
          const answer = await new Promise((resolve) => {
            rli.question('Accept risks of installing these packages (y/N)? ', (str) => resolve(str))
          })
          if (/^\s*y(es)?\s*$/i.test(answer)) {
            break
          } else if (/^\s*no?\s*$/i.test(answer)) {
            throw new Error('Socket npm exiting due to risks')
          }
        }
      }
      debugger
      return this[kRiskyReify](...args)
    } else {
      throw new Error('Socket npm Unable to prompt to accept risk, need TTY to do so')
    }
  }
}
// @ts-ignore
require.cache[arboristLibClassPath].exports = SafeArborist

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
 * @property {import('@npmcli/arborist').Node['location']} location
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
    const sameVersion = diff.actual?.package.version === diff.ideal?.package.version
    let keep = false
    if (diff.action === 'CHANGE') {
      if (!sameVersion) {
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
          action: diff.action,
          location: diff.ideal.location,
          pkgid: diff.ideal.pkgid,
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
          translations ??= JSON.parse(fs.readFileSync(path.join(__dirname, '/translations.json'), 'utf-8'))
          formatter ??= new ((await import('../utils/chalk-markdown.js')).ChalkOrMarkdown)(false)
          console.error(`${formatter.hyperlink(pkg, `https://socket.dev/npm/package/${name}/overview/${version}`)} contains risks:`)
          if (translations) {
            for (const failure of failures) {
              const type = failure.type
              if (type) {
                const issueTypeTranslation = translations.issues[type]
                // TODO: emoji seems to misalign terminals sometimes
                // @ts-ignore
                const msg = `  - ${issueTypeTranslation.description}`
                console.error(msg)
              }
            }
          }
          spinner.start()
        }
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
        spinner.stop()
      }
    }
  } else {
    ora('').succeed('No changes detected')
    return false
  }
}
