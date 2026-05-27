# Sends the day-1 (or day-9) welcome email to yourself by opening it as a
# fully-populated compose window in your existing Outlook desktop client.
# You click "Send" — the email lands in your inbox so you can see exactly
# what a real trial customer would receive.
#
# No Azure / Graph / Marketplace credentials needed for this path. The
# email is sent from whatever account Outlook is currently signed in as
# (typically lars.broden@lbconsultinggroup.org).
#
# Requires:
#   - dev server running at http://localhost:3000 (npm run dev)
#   - Outlook desktop installed and signed in
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\send-self-test-email.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\send-self-test-email.ps1 -Template day9
#   powershell -ExecutionPolicy Bypass -File scripts\send-self-test-email.ps1 -Mode Send  # auto-send (may trigger Outlook security prompt)

param(
  [ValidateSet("day1", "day9")]
  [string]$Template = "day1",

  [string]$ToEmail = "lars.broden@lbconsultinggroup.org",

  # The Outlook account (by SMTP address) to send FROM. If unset, Outlook
  # uses its default account, which is often not the one you want when you
  # have multiple mail accounts configured.
  [string]$FromEmail = "lars.broden@lbconsultinggroup.org",

  [ValidateSet("Display", "Send")]
  [string]$Mode = "Display"
)

$subject = if ($Template -eq "day9") {
  "Day 9 - How is your Bulk Clone Professional trial going?"
} else {
  "Welcome to Bulk Clone Professional for Jira Cloud"
}

$url = "http://localhost:3000/api/debug/preview-template?template=$Template"
Write-Host "Fetching $Template HTML from $url"

try {
  $html = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop | Select-Object -ExpandProperty Content
} catch {
  Write-Host "ERROR: could not reach $url"
  Write-Host "Is the dev server running? (npm run dev in the project root)"
  exit 1
}

Write-Host "Got $($html.Length) bytes of HTML. Opening in Outlook..."

try {
  $Outlook = New-Object -ComObject Outlook.Application -ErrorAction Stop
} catch {
  Write-Host "ERROR: could not start Outlook via COM. Is Outlook desktop installed and signed in?"
  exit 1
}

$Mail = $Outlook.CreateItem(0)  # 0 = olMailItem
$Mail.To       = $ToEmail
$Mail.Subject  = "[SELF-TEST] $subject"
$Mail.HTMLBody = $html

# Select the correct sending account by SMTP address. Outlook's COM API
# defaults to the profile's default account, which may not be the one you
# want when multiple accounts are configured.
$accounts = $Outlook.Session.Accounts
$targetAccount = $null
$availableAddresses = @()
for ($i = 1; $i -le $accounts.Count; $i++) {
  $acct = $accounts.Item($i)
  $availableAddresses += $acct.SmtpAddress
  if ($acct.SmtpAddress -ieq $FromEmail) {
    $targetAccount = $acct
    break
  }
}

if ($null -eq $targetAccount) {
  Write-Host "WARNING: No Outlook account found for '$FromEmail'."
  Write-Host "Available accounts: $($availableAddresses -join ', ')"
  Write-Host "Email will be sent from Outlook's default account."
} else {
  Write-Host "Setting sending account to: $($targetAccount.SmtpAddress)"
  # PowerShell can't set SendUsingAccount via direct assignment because of
  # how COM type binding works for this specific _Account property; use
  # reflection InvokeMember to set it.
  $Mail.GetType().InvokeMember(
    "SendUsingAccount",
    [System.Reflection.BindingFlags]::SetProperty,
    $null,
    $Mail,
    @($targetAccount)
  ) | Out-Null
}

if ($Mode -eq "Send") {
  Write-Host "Calling Send() - may trigger an Outlook security prompt..."
  $Mail.Send()
  Write-Host "Sent. Check your inbox for: $ToEmail"
} else {
  Write-Host "Opening compose window. Click 'Send' in Outlook to deliver to: $ToEmail"
  $Mail.Display()
}
