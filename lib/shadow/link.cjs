const { chmodSync, symlinkSync, mkdirSync, realpathSync } = require('fs')
const path = require('path')

const which = require('which')

/**
 * @param {string} realDirname
 * @param {'npm' | 'npx'} binname
 * @returns {Promise<string>} path to npm cli / npx bin
 */
async function installLinks (realDirname, binname) {
  const realNpmShadowFilename = path.join(realDirname, `${binname}-cli.cjs`)
  // find npm being shadowed by this process
  const npms = await which(binname, {
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
    mkdirSync(bindir, { recursive: true })
    // make npm symlink alias
    try {
      const npmbinpath = path.join(realDirname, 'bin', 'npm')
      symlinkSync(realNpmShadowFilename, npmbinpath)
      chmodSync(npmbinpath, parseInt('755', 8))
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw e
      }
    }
    // make npx symlink alias
    try {
      const realNpxShadowFilename = path.join(realDirname, 'npx-cli.cjs')
      const npxbinpath = path.join(realDirname, 'bin', 'npx')
      symlinkSync(realNpxShadowFilename, npxbinpath)
      chmodSync(npxbinpath, parseInt('755', 8))
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw e
      }
    }
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
