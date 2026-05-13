# Renders the welcome email via the dev server's preview endpoint,
# wraps it as a proper .eml message, and opens it in Outlook.
# Outlook treats .eml files as received messages — full fidelity preview
# with subject, from, to, date, and HTML body, but nothing is actually sent.

param(
  [string]$FirstName    = "Lars",
  [string]$Company      = "LB Consulting Group",
  [string]$TrialEndDate = (Get-Date).AddDays(30).ToString("yyyy-MM-dd"),
  [string]$ToEmail      = "lars.broden@lbconsultinggroup.org",
  [string]$ToName       = "Lars Broden",
  [string]$FromEmail    = "lars.broden@lbconsultinggroup.org",
  [string]$FromName     = "Bulk Clone team"
)

$encFirst   = [uri]::EscapeDataString($FirstName)
$encCompany = [uri]::EscapeDataString($Company)
$encEnd     = [uri]::EscapeDataString($TrialEndDate)
$base       = "http://localhost:3000/api/debug/preview-template"
$url        = "$base`?firstName=$encFirst&company=$encCompany&trialEndDate=$encEnd"

Write-Host "Fetching rendered email from $url"
$html = Invoke-WebRequest -Uri $url -UseBasicParsing | Select-Object -ExpandProperty Content
$text = Invoke-WebRequest -Uri "$url&format=text" -UseBasicParsing | Select-Object -ExpandProperty Content

$subject  = "Welcome to Bulk Clone Professional - getting the most from your trial"
$boundary = "----=_BulkClonePreview_$(Get-Random)"
$date     = (Get-Date).ToUniversalTime().ToString("ddd, dd MMM yyyy HH:mm:ss") + " +0000"

$eml = @"
From: "$FromName" <$FromEmail>
To: "$ToName" <$ToEmail>
Subject: $subject
Date: $date
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="$boundary"
X-Mailer: bulk-clone-trial-mailer/preview

--$boundary
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: 8bit

$text

--$boundary
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: 8bit

$html

--$boundary--
"@

$outPath = Join-Path $env:TEMP "bulk-clone-welcome-preview.eml"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outPath, $eml, $utf8NoBom)

Write-Host "Wrote $outPath"
Write-Host "Opening in default .eml handler (Outlook on Windows)..."
Start-Process $outPath
