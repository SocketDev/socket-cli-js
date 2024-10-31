import fs from 'node:fs/promises'
import path from 'node:path'

import ignore from 'ignore'
import micromatch from 'micromatch'
import { glob as tinyGlob } from 'tinyglobby'

import { directoryPatterns } from './ignore-by-default'

import type { SocketYml } from '@socketsecurity/config'
import type { SocketSdkReturnType } from '@socketsecurity/sdk'
import type { GlobOptions } from 'tinyglobby'

type GlobWithGitIgnoreOptions = GlobOptions & {
  socketConfig?: SocketYml | undefined
}

async function filterGlobResultToSupportedFiles(
  entries: string[],
  supportedFiles: SocketSdkReturnType<'getReportSupportedFiles'>['data']
): Promise<string[]> {
  const patterns = ['golang', 'npm', 'pypi'].reduce(
    (r: string[], n: string) => {
      const supported = supportedFiles[n]
      r.push(
        ...(supported
          ? Object.values(supported).map(p => `**/${p.pattern}`)
          : [])
      )
      return r
    },
    []
  )
  return entries.filter(p => micromatch.some(p, patterns))
}

async function globWithGitIgnore(
  patterns: string[],
  options: GlobWithGitIgnoreOptions
) {
  const {
    socketConfig,
    cwd = process.cwd(),
    ...additionalOptions
  } = <GlobWithGitIgnoreOptions>{ __proto__: null, ...options }
  const projectIgnorePaths = socketConfig?.projectIgnorePaths
  const ignoreFiles = await tinyGlob(['**/.gitignore'], {
    absolute: true,
    cwd,
    expandDirectories: true
  })
  const ignores = [
    ...directoryPatterns(),
    ...(Array.isArray(projectIgnorePaths)
      ? ignoreFileLinesToGlobPatterns(
          projectIgnorePaths,
          path.join(cwd, '.gitignore'),
          cwd
        )
      : []),
    ...(
      await Promise.all(
        ignoreFiles.map(async filepath =>
          ignoreFileToGlobPatterns(
            await fs.readFile(filepath, 'utf8'),
            filepath,
            cwd
          )
        )
      )
    ).flat()
  ]
  const hasNegatedPattern = ignores.some(p => p.charCodeAt(0) === 33 /*'!'*/)
  const globOptions = {
    absolute: true,
    cwd,
    expandDirectories: false,
    ignore: hasNegatedPattern ? [] : ignores,
    ...additionalOptions
  }
  const result = await tinyGlob(patterns, globOptions)
  if (!hasNegatedPattern) {
    return result
  }
  const { absolute } = globOptions
  const filtered = ignore()
    .add(ignores)
    .filter(absolute ? result.map(p => path.relative(cwd, p)) : result)
  return absolute ? filtered.map(p => path.resolve(cwd, p)) : filtered
}

function ignoreFileLinesToGlobPatterns(
  lines: string[],
  filepath: string,
  cwd: string
): string[] {
  const base = path.relative(cwd, path.dirname(filepath)).replace(/\\/g, '/')
  const patterns = []
  for (let i = 0, { length } = lines; i < length; i += 1) {
    const pattern = lines[i]!.trim()
    if (pattern.length > 0 && pattern.charCodeAt(0) !== 35 /*'#'*/) {
      patterns.push(
        ignorePatternToMinimatch(
          pattern.length && pattern.charCodeAt(0) === 33 /*'!'*/
            ? `!${path.posix.join(base, pattern.slice(1))}`
            : path.posix.join(base, pattern)
        )
      )
    }
  }
  return patterns
}

function ignoreFileToGlobPatterns(
  content: string,
  filepath: string,
  cwd: string
): string[] {
  return ignoreFileLinesToGlobPatterns(content.split(/\r?\n/), filepath, cwd)
}

// Based on `@eslint/compat` convertIgnorePatternToMinimatch.
// Apache v2.0 licensed
// Copyright Nicholas C. Zakas
// https://github.com/eslint/rewrite/blob/compat-v1.2.1/packages/compat/src/ignore-file.js#L28
function ignorePatternToMinimatch(pattern: string): string {
  const isNegated = pattern.startsWith('!')
  const negatedPrefix = isNegated ? '!' : ''
  const patternToTest = (isNegated ? pattern.slice(1) : pattern).trimEnd()
  // Special cases.
  if (
    patternToTest === '' ||
    patternToTest === '**' ||
    patternToTest === '/**' ||
    patternToTest === '**'
  ) {
    return `${negatedPrefix}${patternToTest}`
  }
  const firstIndexOfSlash = patternToTest.indexOf('/')
  const matchEverywherePrefix =
    firstIndexOfSlash === -1 || firstIndexOfSlash === patternToTest.length - 1
      ? '**/'
      : ''
  const patternWithoutLeadingSlash =
    firstIndexOfSlash === 0 ? patternToTest.slice(1) : patternToTest
  // Escape `{` and `(` because in gitignore patterns they are just
  // literal characters without any specific syntactic meaning,
  // while in minimatch patterns they can form brace expansion or extglob syntax.
  //
  // For example, gitignore pattern `src/{a,b}.js` ignores file `src/{a,b}.js`.
  // But, the same minimatch pattern `src/{a,b}.js` ignores files `src/a.js` and `src/b.js`.
  // Minimatch pattern `src/\{a,b}.js` is equivalent to gitignore pattern `src/{a,b}.js`.
  const escapedPatternWithoutLeadingSlash =
    patternWithoutLeadingSlash.replaceAll(
      /(?=((?:\\.|[^{(])*))\1([{(])/guy,
      '$1\\$2'
    )
  const matchInsideSuffix = patternToTest.endsWith('/**') ? '/*' : ''
  return `${negatedPrefix}${matchEverywherePrefix}${escapedPatternWithoutLeadingSlash}${matchInsideSuffix}`
}

function pathsToPatterns(paths: string[]): string[] {
  return paths.map(p => (p === '.' ? '**/*' : p))
}

export function findRoot(filepath: string): string | undefined {
  let curPath = filepath
  while (true) {
    if (path.basename(curPath) === 'npm') {
      return curPath
    }
    const parent = path.dirname(curPath)
    if (parent === curPath) {
      return undefined
    }
    curPath = parent
  }
}

export async function getPackageFiles(
  cwd: string,
  inputPaths: string[],
  config: SocketYml | undefined,
  supportedFiles: SocketSdkReturnType<'getReportSupportedFiles'>['data'],
  debugLog: typeof console.error = () => {}
): Promise<string[]> {
  debugLog(`Globbed resolving ${inputPaths.length} paths:`, inputPaths)

  // TODO: Does not support `~/` paths
  const entries = await globWithGitIgnore(pathsToPatterns(inputPaths), {
    cwd,
    socketConfig: config
  })

  debugLog(
    `Globbed resolved ${inputPaths.length} paths to ${entries.length} paths:`,
    entries
  )

  const packageFiles = await filterGlobResultToSupportedFiles(
    entries,
    supportedFiles
  )

  debugLog(
    `Mapped ${entries.length} entries to ${packageFiles.length} files:`,
    packageFiles
  )

  return packageFiles
}

export async function getPackageFilesFullScans(
  cwd: string,
  inputPaths: string[],
  supportedFiles: SocketSdkReturnType<'getReportSupportedFiles'>['data'],
  debugLog: typeof console.error = () => {}
): Promise<string[]> {
  debugLog(`Globbed resolving ${inputPaths.length} paths:`, inputPaths)

  // TODO: Does not support `~/` paths
  const entries = await globWithGitIgnore(pathsToPatterns(inputPaths), {
    cwd
  })

  debugLog(
    `Globbed resolved ${inputPaths.length} paths to ${entries.length} paths:`,
    entries
  )

  const packageFiles = await filterGlobResultToSupportedFiles(
    entries,
    supportedFiles
  )

  debugLog(
    `Mapped ${entries.length} entries to ${packageFiles.length} files:`,
    packageFiles
  )

  return packageFiles
}
