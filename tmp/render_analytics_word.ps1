$ErrorActionPreference = 'Stop'
$analyticsDoc = (Resolve-Path -LiteralPath 'docs\BloodConnect_Analytics_Testing_Report.docx').Path
$analyticsQaDir = Join-Path (Get-Location).Path 'tmp\analytics-docx-qa'
New-Item -ItemType Directory -Path $analyticsQaDir -Force | Out-Null
$analyticsPdf = Join-Path $analyticsQaDir 'BloodConnect_Analytics_Testing_Report.pdf'
$analyticsWord = $null
$analyticsOpenDoc = $null
try {
    $analyticsWord = New-Object -ComObject Word.Application
    $analyticsWord.Visible = $false
    $analyticsWord.DisplayAlerts = 0
    $analyticsOpenDoc = $analyticsWord.Documents.Open($analyticsDoc, $false, $true)
    $analyticsOpenDoc.Repaginate()
    $analyticsOpenDoc.ExportAsFixedFormat($analyticsPdf, 17)
    Write-Output "Word rendered pages: $($analyticsOpenDoc.ComputeStatistics(2))"
    Write-Output $analyticsPdf
} finally {
    if ($null -ne $analyticsOpenDoc) { $analyticsOpenDoc.Close(0) }
    if ($null -ne $analyticsWord) { $analyticsWord.Quit(0) }
}
