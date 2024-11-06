'use strict'

const { createFilter } = require('@rollup/pluginutils')
const MagicString = require('magic-string')

function socketModifyPlugin({
  exclude,
  find,
  include,
  replace,
  sourcemap = true
}) {
  const filter = createFilter(include, exclude)
  return {
    name: 'socket-modify',
    renderChunk(code, { fileName }) {
      if (!filter(fileName)) return null
      const s = new MagicString(code)
      find.lastIndex = 0
      let match
      while ((match = find.exec(code)) !== null) {
        s.overwrite(
          match.index,
          match.index + match[0].length,
          typeof replace === 'function'
            ? Reflect.apply(replace, match, match)
            : String(replace)
        )
      }
      return {
        code: s.toString(),
        map: sourcemap ? s.generateMap() : null
      }
    }
  }
}

module.exports = socketModifyPlugin
