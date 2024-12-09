import * as fs from 'fs'
import colors from 'yoctocolors-cjs'
import { Diff, Purl, Issue } from './classes'
// @ts-ignore
import chalkTable from 'chalk-table'

export function createSecurityCommentJson(diff: Diff): Record<string, any> {
  let scanFailed = false
  if (diff.newAlerts.length === 0) {
    for (const alert of diff.newAlerts) {
      if (alert.error) {
        scanFailed = true
        break
      }
    }
  }
  const output = {
    scanFailed,
    newAlerts: diff.newAlerts.map(alert => JSON.parse(JSON.stringify(alert))),
    fullScanId: diff.id
  }
  return output
}

export function securityCommentTemplate(diff: Diff): string {
  const md = []
  md.push('<!-- socket-security-comment-actions -->')
  md.push('# Socket Security: Issues Report')
  md.push(
    'Potential security issues detected. Learn more about [socket.dev](https://socket.dev)'
  )
  md.push(
    'To accept the risk, merge this PR and you will not be notified again.'
  )
  md.push('')
  md.push('<!-- start-socket-alerts-table -->')
  const { mdUpdated, ignoreCommands, nextSteps } = createSecurityAlertTable(
    diff,
    md
  )
  md.push('<!-- end-socket-alerts-table -->')
  md.push('')
  createNextSteps(mdUpdated, nextSteps)
  createDeeperLook(mdUpdated)
  createRemovePackage(mdUpdated)
  createAcceptableRisk(mdUpdated, ignoreCommands)
  return md.join('\n')
}

export function createNextSteps(
  md: string[],
  nextSteps: Record<string, string[]>
): void {
  for (const step in nextSteps) {
    md.push('<details>')
    md.push(`<summary>${step}</summary>`)
    for (const line of nextSteps[step] ?? []) {
      md.push(line)
    }
    md.push('</details>')
  }
}

export function createDeeperLook(md: string[]): void {
  md.push('<details>')
  md.push('<summary>Take a deeper look at the dependency</summary>')
  md.push(
    'Take a moment to review the security alert above. Review the linked package source code to understand the ' +
      "potential risk. Ensure the package is not malicious before proceeding. If you're unsure how to proceed, " +
      'reach out to your security team or ask the Socket team for help at support [AT] socket [DOT] dev.'
  )
  md.push('</details>')
}

export function createRemovePackage(md: string[]): void {
  md.push('<details>')
  md.push('<summary>Remove the package</summary>')
  md.push(
    'If you happen to install a dependency that Socket reports as ' +
      '[https://socket.dev/npm/issue/malware](Known Malware) you should immediately remove it and select a ' +
      'different dependency. For other alert types, you may wish to investigate alternative packages or ' +
      'consider if there are other ways to mitigate the specific risk posed by the dependency.'
  )
  md.push('</details>')
}

export function createAcceptableRisk(
  md: string[],
  ignoreCommands: string[]
): void {
  md.push('<details>')
  md.push('<summary>Mark a package as acceptable risk</summary>')
  md.push(
    'To ignore an alert, reply with a comment starting with `SocketSecurity ignore` followed by a space ' +
      'separated list of `ecosystem/package-name@version` specifiers. e.g. `SocketSecurity ignore npm/foo@1.0.0`' +
      ' or ignore all packages with `SocketSecurity ignore-all`'
  )
  md.push(...ignoreCommands)
  md.push('</details>')
}

export function createSecurityAlertTable(
  diff: Diff,
  md: string[]
): {
  mdUpdated: string[]
  ignoreCommands: string[]
  nextSteps: Record<string, string[]>
} {
  const alertTableHeaders = [
    'Alert',
    'Package',
    'Introduced by',
    'Manifest File',
    'CI'
  ]
  const nextSteps: Record<string, string[]> = {}
  const ignoreCommands: string[] = []
  const rows: string[] = []
  for (const alert of diff.newAlerts) {
    if (!nextSteps[alert.nextStepTitle]) {
      nextSteps[alert.nextStepTitle] = [alert.description, alert.suggestion]
    }
    const ignoreCommand = `\`SocketSecurity ignore ${alert.purl}\``
    if (!ignoreCommands.includes(ignoreCommand)) {
      ignoreCommands.push(ignoreCommand)
    }
    const { manifestStr, sourceStr } = createSources(alert)
    const purlUrl = `[${alert.purl}](${alert.url})`
    const emoji = alert.error ? ':no_entry_sign:' : ':warning:'
    rows.push(
      `${alert.title} | ${purlUrl} | ${sourceStr} | ${manifestStr} | ${emoji}`
    )
  }
  md.push(alertTableHeaders.join(' | '))
  md.push(rows.join('\n'))
  return { mdUpdated: md, ignoreCommands, nextSteps }
}

export function createSources(
  alert: Issue,
  style = 'md'
): { manifestStr: string; sourceStr: string } {
  const sources: string[] = []
  const manifests: string[] = []
  for (const [source, manifest] of alert.introducedBy) {
    const sourceStr = style === 'md' ? `<li>${source}</li>` : `${source};`
    const manifestStr = style === 'md' ? `<li>${manifest}</li>` : `${manifest};`
    if (!sources.includes(sourceStr)) {
      sources.push(sourceStr)
    }
    if (!manifests.includes(manifestStr)) {
      manifests.push(manifestStr)
    }
  }
  return {
    sourceStr:
      style === 'md' ? `<ul>${sources.join('')}</ul>` : sources.join(''),
    manifestStr:
      style === 'md' ? `<ul>${manifests.join('')}</ul>` : manifests.join('')
  }
}

export function createDependencyOverviewTemplate(diff: Diff): string {
  const md = []
  md.push('<!-- socket-overview-comment-actions -->')
  md.push('# Socket Security: Dependency Overview')
  md.push(
    'New and removed dependencies detected. Learn more about [socket.dev](https://socket.dev)'
  )
  md.push('')
  createAddedTable(diff, md)
  if (diff.removedPackages.length > 0) {
    createRemoveLine(diff, md)
  }
  return md.join('\n')
}

export function createRemoveLine(diff: Diff, md: string[]): void {
  const removedLine = diff.removedPackages
    .map(removed => createPurlLink(removed))
    .join(', ')
  md.push(`Removed packages: ${removedLine}`)
}

export function createAddedTable(diff: Diff, md: string[]): void {
  const headers = [
    'Package',
    'Direct',
    'Capabilities',
    'Transitives',
    'Size',
    'Author'
  ]
  const rows = diff.newPackages.map(added => {
    const capabilities = Object.keys(added.capabilities).join(', ')
    return `${createPurlLink(added)} | ${added.direct} | ${capabilities} | ${
      added.transitives
    } | ${added.size} KB | ${added.authorUrl}`
  })
  md.push(headers.join(' | '))
  md.push(rows.join('\n'))
}

export function createPurlLink(details: Purl): string {
  return `[${details.purl}](${details.url})`
}

export function createConsoleSecurityAlertTable(diff: Diff): chalkTable {
  // TODO: fix
  const alertTable = []
  const options = {
    columns: [
      { field: 'Alert', name: colors.magenta('Alert') },
      { field: 'Package', name: colors.magenta('Package') },
      { field: 'URL', name: colors.magenta('URL') },
      { field: 'Introduced by', name: colors.magenta('Introduced by') },
      { field: 'Manifest File', name: colors.magenta('Manifest File') },
      { field: 'CI Status', name: colors.magenta('CI Status') }
    ]
  }
  for (const alert of diff.newAlerts) {
    // @ts-ignore
    const { manifestStr, sourceStr } = createSources(alert, 'console')
    const state = alert.error
      ? 'block'
      : alert.warn
        ? 'warn'
        : alert.monitor
          ? 'monitor'
          : 'ignore'
    alertTable.push({
      alert: alert.title,
      purl: alert.purl,
      url: alert.url
    })
  }
  return chalkTable(options, alertTable)
}
