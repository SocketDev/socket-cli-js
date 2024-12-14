import { realpathSync } from 'node:fs'
import path from 'node:path'

import { envAsBoolean } from '@socketsecurity/registry/lib/env'
import registryConstants from '@socketsecurity/registry/lib/constants'

const {
  kInternalsSymbol,
  PACKAGE_JSON,
  [kInternalsSymbol as unknown as 'Symbol(kInternalsSymbol)']: {
    createConstantsObject
  }
} = registryConstants

const API_V0_URL = 'https://api.socket.dev/v0'

const NPM_REGISTRY_URL = 'https://registry.npmjs.org'

const SOCKET_CLI_ISSUES_URL = 'https://github.com/SocketDev/socket-cli/issues'

const UPDATE_SOCKET_OVERRIDES_IN_PACKAGE_LOCK_FILE =
  'UPDATE_SOCKET_OVERRIDES_IN_PACKAGE_LOCK_FILE'

const ENV = Object.freeze({
  ...registryConstants.ENV,
  // Flag set by the optimize command to bypass the packagesHaveRiskyIssues check.
  [UPDATE_SOCKET_OVERRIDES_IN_PACKAGE_LOCK_FILE]: envAsBoolean(
    process.env[UPDATE_SOCKET_OVERRIDES_IN_PACKAGE_LOCK_FILE]
  )
})

const rootPath = path.resolve(realpathSync(__dirname), '..')
const rootDistPath = path.join(rootPath, 'dist')
const rootBinPath = path.join(rootPath, 'bin')
const rootPkgJsonPath = path.join(rootPath, PACKAGE_JSON)
const nmBinPath = path.join(rootPath, 'node_modules/.bin')
const cdxgenBinPath = path.join(nmBinPath, 'cdxgen')
const synpBinPath = path.join(nmBinPath, 'synp')

const LAZY_DIST_TYPE = () =>
  registryConstants.SUPPORTS_NODE_REQUIRE_MODULE ? 'module-sync' : 'require'

const lazyConstants = () => constants
const lazyDistPath = () => path.join(rootDistPath, constants.DIST_TYPE)
const lazyShadowBinPath = () =>
  path.join(rootPath, 'shadow', constants.DIST_TYPE)

const constants = <
  {
    readonly API_V0_URL: 'https://api.socket.dev/v0'
    readonly ENV: typeof ENV
    readonly DIST_TYPE: 'module-sync' | 'require'
    readonly NPM_REGISTRY_URL: 'https://registry.npmjs.org'
    readonly SOCKET_CLI_ISSUES_URL: 'https://github.com/SocketDev/socket-cli/issues'
    readonly UPDATE_SOCKET_OVERRIDES_IN_PACKAGE_LOCK_FILE: 'UPDATE_SOCKET_OVERRIDES_IN_PACKAGE_LOCK_FILE'
    readonly cdxgenBinPath: string
    readonly distPath: string
    readonly nmBinPath: string
    readonly rootBinPath: string
    readonly rootDistPath: string
    readonly rootPath: string
    readonly rootPkgJsonPath: string
    readonly shadowBinPath: string
    readonly synpBinPath: string
  } & typeof registryConstants
>createConstantsObject(
  {
    API_V0_URL,
    ENV,
    // Lazily defined values are initialized as `undefined` to keep their key order.
    DIST_TYPE: undefined,
    NPM_REGISTRY_URL,
    SOCKET_CLI_ISSUES_URL,
    UPDATE_SOCKET_OVERRIDES_IN_PACKAGE_LOCK_FILE,
    cdxgenBinPath,
    constants: undefined,
    distPath: undefined,
    nmBinPath,
    rootBinPath,
    rootDistPath,
    rootPath,
    rootPkgJsonPath,
    shadowBinPath: undefined,
    synpBinPath
  },
  {
    getters: {
      DIST_TYPE: LAZY_DIST_TYPE,
      // Preserve rollup chunk compatibility.
      constants: lazyConstants,
      distPath: lazyDistPath,
      shadowBinPath: lazyShadowBinPath
    },
    mixin: registryConstants
  }
)

export default constants
