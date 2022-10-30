import openapiTS from 'openapi-typescript'

// example 2: load [string] as local file (YAML or JSON; released in v4.0)
const localPath = new URL('../../../socket-api-ts/openapi.json', import.meta.url)
const output = await openapiTS(localPath, {
  formatter (node) {
    if (node.format === 'binary') {
      return 'FormData'
    }
  }
})

// eslint-disable-next-line no-console
console.log(output)
