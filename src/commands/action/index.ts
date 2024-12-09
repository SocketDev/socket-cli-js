import yargsParse, { Options } from 'yargs-parser'
import { CliSubcommand } from '../../utils/meow-with-subcommands'
import { pluralize } from '@socketsecurity/registry/lib/words'
import { readFileSync, existsSync } from 'node:fs'
import { Git } from './git'
import { GitError } from 'simple-git'
import { GitHub } from './core/github'
import { setupSdk } from '../../utils/sdk'
import { handleUnsuccessfulApiResponse } from '../../utils/api-helpers'
import { SocketSdkReturnType } from '@socketsecurity/sdk'
import { ErrorWithCause } from 'pony-cause'
import yoctoSpinner from '@socketregistry/yocto-spinner'

const yargsConfig: Options = {
  string: [
    'api-token',
    'repo',
    'branch',
    'committer',
    'commit-message',
    'target-path',
    'scm',
    'sbom-file',
    'commit-sha',
    'generate-license'
  ],
  number: ['pr-number'],
  boolean: [
    'default-branch',
    'enable-debug',
    'allow-unverified',
    'enable-json',
    'disable-overview',
    'disable-security-issue',
    'ignore-commit-files',
    'disable-blocking'
  ],
  array: ['files'],
  default: {
    'api-token': process.env['SOCKET_SECURITY_API_KEY'] ?? '',
    'target-path': './',
    scm: 'api', // or github or gitlab
    files: []
  }
}

export const action: CliSubcommand = {
  description: 'Socket action command',
  async run(argv_) {
    const yargv = <any>{
      ...yargsParse(<string[]>argv_, yargsConfig)
    }
    const unknown: string[] = yargv._
    const { length: unknownLength } = unknown
    if (unknownLength) {
      console.error(
        `Unknown ${pluralize('argument', unknownLength)}: ${yargv._.join(', ')}`
      )
      process.exitCode = 1
      return
    }
    console.log('Starting Socket Security Scan Version')
    let {
      apiToken,
      repo,
      branch,
      committer,
      prNumber,
      commitMessage,
      defaultBranch,
      targetPath,
      scm: scmType,
      sbomFile,
      commitSHA,
      generateLicense,
      enableDebug,
      allowUnverified,
      enableJSON,
      disableOverview,
      disableSecurityIssue,
      files,
      ignoreCommitFiles,
      disableBlocking
    }: {
      apiToken: string
      repo: string
      branch: string
      committer: string
      commitMessage: string
      defaultBranch: boolean
      targetPath: string
      scm: 'api' | 'github' | 'gitlab'
      sbomFile?: string
      commitSHA?: string
      generateLicense?: boolean
      enableDebug: boolean
      allowUnverified: boolean
      enableJSON: boolean
      disableOverview: boolean
      disableSecurityIssue: boolean
      ignoreCommitFiles: boolean
      disableBlocking: boolean
      prNumber?: number
      files: string[]
    } = yargv
    if (apiToken === undefined) {
      console.error('Unable to find Socket API Token')
      process.exit(3)
    }
    // TODO: improve to show which file failed
    let jsonFiles = []
    let isRepo = false
    try {
      jsonFiles = files.map(file => JSON.parse(readFileSync(file, 'utf-8')))
      isRepo = true
    } catch {
      console.error(`Failed to parse or read ${files.join(',')}`)
      process.exit(3)
    }
    if (existsSync(targetPath)) {
      console.error(`Unable to find path ${targetPath}`)
      process.exit(1)
    }
    try {
      const gitRepo = new Git(targetPath)
      await gitRepo.init()
      // TODO: https://github.com/SocketDev/socket-python-cli/blob/main/socketsecurity/socketcli.py#L273
    } catch (e) {
      if (e instanceof GitError) {
        isRepo = false
        ignoreCommitFiles = true
      } else {
        throw e
      }
    }
    if (repo === '') {
      console.log('Repo name needs to be set')
      process.exit(2)
    }
    let licenseFile = repo
    if (branch !== '') {
      licenseFile += `_${branch}`
    }
    licenseFile += '.json'
    let scm = null
    if (scmType === 'github') {
      scm = new GitHub()
    }
    // TODO: handle GitLab
    if (scm !== null) {
      defaultBranch = scm.isDefaultBranch
    }
    const baseApiUrl = process.env['BASE_API_URL'] ?? null
    let noChange = true
    const socketSdk = await setupSdk()
    if (ignoreCommitFiles) {
      noChange = false
    } else if (isRepo && files?.length > 0) {
      console.log(files)
      // matchSupportedFiles https://github.com/SocketDev/socket-python-cli/blob/main/socketsecurity/socketcli.py#L317
      const supportedFiles = await socketSdk
        .getReportSupportedFiles()
        .then(res => {
          if (!res.success)
            handleUnsuccessfulApiResponse(
              'getReportSupportedFiles',
              res,
              yoctoSpinner()
            )
          return (res as SocketSdkReturnType<'getReportSupportedFiles'>).data
        })
        .catch((cause: Error) => {
          throw new ErrorWithCause(
            'Failed getting supported files for report',
            {
              cause
            }
          )
        })
    }
    // TODO: ...
  }
}
