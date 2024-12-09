import { Comment } from './classes'
import { Comments } from './scm_comments'
import { createDebugLogger } from '../../../utils/misc'

const debug = createDebugLogger(false)

const githubVariables = [
  'GITHUB_SHA',
  'GITHUB_API_URL',
  'GITHUB_REF_TYPE',
  'GITHUB_EVENT_NAME',
  'GITHUB_WORKSPACE',
  'GITHUB_REPOSITORY',
  'GITHUB_REF_NAME',
  'DEFAULT_BRANCH',
  'PR_NUMBER',
  'PR_NAME',
  'COMMIT_MESSAGE',
  'GITHUB_ACTOR',
  'GITHUB_ENV',
  'GH_API_TOKEN',
  'GITHUB_REPOSITORY_OWNER',
  'EVENT_ACTION'
] as const

type GithubEnvVariables = {
  [key in (typeof githubVariables)[number]]: string | null
}

const env: GithubEnvVariables = {} as GithubEnvVariables

githubVariables.forEach(varName => {
  const value = process.env[varName] || null
  env[varName] = value
  if (varName !== 'GH_API_TOKEN') {
    debug(`${varName}=${value}`)
  }
})

const headers = {
  Authorization: `Bearer ${env['GH_API_TOKEN']}`,
  'User-Agent': 'SocketNodeScript/0.0.1',
  accept: 'application/json'
}

export class GitHub {
  commitSha: string | null
  apiUrl: string | null
  refType: string | null
  eventName: string | null
  workspace: string | null
  repository: string | null
  branch: string | null
  defaultBranch: string | null
  isDefaultBranch: boolean
  prNumber: number | null
  prName: string | null
  commitMessage: string | null
  committer: string | null
  githubEnv: string | null
  apiToken: string | null
  projectId: number
  eventAction: string | null

  constructor() {
    this.commitSha = env['GITHUB_SHA']
    this.apiUrl = env['GITHUB_API_URL']
    this.refType = env['GITHUB_REF_TYPE']
    this.eventName = env['GITHUB_EVENT_NAME']
    this.workspace = env['GITHUB_WORKSPACE']
    this.repository = env['GITHUB_REPOSITORY']
    this.branch = env['GITHUB_REF_NAME']
    this.defaultBranch = env['DEFAULT_BRANCH']
    this.isDefaultBranch =
      (env['DEFAULT_BRANCH'] ?? '').toLowerCase() !== 'false'
    this.prNumber = env['PR_NUMBER'] ? parseInt(env['PR_NUMBER'], 10) : null
    this.prName = env['PR_NAME']
    this.commitMessage = env['COMMIT_MESSAGE']
    this.committer = env['GITHUB_ACTOR']
    this.githubEnv = env['GITHUB_ENV']
    this.apiToken = env['GH_API_TOKEN']
    this.projectId = 0
    this.eventAction = env['EVENT_ACTION']

    if (!this.apiToken) {
      console.error('Unable to get Github API Token from GH_API_TOKEN')
      process.exit(2)
    }
  }

  static checkEventType(): string | null {
    switch (env['GITHUB_EVENT_NAME']?.toLowerCase()) {
      case 'push':
        return env['PR_NUMBER'] ? 'diff' : 'main'
      case 'pull_request':
        if (
          env['EVENT_ACTION'] &&
          ['opened', 'synchronize'].includes(env['EVENT_ACTION'].toLowerCase())
        ) {
          return 'diff'
        } else {
          console.log(
            `Pull Request Action ${env['EVENT_ACTION']} is not supported`
          )
          process.exit(0)
        }
      case 'issue_comment':
        return 'comment'
      default:
        console.error(`Unknown event type ${env['GITHUB_EVENT_NAME']}`)
        process.exit(0)
    }
  }

  static async addSocketComments(
    securityComment: string,
    overviewComment: string,
    comments: Record<string, Comment>,
    newSecurityComment: boolean = true,
    newOverviewComment: boolean = true
  ): Promise<void> {
    const existingOverviewComment = comments['overview']
    const existingSecurityComment = comments['security']

    if (newOverviewComment) {
      debug('New Dependency Overview comment')
      if (existingOverviewComment) {
        debug('Updating existing Dependency Overview comment')
        await GitHub.updateComment(
          overviewComment,
          existingOverviewComment.id?.toString() ?? ''
        )
      } else {
        debug('Posting new Dependency Overview comment')
        await GitHub.postComment(overviewComment)
      }
    }

    if (newSecurityComment) {
      debug('New Security Issue Comment')
      if (existingSecurityComment) {
        debug
        await GitHub.updateComment(
          securityComment,
          existingSecurityComment.id?.toString() ?? ''
        )
      } else {
        debug('Posting new Security Issue comment')
        await GitHub.postComment(securityComment)
      }
    }
  }

  static async postComment(body: string): Promise<void> {
    const repo = env['GITHUB_REPOSITORY']?.split('/')[1]
    const path = `repos/${env['GITHUB_REPOSITORY_OWNER']}/${repo}/issues/${env['PR_NUMBER']}/comments`
    const payload = JSON.stringify({ body })
    await fetch(path, { body: payload, method: 'POST', headers })
  }

  static async updateComment(body: string, commentId: string): Promise<void> {
    const repo = env['GITHUB_REPOSITORY']?.split('/')[1]
    const path = `repos/${env['GITHUB_REPOSITORY_OWNER']}/${repo}/issues/comments/${commentId}`
    const payload = JSON.stringify({ body })
    await fetch(path, { body: payload, method: 'PATCH', headers })
  }

  static async writeNewEnv(name: string, content: string): Promise<void> {
    const file = require('fs').createWriteStream(env['GITHUB_ENV'], {
      flags: 'a'
    })
    const newContent = content.replace(/\n/g, '\\n')
    file.write(`${name}=${newContent}`)
    file.close()
  }

  static async getCommentsForPr(
    repo: string,
    pr: string
  ): Promise<Record<string, Comment | Comment[]>> {
    const path = `repos/${env['GITHUB_REPOSITORY_OWNER']}/${repo}/issues/${pr}/comments`
    const rawComments = await Comments.processResponse(
      await fetch(path, { headers })
    )
    const comments: Record<string, Comment> = {}
    if (!rawComments['error']) {
      // @ts-ignore
      rawComments.forEach((item: any) => {
        const comment = new Comment(item)
        // @ts-ignore
        comments[comment.id] = comment
      })
    } else {
      console.error(rawComments)
    }
    return Comments.checkForSocketComments(comments)
  }

  static async postReaction(commentId: number): Promise<void> {
    const repo = env['GITHUB_REPOSITORY']?.split('/')[1]
    const path = `repos/${env['GITHUB_REPOSITORY_OWNER']}/${repo}/issues/comments/${commentId}/reactions`
    const payload = JSON.stringify({ content: '+1' })
    await fetch(path, { body: payload, method: 'POST', headers })
  }

  static async commentReactionExists(commentId: number): Promise<boolean> {
    const repo = env['GITHUB_REPOSITORY']?.split('/')[1]
    const path = `repos/${env['GITHUB_REPOSITORY_OWNER']}/${repo}/issues/comments/${commentId}/reactions`
    try {
      const response = await fetch(path, { headers })
      const data = (await response.json()) as any[]
      return data.some((reaction: any) => reaction.content === ':thumbsup:')
    } catch (error) {
      console.error(`Error fetching reaction for comment ${commentId}`)
      return false
    }
  }
}
