/* eslint-disable no-console */
// THIS MUST BE CJS TO WORK WITH --require
'use strict'

// const path = require('path')

// try {
//   // due to update-notifier pkg being ESM only we actually spawn a subprocess sadly
// //   require('child_process').spawnSync(process.execPath, [
// //     path.join(__dirname, 'update-notifier.mjs')
// //   ], {
// //     stdio: 'inherit'
// //   })
// } catch (e) {
//   // ignore if update notification fails
// }

// require.cache[process.argv[1]] = { exports: {} } 

const pnpmInjection = async (depGraph) => {
    if (process.env.SOCKET_PNPM_WRAPPER) {    

    }
}

const dryRun = Boolean(process.env.SOCKET_PNPM_WRAPPER)

module.exports = {
    pnpmInjection,
    dryRun
}