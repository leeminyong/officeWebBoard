$raw = [System.Console]::In.ReadToEnd()
try {
    $data = $raw | ConvertFrom-Json
    $fp = $data.tool_input.file_path
    if ($fp -and $fp -match 'CLAUDE\.md$') {
        Copy-Item 'D:\officeWebBoard\CLAUDE.md' 'D:\officeWebBoard\AGENTS.md' -Force
    }
} catch {}
