$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$batchSource = Join-Path $root "launcher\StlToBgsdLauncher.cs"
$batchTarget = Join-Path $root "STL-to-BGSD.exe"
$guiSource = Join-Path $root "launcher\StlToBgsdGuiLauncher.cs"
$guiTarget = Join-Path $root "STL-to-BGSD-GUI.exe"

if (-not (Test-Path $batchSource)) {
  throw "Source not found: $batchSource"
}

if (-not (Test-Path $guiSource)) {
  throw "Source not found: $guiSource"
}

Add-Type -OutputAssembly $batchTarget -OutputType ConsoleApplication -Path $batchSource
Add-Type -OutputAssembly $guiTarget -OutputType ConsoleApplication -Path $guiSource
Write-Host "Built $batchTarget"
Write-Host "Built $guiTarget"
