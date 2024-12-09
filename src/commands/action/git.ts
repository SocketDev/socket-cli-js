import simpleGit, { SimpleGit, DefaultLogFields } from 'simple-git'

export class Git {
  private repo: SimpleGit
  public path: string
  public head: string | null = null
  public commit: DefaultLogFields | null = null
  public repoName: string | null = null
  public branch: string | null = null
  public author: string | null = null
  public commitSha: string | null = null
  public commitMessage: string | null = null
  public committer: string | null = null
  public showFiles: string[] = []
  public changedFiles: string[] = []

  constructor(path: string) {
    this.path = path
    // TODO: what if there's no repo?
    this.repo = simpleGit(path)
  }

  async init(): Promise<void> {
    // Get the HEAD reference
    this.head = await this.repo.revparse(['HEAD'])

    // Get the latest commit log
    const logEntry = await this.repo.log({ n: 1 })
    this.commit = logEntry.latest

    // Extract the repository name from the origin remote URL
    const remotes = await this.repo.getRemotes(true)
    const originRemote = remotes.find(remote => remote.name === 'origin')

    if (originRemote) {
      const url = originRemote.refs.fetch
      this.repoName = url.split('.git')[0]?.split('/').pop() || null
    }

    // Get the current branch
    try {
      const branches = await this.repo.branchLocal()
      const currentBranch = branches.current
      this.branch = decodeURIComponent(currentBranch)
    } catch (error) {
      this.branch = null
      console.error('Failed to get branch information:', error)
    }

    // Populate commit details
    if (this.commit) {
      this.author = this.commit.author_name || null
      this.commitSha = this.commit.hash || null
      this.commitMessage = this.commit.message || null
      this.committer = this.commit.author_email || null
    }

    // List files changed in the latest commit
    if (this.commitSha) {
      const changedFilesOutput = await this.repo.raw([
        'show',
        '--name-only',
        '--format=%n',
        this.commitSha
      ])

      this.showFiles = changedFilesOutput
        .split('\n')
        .filter(item => item.trim() !== '')
      this.changedFiles = this.showFiles.map(item => `${this.path}/${item}`)
    }
  }
}
