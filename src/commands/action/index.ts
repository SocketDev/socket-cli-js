import { parseArgs } from 'util'
import { CliSubcommand } from '../../utils/meow-with-subcommands'
import simpleGit from 'simple-git'
import { Octokit } from '@octokit/rest'
import { SocketSdk } from '@socketsecurity/sdk'
import micromatch from 'micromatch'
import ignore from 'ignore'
const octokit = new Octokit()
const socket = new SocketSdk(
  'sktsec_MC9u35CaTKpnGaWsT-OG53Xlvp9NoVmzwEzOH1OinZTg_api',
  { baseUrl: 'https://api-server-staging.onrender.com/v0/' }
)

// const options = (github_variables = [
//   'GITHUB_SHA',
//   'GITHUB_API_URL',
//   'GITHUB_REF_TYPE',
//   'GITHUB_EVENT_NAME',
//   'GITHUB_WORKSPACE',
//   'GITHUB_REPOSITORY',
//   'GITHUB_REF_NAME',
//   'DEFAULT_BRANCH',
//   'PR_NUMBER',
//   'PR_NAME',
//   'COMMIT_MESSAGE',
//   'GITHUB_ACTOR',
//   'GITHUB_ENV',
//   'GH_API_TOKEN',
//   'GITHUB_REPOSITORY_OWNER',
//   'EVENT_ACTION'
// ])

// https://github.com/actions/checkout/issues/58#issuecomment-2264361099
const prNumber = parseInt(
  process.env['GITHUB_REF']?.match(/refs\/pull\/(\d+)\/merge/)?.at(1) ?? ''
)

function eventType(): 'main' | 'diff' | 'comment' | 'unsupported' {
  switch (process.env['GITHUB_EVENT_NAME']) {
    case 'push':
      return prNumber ? 'diff' : 'main'

    case 'pull_request':
      // Provided by github.event.action, add this code below to GitHub action
      //  if: github.event_name == 'pull_request'
      //  run: echo "EVENT_ACTION=${{ github.event.action }}" >> $GITHUB_ENV
      const eventAction = process.env['EVENT_ACTION']

      if (!eventAction) {
        throw new Error('Missing event action')
      }

      if (['opened', 'synchronize'].includes(eventAction)) {
        return 'diff'
      } else {
        console.log(`Pull request action: ${eventAction} is not supported`)
        process.exit()
      }

    case 'issue_comment':
      return 'comment'

    default:
      throw new Error(`Unknown event type: ${process.env['GITHUB_EVENT_NAME']}`)
  }
}

export const action: CliSubcommand = {
  description: 'Socket action command',
  async run(args: readonly string[]) {
    const { values } = parseArgs({
      ...args,
      options: {
        socketSecurityApiKey: {
          type: 'string',
          default: process.env['SOCKET_SECURITY_API_KEY']
        },
        githubEventBefore: {
          type: 'string',
          default: ''
        },
        githubEventAfter: {
          type: 'string',
          default: ''
        }
      },
      strict: true,
      allowPositionals: true
    })

    const git = simpleGit()
    const changedFiles = (
      await git.diff(
        process.env['GITHUB_EVENT_NAME'] === 'pull_request'
          ? ['--name-only', 'HEAD^1', 'HEAD']
          : ['--name-only', values.githubEventBefore, values.githubEventAfter]
      )
    ).split('\n')

    console.log({ changedFiles })
    // supportedFiles have 3-level depp globs
    const patterns = Object.values(await socket.getReportSupportedFiles())
      .flatMap((i: Record<string, any>) => Object.values(i))
      .flatMap((i: Record<string, any>) => Object.values(i))
      .flatMap((i: Record<string, any>) => Object.values(i))

    const files = micromatch(changedFiles, patterns)
    console.log({ files })

    if (eventType() === 'comment') {
      console.log('Comment initiated flow')
      const [owner = '', repo = ''] = (
        process.env['GITHUB_REPOSITORY'] ?? ''
      ).split('/')
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber
      })
      type Comments = Awaited<
        ReturnType<typeof octokit.rest.issues.listComments>
      >['data']
      console.log({ comments })
      // Socket only comments
      const socketComments: {
        security: Comments
        overview: Comments
        ignore: Comments
      } = {
        security: [],
        overview: [],
        ignore: []
      }
      for (const comment of comments) {
        if (comment.body?.includes('socket-security-comment-actions')) {
          socketComments.security.push(comment)
        } else if (comment.body?.includes('socket-overview-comment-actions')) {
          socketComments.overview.push(comment)
        } else if (
          // Based on:
          // To ignore an alert, reply with a comment starting with @SocketSecurity ignore
          // followed by a space separated list of ecosystem/package-name@version specifiers.
          // e.g. @SocketSecurity ignore npm/foo@1.0.0 or ignore all packages with @SocketSecurity ignore-all
          comment.body?.split('\n').at(0)?.includes('SocketSecurity ignore')
        ) {
          socketComments.ignore.push(comment)
        }
        // Remove security comments
        // https://github.com/SocketDev/socket-python-cli/blob/main/socketsecurity/core/scm_comments.py#L84
      }
    }
  }
}

// Parse:
// @SocketSecurity ignore pkg1 pkg2 ...
// @SocketSecurity ignore ignore-all
function parseIgnoreCommand(line: string) {
  const result = { packages: [] as string[], ignoreAll: false }
  const words = line.trim().replace(/\s+/g, ' ').split(' ')
  if (words.at(1) === 'ignore-all') {
    result.ignoreAll = true
    return result
  }
  if (words.at(1) === 'ignore') {
    for (let i = 2; i < words.length; i++) {
      const pkg = words[i] as string
      result.packages.push(pkg)
    }
    return result
  }
  return result
}
type Comments = Awaited<
  ReturnType<typeof octokit.rest.issues.listComments>
>['data']

// Ref: https://github.com/socketdev-demo/javascript-threats/pull/89#issuecomment-2456015512
function processSecurityComment({
  securityComment,
  ignoreComments
}: {
  securityComment: Comments[0]
  ignoreComments: Comments
}): string {
  const result: string[] = []
  let start = false

  let ignoreAll = false
  let ignoredPackages = []
  for (const ignoreComment of ignoreComments) {
    const parsed = parseIgnoreCommand(
      ignoreComment.body?.split('\n').at(0) ?? ''
    )
    if (parsed.ignoreAll) {
      ignoreAll = true
      break
    }
    ignoredPackages.push(parsed.packages)
  }

  // Split the comment body into lines
  for (let line of securityComment.body?.split('\n') ?? []) {
    line = line.trim()

    if (line.includes('start-socket-alerts-table')) {
      start = true
      result.push(line)
    } else if (
      start && // Checking that we're still inside socket table
      !line.includes('end-socket-alerts-table') &&
      // is not heading line?
      !(
        line === '|Alert|Package|Introduced by|Manifest File|CI|' ||
        line.includes(':---')
      ) &&
      line !== ''
    ) {
      // Parsing Markdown data colunms
      const [_, title, packageLink, introducedBy, manifest, ci] = line.split(
        '|'
      ) as [string, string, string, string, string, string]

      // Parsing package link [npm/pkg](url)
      let [ecosystem, pkg] = packageLink
        .slice(1, packageLink.indexOf(']'))
        .split('/', 2) as [string, string]
      const [pkgName, pkgVersion] = pkg.split('@')

      let ignore = false

      // Checking if this package should be ignored
      if (ignoreAll) {
        ignore = true
      } else {
        for (const [ignoredPkgName, ignorePkgVersion] of ignoredPackages) {
          if (
            pkgName === ignoredPkgName &&
            (pkgVersion === ignorePkgVersion || ignorePkgVersion === '*')
          ) {
            ignore = true
            break
          }
        }
      }

      if (!ignore) {
        result.push(line)
      }
    } else if (line.includes('end-socket-alerts-table')) {
      start = false
      result.push(line)
    } else {
      result.push(line)
    }
  }

  const newBody = result.join('\n')
  return newBody
}
