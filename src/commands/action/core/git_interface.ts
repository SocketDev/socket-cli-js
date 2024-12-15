import simpleGit, { SimpleGit, DefaultLogFields } from 'simple-git'

export interface GitInfo {
  path: string
  head: string
  repoName: string
  branch: string
  author: string
  commitSHA: string
  commitMessage: string
  committer: string
  showFiles: string[]
  changedFiles: string[]
}

export async function gitInfo(path: string): Promise<GitInfo> {
  const repo = simpleGit(path)

  let head: string
  let commit: DefaultLogFields | null = null
  let repoName: string = ''
  let branch: string = ''
  let author: string = ''
  let commitSHA: string = ''
  let commitMessage: string = ''
  let committer: string = ''
  const showFiles: string[] = []
  const changedFiles: string[] = []

  // Get the HEAD reference
  head = await repo.revparse(['HEAD'])

  // Get the latest commit log
  const logEntry = await repo.log({ n: 1 })
  commit = logEntry.latest

  // Extract the repository name from the origin remote URL
  const remotes = await repo.getRemotes(true)
  const originRemote = remotes.find(remote => remote.name === 'origin')

  if (originRemote) {
    const url = originRemote.refs.fetch
    repoName = url.split('/').pop()?.replace('.git', '') || ''
  }

  // Get the current branch
  try {
    const branches = await repo.branchLocal()
    branch = decodeURIComponent(branches.current)
  } catch (error) {
    console.error('Failed to get branch information:', error)
  }

  // Populate commit details
  if (commit) {
    author = commit.author_name || ''
    commitSHA = commit.hash || ''
    commitMessage = commit.message || ''
    committer = commit.author_email || ''
  }

  // List files changed in the latest commit
  if (commitSHA) {
    const changedFilesOutput = await repo.raw([
      'show',
      '--name-only',
      '--format=%n',
      commitSHA
    ])

    changedFilesOutput
      .split('\n')
      .filter(item => item.trim() !== '')
      .forEach(item => {
        showFiles.push(item)
        changedFiles.push(`${path}/${item}`)
      })
  }

  return {
    path,
    head,
    repoName,
    branch,
    author,
    commitSHA: commitSHA,
    commitMessage,
    committer,
    showFiles,
    changedFiles
  }
}
