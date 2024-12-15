import yargsParse, { Options } from 'yargs-parser'
import { CliSubcommand } from '../../utils/meow-with-subcommands'
import { pluralize } from '@socketsecurity/registry/lib/words'
import { readFileSync, existsSync } from 'node:fs'
import { Git, gitInfo } from './core/git_interface.ts'
import { GitError } from 'simple-git'
import { GitHub } from './core/github'
import { setupSdk } from '../../utils/sdk'
import { handleUnsuccessfulApiResponse } from '../../utils/api-helpers'
import { SocketSdkReturnType } from '@socketsecurity/sdk'
import { ErrorWithCause } from 'pony-cause'
import yoctoSpinner from '@socketregistry/yocto-spinner'
import * as comments from './core/scm_comments.ts'
import { createDebugLogger } from '../../utils/misc'
import { Diff, FullScanParams } from './core/classes.ts'

const debug = createDebugLogger(false)

function outputConsoleComments(
  diffReport: Diff,
  sbomFileName: string | null = null
): void {
  if (diffReport.id !== 'NO_DIFF_RAN') {
    const consoleSecurityComment =
      Messages.createConsoleSecurityAlertTable(diffReport)
    saveSbomFile(diffReport, sbomFileName)
    console.log(`Socket Full Scan ID: ${diffReport.id}`)
    if (diffReport.newAlerts.length > 0) {
      console.log('Security issues detected by Socket Security')
      const msg = `\n${consoleSecurityComment}`
      console.log(msg)
      if (!reportPass(diffReport) && !blockingDisabled) {
        process.exit(1)
      } else {
        // Means only warning alerts with no blocked
        if (!blockingDisabled) {
          process.exit(5)
        }
      }
    } else {
      console.log('No New Security issues detected by Socket Security')
    }
  }
}

function outputConsoleJson(
  diffReport: Diff,
  sbomFileName: string | null = null
): void {
  if (diffReport.id !== 'NO_DIFF_RAN') {
    const consoleSecurityComment =
      Messages.createSecurityCommentJson(diffReport)
    saveSbomFile(diffReport, sbomFileName)
    console.log(JSON.stringify(consoleSecurityComment))
    if (!reportPass(diffReport) && !blockingDisabled) {
      process.exit(1)
    } else if (diffReport.newAlerts.length > 0 && !blockingDisabled) {
      // Means only warning alerts with no blocked
      process.exit(5)
    }
  }
}

function reportPass(diffReport: Diff): boolean {
  let reportPassed = true
  if (diffReport.newAlerts.length > 0) {
    for (const alert of diffReport.newAlerts) {
      if (reportPassed && alert.error) {
        reportPassed = false
        break
      }
    }
  }
  return reportPassed
}

function saveSbomFile(
  diffReport: Diff,
  sbomFileName: string | null = null
): void {
  if (diffReport !== null && sbomFileName !== null) {
    Core.saveFile(
      sbomFileName,
      JSON.stringify(Core.createSbomOutput(diffReport))
    )
  }
}

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
      const gitRepo = await gitInfo(targetPath)
      if (!repo) {
        repo = gitRepo.repoName
      }
      if (!commitSHA || commitSHA === '') {
        commitSHA = gitRepo.commit
      }
      if (!branch || branch === '') {
        branch = gitRepo.branch
      }
      if (!committer || committer === '') {
        committer = gitRepo.committer
      }
      if (!commitMessage || commitMessage === '') {
        commitMessage = gitRepo.commitMessage
      }
      if (files.length === 0 && !ignoreCommitFiles) {
        files = gitRepo.changedFiles
        isRepo = true
      }
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
    let setAsPendingHead = false
    if (defaultBranch) {
      setAsPendingHead = true
    }
    const params = new FullScanParams({
      repo,
      branch,
      commitMessage,
      commitHash: commitSHA,
      pullRequest: prNumber,
      committers: committer,
      makeDefaultBranch: defaultBranch,
      setAsPendingHead
    })
    let diff: Diff = new Diff()
    diff.id = 'NO_DIFF_RAN'
    if (scm !== null && scm.checkEventType() === 'comment') {
      console.log('Comment initiated flow')
      debug(
        `Getting comments for Repo ${scm.repository} for PR ${scm.prNumber}`
      )
      const comments = scm.getCommentsForPr(
        scm.repository,
        String(scm.prNumber)
      )
      debug('Removing comment alerts')
      scm.removeCommentAlerts(comments)
    } else if (scm !== null && scm.checkEventType() !== 'comment') {
      console.log('Push initiated flow')
      if (noChange) {
        console.log('No manifest files changes, skipping scan')
        // console.log("No dependency changes");
      } else if (scm.checkEventType() === 'diff') {
        diff = core.createNewDiff(targetPath, params, targetPath, noChange)
        console.log('Starting comment logic for PR/MR event')
        debug(
          `Getting comments for Repo ${scm.repository} for PR ${scm.prNumber}`
        )
        const comments = scm.getCommentsForPr(repo, String(prNumber))
        debug('Removing comment alerts')
        diff.newAlerts = Comments.removeAlerts(comments, diff.newAlerts)
        debug('Creating Dependency Overview Comment')
        const overviewComment = Messages.dependencyOverviewTemplate(diff)
        debug('Creating Security Issues Comment')
        const securityComment = Messages.securityCommentTemplate(diff)
        let newSecurityComment = true
        let newOverviewComment = true
        const updateOldSecurityComment =
          securityComment === null ||
          securityComment === '' ||
          (comments.length !== 0 && comments.get('security') !== null)
        const updateOldOverviewComment =
          overviewComment === null ||
          overviewComment === '' ||
          (comments.length !== 0 && comments.get('overview') !== null)
        if (diff.newAlerts.length === 0 || disableSecurityIssue) {
          if (!updateOldSecurityComment) {
            newSecurityComment = false
            debug('No new alerts or security issue comment disabled')
          } else {
            debug('Updated security comment with no new alerts')
          }
        }
        if (
          (diff.newPackages.length === 0 &&
            diff.removedPackages.length === 0) ||
          disableOverview
        ) {
          if (!updateOldOverviewComment) {
            newOverviewComment = false
            debug(
              'No new/removed packages or Dependency Overview comment disabled'
            )
          } else {
            debug('Updated overview comment with no dependencies')
          }
        }
        debug(`Adding comments for ${scmType}`)
        scm.addSocketComments(
          securityComment,
          overviewComment,
          comments,
          newSecurityComment,
          newOverviewComment
        )
      } else {
        console.log('Starting non-PR/MR flow')
        diff = core.createNewDiff(targetPath, params, targetPath, noChange)
      }
      if (enableJson) {
        debug('Outputting JSON Results')
        outputConsoleJson(diff, sbomFile)
      } else {
        outputConsoleComments(diff, sbomFile)
      }
    } else {
      console.log('API Mode')
      diff = core.createNewDiff(targetPath, params, targetPath, noChange)
      if (enableJson) {
        outputConsoleJson(diff, sbomFile)
      } else {
        outputConsoleComments(diff, sbomFile)
      }
    }
    if (diff !== null && licenseMode) {
      const allPackages: { [key: string]: any } = {}
      for (const packageId in diff.packages) {
        const packageInfo: Package = diff.packages[packageId]
        const output = {
          id: packageId,
          name: packageInfo.name,
          version: packageInfo.version,
          ecosystem: packageInfo.type,
          direct: packageInfo.direct,
          url: packageInfo.url,
          license: packageInfo.license,
          license_text: packageInfo.licenseText
        }
        allPackages[packageId] = output
      }
      core.saveFile(licenseFile, JSON.stringify(allPackages))
    }
  }
}
