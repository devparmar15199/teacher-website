# Fix API paths in service files by removing /api prefix
$servicesPath = "src\services"
$files = Get-ChildItem -Path $servicesPath -Filter "*.js" -Exclude "api.js"

$count = 0
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    # Replace all instances of '/api/ in api calls
    $content = $content -replace "api\.get\('/api/", "api.get('/"
    $content = $content -replace "api\.post\('/api/", "api.post('/"
    $content = $content -replace "api\.put\('/api/", "api.put('/"
    $content = $content -replace "api\.delete\('/api/", "api.delete('/"
    $content = $content -replace "api\.patch\('/api/", "api.patch('/"
    $content = $content -replace 'api\.get\("/api/', 'api.get("/'
    $content = $content -replace 'api\.post\("/api/', 'api.post("/'
    $content = $content -replace 'api\.put\("/api/', 'api.put("/'
    $content = $content -replace 'api\.delete\("/api/', 'api.delete("/'
    $content = $content -replace 'api\.patch\("/api/', 'api.patch("/'
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline -Encoding UTF8
        Write-Host "Fixed: $($file.Name)" -ForegroundColor Green
        $count++
    } else {
        Write-Host "No changes: $($file.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! Fixed $count out of $($files.Count) files." -ForegroundColor Cyan
