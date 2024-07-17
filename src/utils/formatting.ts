type ListDescription = string | { description: string }
type HelpListOptions = {
  keyPrefix: string
  padName: number
}

/**
 * @param {} list
 * @param {number} indent
 * @param {HelpListOptions} options
 * @returns {string}
 */
export function printHelpList(
  list: Record<string, ListDescription>,
  indent: number,
  { keyPrefix = '', padName = 18 } = {} as HelpListOptions
) {
  const names = Object.keys(list).sort()

  let result = ''

  for (const name of names) {
    const rawDescription = list[name]
    const description =
      (typeof rawDescription === 'object'
        ? rawDescription.description
        : rawDescription) || ''

    result +=
      ''.padEnd(indent) +
      (keyPrefix + name).padEnd(padName) +
      description +
      '\n'
  }

  return result.trim()
}

export function printFlagList(
  list: Record<string, ListDescription>,
  indent: number,
  { keyPrefix = '--', padName } = {} as HelpListOptions
): string {
  return printHelpList(
    {
      help: 'Print this help and exits.',
      version: 'Prints current version and exits.',
      ...list
    },
    indent,
    { keyPrefix, padName }
  )
}
