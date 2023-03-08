/* eslint-disable no-console */

import chalk from 'chalk'
import meow from 'meow'
import ora from 'ora'

import { outputFlags, validationFlags } from '../../flags/index.js'
import { handleApiCall, handleUnsuccessfulApiResponse } from '../../utils/api-helpers.js'
import { ChalkOrMarkdown } from '../../utils/chalk-markdown.js'
import { getSeverityCount, formatSeverityCount } from '../../utils/format-issues.js'
import { printFlagList } from '../../utils/formatting.js'
import { objectSome } from '../../utils/misc.js'
import { dryRun } from '../../utils/npm-wrapper.js'
import { setupSdk } from '../../utils/sdk.js'

/** @type {import('../../utils/meow-with-subcommands').CliSubcommand} */
export const install = {
  description: 'Look up info regarding a package',
  async run (argv, importMeta, { parentName }) {
    const name = parentName + ' install'

    const { packages } = setupCommand(name, install.description, argv, importMeta)
    console.log(`requesting effects for installing ${packages.join(' ')} from npm`)
    const packageData = await dryRun(packages)
    console.log('querying socket info for', packageData)
    return getDataForPackages(packageData)
  }
}

// Internal functions

/**
 * @typedef CommandContext
 * @property {string[]} packages
 */

/**
 * @param {string} name
 * @param {string} description
 * @param {readonly string[]} argv
 * @param {ImportMeta} importMeta
 * @returns {CommandContext}
 */
function setupCommand (name, description, argv, importMeta) {
  const flags = {
    ...outputFlags,
    ...validationFlags,
  }

  const cli = meow(`
    Usage
      $ ${name} <packages>

    Options
      ${printFlagList(flags, 6)}

    Examples
      $ ${name} webtorrent
      $ ${name} webtorrent@1.9.1
  `, {
    argv,
    description,
    importMeta,
    flags
  })

  return {
    packages: cli.input
  }
}

/**
 * @typedef PackageData
 * @property {import('@socketsecurity/sdk').SocketSdkReturnType<'getIssuesByNPMPackage'>["data"]} data
 * @property {Record<import('../../utils/format-issues').SocketIssue['severity'], number>} severityCount
 */

/**
 * @param {string[]} pkgs
 * @returns {Promise<void>}
 */
function getDataForPackages (pkgs) {
  if (pkgs.length) {
    let remaining = pkgs.length
    const spinner = ora(`Looking up data for ${remaining} packages`).start()
    return Promise.all(
      pkgs.map(async function (pkg) {
        const delimiter = pkg.lastIndexOf('@')
        const name = pkg.slice(0, delimiter)
        const version = pkg.slice(delimiter + 1)
        await fetchPackageData(name, version, spinner)
        remaining--
        if (remaining !== 0) {
          spinner.text = `Looking up data for ${remaining} packages`
        } else {
          spinner.succeed()
        }
        return ''
      })
    ).then(() => {})
  } else {
    ora('').succeed('No changes detected')
    return Promise.resolve()
  }
}

/**
 * @param {string} pkgName
 * @param {string} pkgVersion
 * @param {import('ora').Ora} spinner
 * @returns {Promise<void|PackageData>}
 */
async function fetchPackageData (pkgName, pkgVersion, spinner) {
  const includeAllIssues = false
  const strict = true
  const socketSdk = await setupSdk()
  const result = await handleApiCall(socketSdk.getIssuesByNPMPackage(pkgName, pkgVersion), spinner, 'looking up package')

  if (result.success === false) {
    return handleUnsuccessfulApiResponse('getIssuesByNPMPackage', result, spinner)
  }

  // Conclude the status of the API call

  const severityCount = getSeverityCount(result.data, includeAllIssues ? undefined : 'high')

  if (objectSome(severityCount)) {
    const issueSummary = formatSeverityCount(severityCount)
    spinner[strict ? 'fail' : 'succeed'](`Package version ${pkgVersion} of ${pkgName} has these issues: ${issueSummary}`)
  } else {
    // spinner.succeed('Package has no issues')
  }

  return {
    data: result.data,
    severityCount,
  }
}
