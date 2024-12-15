import { createDebugLogger } from '../../../utils/misc'
import { Comment, Issue } from './classes'

const debug = createDebugLogger(false)

export async function processResponse(
  response: Response
): Promise<Record<string, any>> {
  let output: Record<string, any> = {}
  try {
    output = (await response.json()) as typeof output
  } catch (error) {
    debug('Unable to parse comment response JSON, trying as text')
    debug(error)
    try {
      output = JSON.parse(await response.text())
    } catch (err) {
      console.error(
        'Unable to process comment data, unable to get previous comment data'
      )
      console.error(err)
    }
  }
  return output
}

export function removeAlerts(
  comments: Record<string, any>,
  newAlerts: Issue[]
): Issue[] {
  const alerts: Issue[] = []
  if (!comments['ignore']) {
    return newAlerts
  }

  const [ignoreAll, ignoreCommands] = getIgnoreOptions(comments)

  for (const alert of newAlerts) {
    if (ignoreAll) {
      break
    } else {
      const fullName = `${alert.pkgType}/${alert.pkgName}`
      const purl = [fullName, alert.pkgVersion] as const
      const purlStar = [fullName, '*'] as const

      if (
        ignoreCommands.some(
          cmd =>
            JSON.stringify(cmd) === JSON.stringify(purl) ||
            JSON.stringify(cmd) === JSON.stringify(purlStar)
        )
      ) {
        console.log(`Alerts for ${alert.pkgName}@${alert.pkgVersion} ignored`)
      } else {
        console.log(
          `Adding alert ${alert.type} for ${alert.pkgName}@${alert.pkgVersion}`
        )
        alerts.push(alert)
      }
    }
  }

  return alerts
}

export function getIgnoreOptions(
  comments: Record<string, any>
): [boolean, [string, string][]] {
  const ignoreCommands: [string, string][] = []
  let ignoreAll = false

  for (const comment of comments['ignore']) {
    const firstLine = comment.bodyList[0]
    if (!ignoreAll && firstLine.includes('SocketSecurity ignore')) {
      try {
        const [, command] = firstLine.replace('@', '').split('SocketSecurity ')
        const trimmedCommand = command.trim()

        if (trimmedCommand === 'ignore-all') {
          ignoreAll = true
        } else {
          const [name, version] = trimmedCommand
            .replace('ignore', '')
            .trim()
            .split('@')
          ignoreCommands.push([name, version])
        }
      } catch (error) {
        console.error(`Unable to process ignore command for ${comment}`)
        console.error(error)
      }
    }
  }

  return [ignoreAll, ignoreCommands]
}

export function isIgnore(
  pkgName: string,
  pkgVersion: string,
  name: string,
  version: string
): boolean {
  return pkgName === name && (pkgVersion === version || version === '*')
}

export function isHeadingLine(line: string): boolean {
  return (
    line === '|Alert|Package|Introduced by|Manifest File|CI|' ||
    line.includes(':---')
  )
}

export function processSecurityComment(
  comment: Comment,
  comments: Record<string, any>
): string {
  const lines: string[] = []
  let start = false
  const [ignoreAll, ignoreCommands] = getIgnoreOptions(comments)

  for (const line of comment.bodyList) {
    const trimmedLine = line.trim()

    if (trimmedLine.includes('start-socket-alerts-table')) {
      start = true
      lines.push(trimmedLine)
    } else if (
      start &&
      !trimmedLine.includes('end-socket-alerts-table') &&
      !isHeadingLine(trimmedLine) &&
      trimmedLine !== ''
    ) {
      const [title, packageLink, introducedBy, manifest, ci] = trimmedLine
        .replace('|', '')
        .split('|')
      if (
        typeof title !== 'string' ||
        typeof packageLink !== 'string' ||
        typeof introducedBy !== 'string' ||
        typeof manifest !== 'string' ||
        typeof ci !== 'string'
      ) {
        return ''
      }
      const [details] = packageLink.split('](')
      if (!details) return ''
      const [ecosystem, pkgDetails] = details.split('/', 2)
      if (!pkgDetails) return ''
      const [pkgName, pkgVersion] = pkgDetails.split('@')
      if (!pkgVersion) return ''
      const fullName = `${ecosystem}/${pkgName}`
      const ignore =
        ignoreAll ||
        ignoreCommands.some(([name, version]) =>
          isIgnore(fullName, pkgVersion, name, version)
        )

      if (!ignore) {
        lines.push(trimmedLine)
      }
    } else if (trimmedLine.includes('end-socket-alerts-table')) {
      start = false
      lines.push(trimmedLine)
    } else {
      lines.push(trimmedLine)
    }
  }

  return lines.join('\n')
}

export function checkForSocketComments(
  comments: Record<string, Comment>
): Record<string, Comment> {
  const socketComments: Record<string, Comment> = {}

  for (const [commentId, comment] of Object.entries(comments)) {
    if (comment.body?.includes('socket-security-comment-actions')) {
      socketComments['security'] = comment
    } else if (comment.body?.includes('socket-overview-comment-actions')) {
      socketComments['overview'] = comment
    } else if (
      comment.bodyList.length > 0 &&
      comment.bodyList[0]?.toLowerCase().includes('socketsecurity ignore')
    ) {
      if (!socketComments['ignore']) {
        socketComments['ignore'] = []
      }
      ;(socketComments['ignore'] as Comment[]).push(comment)
    }
  }

  return socketComments
}
