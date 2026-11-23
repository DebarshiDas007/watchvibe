# Daily refresh runner, started by the Windows scheduled task "WatchVibe daily refresh" (daily 09:00 and at every sign-in; it catches up
# after the PC was off). It refreshes catalog_fresh.json, deploys the site with the existing local Cloudflare login, and commits the data.
# Safe by design:
#   - runs at most once a day (last_deployed_day.txt), and never at the same time as another run (lock file)
#   - does nothing when the working tree has other uncommitted changes, so it can never ship half-finished work
#   - a failed refresh or deploy changes nothing on the live site and is retried at the next trigger
# Log: logs\daily_refresh.log
$ErrorActionPreference = 'Continue'
$env:PYTHONUTF8 = '1'; $env:PYTHONIOENCODING = 'utf-8'   # deploy.py prints emoji; without this it crashes when its output is piped to the log
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$logDir = Join-Path $repo 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'daily_refresh.log'
function Log($m) { Add-Content -Path $log -Value ('{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $m) -Encoding UTF8 }

$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
$stateFile = Join-Path $logDir 'last_deployed_day.txt'
if ((Test-Path $stateFile) -and ((Get-Content $stateFile -Raw).Trim() -eq $today)) { exit 0 }

# one run at a time (a stale lock older than 2 hours is ignored)
$lock = Join-Path $logDir 'running.lock'
if ((Test-Path $lock) -and (((Get-Date) - (Get-Item $lock).LastWriteTime).TotalHours -lt 2)) { Log 'another run is in progress, skipping'; exit 0 }
Set-Content -Path $lock -Value (Get-Date).ToString('o')
try {
  $dirty = @(git status --porcelain | Where-Object { $_ -notmatch 'catalog_fresh\.json$' -and $_ -notmatch 'logs/' })
  if ($dirty.Count -gt 0) { Log ("skipped: {0} uncommitted change(s) in the project, will retry at the next trigger" -f $dirty.Count); exit 0 }

  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  $py = (Get-Command python -ErrorAction SilentlyContinue).Source
  if (-not $node -or -not $py) { Log 'ERROR: node or python not found on PATH'; exit 1 }

  Log 'refresh start'
  $out = & $node (Join-Path $repo 'scripts\refresh_daily.mjs') 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { Log ('ERROR: refresh script failed: ' + $out.Substring([Math]::Max(0, $out.Length - 400))); exit 1 }
  $summary = (($out -split "`r?`n") | Where-Object { $_ -match 'rated changes|WARNING|failed' } | Select-Object -Last 2) -join ' | '
  Log ('refresh done: ' + $summary)

  # the new file must be sane before it goes live
  try { $d = Get-Content (Join-Path $repo 'web_live_build\catalog_fresh.json') -Raw | ConvertFrom-Json } catch { $d = $null }
  if (-not $d -or $d.day -ne $today -or $null -eq $d.r -or $null -eq $d.news) { Log 'ERROR: catalog_fresh.json failed the sanity check, not deploying'; git checkout -- web_live_build/catalog_fresh.json 2>$null; exit 1 }

  Log 'deploy start'
  $dep = & $py (Join-Path $repo 'deploy.py') 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -or $dep -notmatch 'Deployment completed successfully') { Log ('ERROR: deploy failed: ' + $dep.Substring([Math]::Max(0, $dep.Length - 400))); exit 1 }
  Log 'deploy ok'
  Set-Content -Path $stateFile -Value $today

  git add web_live_build/catalog_fresh.json 2>&1 | Out-Null
  git commit -q -m "Daily data refresh $today`n`nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" 2>&1 | Out-Null
  git push -q 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Log 'note: git push failed (the site is deployed; the data commit stays local)' } else { Log 'committed and pushed' }
}
finally { Remove-Item $lock -Force -ErrorAction SilentlyContinue }
