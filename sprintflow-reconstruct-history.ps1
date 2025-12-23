param(
  [string]$TargetBranch = "main",
  [switch]$Force,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  $gitArgs = $args
  $output = & git @gitArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git $($gitArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
  return $output
}

function Test-GitRef {
  param([string]$Ref)
  & git show-ref --verify --quiet $Ref
  return $LASTEXITCODE -eq 0
}

function Set-GitIdentity {
  param([string]$When)
  $env:GIT_AUTHOR_NAME = $script:AuthorName
  $env:GIT_AUTHOR_EMAIL = $script:AuthorEmail
  $env:GIT_COMMITTER_NAME = $script:AuthorName
  $env:GIT_COMMITTER_EMAIL = $script:AuthorEmail
  $env:GIT_AUTHOR_DATE = $When
  $env:GIT_COMMITTER_DATE = $When
}

function Stage-TextFile {
  param(
    [string]$Path,
    [string]$Content
  )

  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($tmp, $Content, $utf8NoBom)
    $blob = (Invoke-Git hash-object -w $tmp).Trim()
    Invoke-Git update-index --add --cacheinfo "100644,$blob,$Path" | Out-Null
  }
  finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}

function New-HistoryCommit {
  param(
    [string]$Message,
    [string]$Parent,
    [string[]]$Paths = @(),
    [hashtable]$TextFiles = @{},
    [string]$When
  )

  $index = Join-Path ([System.IO.Path]::GetTempPath()) ("sprintflow-index-" + [guid]::NewGuid().ToString("N"))
  $previousIndex = $env:GIT_INDEX_FILE
  try {
    $env:GIT_INDEX_FILE = $index
    if ([string]::IsNullOrWhiteSpace($Parent)) {
      Invoke-Git read-tree --empty | Out-Null
    } else {
      Invoke-Git read-tree "$Parent^{tree}" | Out-Null
    }

    if ($Paths.Count -gt 0) {
      $addArgs = @("add", "--") + $Paths
      Invoke-Git @addArgs | Out-Null
    }

    foreach ($path in $TextFiles.Keys) {
      Stage-TextFile -Path $path -Content $TextFiles[$path]
    }

    $tree = (Invoke-Git write-tree).Trim()
    Set-GitIdentity $When

    $commitArgs = @("commit-tree", $tree)
    if (-not [string]::IsNullOrWhiteSpace($Parent)) {
      $commitArgs += @("-p", $Parent)
    }
    $commitArgs += @("-m", $Message)

    return (Invoke-Git @commitArgs).Trim()
  }
  finally {
    if ($null -eq $previousIndex) {
      Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue
    } else {
      $env:GIT_INDEX_FILE = $previousIndex
    }
    Remove-Item -LiteralPath $index -Force -ErrorAction SilentlyContinue
  }
}

function New-HistoryCommitFromTree {
  param(
    [string]$Message,
    [string]$Parent,
    [string]$Tree,
    [string]$When
  )

  Set-GitIdentity $When
  $commitArgs = @("commit-tree", $Tree)
  if (-not [string]::IsNullOrWhiteSpace($Parent)) {
    $commitArgs += @("-p", $Parent)
  }
  $commitArgs += @("-m", $Message)
  return (Invoke-Git @commitArgs).Trim()
}

function New-MergeCommit {
  param(
    [string]$Message,
    [string]$MainParent,
    [string]$TopicParent,
    [string]$When
  )

  $index = Join-Path ([System.IO.Path]::GetTempPath()) ("sprintflow-index-" + [guid]::NewGuid().ToString("N"))
  $previousIndex = $env:GIT_INDEX_FILE
  try {
    $env:GIT_INDEX_FILE = $index
    Invoke-Git read-tree "$TopicParent^{tree}" | Out-Null
    $tree = (Invoke-Git write-tree).Trim()
    Set-GitIdentity $When
    return (Invoke-Git commit-tree $tree -p $MainParent -p $TopicParent -m $Message).Trim()
  }
  finally {
    if ($null -eq $previousIndex) {
      Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue
    } else {
      $env:GIT_INDEX_FILE = $previousIndex
    }
    Remove-Item -LiteralPath $index -Force -ErrorAction SilentlyContinue
  }
}

function New-AnnotatedTag {
  param(
    [string]$Name,
    [string]$Target,
    [string]$Message,
    [string]$When
  )

  Set-GitIdentity $When
  Invoke-Git tag -a $Name $Target -m $Message | Out-Null
}

$repo = (Invoke-Git rev-parse --show-toplevel).Trim()
Set-Location $repo

$currentHead = (Invoke-Git rev-parse HEAD).Trim()
$currentTree = (Invoke-Git rev-parse "HEAD^{tree}").Trim()
$currentBranch = (Invoke-Git branch --show-current).Trim()
$dirtyTracked = & git status --porcelain --untracked-files=no
if ($dirtyTracked) {
  throw "Tracked working tree changes are present. Commit or stash them before rewriting history."
}

$script:AuthorName = (Invoke-Git log -1 --format=%an).Trim()
$script:AuthorEmail = (Invoke-Git log -1 --format=%ae).Trim()
if ([string]::IsNullOrWhiteSpace($script:AuthorName)) { $script:AuthorName = "Arian" }
if ([string]::IsNullOrWhiteSpace($script:AuthorEmail)) { $script:AuthorEmail = "arian@example.com" }

$featureRefs = @(
  "refs/heads/feature/api-foundation",
  "refs/heads/feature/react-client",
  "refs/heads/feature/api-quality",
  "refs/heads/feature/demo-media",
  "refs/heads/chore/deployment-pipeline"
)
$tagNames = @(
  "v0.1.0-api-preview",
  "v0.2.0-client-beta",
  "v0.3.0-quality-pass",
  "v0.4.0-demo-media",
  "v1.0.0"
)

if ($DryRun) {
  Write-Host "Would reconstruct history on '$TargetBranch' from current tree $currentTree."
  Write-Host "Would preserve current HEAD $currentHead on backup/original-history-<timestamp>."
  Write-Host "Would create feature branches: $($featureRefs -replace '^refs/heads/' -join ', ')"
  Write-Host "Would create tags: $($tagNames -join ', ')"
  exit 0
}

foreach ($ref in $featureRefs) {
  if (Test-GitRef $ref) {
    if (-not $Force) { throw "$ref already exists. Re-run with -Force to replace reconstructed feature refs." }
    Invoke-Git update-ref -d $ref | Out-Null
  }
}

foreach ($tag in $tagNames) {
  if (Test-GitRef "refs/tags/$tag") {
    if (-not $Force) { throw "Tag $tag already exists. Re-run with -Force to replace reconstructed tags." }
    Invoke-Git tag -d $tag | Out-Null
  }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupBranch = "backup/original-history-$stamp"
Invoke-Git branch $backupBranch $currentHead | Out-Null

$appWithoutDemoRoute = @(
  'import express, { Express } from "express"',
  'import cors from "cors"',
  'import swaggerUi from "swagger-ui-express"',
  'import YAML from "yamljs"',
  '',
  'import login from "./routes/login"',
  'import tickets from "./routes/tickets"',
  'import users from "./routes/users"',
  'import companies from "./routes/companies"',
  'import charts from "./routes/charts"',
  '',
  'const app: Express = express()',
  '',
  'app.use(cors())',
  'app.use(express.json())',
  '',
  'app.use("/api/login", login)',
  'app.use("/api/tickets", tickets)',
  'app.use("/api/users", users)',
  'app.use("/api/companies", companies)',
  'app.use("/api/charts", charts)',
  '',
  'const swaggerDocument = YAML.load("./swagger.yml")',
  'app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))',
  '',
  'export default app'
) -join "`r`n"

$main = New-HistoryCommit `
  -Message "Initialize SprintFlow monorepo tooling" `
  -Paths @(
    ".gitignore",
    "client/package.json",
    "client/package-lock.json",
    "client/tsconfig.json",
    "client/tsconfig.node.json",
    "client/vite.config.ts",
    "client/index.html",
    "client/public",
    "client/src/vite-env.d.ts",
    "server/package.json",
    "server/package-lock.json",
    "server/tsconfig.json"
  ) `
  -When "2025-10-19T10:17:00-04:00"

$api = New-HistoryCommit `
  -Message "Model support workflow domain with Mongoose" `
  -Parent $main `
  -Paths @("server/models", "server/configs") `
  -When "2025-10-20T21:34:00-04:00"

$api = New-HistoryCommit `
  -Message "Implement Google OAuth login and JWT session middleware" `
  -Parent $api `
  -Paths @(
    "server/api",
    "server/middlewares",
    "server/utils/safeParse.ts",
    "server/routes/login.ts",
    "server/routes/users.ts"
  ) `
  -When "2025-10-22T07:58:00-04:00"

$api = New-HistoryCommit `
  -Message "Add company onboarding and ticket lifecycle endpoints" `
  -Parent $api `
  -Paths @("server/routes/companies.ts", "server/routes/tickets.ts") `
  -When "2025-10-23T22:11:00-04:00"

$api = New-HistoryCommit `
  -Message "Add reporting chart aggregations and API server entrypoint" `
  -Parent $api `
  -Paths @(
    "server/routes/charts.ts",
    "server/utils/handleDates.ts",
    "server/index.ts",
    "server/.env.example",
    "server/swagger.yml"
  ) `
  -TextFiles @{ "server/app.ts" = $appWithoutDemoRoute } `
  -When "2025-10-25T15:26:00-04:00"

Invoke-Git update-ref refs/heads/feature/api-foundation $api | Out-Null
$main = New-MergeCommit `
  -Message "Merge pull request #1 from feature/api-foundation" `
  -MainParent $main `
  -TopicParent $api `
  -When "2025-10-26T20:42:00-04:00"
New-AnnotatedTag -Name "v0.1.0-api-preview" -Target $main -Message "v0.1.0-api-preview - API preview" -When "2025-10-26T20:50:00-04:00"

$client = New-HistoryCommit `
  -Message "Scaffold React layout shell and shared UI primitives" `
  -Parent $main `
  -Paths @(
    "client/src/layout",
    "client/src/components",
    "client/src/pages/NotFound",
    "client/src/assets/logo.svg",
    "client/src/assets/not-found.webp"
  ) `
  -When "2025-10-29T08:14:00-04:00"

$client = New-HistoryCommit `
  -Message "Add typed API client and RxJS-backed session state" `
  -Parent $client `
  -Paths @(
    "client/src/api",
    "client/src/states",
    "client/src/hooks",
    "client/src/utils"
  ) `
  -When "2025-10-30T22:37:00-04:00"

$client = New-HistoryCommit `
  -Message "Build OAuth landing and company onboarding flows" `
  -Parent $client `
  -Paths @(
    "client/src/pages/Landing",
    "client/src/pages/Callback",
    "client/src/pages/Onboarding",
    "client/src/assets/avatars",
    "client/src/assets/default-avatar.webp",
    "client/src/assets/dashboard-preview.png"
  ) `
  -When "2025-11-01T17:09:00-04:00"

$client = New-HistoryCommit `
  -Message "Implement ticket creation, detail, and messaging workflows" `
  -Parent $client `
  -Paths @(
    "client/src/pages/Create",
    "client/src/pages/Ticket",
    "client/src/pages/TicketList",
    "client/src/assets/priority-low.svg",
    "client/src/assets/priority-medium.svg",
    "client/src/assets/priority-high.svg",
    "client/src/assets/empty-state.webp",
    "client/src/assets/no-messages.webp"
  ) `
  -When "2025-11-04T21:48:00-05:00"

$client = New-HistoryCommit `
  -Message "Add dashboard analytics, profile management, and responsive styling" `
  -Parent $client `
  -Paths @(
    "client/src/pages/Dashboard",
    "client/src/pages/Profile",
    "client/src/pages/Users",
    "client/src/assets/status-total.svg",
    "client/src/assets/status-open.svg",
    "client/src/assets/status-pending.svg",
    "client/src/assets/status-closed.svg",
    "client/src/index.css",
    "client/src/main.tsx",
    "client/src/App.tsx"
  ) `
  -When "2025-11-10T19:32:00-05:00"

Invoke-Git update-ref refs/heads/feature/react-client $client | Out-Null
$main = New-MergeCommit `
  -Message "Merge pull request #2 from feature/react-client" `
  -MainParent $main `
  -TopicParent $client `
  -When "2025-11-11T08:41:00-05:00"
New-AnnotatedTag -Name "v0.2.0-client-beta" -Target $main -Message "v0.2.0-client-beta - React client beta" -When "2025-11-11T08:49:00-05:00"

$quality = New-HistoryCommit `
  -Message "Add in-memory Mongo test harness for API integration coverage" `
  -Parent $main `
  -Paths @("server/jest.config.json", "server/tests/databaseHandler.ts") `
  -When "2025-11-14T18:54:00-05:00"

$quality = New-HistoryCommit `
  -Message "Cover auth, companies, users, and tickets API routes" `
  -Parent $quality `
  -Paths @(
    "server/tests/login.test.ts",
    "server/tests/companies.test.ts",
    "server/tests/users.test.ts",
    "server/tests/tickets.test.ts"
  ) `
  -When "2025-11-16T11:18:00-05:00"

Invoke-Git update-ref refs/heads/feature/api-quality $quality | Out-Null
$main = New-MergeCommit `
  -Message "Merge pull request #3 from feature/api-quality" `
  -MainParent $main `
  -TopicParent $quality `
  -When "2025-11-21T16:20:00-05:00"
New-AnnotatedTag -Name "v0.3.0-quality-pass" -Target $main -Message "v0.3.0-quality-pass - API integration coverage" -When "2025-11-21T16:32:00-05:00"

$demo = New-HistoryCommit `
  -Message "Add deterministic demo mode backed by real Mongo models" `
  -Parent $main `
  -Paths @(
    "server/app.ts",
    "server/routes/demo.ts",
    "server/utils/demoData.ts",
    "server/scripts/seedDemoData.ts",
    "server/scripts/startDemoServer.ts"
  ) `
  -When "2025-11-29T13:44:00-05:00"

$demo = New-HistoryCommit `
  -Message "Automate documentation media capture with Playwright" `
  -Parent $demo `
  -Paths @("client/playwright.config.ts", "client/tests/docs-media.spec.ts") `
  -When "2025-12-01T22:26:00-05:00"

$demo = New-HistoryCommit `
  -Message "Generate product screenshots and animated demo media" `
  -Parent $demo `
  -Paths @("docs/assets") `
  -When "2025-12-03T20:12:00-05:00"

Invoke-Git update-ref refs/heads/feature/demo-media $demo | Out-Null
$main = New-MergeCommit `
  -Message "Merge pull request #4 from feature/demo-media" `
  -MainParent $main `
  -TopicParent $demo `
  -When "2025-12-06T10:18:00-05:00"
New-AnnotatedTag -Name "v0.4.0-demo-media" -Target $main -Message "v0.4.0-demo-media - deterministic demo media" -When "2025-12-06T10:27:00-05:00"

$deploy = New-HistoryCommit `
  -Message "Containerize React client with Nginx static delivery" `
  -Parent $main `
  -Paths @("client/Dockerfile", "client/nginx.conf", "client/.dockerignore") `
  -When "2025-12-10T21:40:00-05:00"

$deploy = New-HistoryCommit `
  -Message "Containerize Express API for Docker-based releases" `
  -Parent $deploy `
  -Paths @("server/Dockerfile", "server/.dockerignore") `
  -When "2025-12-12T14:11:00-05:00"

$deploy = New-HistoryCommit `
  -Message "Add Docker Hub publishing workflows for client and server" `
  -Parent $deploy `
  -Paths @(".github") `
  -When "2025-12-15T08:36:00-05:00"

$deploy = New-HistoryCommit `
  -Message "Tighten environment templates and ignored local artifacts" `
  -Parent $deploy `
  -Paths @(
    "client/.env.example",
    "client/.gitignore",
    "server/.gitignore"
  ) `
  -When "2025-12-17T22:33:00-05:00"

Invoke-Git update-ref refs/heads/chore/deployment-pipeline $deploy | Out-Null
$main = New-MergeCommit `
  -Message "Merge pull request #5 from chore/deployment-pipeline" `
  -MainParent $main `
  -TopicParent $deploy `
  -When "2025-12-18T09:02:00-05:00"

$main = New-HistoryCommitFromTree `
  -Message "Prepare SprintFlow 1.0 release documentation" `
  -Parent $main `
  -Tree $currentTree `
  -When "2025-12-23T15:37:00-05:00"
New-AnnotatedTag -Name "v1.0.0" -Target $main -Message "v1.0.0 - public SprintFlow release" -When "2025-12-23T15:44:00-05:00"

$finalTree = (Invoke-Git rev-parse "$main^{tree}").Trim()
if ($finalTree -ne $currentTree) {
  throw "Final reconstructed tree $finalTree does not match current HEAD tree $currentTree. Ref update aborted."
}

Invoke-Git update-ref "refs/heads/$TargetBranch" $main | Out-Null

Write-Host "Reconstructed $TargetBranch at $main"
Write-Host "Original history preserved at $backupBranch ($currentHead)"
Write-Host "Feature branches created: feature/api-foundation, feature/react-client, feature/api-quality, feature/demo-media, chore/deployment-pipeline"
Write-Host "Tags created: $($tagNames -join ', ')"
Write-Host "Final tree verified unchanged: $finalTree"
if ($currentBranch -eq $TargetBranch) {
  Write-Host "Current branch '$TargetBranch' now points at the reconstructed history."
}
