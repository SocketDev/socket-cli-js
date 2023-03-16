const { chmodSync, realpathSync } = require('fs')
const path = require('path')

const which = require('which')

/**
 * @param {string} realDirname
 * @param {'npm' | 'npx'} binname
 * @returns {string} path to npm cli / npx bin
 */
function installLinks (realDirname, binname) {
  const realNpmShadowFilename = path.join(realDirname, `${binname}-cli.cjs`)
  // find npm being shadowed by this process
  const npms = which.sync(binname, {
    all: true
  })
  let shadowIndex = -1
  const npmpath = npms.find((npmPath, i) => {
    const isShadow = realpathSync(npmPath) === realNpmShadowFilename
    if (isShadow) {
      shadowIndex = i
    }
    return !isShadow
  })
  if (!npmpath) {
    process.exit(127)
  }
  if (shadowIndex === -1) {
    chmodSync(realNpmShadowFilename, parseInt('755', 8))
    const bindir = path.join(realDirname, 'bin')
    process.env['PATH'] = `${
      bindir
    }${
      process.platform === 'win32' ? ';' : ':'
    }${
      process.env['PATH']
    }`
  }
  return npmpath
}
module.exports = installLinks
