'use strict'

/**
 * @typedef SocketCliJsCommands
 * @property {import('./lib/commands/report/create.js').createReport} createReport
 */

/**
 * @typedef SocketCliJsHelpers
 * @property {import('./lib/utils/path-resolve.js').getPackageFiles} getPackageFiles
 */

/** @returns {Promise<SocketCliJsCommands>} */
async function getCommands () {
  const [
    { createReport }
  ] = await Promise.all([
    import('./lib/commands/report/create.js'),
  ])

  return {
    createReport,
  }
}

/** @returns {Promise<SocketCliJsHelpers>} */
async function getHelpers () {
  const [
    { getPackageFiles }
  ] = await Promise.all([
    import('./lib/utils/path-resolve.js')
  ])

  return {
    getPackageFiles
  }
}

module.exports = {
  getCommands,
  getHelpers
}
