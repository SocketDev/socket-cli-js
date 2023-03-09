/* eslint-disable no-console */

import { spawn } from 'child_process'
import { createInterface } from 'readline'

import meow from 'meow'
import ora from 'ora'
import pAll from 'p-all'

import { handleApiCall, handleUnsuccessfulApiResponse } from '../../utils/api-helpers.js'
import { ChalkOrMarkdown } from '../../utils/chalk-markdown.js'
import { getSeverityCount, formatSeverityCount } from '../../utils/format-issues.js'
import { printFlagList } from '../../utils/formatting.js'
import { objectSome } from '../../utils/misc.js'
import { deref, dryRun } from '../../utils/npm-wrapper.js'
import { setupSdk } from '../../utils/sdk.js'

const description = 'npm wrapper functionality'

/** @type {import('../../utils/meow-with-subcommands').CliSubcommand} */
export const npm = {
  description,
  run: async (argv, importMeta, { parentName }) => {
    const name = `${parentName} npm`
    /**
     * @type {Record<string, any>}
     */
    const flags = {}
    const cli = meow(`
      Usage
        $ ${name}

      Options
        ${printFlagList(flags, 6)}

      Examples
        $ ${name} install webtorrent
        $ ${name} install webtorrent@1.9.1
        $ ${name} update next
    `, {
      argv,
      description,
      importMeta,
      flags
    })
    if (cli.input.length === 0) {
      process.exit(0)
    }
    /**
     * @type {string}
     */
    // @ts-ignore
    const cmd = deref(cli.input[0])
    if (cmd === 'install') {
      runWrappedNPM('install', argv.slice(1))
    } else if (cmd === 'update') {
      runWrappedNPM('update', argv.slice(1))
    } else {
      process.exitCode = 1
      spawn('npm', argv, {
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
}

/**
 * @typedef {import('@socketsecurity/sdk').SocketSdk} SocketSdk
 */
/**
 * @param {string} cmd
 * @param {string[]} argv
 */
async function runWrappedNPM (cmd, argv) {
  const spinner = ora(`requesting effects for ${argv.join(' ')} from npm ${cmd}`).info()
  const packageData = await dryRun(cmd, argv)
  spinner.info('querying socket info on packages')
  let result
  try {
    result = await getDataForPackages(packageData)
  } catch (e) {
    console.error(e)
  }
  let failed = false
  for (const item of result) {
    if (item) {
      for (const issue of item.data) {
        if (!issue.type) {
          continue
        }
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
        }
      }
    }
  }
  let accepted
  if (failed) {
    const readline = createInterface(process.stdin, process.stderr)
    accepted = await new Promise((resolve) => {
      readline.question('Accept all risks (y/N)? ', (answer) => {
        if (answer === 'y') {
          resolve(true)
        } else {
          resolve(false)
        }
      })
    }).finally(() => {
      readline.close()
    })
  } else {
    accepted = true
  }
  if (accepted === true) {
    process.exitCode = 1
    spawn('npm', [cmd, ...argv], {
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

// Internal functions

/**
 * @typedef PackageData2
 * @property {import('@socketsecurity/sdk').SocketSdkReturnType<'getIssuesByNPMPackage'>["data"]} data
 * @property {Record<import('../../utils/format-issues').SocketIssue['severity'], number>} severityCount
 * @property {boolean} fail
 */

/**
 * @param {string[]} pkgs
 * @returns {Promise<(void | PackageData2)[]>}
 */
function getDataForPackages (pkgs) {
  if (pkgs.length) {
    return setupSdk().then((socketSdk) => {
      let remaining = pkgs.length
      /**
       *
       * @returns {string}
       */
      function getText () {
        return `Looking up data for ${remaining} packages`
      }
      let spinner = ora(getText()).start()
      /**
       *
       * @param {(spinnger: import('ora').Ora) => void} fn
       */
      function consumeSpinner (fn) {
        try {
          fn(spinner)
        } catch (e) {
          console.error(e)
        }
        spinner.render()
        spinner.stop()
        spinner = ora(getText()).start()
      }
      return pAll(
        pkgs.map(function (pkg) {
          return async () => {
            const delimiter = pkg.lastIndexOf('@')
            const name = pkg.slice(0, delimiter)
            const version = pkg.slice(delimiter + 1)
            // console.error('FETCHING', name, version)
            const pkgData = await fetchPackageData(socketSdk, name, version, consumeSpinner)
            // console.error('FETCHED', name, version)
            remaining--
            if (remaining !== 0) {
              spinner.text = getText()
            } else {
              spinner.stop()
            }
            return pkgData
          }
        }),
        {
          stopOnError: true,
          concurrency: 1
        }
      ).finally(() => {
        if (spinner.isSpinning) {
          console.error('STOPPING')
          spinner.stop()
        }
      })
    })
  } else {
    ora('').succeed('No changes detected')
    return Promise.resolve([])
  }
}

/**
 * @param {SocketSdk} socketSdk
 * @param {string} pkgName
 * @param {string} pkgVersion
 * @param {(fn: (spinner: import('ora').Ora) => void) => void} consumeSpinner
 * @returns {Promise<void|PackageData2>}
 */
async function fetchPackageData (socketSdk, pkgName, pkgVersion, consumeSpinner) {
  const includeAllIssues = false
  const strict = true
  const result = await handleApiCall(socketSdk.getIssuesByNPMPackage(pkgName, pkgVersion), null, 'looking up package')
  // console.log({ result })

  if (result.success === false) {
    consumeSpinner(spinner => {
      handleUnsuccessfulApiResponse('getIssuesByNPMPackage', result, spinner)
    })
    process.exit(1)
  }

  // Conclude the status of the API call

  const severityCount = getSeverityCount(result.data, includeAllIssues ? undefined : 'high')

  let fail = false
  if (objectSome(severityCount)) {
    fail = strict
    const issueSummary = formatSeverityCount(severityCount)
    const format = new ChalkOrMarkdown(false)
    consumeSpinner((spinner) => {
      if (fail) {
        spinner[fail ? 'fail' : 'succeed'](`Package version ${pkgVersion} of ${
          format.hyperlink(pkgName, `https://socket.dev/npm/package/${pkgName}/issues/${pkgVersion}`)
        } has these issues: ${issueSummary}`)
      }
    })
  } else {
    // consumeSpinner((spinner) => {
    //   spinner.succeed(`Package ${pkgName}@${pkgVersion} has no issues`)
    // })
  }

  return {
    fail,
    data: result.data,
    severityCount,
  }
}
