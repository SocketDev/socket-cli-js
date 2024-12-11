import { isValidPackageName } from '@socketsecurity/registry/lib/packages'
import { isRelative } from '@socketsecurity/registry/lib/path'

import baseConfig from './rollup.base.config.mjs'
import constants from '../scripts/constants.js'
import {
  isBuiltin,
  getPackageName,
  normalizeId
} from '../scripts/utils/packages.js'

const { ROLLUP_EXTERNAL_SUFFIX, SUPPORTS_SYNC_ESM, rootSrcPath } = constants

export default () =>
  baseConfig({
    input: {
      constants: `${rootSrcPath}/constants.ts`,
      misc: `${rootSrcPath}/utils/misc.ts`,
      'path-resolve': `${rootSrcPath}/utils/path-resolve.ts`
    },
    output: [
      {
        dir: 'test/dist',
        entryFileNames: '[name].js',
        format: 'cjs',
        exports: 'auto',
        externalLiveBindings: false,
        freeze: false
      }
    ],
    ...(SUPPORTS_SYNC_ESM
      ? {
          external(id_) {
            if (id_.endsWith(ROLLUP_EXTERNAL_SUFFIX) || isBuiltin(id_)) {
              return true
            }
            const id = normalizeId(id_)
            const name = getPackageName(id)
            if (
              name === '@babel/runtime' ||
              id.startsWith(rootSrcPath) ||
              id.endsWith('.mjs') ||
              id.endsWith('.mts') ||
              isRelative(id) ||
              !isValidPackageName(name)
            ) {
              return false
            }
            return true
          }
        }
      : {})
  })
