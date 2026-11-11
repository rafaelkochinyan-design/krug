---
description: "[Windows / PowerShell only] Show token usage report  daily, monthly, or with per-agent breakdown. Requires usage-report.ps1 in ~/.claude/scripts/."
---

> **Windows / PowerShell only.** This command shells out to a PowerShell script at `$env:USERPROFILE\.claude\scripts\usage-report.ps1`. On macOS or Linux, this command does nothing useful  remove it from the project after copying the template, or replace the script with a cross-platform equivalent.

Run the usage report script. Parse `$ARGUMENTS` to determine which mode:

**Default (no args):** Today's usage
```powershell
& "$env:USERPROFILE\.claude\scripts\usage-report.ps1" -Detailed
```

**"monthly" or "month":** Current month with daily breakdown and quota remaining
```powershell
& "$env:USERPROFILE\.claude\scripts\usage-report.ps1" -Monthly -Detailed
```

**A date like "2026-05-05":** That specific day
```powershell
& "$env:USERPROFILE\.claude\scripts\usage-report.ps1" -Date "2026-05-05" -Detailed
```

**"json":** JSON output for programmatic use
```powershell
& "$env:USERPROFILE\.claude\scripts\usage-report.ps1" -Monthly -Json
```

**"set limit N":** Update the monthly token limit
```powershell
'{"MonthlyTokenLimit": N}' | Out-File "$env:USERPROFILE\.claude\scripts\usage-config.json" -Encoding utf8
```

Run via PowerShell tool. Show the output directly to the user -- do not summarize or reformat it.
