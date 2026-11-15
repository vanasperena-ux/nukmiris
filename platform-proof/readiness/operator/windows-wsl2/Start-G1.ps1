[CmdletBinding()]
param(
    [string]$Distro = 'Ubuntu-24.04',
    [string]$MachineLabel = 'UNATTESTED - operator must identify the separate verification machine',
    [string]$DockerDesktopVersion = ''
)
$ErrorActionPreference = 'Stop'
if (-not [Environment]::Is64BitOperatingSystem) { throw 'Windows x64 required.' }
$desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if ([string]::IsNullOrWhiteSpace($DockerDesktopVersion)) {
    if (-not (Test-Path -LiteralPath $desktop)) { throw 'Standard Docker Desktop executable not found. Supply -DockerDesktopVersion from its About screen or use the documented WSL route. No installation is attempted.' }
    $DockerDesktopVersion = (Get-Item -LiteralPath $desktop).VersionInfo.ProductVersion
}
$windows = Get-CimInstance -ClassName Win32_OperatingSystem
if ($windows.Caption -notmatch 'Windows 11') { throw 'This procedure targets Windows 11.' }
$wslVersion = (& wsl.exe --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'WSL version could not be read.' }
$runLabel = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$out = Join-Path $env:USERPROFILE ('Downloads\NukMiris-G1-' + $runLabel)
New-Item -ItemType Directory -Path $out -ErrorAction Stop | Out-Null
$receipt = Join-Path $out 'windows-host.json'
[ordered]@{
    windowsCaption = $windows.Caption
    windowsVersion = $windows.Version
    windowsBuild = $windows.BuildNumber
    os64Bit = [Environment]::Is64BitOperatingSystem
    selectedDistro = $Distro
    wslVersion = $wslVersion
    dockerDesktopVersion = $DockerDesktopVersion
    operatorMachineLabel = $MachineLabel
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $receipt -Encoding UTF8
$linuxKit = (& wsl.exe -d $Distro --exec wslpath -a -u $PSScriptRoot | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $linuxKit.StartsWith('/')) { throw 'Cannot resolve operator kit inside the selected WSL distro.' }
$linuxReceipt = (& wsl.exe -d $Distro --exec wslpath -a -u $receipt | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the Windows version receipt in WSL.' }
$console = Join-Path $out 'operator-console.log'
$savedErrorPreference = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    & wsl.exe -d $Distro --exec /usr/bin/env -u BASH_ENV -u ENV -u G1_OPERATOR_SCRUBBED bash --noprofile --norc ($linuxKit + '/verify-g1-wsl.sh') $linuxReceipt 2>&1 | Tee-Object -FilePath $console
    $runExit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $savedErrorPreference
}
$runMatches = @(Get-Content -LiteralPath $console | Select-String -Pattern '^RUN_DIRECTORY=(/tmp/nukmiris-readiness-windows-[A-Za-z0-9]+)$')
if ($runMatches.Count -eq 0) { throw ('Verification stopped before a results directory was reported. Preserve ' + $out) }
$linuxRun = $runMatches[-1].Matches[0].Groups[1].Value
$winRun = (& wsl.exe -d $Distro --exec wslpath -w $linuxRun | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot locate the retained WSL results. Preserve the printed RUN_DIRECTORY.' }
$leaf = ($linuxRun -split '/')[-1]
$zipName = $leaf + '-results.zip'
Copy-Item -LiteralPath (Join-Path $winRun $zipName) -Destination $out
Copy-Item -LiteralPath (Join-Path $winRun ($zipName + '.sha256')) -Destination $out
$zipPath = Join-Path $out $zipName
$expected = ((Get-Content -LiteralPath ($zipPath + '.sha256') -Raw).Trim() -split '\s+')[0]
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash.ToLowerInvariant()
if ($expected -notmatch '^[a-f0-9]{64}$' -or $actual -ne $expected) { throw 'RESULT ZIP CHECKSUM MISMATCH: stop and preserve both copies.' }
Write-Output ('RESULTS_FOLDER=' + $out)
Write-Output ('RESULT_ZIP_SHA256=' + $actual)
Write-Output ('WSL_EXIT_CODE=' + $runExit)
Write-Output 'No review/upload/deployment is automatic. Read the ZIP summary and attach it manually only when requested.'
if ($runExit -ne 0) { throw ('Local verification incomplete; partial evidence retained. WSL exit code ' + $runExit) }
