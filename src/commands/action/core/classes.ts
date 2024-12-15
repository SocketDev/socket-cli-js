export class Report {
  branch?: string
  commit?: string
  id?: string
  pullRequests: any[] = []
  url?: string
  repo?: string
  processed: boolean = false
  owner?: string
  createdAt?: string
  sbom: any[] = []

  constructor(options: Partial<Report> = {}) {
    Object.assign(this, options)
    if (this.pullRequests && typeof this.pullRequests === 'string') {
      this.pullRequests = JSON.parse(this.pullRequests)
    }
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class Score {
  supplyChain?: number
  quality?: number
  maintenance?: number
  license?: number
  overall?: number
  vulnerability?: number

  constructor(options: Partial<Score> = {}) {
    Object.assign(this, options)
    for (const key in this) {
      // @ts-ignore
      if (typeof this[key] === 'number' && this[key] <= 1) {
        // @ts-ignore
        this[key] = this[key] * 100
      }
    }
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class Package {
  type?: string
  name?: string
  version?: string
  release?: string
  id?: string
  direct: boolean = false
  manifestFiles: any[] = []
  author: any[] = []
  size: number = 0
  score: Record<string, any> = {}
  scores?: Score
  alerts: any[] = []
  errorAlerts: any[] = []
  alertCounts: Record<string, number> = {
    critical: 0,
    high: 0,
    middle: 0,
    low: 0
  }
  topLevelAncestors: any[] = []
  url: string
  transitives: number = 0
  license: string = 'NoLicenseFound'
  licenseText: string = ''
  purl: string

  constructor(options: Partial<Package> = {}) {
    Object.assign(this, options)
    this.url = `https://socket.dev/${this.type}/package/${this.name}/overview/${this.version}`
    if (this.score) {
      this.scores = new Score(this.score)
    }
    this.purl = `${this.type}/${this.name}@${this.version}`
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class Issue {
  pkgType?: string
  pkgName?: string
  pkgVersion?: string
  category?: string
  type?: string
  severity?: string
  pkgId?: string
  props?: Record<string, any>
  key?: string
  error: boolean = false
  warn: boolean = false
  ignore: boolean = false
  monitor: boolean = false
  description?: string
  title?: string
  emoji?: string
  nextStepTitle?: string
  suggestion?: string
  introducedBy: any[] = []
  manifests: string = ''
  url?: string
  purl?: string

  constructor(options: Partial<Issue> = {}) {
    Object.assign(this, options)
    if (this.introducedBy) {
      this.manifests = this.introducedBy
        .map(([pkg, manifest]: [string, string]) => manifest)
        .join(';')
    }
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class YamlFile {
  path?: string
  name?: string
  team: any[] = []
  module: any[] = []
  production?: boolean
  pii?: boolean
  alerts: Record<string, any> = {}
  errorIds: any[] = []

  constructor(options: Partial<YamlFile> = {}) {
    Object.assign(this, options)
  }

  toString(): string {
    const alerts = Object.entries(this.alerts).reduce(
      (acc, [key, value]) => {
        const issue: Issue = value.issue
        acc[key] = {
          issue: JSON.parse(issue.toString()),
          manifests: value.manifests
        }
        return acc
      },
      {} as Record<string, any>
    )

    return JSON.stringify({ ...this, alerts })
  }
}

export class Alert {
  key?: string
  type?: string
  severity?: string
  category?: string
  props: Record<string, any> = {}

  constructor(options: Partial<Alert> = {}) {
    Object.assign(this, options)
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class FullScan {
  id?: string
  createdAt?: string
  updatedAt?: string
  organizationId?: string
  repositoryId?: string
  branch?: string
  commitMessage?: string
  commitHash?: string
  pullRequest?: number
  sbomArtifacts: any[] = []
  packages?: Record<string, any>

  constructor(options: Partial<FullScan> = {}) {
    Object.assign(this, options)
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class Repository {
  id?: string
  createdAt?: string
  updatedAt?: string
  headFullScanId?: string
  name?: string
  description?: string
  homepage?: string
  visibility?: string
  archived?: boolean
  defaultBranch?: string

  constructor(options: Partial<Repository> = {}) {
    Object.assign(this, options)
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class FullScanParams {
  repo?: string
  branch?: string
  commitMessage?: string
  commitHash?: string
  pullRequest?: number
  committers?: string
  makeDefaultBranch?: boolean
  setAsPendingHead?: boolean

  constructor(options: Partial<FullScanParams> = {}) {
    Object.assign(this, options)
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class Diff {
  newPackages: any[] = []
  newCapabilities: Record<string, any> = {}
  removedPackages: any[] = []
  newAlerts: any[] = []
  id?: string
  sbom?: string
  packages?: Record<string, any>
  reportUrl?: string
  diffUrl?: string

  constructor(options: Partial<Diff> = {}) {
    Object.assign(this, options)
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class Purl {
  id?: string
  name?: string
  version?: string
  ecosystem?: string
  direct: boolean = false
  author: any[] = []
  size: number = 0
  transitives: number = 0
  introducedBy: any[] = []
  capabilities: Record<string, any> = {}
  isNew: boolean = false
  authorUrl: string
  url?: string
  purl?: string

  constructor(options: Partial<Purl> = {}) {
    Object.assign(this, options)
    // TODO: better handle ecosystem
    this.authorUrl = Purl.generateAuthorData(
      this.author,
      this.ecosystem ?? 'npm'
    )
  }

  static generateAuthorData(authors: string[], ecosystem: string): string {
    return authors
      .map(
        author => `[${author}](https://socket.dev/${ecosystem}/user/${author})`
      )
      .join(',')
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class GithubComment {
  url?: string
  htmlUrl?: string
  issueUrl?: string
  id?: number
  nodeId?: string
  user?: Record<string, any>
  createdAt?: string
  updatedAt?: string
  authorAssociation?: string
  body?: string
  bodyList: string[] = []
  reactions?: Record<string, any>
  performedViaGithubApp?: Record<string, any>

  constructor(options: Partial<GithubComment> = {}) {
    Object.assign(this, options)
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class GitlabComment {
  id?: number
  type?: string
  body?: string
  attachment?: string
  author?: Record<string, any>
  createdAt?: string
  updatedAt?: string
  system?: boolean
  notableId?: number
  noteableType?: string
  projectId?: number
  resolvable?: boolean
  confidential?: boolean
  internal?: boolean
  imported?: boolean
  importedFrom?: string
  noteableIid?: number
  commandsChanges?: Record<string, any>
  bodyList: string[] = []

  constructor(options: Partial<GitlabComment> = {}) {
    Object.assign(this, options)
  }

  toString(): string {
    return JSON.stringify(this)
  }
}

export class Comment {
  id?: number
  body?: string
  bodyList: string[] = []

  constructor(options: Partial<Comment> = {}) {
    Object.assign(this, options)
  }

  toString(): string {
    return JSON.stringify(this)
  }
}
